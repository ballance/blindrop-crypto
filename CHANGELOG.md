# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-15

### Added

- **Zero-knowledge encryption** using AES-256-GCM
  - `generateKey()` - Generate encryption keys
  - `encrypt()` - Encrypt plaintext with random IV per call
  - `decrypt()` - Decrypt ciphertext (supports both `(ciphertext, iv, key)` and `(EncryptedData, key)` signatures)
  - `keyToBase64()` / `base64ToKey()` - Key serialization for URL fragments

- **Atomic Redis operations** via Lua scripts
  - `ATOMIC_DECREMENT_SCRIPT` - View counting with burn-after-reading
  - `ATOMIC_INCREMENT_WITH_LIMIT_SCRIPT` - Rate limiting
  - `parseDecrementResult()` / `parseIncrementResult()` - Result parsing

- **Typed error hierarchy** for precise error handling
  - `CryptoError` (base class)
  - `InvalidKeyError`, `InvalidBase64Error`, `InvalidIVError`
  - `DecryptionError`, `PayloadTooLargeError`, `InvalidResultError`

- **Key algorithm validation** - Functions validate CryptoKey is AES-GCM

- **Format versioning** - `EncryptedData` includes version field for future compatibility

- **Payload size limits** - Configurable max plaintext size (default 1MB)

- **Architecture Decision Records** documenting design choices

### Security

- Zero runtime dependencies (minimal supply chain risk)
- Web Crypto API for hardware-accelerated, constant-time operations
- Random 96-bit IV generated per encryption (prevents IV reuse)
- Base64url encoding for URL-safe key storage in fragments

[1.0.0]: https://github.com/ballance/blindrop-crypto/releases/tag/v1.0.0
