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
 * const { ciphertext, iv } = await encrypt("my secret", key);
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

export interface EncryptedData {
  ciphertext: string;
  iv: string;
}

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits, recommended for AES-GCM

/**
 * Generate a new AES-256-GCM encryption key
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
 * @returns Base64-encoded ciphertext and IV
 */
export async function encrypt(
  plaintext: string,
  key: CryptoKey
): Promise<EncryptedData> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // Generate random IV for each encryption
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    data
  );

  return {
    ciphertext: bufferToBase64(ciphertextBuffer),
    iv: bufferToBase64(iv),
  };
}

/**
 * Decrypt ciphertext using AES-256-GCM
 *
 * @param ciphertext - Base64-encoded ciphertext
 * @param iv - Base64-encoded initialization vector
 * @param key - The decryption key
 * @returns Decrypted plaintext
 */
export async function decrypt(
  ciphertext: string,
  iv: string,
  key: CryptoKey
): Promise<string> {
  const ciphertextArray = base64ToBuffer(ciphertext);
  const ivArray = base64ToBuffer(iv);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: new Uint8Array(ivArray) },
    key,
    new Uint8Array(ciphertextArray)
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

/**
 * Export a CryptoKey to Base64 string (for URL fragment)
 */
export async function keyToBase64(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("raw", key);
  return bufferToBase64(exported);
}

/**
 * Import a Base64 string back to CryptoKey
 */
export async function base64ToKey(base64: string): Promise<CryptoKey> {
  const keyArray = base64ToBuffer(base64);
  return crypto.subtle.importKey(
    "raw",
    new Uint8Array(keyArray),
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ["encrypt", "decrypt"]
  );
}

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
}
