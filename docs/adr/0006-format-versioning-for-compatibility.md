# ADR-0006: Format Versioning for Future Compatibility

## Status

Accepted

## Context

Encrypted data may be stored for extended periods before decryption. If we change the encryption format in the future (different algorithm, additional fields, etc.), we need a way to:

1. Identify which format version was used to encrypt data
2. Apply the correct decryption logic for that version
3. Maintain backwards compatibility with existing encrypted data

Without versioning, format changes would either:
- Break decryption of existing data
- Require complex heuristics to detect format

## Decision

Include a **version field** in all encrypted data structures:

```typescript
// src/crypto.ts - EncryptedData interface
export interface EncryptedData {
  /** Format version for future compatibility */
  version: 1;
  /** Base64url-encoded ciphertext */
  ciphertext: string;
  /** Base64url-encoded initialization vector */
  iv: string;
}
```

Current version is **1**. The version field:
- Is a literal type (`1`, not `number`) for type safety
- Is set unconditionally on every encrypt operation
- Must be validated before decryption in future versions

```typescript
// src/crypto.ts - encrypt() return value
return {
  version: 1,
  ciphertext: bufferToBase64Url(ciphertextBuffer),
  iv: bufferToBase64Url(iv),
};
```

## Consequences

### Positive

- **Future-proof**: New encryption formats can be introduced without breaking existing data
- **Explicit migration path**: Version number guides decryption logic selection
- **Type safety**: TypeScript literal types ensure version is always present and correct
- **Self-describing format**: Encrypted data carries its own format metadata

### Negative

- **Additional field**: Slight increase in payload size (~12 bytes for `"version":1,` with JSON formatting)
- **Unused currently**: Version field is written but never checked in v1. Acceptable as investment in future compatibility

### Migration Strategy

When introducing version 2:

```typescript
// Future: src/crypto.ts
export interface EncryptedDataV1 {
  version: 1;
  ciphertext: string;
  iv: string;
}

export interface EncryptedDataV2 {
  version: 2;
  ciphertext: string;
  iv: string;
  aad?: string;  // Example: new field
}

export type EncryptedData = EncryptedDataV1 | EncryptedDataV2;

export async function decrypt(
  data: EncryptedData,
  key: CryptoKey
): Promise<string> {
  switch (data.version) {
    case 1:
      return decryptV1(data, key);
    case 2:
      return decryptV2(data, key);
    default:
      throw new CryptoError(`Unsupported format version: ${data.version}`);
  }
}
```

### Version 1 Specification

| Field | Type | Description |
|-------|------|-------------|
| version | `1` (literal) | Format version identifier |
| ciphertext | string | Base64url-encoded AES-256-GCM ciphertext with auth tag |
| iv | string | Base64url-encoded 96-bit initialization vector |

Invariants:
- `iv` is always 16 characters (12 bytes base64url-encoded)
- `ciphertext` length depends on plaintext length + 16-byte auth tag
- All strings use base64url encoding (RFC 4648, no padding)

### Future Version Considerations

Potential reasons for version 2:
- Additional authenticated data (AAD) support
- Key derivation parameters (if adding password-based encryption)
- Algorithm agility (e.g., ChaCha20-Poly1305 option)
- Compression before encryption

The version field enables any of these without breaking existing secrets.

## References

- `src/crypto.ts` - `EncryptedData` interface definition
- `src/crypto.ts` - `encrypt()` function returns `{ version: 1, ... }`
- `src/crypto.test.ts` - "encrypt version field" test suite
