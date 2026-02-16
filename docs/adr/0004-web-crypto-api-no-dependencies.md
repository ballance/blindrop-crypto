# ADR-0004: Web Crypto API with Zero Runtime Dependencies

## Status

Accepted

## Context

Cryptographic operations require a secure random number generator and constant-time implementations of encryption primitives. We must choose between:

1. JavaScript crypto libraries (e.g., crypto-js, sjcl, tweetnacl)
2. Native Web Crypto API (`crypto.subtle`)

Security and supply chain considerations are paramount for a cryptography library.

| Approach | Security | Supply Chain Risk | Performance | Browser Support |
|----------|----------|-------------------|-------------|-----------------|
| crypto-js | JS implementation | npm dependency | Slower | Universal |
| sjcl | JS implementation | npm dependency | Slower | Universal |
| tweetnacl | JS implementation | npm dependency | Moderate | Universal |
| Web Crypto API | Native/hardware | Zero | Fastest | Modern browsers |

## Decision

Use the **Web Crypto API** (`crypto.subtle`) exclusively with **zero runtime dependencies**.

```typescript
// src/crypto.ts - No imports from npm for crypto operations
const key = await crypto.subtle.generateKey(
  { name: "AES-GCM", length: 256 },
  true,
  ["encrypt", "decrypt"]
);
```

Require Node.js 18+ which provides native Web Crypto API:

```json
// package.json:45-47
"engines": {
  "node": ">=18.0.0"
}
```

## Consequences

### Positive

- **No supply chain risk**: Zero runtime dependencies means no `npm install` attack surface. The only code executing is our source and browser/Node.js built-ins
- **Hardware acceleration**: Web Crypto API implementations use AES-NI instructions where available, providing constant-time execution and high performance
- **Constant-time operations**: Native implementations are designed to avoid timing side channels; JavaScript implementations may leak timing information
- **CSPRNG guaranteed**: `crypto.getRandomValues()` provides cryptographically secure random numbers backed by OS entropy
- **Auditable**: Entire codebase is ~600 lines of TypeScript with no transitive dependencies to review
- **Smaller bundle**: No crypto library bloat; just our wrapper code

### Negative

- **Node.js 18+ requirement**: Older Node.js versions need polyfills. Acceptable given Node 18 is LTS
- **Browser compatibility**: Requires modern browsers (Chrome 37+, Firefox 34+, Safari 11+, Edge 12+). Acceptable for 2026+
- **Limited algorithm choice**: Web Crypto API supports fewer algorithms than some libraries. AES-GCM is sufficient for our needs
- **Async-only API**: All `crypto.subtle` methods return Promises. Acceptable; we're async throughout

### Supply Chain Analysis

```json
// package.json - devDependencies only
"devDependencies": {
  "@fast-check/vitest": "^0.1.0",  // Testing only
  "@types/node": "^20.0.0",         // Types only
  "fast-check": "^3.15.0",          // Testing only
  "tsup": "^8.0.0",                 // Build only
  "typescript": "^5.0.0",           // Build only
  "vitest": "^1.0.0"                // Testing only
}
```

No runtime dependencies. Published package contains only our compiled code.

### Performance Characteristics

Web Crypto API with AES-NI hardware acceleration:

| Operation | Performance |
|-----------|-------------|
| Key generation | ~0.1ms |
| Encrypt 1KB | ~0.2ms |
| Encrypt 1MB | ~15ms |
| Decrypt 1KB | ~0.2ms |

JavaScript implementations would be 10-100x slower without hardware acceleration.

### Alternative Rejected: Hybrid Approach

We considered using Web Crypto where available with JS fallback:

```typescript
// REJECTED: Complexity and security risk
const crypto = globalThis.crypto?.subtle ?? new SJCLCrypto();
```

Problems:
1. Two code paths to test and audit
2. Fallback may have different security properties
3. Adds npm dependencies
4. When would fallback ever be needed in 2026+?

## References

- Web Crypto API Specification: https://www.w3.org/TR/WebCryptoAPI/
- Node.js Web Crypto: https://nodejs.org/api/webcrypto.html
- `src/crypto.ts` - `generateKey()` function
- `src/crypto.ts` - `encrypt()` function
- `package.json` - `engines.node` requirement
