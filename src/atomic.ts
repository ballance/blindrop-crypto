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

/**
 * Lua script for atomic decrement-and-get operation.
 *
 * This script:
 * 1. Gets the current data
 * 2. Decrements the view counter
 * 3. Deletes if exhausted, or updates with preserved TTL
 * 4. Returns the result - all in a single atomic operation
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

local secret = cjson.decode(data)
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
 * Parse the result from ATOMIC_DECREMENT_SCRIPT
 *
 * Handles both string and pre-parsed object responses
 * (Upstash REST API may return either depending on version)
 */
export function parseDecrementResult<T>(
  result: unknown
): DecrementResult<T> | null {
  if (!result) {
    return null;
  }

  if (typeof result === "object") {
    return result as DecrementResult<T>;
  }

  return JSON.parse(result as string) as DecrementResult<T>;
}
