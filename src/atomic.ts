/**
 * Atomic Operations for Redis
 *
 * This module provides Lua scripts for atomic read-modify-write operations
 * in Redis, preventing TOCTOU (Time-of-Check to Time-of-Use) race conditions.
 *
 * Problem: Non-atomic view counting
 * ```
 * // VULNERABLE: Race condition between read and write
 * const secret = await redis.get(key);        // Thread A reads: views = 2
 * secret.viewsRemaining--;                     // Thread B reads: views = 2 (same!)
 * await redis.set(key, secret);               // Both decrement to 1, not 0
 * ```
 *
 * Solution: Lua script executes atomically in Redis
 * ```
 * // SAFE: Entire operation is atomic
 * const result = await redis.eval(DECREMENT_SCRIPT, [key], []);
 * ```
 */

import { InvalidResultError } from "./errors";

/**
 * Lua script for atomic decrement-and-get operation.
 *
 * This script:
 * 1. Gets the current data
 * 2. Validates viewsRemaining is a number
 * 3. Decrements the view counter
 * 4. Deletes if exhausted, or updates with preserved TTL
 * 5. Returns the result - all in a single atomic operation
 *
 * @example
 * ```typescript
 * import { Redis } from "@upstash/redis";
 *
 * const redis = new Redis({ url: "...", token: "..." });
 *
 * const result = await redis.eval(
 *   ATOMIC_DECREMENT_SCRIPT,
 *   ["secret:abc123"],
 *   []
 * );
 *
 * if (!result) {
 *   // Secret not found or expired
 * } else if (typeof result === "object") {
 *   // Upstash returns parsed object
 *   const { secret, burned } = result;
 * } else {
 *   // Raw JSON string
 *   const { secret, burned } = JSON.parse(result);
 * }
 * ```
 */
export const ATOMIC_DECREMENT_SCRIPT = `
local key = KEYS[1]
local data = redis.call('GET', key)
if not data then
  return nil
end

local ok, secret = pcall(cjson.decode, data)
if not ok then
  return cjson.encode({error = "invalid_json"})
end

if type(secret.viewsRemaining) ~= "number" then
  return cjson.encode({error = "invalid_viewsRemaining_type"})
end

secret.viewsRemaining = secret.viewsRemaining - 1

if secret.viewsRemaining <= 0 then
  redis.call('DEL', key)
  secret.viewsRemaining = 0
  return cjson.encode({secret = secret, burned = true})
else
  local ttl = redis.call('TTL', key)
  if ttl > 0 then
    redis.call('SET', key, cjson.encode(secret), 'EX', ttl)
  else
    redis.call('SET', key, cjson.encode(secret))
  end
  return cjson.encode({secret = secret, burned = false})
end
`;

/**
 * Lua script for atomic increment with maximum limit.
 *
 * Useful for rate limiting - increments a counter but fails if limit reached.
 *
 * @example
 * ```typescript
 * const result = await redis.eval(
 *   ATOMIC_INCREMENT_WITH_LIMIT_SCRIPT,
 *   ["ratelimit:192.168.1.1"],
 *   [10, 60] // max 10, expires in 60 seconds
 * );
 * // Returns current count, or -1 if limit exceeded
 * ```
 */
export const ATOMIC_INCREMENT_WITH_LIMIT_SCRIPT = `
local key = KEYS[1]
local max_count = tonumber(ARGV[1])
local expire_seconds = tonumber(ARGV[2])

if not max_count or not expire_seconds then
  return cjson.encode({error = "missing_arguments"})
end

if max_count <= 0 or expire_seconds <= 0 then
  return cjson.encode({error = "invalid_arguments"})
end

local current = redis.call('GET', key)
if current and tonumber(current) >= max_count then
  return -1
end

local new_count = redis.call('INCR', key)
if new_count == 1 then
  redis.call('EXPIRE', key, expire_seconds)
end

return new_count
`;

/**
 * Helper type for the decrement script result
 */
export interface DecrementResult<T> {
  secret: T;
  burned: boolean;
}

/**
 * Error response from Lua scripts
 */
export interface LuaScriptError {
  error: string;
}

/**
 * Type guard to validate DecrementResult structure
 */
function isDecrementResult<T>(value: unknown): value is DecrementResult<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "secret" in value &&
    "burned" in value &&
    typeof (value as DecrementResult<T>).burned === "boolean"
  );
}

/**
 * Type guard to check if result is a Lua script error
 */
function isLuaScriptError(value: unknown): value is LuaScriptError {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as LuaScriptError).error === "string"
  );
}

/**
 * Parse the result from ATOMIC_DECREMENT_SCRIPT
 *
 * Handles both string and pre-parsed object responses
 * (Upstash REST API may return either depending on version)
 *
 * @throws {InvalidResultError} If the result has an unexpected structure
 * @throws {InvalidResultError} If the Lua script returned an error response
 */
export function parseDecrementResult<T>(
  result: unknown
): DecrementResult<T> | null {
  if (result === null || result === undefined) {
    return null;
  }

  let parsed: unknown;

  if (typeof result === "string") {
    try {
      parsed = JSON.parse(result);
    } catch {
      throw new InvalidResultError(
        "Invalid decrement result: failed to parse JSON string"
      );
    }
  } else {
    parsed = result;
  }

  // Check for Lua script error responses
  if (isLuaScriptError(parsed)) {
    throw new InvalidResultError(
      `Lua script error: ${parsed.error}`
    );
  }

  if (!isDecrementResult<T>(parsed)) {
    throw new InvalidResultError(
      "Invalid decrement result: missing required 'secret' or 'burned' properties"
    );
  }

  return parsed;
}

/**
 * Parse the result from ATOMIC_INCREMENT_WITH_LIMIT_SCRIPT
 *
 * @returns The new count, or -1 if limit exceeded, or null for error responses
 * @throws {InvalidResultError} If the Lua script returned an error response
 */
export function parseIncrementResult(result: unknown): number | null {
  if (result === null || result === undefined) {
    return null;
  }

  // Handle numeric results (success case)
  if (typeof result === "number") {
    return result;
  }

  // Handle string results that might be JSON error objects or numeric strings
  if (typeof result === "string") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(result);
    } catch {
      // Not JSON, might be a numeric string
      const num = parseInt(result, 10);
      if (!isNaN(num)) {
        return num;
      }
      throw new InvalidResultError(
        "Invalid increment result: expected number or JSON"
      );
    }

    // JSON parsed successfully - check what we got
    if (typeof parsed === "number") {
      return parsed;
    }

    if (isLuaScriptError(parsed)) {
      throw new InvalidResultError(`Lua script error: ${parsed.error}`);
    }

    throw new InvalidResultError(
      "Invalid increment result: expected number or error object"
    );
  }

  // Handle object results (error case)
  if (isLuaScriptError(result)) {
    throw new InvalidResultError(`Lua script error: ${result.error}`);
  }

  throw new InvalidResultError(
    "Invalid increment result: unexpected result type"
  );
}
