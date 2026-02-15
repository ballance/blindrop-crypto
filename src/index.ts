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
  type EncryptedData,
} from "./crypto";

export {
  ATOMIC_DECREMENT_SCRIPT,
  ATOMIC_INCREMENT_WITH_LIMIT_SCRIPT,
  parseDecrementResult,
  type DecrementResult,
} from "./atomic";
