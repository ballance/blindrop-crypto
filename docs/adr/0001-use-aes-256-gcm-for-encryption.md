# ADR-0001: Use AES-256-GCM for Encryption

## Status

Accepted

## Context

We need to select a symmetric encryption algorithm for encrypting user secrets in a zero-knowledge architecture. The algorithm must:

1. Provide both confidentiality and integrity (authenticated encryption)
2. Be widely supported across browsers and Node.js via Web Crypto API
3. Be resistant to known cryptographic attacks
4. Support efficient encryption of variable-length payloads

Options considered:

| Algorithm | Type | Key Size | Authentication | Browser Support |
|-----------|------|----------|----------------|-----------------|
| AES-256-GCM | AEAD | 256-bit | Built-in | Web Crypto API |
| AES-256-CBC + HMAC | Encrypt-then-MAC | 256-bit | Separate HMAC | Web Crypto API |
| ChaCha20-Poly1305 | AEAD | 256-bit | Built-in | Limited |
| AES-256-CTR | Stream cipher | 256-bit | None | Web Crypto API |

## Decision

Use **AES-256-GCM** (Galois/Counter Mode) with:

- 256-bit keys (32 bytes)
- 96-bit IVs (12 bytes) per NIST SP 800-38D recommendation
- Random IV generated for each encryption operation

Implementation in `src/crypto.ts`:

```typescript
const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits, recommended for AES-GCM
```

## Consequences

### Positive

- **Authenticated encryption**: GCM provides both confidentiality and integrity in a single pass, detecting tampering automatically via the authentication tag
- **Performance**: Single-pass encryption is faster than separate encrypt + HMAC operations; hardware acceleration (AES-NI) available on most modern CPUs
- **Simplicity**: No need to implement or coordinate separate MAC; reduces risk of implementation errors (e.g., MAC-then-encrypt vs encrypt-then-MAC)
- **Universal support**: Available in all modern browsers via `crypto.subtle` and Node.js 18+ natively
- **NIST approved**: AES-GCM is recommended by NIST SP 800-38D

### Negative

- **IV uniqueness requirement**: Reusing an IV with the same key is catastrophic (breaks authentication and leaks plaintext XOR). Mitigated by generating random IV per encryption
- **96-bit IV space**: With random IVs, collision probability becomes significant after ~2^32 encryptions with same key. Acceptable for our use case (single-use secrets)
- **No misuse resistance**: Unlike AES-GCM-SIV, standard GCM fails catastrophically on IV reuse. Acceptable given our random IV generation

### Security Properties

| Property | Status |
|----------|--------|
| Confidentiality | AES-256 provides |
| Integrity | GCM authentication tag |
| IV reuse resistance | Random IV per encrypt() call |
| Key compromise | Forward secrecy not provided (acceptable for single-use secrets) |

## References

- NIST SP 800-38D: Recommendation for GCM Mode
- RFC 5116: An Interface and Algorithms for Authenticated Encryption
- `src/crypto.ts` - `ALGORITHM`, `KEY_LENGTH`, `IV_LENGTH` constants
- `src/crypto.ts` - `encrypt()` function, IV generation via `crypto.getRandomValues()`
