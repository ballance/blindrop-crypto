# ADR-0005: Typed Error Hierarchy for Exception Handling

## Status

Accepted

## Context

Cryptographic operations can fail for various reasons:
- Invalid key format or length
- Malformed base64 encoding
- Wrong decryption key (authentication tag mismatch)
- Tampered ciphertext
- Payload size limits exceeded

Callers need to distinguish between these failure modes to provide appropriate user feedback and implement retry logic where applicable.

Options considered:

| Approach | Type Safety | instanceof | Error Details |
|----------|-------------|------------|---------------|
| String error messages | None | No | In message only |
| Error codes (enum) | Compile-time | No | Separate field |
| Error subclasses | Compile-time | Yes | Typed properties |
| Result<T, E> pattern | Compile-time | No | Union type |

## Decision

Implement a **typed error hierarchy** using ES6 class inheritance:

```typescript
// src/errors.ts
export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CryptoError";
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class InvalidKeyError extends CryptoError {
  override name = "InvalidKeyError";
}

export class InvalidBase64Error extends CryptoError { ... }
export class InvalidIVError extends CryptoError { ... }
export class DecryptionError extends CryptoError { ... }
export class PayloadTooLargeError extends CryptoError { ... }
export class InvalidResultError extends CryptoError { ... }
```

## Consequences

### Positive

- **instanceof checks**: Callers can catch specific error types:
  ```typescript
  try {
    await decrypt(ciphertext, iv, key);
  } catch (error) {
    if (error instanceof DecryptionError) {
      // Wrong key or tampered data
    } else if (error instanceof InvalidBase64Error) {
      // Malformed input
    }
  }
  ```

- **Type narrowing**: TypeScript narrows caught errors when using instanceof

- **Hierarchical catching**: Catch `CryptoError` for all crypto-related failures, or specific subclasses for granular handling

- **Stack traces preserved**: V8's `captureStackTrace` ensures stack points to throw site, not error constructor

- **No sensitive data leakage**: Error messages describe the failure type without revealing key material or plaintext

### Negative

- **Verbose error handling**: Callers must import error classes to use instanceof. Acceptable tradeoff for type safety

- **Not serializable**: Error class instances don't JSON.stringify cleanly. Use `error.message` and `error.name` for logging

### Error Taxonomy

| Error Class | Thrown When | Recoverable |
|-------------|-------------|-------------|
| `InvalidKeyError` | Key empty, wrong length, not a string | No (fix input) |
| `InvalidBase64Error` | Base64 contains invalid chars, wrong padding | No (fix input) |
| `InvalidIVError` | IV wrong length (not 12 bytes) | No (fix input) |
| `DecryptionError` | Wrong key, tampered ciphertext, auth tag mismatch | No (wrong key) |
| `PayloadTooLargeError` | Plaintext exceeds maxBytes | Maybe (chunk data) |
| `InvalidResultError` | Lua script returned unexpected structure | No (data corruption) |

### Usage Examples

```typescript
// Catch all crypto errors
try {
  const plaintext = await decrypt(ciphertext, iv, key);
} catch (error) {
  if (error instanceof CryptoError) {
    console.error("Crypto operation failed:", error.message);
  }
}

// Granular handling
try {
  const key = await base64ToKey(userInput);
} catch (error) {
  if (error instanceof InvalidKeyError) {
    showError("The key in your URL appears to be invalid");
  } else if (error instanceof InvalidBase64Error) {
    showError("The URL contains invalid characters");
  }
}
```

### Alternative Rejected: Result<T, E>

Rust-style Result types were considered:

```typescript
// REJECTED: Unfamiliar pattern, verbose
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

const result = await decrypt(ciphertext, iv, key);
if (!result.ok) {
  handleError(result.error);
}
```

Problems:
1. Unfamiliar to most TypeScript developers
2. Requires checking every call site
3. Doesn't integrate with existing try/catch patterns
4. Can't be caught in a single boundary

## References

- V8 Error.captureStackTrace: https://v8.dev/docs/stack-trace-api
- `src/errors.ts` - Error class definitions
- `src/crypto.ts` - `decrypt()` function throws `InvalidIVError`, `DecryptionError`
- `src/crypto.ts` - `base64ToKey()` function throws `InvalidKeyError`, `InvalidBase64Error`
