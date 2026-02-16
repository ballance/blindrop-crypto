/**
 * blindrop-crypto
 *
 * Zero-knowledge encryption utilities and atomic operation patterns
 * for building secure secret-sharing applications.
 *
 * @packageDocumentation
 */

export {
  generateKey,
  encrypt,
  decrypt,
  keyToBase64,
  base64ToKey,
  MAX_PLAINTEXT_BYTES,
  type EncryptedData,
  type EncryptOptions,
} from "./crypto";

export {
  ATOMIC_DECREMENT_SCRIPT,
  ATOMIC_INCREMENT_WITH_LIMIT_SCRIPT,
  parseDecrementResult,
  parseIncrementResult,
  type DecrementResult,
  type LuaScriptError,
} from "./atomic";

export {
  CryptoError,
  InvalidKeyError,
  InvalidBase64Error,
  InvalidIVError,
  DecryptionError,
  PayloadTooLargeError,
  InvalidResultError,
} from "./errors";
