import { describe, it, expect } from "vitest";
import {
  ATOMIC_DECREMENT_SCRIPT,
  ATOMIC_INCREMENT_WITH_LIMIT_SCRIPT,
  parseDecrementResult,
  parseIncrementResult,
  type DecrementResult,
} from "./atomic";
import { InvalidResultError } from "./errors";

interface TestSecret {
  id: string;
  content: string;
  viewsRemaining: number;
}

describe("parseDecrementResult", () => {
  describe("valid inputs", () => {
    it("parses a valid object result", () => {
      const input: DecrementResult<TestSecret> = {
        secret: {
          id: "abc123",
          content: "encrypted-data",
          viewsRemaining: 2,
        },
        burned: false,
      };

      const result = parseDecrementResult<TestSecret>(input);

      expect(result).not.toBeNull();
      expect(result?.secret.id).toBe("abc123");
      expect(result?.secret.viewsRemaining).toBe(2);
      expect(result?.burned).toBe(false);
    });

    it("parses a valid JSON string result", () => {
      const input = JSON.stringify({
        secret: {
          id: "abc123",
          content: "encrypted-data",
          viewsRemaining: 0,
        },
        burned: true,
      });

      const result = parseDecrementResult<TestSecret>(input);

      expect(result).not.toBeNull();
      expect(result?.secret.id).toBe("abc123");
      expect(result?.secret.viewsRemaining).toBe(0);
      expect(result?.burned).toBe(true);
    });

    it("handles burned=true correctly", () => {
      const input = {
        secret: { id: "test", content: "data", viewsRemaining: 0 },
        burned: true,
      };

      const result = parseDecrementResult<TestSecret>(input);

      expect(result?.burned).toBe(true);
    });

    it("handles burned=false correctly", () => {
      const input = {
        secret: { id: "test", content: "data", viewsRemaining: 5 },
        burned: false,
      };

      const result = parseDecrementResult<TestSecret>(input);

      expect(result?.burned).toBe(false);
    });
  });

  describe("null/undefined handling", () => {
    it("returns null for null input", () => {
      const result = parseDecrementResult(null);
      expect(result).toBeNull();
    });

    it("returns null for undefined input", () => {
      const result = parseDecrementResult(undefined);
      expect(result).toBeNull();
    });
  });

  describe("invalid inputs", () => {
    it("throws InvalidResultError on invalid JSON string", () => {
      expect(() => parseDecrementResult("not valid json")).toThrow(InvalidResultError);
      expect(() => parseDecrementResult("not valid json")).toThrow(
        "Invalid decrement result: failed to parse JSON string"
      );
    });

    it("throws InvalidResultError on malformed JSON", () => {
      expect(() => parseDecrementResult("{invalid}")).toThrow(InvalidResultError);
      expect(() => parseDecrementResult("{invalid}")).toThrow(
        "Invalid decrement result: failed to parse JSON string"
      );
    });

    it("throws InvalidResultError when secret property is missing", () => {
      const input = { burned: true };

      expect(() => parseDecrementResult(input)).toThrow(InvalidResultError);
      expect(() => parseDecrementResult(input)).toThrow(
        "Invalid decrement result: missing required 'secret' or 'burned' properties"
      );
    });

    it("throws InvalidResultError when burned property is missing", () => {
      const input = { secret: { id: "test" } };

      expect(() => parseDecrementResult(input)).toThrow(InvalidResultError);
      expect(() => parseDecrementResult(input)).toThrow(
        "Invalid decrement result: missing required 'secret' or 'burned' properties"
      );
    });

    it("throws InvalidResultError when burned is not a boolean", () => {
      const input = {
        secret: { id: "test" },
        burned: "true", // string instead of boolean
      };

      expect(() => parseDecrementResult(input)).toThrow(InvalidResultError);
      expect(() => parseDecrementResult(input)).toThrow(
        "Invalid decrement result: missing required 'secret' or 'burned' properties"
      );
    });

    it("throws InvalidResultError when burned is a number", () => {
      const input = {
        secret: { id: "test" },
        burned: 1,
      };

      expect(() => parseDecrementResult(input)).toThrow(InvalidResultError);
      expect(() => parseDecrementResult(input)).toThrow(
        "Invalid decrement result: missing required 'secret' or 'burned' properties"
      );
    });

    it("throws InvalidResultError for empty object", () => {
      expect(() => parseDecrementResult({})).toThrow(InvalidResultError);
      expect(() => parseDecrementResult({})).toThrow(
        "Invalid decrement result: missing required 'secret' or 'burned' properties"
      );
    });

    it("throws InvalidResultError for array input", () => {
      expect(() => parseDecrementResult([1, 2, 3])).toThrow(InvalidResultError);
      expect(() => parseDecrementResult([1, 2, 3])).toThrow(
        "Invalid decrement result: missing required 'secret' or 'burned' properties"
      );
    });

    it("throws InvalidResultError for number input", () => {
      expect(() => parseDecrementResult(42)).toThrow(InvalidResultError);
      expect(() => parseDecrementResult(42)).toThrow(
        "Invalid decrement result: missing required 'secret' or 'burned' properties"
      );
    });

    it("throws InvalidResultError for boolean input", () => {
      expect(() => parseDecrementResult(true)).toThrow(InvalidResultError);
      expect(() => parseDecrementResult(true)).toThrow(
        "Invalid decrement result: missing required 'secret' or 'burned' properties"
      );
    });
  });

  describe("Lua script error handling", () => {
    it("throws InvalidResultError for invalid_json error", () => {
      const input = { error: "invalid_json" };

      expect(() => parseDecrementResult(input)).toThrow(InvalidResultError);
      expect(() => parseDecrementResult(input)).toThrow("Lua script error: invalid_json");
    });

    it("throws InvalidResultError for invalid_viewsRemaining_type error", () => {
      const input = { error: "invalid_viewsRemaining_type" };

      expect(() => parseDecrementResult(input)).toThrow(InvalidResultError);
      expect(() => parseDecrementResult(input)).toThrow("Lua script error: invalid_viewsRemaining_type");
    });

    it("throws InvalidResultError for JSON string error response", () => {
      const input = JSON.stringify({ error: "invalid_json" });

      expect(() => parseDecrementResult(input)).toThrow(InvalidResultError);
      expect(() => parseDecrementResult(input)).toThrow("Lua script error: invalid_json");
    });
  });

  describe("edge cases", () => {
    it("handles secret with extra properties", () => {
      const input = {
        secret: {
          id: "test",
          content: "data",
          viewsRemaining: 1,
          extraField: "ignored",
        },
        burned: false,
      };

      const result = parseDecrementResult<TestSecret & { extraField: string }>(
        input
      );

      expect(result?.secret.extraField).toBe("ignored");
    });

    it("handles result with extra top-level properties", () => {
      const input = {
        secret: { id: "test" },
        burned: false,
        extraTopLevel: "also ok",
      };

      const result = parseDecrementResult(input);
      expect(result).not.toBeNull();
    });

    it("handles deeply nested secret objects", () => {
      interface NestedSecret {
        data: {
          nested: {
            value: string;
          };
        };
      }

      const input = {
        secret: {
          data: {
            nested: {
              value: "deep",
            },
          },
        },
        burned: false,
      };

      const result = parseDecrementResult<NestedSecret>(input);

      expect(result?.secret.data.nested.value).toBe("deep");
    });

    it("handles JSON string with whitespace", () => {
      const input = `
        {
          "secret": { "id": "test" },
          "burned": true
        }
      `;

      const result = parseDecrementResult(input);
      expect(result?.burned).toBe(true);
    });
  });
});

describe("parseIncrementResult", () => {
  describe("valid inputs", () => {
    it("returns number for numeric result", () => {
      expect(parseIncrementResult(1)).toBe(1);
      expect(parseIncrementResult(5)).toBe(5);
      expect(parseIncrementResult(100)).toBe(100);
    });

    it("returns -1 for limit exceeded", () => {
      expect(parseIncrementResult(-1)).toBe(-1);
    });

    it("returns null for null input", () => {
      expect(parseIncrementResult(null)).toBeNull();
    });

    it("returns null for undefined input", () => {
      expect(parseIncrementResult(undefined)).toBeNull();
    });

    it("parses numeric string", () => {
      expect(parseIncrementResult("5")).toBe(5);
      expect(parseIncrementResult("-1")).toBe(-1);
    });
  });

  describe("Lua script error handling", () => {
    it("throws InvalidResultError for missing_arguments error", () => {
      const input = { error: "missing_arguments" };

      expect(() => parseIncrementResult(input)).toThrow(InvalidResultError);
      expect(() => parseIncrementResult(input)).toThrow("Lua script error: missing_arguments");
    });

    it("throws InvalidResultError for invalid_arguments error", () => {
      const input = { error: "invalid_arguments" };

      expect(() => parseIncrementResult(input)).toThrow(InvalidResultError);
      expect(() => parseIncrementResult(input)).toThrow("Lua script error: invalid_arguments");
    });

    it("throws InvalidResultError for JSON string error response", () => {
      const input = JSON.stringify({ error: "missing_arguments" });

      expect(() => parseIncrementResult(input)).toThrow(InvalidResultError);
      expect(() => parseIncrementResult(input)).toThrow("Lua script error: missing_arguments");
    });
  });

  describe("invalid inputs", () => {
    it("throws InvalidResultError for non-numeric string", () => {
      expect(() => parseIncrementResult("not a number")).toThrow(InvalidResultError);
    });
  });
});

describe("Lua scripts", () => {
  describe("ATOMIC_DECREMENT_SCRIPT", () => {
    it("is a non-empty string", () => {
      expect(typeof ATOMIC_DECREMENT_SCRIPT).toBe("string");
      expect(ATOMIC_DECREMENT_SCRIPT.length).toBeGreaterThan(0);
    });

    it("contains expected Redis commands", () => {
      expect(ATOMIC_DECREMENT_SCRIPT).toContain("redis.call('GET'");
      expect(ATOMIC_DECREMENT_SCRIPT).toContain("redis.call('DEL'");
      expect(ATOMIC_DECREMENT_SCRIPT).toContain("redis.call('SET'");
      expect(ATOMIC_DECREMENT_SCRIPT).toContain("redis.call('TTL'");
    });

    it("contains viewsRemaining decrement logic", () => {
      expect(ATOMIC_DECREMENT_SCRIPT).toContain("viewsRemaining");
      expect(ATOMIC_DECREMENT_SCRIPT).toContain("- 1");
    });

    it("contains burn logic", () => {
      expect(ATOMIC_DECREMENT_SCRIPT).toContain("burned = true");
      expect(ATOMIC_DECREMENT_SCRIPT).toContain("burned = false");
    });

    it("uses KEYS[1] for the key parameter", () => {
      expect(ATOMIC_DECREMENT_SCRIPT).toContain("KEYS[1]");
    });

    it("preserves TTL when updating", () => {
      expect(ATOMIC_DECREMENT_SCRIPT).toContain("'EX', ttl");
    });

    it("validates viewsRemaining type", () => {
      expect(ATOMIC_DECREMENT_SCRIPT).toContain("type(secret.viewsRemaining)");
      expect(ATOMIC_DECREMENT_SCRIPT).toContain("~= \"number\"");
      expect(ATOMIC_DECREMENT_SCRIPT).toContain("invalid_viewsRemaining_type");
    });

    it("uses pcall for safe JSON decoding", () => {
      expect(ATOMIC_DECREMENT_SCRIPT).toContain("pcall(cjson.decode");
      expect(ATOMIC_DECREMENT_SCRIPT).toContain("invalid_json");
    });
  });

  describe("ATOMIC_INCREMENT_WITH_LIMIT_SCRIPT", () => {
    it("is a non-empty string", () => {
      expect(typeof ATOMIC_INCREMENT_WITH_LIMIT_SCRIPT).toBe("string");
      expect(ATOMIC_INCREMENT_WITH_LIMIT_SCRIPT.length).toBeGreaterThan(0);
    });

    it("contains expected Redis commands", () => {
      expect(ATOMIC_INCREMENT_WITH_LIMIT_SCRIPT).toContain("redis.call('GET'");
      expect(ATOMIC_INCREMENT_WITH_LIMIT_SCRIPT).toContain("redis.call('INCR'");
      expect(ATOMIC_INCREMENT_WITH_LIMIT_SCRIPT).toContain(
        "redis.call('EXPIRE'"
      );
    });

    it("uses KEYS[1] for the key parameter", () => {
      expect(ATOMIC_INCREMENT_WITH_LIMIT_SCRIPT).toContain("KEYS[1]");
    });

    it("uses ARGV[1] for max_count", () => {
      expect(ATOMIC_INCREMENT_WITH_LIMIT_SCRIPT).toContain("ARGV[1]");
      expect(ATOMIC_INCREMENT_WITH_LIMIT_SCRIPT).toContain("max_count");
    });

    it("uses ARGV[2] for expire_seconds", () => {
      expect(ATOMIC_INCREMENT_WITH_LIMIT_SCRIPT).toContain("ARGV[2]");
      expect(ATOMIC_INCREMENT_WITH_LIMIT_SCRIPT).toContain("expire_seconds");
    });

    it("returns -1 when limit exceeded", () => {
      expect(ATOMIC_INCREMENT_WITH_LIMIT_SCRIPT).toContain("return -1");
    });

    it("sets expiry only on first increment", () => {
      expect(ATOMIC_INCREMENT_WITH_LIMIT_SCRIPT).toContain("new_count == 1");
    });

    it("validates arguments are present", () => {
      expect(ATOMIC_INCREMENT_WITH_LIMIT_SCRIPT).toContain("not max_count");
      expect(ATOMIC_INCREMENT_WITH_LIMIT_SCRIPT).toContain("not expire_seconds");
      expect(ATOMIC_INCREMENT_WITH_LIMIT_SCRIPT).toContain("missing_arguments");
    });

    it("validates arguments are positive", () => {
      expect(ATOMIC_INCREMENT_WITH_LIMIT_SCRIPT).toContain("max_count <= 0");
      expect(ATOMIC_INCREMENT_WITH_LIMIT_SCRIPT).toContain("expire_seconds <= 0");
      expect(ATOMIC_INCREMENT_WITH_LIMIT_SCRIPT).toContain("invalid_arguments");
    });
  });
});
