import { describe, it, expect } from "vitest";
import { test as fcTest } from "@fast-check/vitest";
import fc from "fast-check";
import {
  generateKey,
  encrypt,
  decrypt,
  keyToBase64,
  base64ToKey,
  MAX_PLAINTEXT_BYTES,
} from "./crypto";
import {
  InvalidKeyError,
  InvalidBase64Error,
  InvalidIVError,
  DecryptionError,
  PayloadTooLargeError,
} from "./errors";

describe("generateKey", () => {
  it("generates a valid CryptoKey", async () => {
    const key = await generateKey();

    expect(key).toBeDefined();
    expect(key.type).toBe("secret");
    expect(key.algorithm.name).toBe("AES-GCM");
    expect((key.algorithm as AesKeyAlgorithm).length).toBe(256);
    expect(key.extractable).toBe(true);
    expect(key.usages).toContain("encrypt");
    expect(key.usages).toContain("decrypt");
  });

  it("generates unique keys each time", async () => {
    const key1 = await generateKey();
    const key2 = await generateKey();

    const key1Base64 = await keyToBase64(key1);
    const key2Base64 = await keyToBase64(key2);

    expect(key1Base64).not.toBe(key2Base64);
  });
});

describe("encrypt and decrypt", () => {
  it("encrypts and decrypts a simple string", async () => {
    const key = await generateKey();
    const plaintext = "my secret password";

    const { ciphertext, iv } = await encrypt(plaintext, key);
    const decrypted = await decrypt(ciphertext, iv, key);

    expect(decrypted).toBe(plaintext);
  });

  it("encrypts and decrypts an empty string", async () => {
    const key = await generateKey();
    const plaintext = "";

    const { ciphertext, iv } = await encrypt(plaintext, key);
    const decrypted = await decrypt(ciphertext, iv, key);

    expect(decrypted).toBe(plaintext);
  });

  it("encrypts and decrypts unicode characters", async () => {
    const key = await generateKey();
    const plaintext = "Hello 世界 🔐 émojis café";

    const { ciphertext, iv } = await encrypt(plaintext, key);
    const decrypted = await decrypt(ciphertext, iv, key);

    expect(decrypted).toBe(plaintext);
  });

  it("encrypts and decrypts a long string", async () => {
    const key = await generateKey();
    const plaintext = "a".repeat(10000);

    const { ciphertext, iv } = await encrypt(plaintext, key);
    const decrypted = await decrypt(ciphertext, iv, key);

    expect(decrypted).toBe(plaintext);
  });

  it("generates unique IV for each encryption", async () => {
    const key = await generateKey();
    const plaintext = "same message";

    const result1 = await encrypt(plaintext, key);
    const result2 = await encrypt(plaintext, key);

    expect(result1.iv).not.toBe(result2.iv);
    expect(result1.ciphertext).not.toBe(result2.ciphertext);
  });

  it("fails to decrypt with wrong key", async () => {
    const key1 = await generateKey();
    const key2 = await generateKey();
    const plaintext = "secret";

    const { ciphertext, iv } = await encrypt(plaintext, key1);

    await expect(decrypt(ciphertext, iv, key2)).rejects.toThrow(DecryptionError);
  });

  it("fails to decrypt with tampered ciphertext", async () => {
    const key = await generateKey();
    const plaintext = "secret";

    const { ciphertext, iv } = await encrypt(plaintext, key);

    // Tamper with ciphertext
    const tamperedCiphertext = "A" + ciphertext.slice(1);

    await expect(decrypt(tamperedCiphertext, iv, key)).rejects.toThrow(DecryptionError);
  });

  it("fails to decrypt with wrong IV", async () => {
    const key = await generateKey();
    const plaintext = "secret";

    const { ciphertext } = await encrypt(plaintext, key);
    const { iv: wrongIv } = await encrypt("other", key);

    await expect(decrypt(ciphertext, wrongIv, key)).rejects.toThrow(DecryptionError);
  });
});

describe("encrypt version field", () => {
  it("includes version 1 in encrypted data", async () => {
    const key = await generateKey();
    const result = await encrypt("test", key);

    expect(result.version).toBe(1);
  });

  it("always returns version 1", async () => {
    const key = await generateKey();

    for (let i = 0; i < 5; i++) {
      const result = await encrypt(`message ${i}`, key);
      expect(result.version).toBe(1);
    }
  });
});

describe("encrypt max payload validation", () => {
  it("exports MAX_PLAINTEXT_BYTES constant", () => {
    expect(MAX_PLAINTEXT_BYTES).toBe(1024 * 1024);
  });

  it("rejects payload exceeding default max size", async () => {
    const key = await generateKey();
    const largePayload = "x".repeat(MAX_PLAINTEXT_BYTES + 1);

    await expect(encrypt(largePayload, key)).rejects.toThrow(PayloadTooLargeError);
    await expect(encrypt(largePayload, key)).rejects.toThrow(/exceeds maximum size/);
  });

  it("accepts payload at exactly max size", async () => {
    const key = await generateKey();
    // Use a smaller custom max for faster test
    const maxBytes = 1000;
    const exactPayload = "x".repeat(maxBytes);

    const result = await encrypt(exactPayload, key, { maxBytes });
    expect(result.ciphertext).toBeDefined();
  });

  it("allows custom max size via options", async () => {
    const key = await generateKey();
    const smallMax = 100;
    const payload = "x".repeat(101);

    await expect(encrypt(payload, key, { maxBytes: smallMax })).rejects.toThrow(
      PayloadTooLargeError
    );
  });

  it("accepts payload under custom max size", async () => {
    const key = await generateKey();
    const payload = "x".repeat(50);

    const result = await encrypt(payload, key, { maxBytes: 100 });
    expect(result.ciphertext).toBeDefined();
  });
});

describe("keyToBase64 and base64ToKey", () => {
  it("exports and imports a key correctly", async () => {
    const originalKey = await generateKey();
    const plaintext = "test message";

    const { ciphertext, iv } = await encrypt(plaintext, originalKey);

    const keyBase64 = await keyToBase64(originalKey);
    const importedKey = await base64ToKey(keyBase64);

    const decrypted = await decrypt(ciphertext, iv, importedKey);
    expect(decrypted).toBe(plaintext);
  });

  it("produces URL-safe base64 output", async () => {
    // Generate multiple keys to increase chance of hitting +, /, or =
    for (let i = 0; i < 20; i++) {
      const key = await generateKey();
      const base64 = await keyToBase64(key);

      expect(base64).not.toContain("+");
      expect(base64).not.toContain("/");
      expect(base64).not.toContain("=");
      // Should only contain base64url characters
      expect(base64).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("produces consistent key length", async () => {
    const key = await generateKey();
    const base64 = await keyToBase64(key);

    // 32 bytes = 256 bits, base64url encoded without padding
    // 32 bytes * 8 bits / 6 bits per char = 42.67, rounds to 43 chars
    expect(base64.length).toBe(43);
  });
});

describe("base64ToKey validation", () => {
  it("rejects empty string with InvalidKeyError", async () => {
    await expect(base64ToKey("")).rejects.toThrow(InvalidKeyError);
    await expect(base64ToKey("")).rejects.toThrow("Invalid key: expected non-empty string");
  });

  it("rejects null/undefined with InvalidKeyError", async () => {
    await expect(base64ToKey(null as unknown as string)).rejects.toThrow(InvalidKeyError);
    await expect(base64ToKey(undefined as unknown as string)).rejects.toThrow(InvalidKeyError);
  });

  it("rejects invalid base64 characters with InvalidBase64Error", async () => {
    await expect(base64ToKey("invalid!@#$%")).rejects.toThrow(InvalidBase64Error);
    await expect(base64ToKey("invalid!@#$%")).rejects.toThrow("Invalid base64 string");
  });

  it("rejects key with wrong length (too short) with InvalidKeyError", async () => {
    // 16 bytes instead of 32
    const shortKey = "AAAAAAAAAAAAAAAAAAAAAA"; // ~16 bytes

    await expect(base64ToKey(shortKey)).rejects.toThrow(InvalidKeyError);
    await expect(base64ToKey(shortKey)).rejects.toThrow("Invalid key length: expected 32 bytes");
  });

  it("rejects key with wrong length (too long) with InvalidKeyError", async () => {
    // 64 bytes instead of 32
    const longKey = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

    await expect(base64ToKey(longKey)).rejects.toThrow(InvalidKeyError);
    await expect(base64ToKey(longKey)).rejects.toThrow("Invalid key length: expected 32 bytes");
  });

  it("rejects base64 with invalid length (padding impossible) with InvalidBase64Error", async () => {
    // Length % 4 === 1 is invalid for base64
    await expect(base64ToKey("AAAAA")).rejects.toThrow(InvalidBase64Error);
    await expect(base64ToKey("AAAAA")).rejects.toThrow("Invalid base64 string: incorrect length");
  });
});

describe("decrypt validation", () => {
  it("rejects IV with wrong length with InvalidIVError", async () => {
    const key = await generateKey();
    const { ciphertext } = await encrypt("test", key);

    // 8 bytes instead of 12
    const shortIv = "AAAAAAAAAAA"; // ~8 bytes

    await expect(decrypt(ciphertext, shortIv, key)).rejects.toThrow(InvalidIVError);
    await expect(decrypt(ciphertext, shortIv, key)).rejects.toThrow("Invalid IV length: expected 12 bytes");
  });
});

describe("backwards compatibility", () => {
  it("decodes standard base64 with + and /", async () => {
    // This tests that base64UrlToBuffer handles standard base64
    // by converting + to - and / to _ internally
    const key = await generateKey();
    const keyBase64Url = await keyToBase64(key);

    // Convert to standard base64
    const keyStandardBase64 = keyBase64Url
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    // Should still work
    const importedKey = await base64ToKey(keyStandardBase64);
    expect(importedKey).toBeDefined();

    // Verify it's the same key by encrypting/decrypting
    const plaintext = "test";
    const { ciphertext, iv } = await encrypt(plaintext, key);
    const decrypted = await decrypt(ciphertext, iv, importedKey);
    expect(decrypted).toBe(plaintext);
  });
});

describe("encrypt output format", () => {
  it("produces URL-safe ciphertext and IV", async () => {
    const key = await generateKey();

    // Encrypt multiple times to increase variety
    for (let i = 0; i < 10; i++) {
      const { ciphertext, iv } = await encrypt(`message ${i}`, key);

      expect(ciphertext).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(iv).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(ciphertext).not.toContain("+");
      expect(ciphertext).not.toContain("/");
      expect(ciphertext).not.toContain("=");
    }
  });

  it("IV is always 16 characters (12 bytes base64url encoded)", async () => {
    const key = await generateKey();

    for (let i = 0; i < 10; i++) {
      const { iv } = await encrypt(`message ${i}`, key);
      // 12 bytes = 96 bits, base64url = 16 chars
      expect(iv.length).toBe(16);
    }
  });
});

describe("property-based tests", () => {
  fcTest.prop([fc.string()])("encrypt/decrypt roundtrip for any string", async (plaintext) => {
    const key = await generateKey();
    const encrypted = await encrypt(plaintext, key, { maxBytes: 10 * 1024 * 1024 });
    const decrypted = await decrypt(encrypted.ciphertext, encrypted.iv, key);
    expect(decrypted).toBe(plaintext);
  });

  fcTest.prop([fc.uint8Array({ minLength: 0, maxLength: 1000 })])(
    "handles binary-like content via TextDecoder",
    async (bytes) => {
      const plaintext = new TextDecoder().decode(bytes);
      const key = await generateKey();
      const encrypted = await encrypt(plaintext, key);
      const decrypted = await decrypt(encrypted.ciphertext, encrypted.iv, key);
      expect(decrypted).toBe(plaintext);
    }
  );

  fcTest.prop([fc.string({ minLength: 1, maxLength: 100 })])(
    "different plaintexts produce different ciphertexts",
    async (plaintext) => {
      const key = await generateKey();
      const encrypted1 = await encrypt(plaintext, key);
      const encrypted2 = await encrypt(plaintext, key);

      // Same plaintext should produce different ciphertext due to random IV
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
    }
  );

  fcTest.prop([fc.string({ minLength: 0, maxLength: 500 })])(
    "encrypted data has version field",
    async (plaintext) => {
      const key = await generateKey();
      const encrypted = await encrypt(plaintext, key);
      expect(encrypted.version).toBe(1);
    }
  );
});

describe("large buffer handling", () => {
  it("handles moderately large payloads without stack overflow", async () => {
    const key = await generateKey();
    // 100KB payload - tests chunked base64 encoding
    const largePayload = "x".repeat(100 * 1024);

    const encrypted = await encrypt(largePayload, key);
    const decrypted = await decrypt(encrypted.ciphertext, encrypted.iv, key);

    expect(decrypted).toBe(largePayload);
  });

  it("handles payload near max size", async () => {
    const key = await generateKey();
    // Just under 1MB
    const nearMaxPayload = "y".repeat(MAX_PLAINTEXT_BYTES - 100);

    const encrypted = await encrypt(nearMaxPayload, key);
    const decrypted = await decrypt(encrypted.ciphertext, encrypted.iv, key);

    expect(decrypted).toBe(nearMaxPayload);
  });
});
