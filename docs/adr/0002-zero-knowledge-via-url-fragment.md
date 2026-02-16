# ADR-0002: Zero-Knowledge Architecture via URL Fragment

## Status

Accepted

## Context

We need to share encrypted secrets via URLs while ensuring the server never has access to decryption keys. This is the core security guarantee of the Blindrop service.

Requirements:

1. Key must never be transmitted to the server
2. URL must be shareable via messaging apps, email, etc.
3. Recipient must be able to decrypt without additional out-of-band key exchange
4. Solution must work across all browsers without plugins

Options considered:

| Approach | Server Sees Key | User Experience | Implementation |
|----------|-----------------|-----------------|----------------|
| URL fragment (#key) | No | Single URL | Simple |
| Separate key channel | No | Two messages needed | Complex UX |
| Query parameter (?key=) | Yes (in logs) | Single URL | Defeats purpose |
| Client-side only app | No | No persistence | No server needed |

## Decision

Store the encryption key in the **URL fragment** (the portion after `#`).

Per RFC 3986 Section 3.5, the fragment identifier is:
> "...not sent to the server"

This is enforced by all browsers. The fragment is processed client-side only.

URL structure:
```
https://blindrop.com/s/{secret_id}#{base64url_encoded_key}
                       └── sent to server    └── never sent
```

Key encoding uses base64url (RFC 4648) for URL safety:

```typescript
// src/crypto.ts - bufferToBase64Url()
return btoa(chunks.join(""))
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/, "");
```

## Consequences

### Positive

- **True zero-knowledge**: Server mathematically cannot decrypt secrets; no key material ever transmitted
- **Single URL sharing**: Recipients need only one URL, no separate key exchange
- **Browser-enforced**: Security guarantee comes from RFC 3986 compliance, not our code
- **Auditability**: Server logs prove key absence; compliance-friendly
- **No trust required**: Users don't need to trust server operators

### Negative

- **Full URL compromise**: If attacker captures the complete URL (including fragment), they can decrypt. Mitigated by:
  - HTTPS (URL path encrypted in transit)
  - View limits (burn after reading)
  - TTL expiration
- **URL length limits**: Base64-encoded 256-bit key adds 43 characters. Well within browser limits (~2000 chars) but reduces space for path
- **Analytics blind spot**: Server cannot track which secrets are actually viewed (only that the page was loaded)
- **Referer header risk**: Fragment not included in Referer, but link text might be logged by destination sites. Mitigated by `Referrer-Policy: no-referrer`

### Threat Model

| Threat | Mitigated | Notes |
|--------|-----------|-------|
| Server compromise | Yes | Server only has ciphertext |
| Database breach | Yes | Encrypted data only |
| Server-side logging | Yes | Fragment not in access logs |
| Network proxy/CDN | Yes | Fragment not transmitted |
| Browser history | Partial | URL with key stored locally |
| Shoulder surfing | No | URL visible if displayed |
| Link interception | No | Full URL = full access |

### Key Extractability

Keys must be marked as `extractable: true` to enable export to URL:

```typescript
// src/crypto.ts - generateKey()
true, // extractable - needed to export to URL
```

This is a security tradeoff: extractable keys can be exported by JavaScript, but this is required for the zero-knowledge architecture to function.

## References

- RFC 3986 Section 3.5: Fragment Identifier
- RFC 4648: Base64url Encoding
- `src/crypto.ts` - `keyToBase64()` implementation
- `src/crypto.ts` - `base64ToKey()` implementation
