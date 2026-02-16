/**
 * Custom Error Classes for blindrop-crypto
 *
 * Typed error hierarchy for better error handling and categorization.
 */

/**
 * Base error class for all cryptographic operations
 */
export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CryptoError";
    // Maintains proper stack trace for where error was thrown (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Thrown when an encryption key is invalid (wrong length, format, etc.)
 */
export class InvalidKeyError extends CryptoError {
  override name = "InvalidKeyError";
}

/**
 * Thrown when a base64 string is malformed or contains invalid characters
 */
export class InvalidBase64Error extends CryptoError {
  override name = "InvalidBase64Error";
}

/**
 * Thrown when an initialization vector (IV) is invalid
 */
export class InvalidIVError extends CryptoError {
  override name = "InvalidIVError";
}

/**
 * Thrown when decryption fails (wrong key, tampered ciphertext, etc.)
 */
export class DecryptionError extends CryptoError {
  override name = "DecryptionError";
}

/**
 * Thrown when plaintext exceeds the maximum allowed size
 */
export class PayloadTooLargeError extends CryptoError {
  override name = "PayloadTooLargeError";
}

/**
 * Thrown when parsing a result fails (invalid structure, missing fields, etc.)
 */
export class InvalidResultError extends CryptoError {
  override name = "InvalidResultError";
}
