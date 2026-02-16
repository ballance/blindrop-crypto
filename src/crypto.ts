/**
 * Zero-Knowledge Encryption Module
 *
 * Implements AES-256-GCM encryption for zero-knowledge secret sharing.
 * The key never leaves the client - it's stored in the URL fragment
 * which is never sent to the server.
 *
 * @example
 * ```typescript
 * // Encrypt a secret
 * const key = await generateKey();
 * const { ciphertext, iv, version } = await encrypt("my secret", key);
 * const keyBase64 = await keyToBase64(key);
 *
 * // Store ciphertext + iv on server, keep key in URL fragment
 * const url = `https://example.com/s/${id}#${keyBase64}`;
 *
 * // Decrypt (client-side only)
 * const key = await base64ToKey(keyBase64);
 * const plaintext = await decrypt(ciphertext, iv, key);
 * ```
 */

import {
  CryptoError,
  DecryptionError,
  InvalidBase64Error,
  InvalidIVError,
  InvalidKeyError,
  PayloadTooLargeError,
} from "./errors";

export interface EncryptedData {
  /** Format version for future compatibility */
  version: 1;
  /** Base64url-encoded ciphertext */
  ciphertext: string;
  /** Base64url-encoded initialization vector */
  iv: string;
}

export interface EncryptOptions {
  /** Maximum plaintext size in bytes (default: 1MB) */
  maxBytes?: number;
}

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits, recommended for AES-GCM
const KEY_BYTES = KEY_LENGTH / 8; // 32 bytes for AES-256

/** Default maximum plaintext size: 1MB */
export const MAX_PLAINTEXT_BYTES = 1024 * 1024;

// Module-level encoder/decoder for performance
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Generate a new AES-256-GCM encryption key
 *
 * @returns A new CryptoKey suitable for encryption and decryption
 */
export async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true, // extractable - needed to export to URL
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt plaintext using AES-256-GCM
 *
 * @param plaintext - The secret to encrypt
 * @param key - The encryption key
 * @param options - Optional encryption options
 * @returns Base64-encoded ciphertext, IV, and format version
 *
 * @throws {PayloadTooLargeError} If plaintext exceeds maximum size
 * @throws {CryptoError} If encryption fails
 */
export async function encrypt(
  plaintext: string,
  key: CryptoKey,
  options?: EncryptOptions
): Promise<EncryptedData> {
  const maxBytes = options?.maxBytes ?? MAX_PLAINTEXT_BYTES;
  const data = encoder.encode(plaintext);

  if (data.byteLength > maxBytes) {
    throw new PayloadTooLargeError(
      `Plaintext exceeds maximum size: ${data.byteLength} > ${maxBytes} bytes`
    );
  }

  // Generate random IV for each encryption
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  let ciphertextBuffer: ArrayBuffer;
  try {
    ciphertextBuffer = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      key,
      data
    );
  } catch (error) {
    throw new CryptoError(
      `Encryption failed: ${error instanceof Error ? error.message : "unknown error"}`
    );
  }

  return {
    version: 1,
    ciphertext: bufferToBase64Url(ciphertextBuffer),
    iv: bufferToBase64Url(iv),
  };
}

/**
 * Decrypt ciphertext using AES-256-GCM
 *
 * @param ciphertext - Base64-encoded ciphertext
 * @param iv - Base64-encoded initialization vector
 * @param key - The decryption key
 * @returns Decrypted plaintext
 *
 * @throws {InvalidBase64Error} If ciphertext or IV contains invalid base64
 * @throws {InvalidIVError} If IV has incorrect length
 * @throws {DecryptionError} If decryption fails (wrong key, tampered data, etc.)
 */
export async function decrypt(
  ciphertext: string,
  iv: string,
  key: CryptoKey
): Promise<string> {
  const ciphertextArray = base64UrlToBuffer(ciphertext);
  const ivArray = base64UrlToBuffer(iv);

  if (ivArray.byteLength !== IV_LENGTH) {
    throw new InvalidIVError(
      `Invalid IV length: expected ${IV_LENGTH} bytes, got ${ivArray.byteLength}`
    );
  }

  let decryptedBuffer: ArrayBuffer;
  try {
    decryptedBuffer = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv: new Uint8Array(ivArray) },
      key,
      new Uint8Array(ciphertextArray)
    );
  } catch (error) {
    throw new DecryptionError(
      `Decryption failed: ${error instanceof Error ? error.message : "authentication tag mismatch or corrupted data"}`
    );
  }

  return decoder.decode(decryptedBuffer);
}

/**
 * Export a CryptoKey to URL-safe Base64 string (for URL fragment)
 *
 * @param key - The CryptoKey to export
 * @returns URL-safe Base64 string representation of the key
 *
 * @throws {CryptoError} If key export fails
 */
export async function keyToBase64(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("raw", key);
  return bufferToBase64Url(exported);
}

/**
 * Import a URL-safe Base64 string back to CryptoKey
 *
 * @param base64 - The base64-encoded key string
 * @returns The imported CryptoKey
 *
 * @throws {InvalidKeyError} If the base64 string is empty or not a string
 * @throws {InvalidBase64Error} If the base64 string is malformed
 * @throws {InvalidKeyError} If the key length is incorrect
 */
export async function base64ToKey(base64: string): Promise<CryptoKey> {
  if (!base64 || typeof base64 !== "string") {
    throw new InvalidKeyError("Invalid key: expected non-empty string");
  }

  const keyArray = base64UrlToBuffer(base64);

  if (keyArray.byteLength !== KEY_BYTES) {
    throw new InvalidKeyError(
      `Invalid key length: expected ${KEY_BYTES} bytes, got ${keyArray.byteLength}`
    );
  }

  return crypto.subtle.importKey(
    "raw",
    new Uint8Array(keyArray),
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * Convert buffer to URL-safe base64 (base64url per RFC 4648)
 * - Replaces + with -
 * - Replaces / with _
 * - Removes padding =
 *
 * Uses chunked processing to avoid stack overflow on large buffers.
 */
function bufferToBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  // Process in chunks to avoid stack overflow on large buffers
  const CHUNK_SIZE = 0x8000; // 32KB chunks
  const chunks: string[] = [];

  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE)));
  }

  return btoa(chunks.join(""))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Convert URL-safe base64 back to buffer
 * Handles both standard base64 and base64url for backwards compatibility
 *
 * @throws {InvalidBase64Error} If the base64 string is malformed
 */
function base64UrlToBuffer(base64url: string): ArrayBuffer {
  // Convert base64url to standard base64
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");

  // Add padding if needed
  const padding = base64.length % 4;
  if (padding === 2) {
    base64 += "==";
  } else if (padding === 3) {
    base64 += "=";
  } else if (padding === 1) {
    throw new InvalidBase64Error("Invalid base64 string: incorrect length");
  }

  let binary: string;
  try {
    binary = atob(base64);
  } catch {
    throw new InvalidBase64Error(
      "Invalid base64 string: contains invalid characters"
    );
  }

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  // Return proper ArrayBuffer slice to handle SharedArrayBuffer edge case
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  );
}
