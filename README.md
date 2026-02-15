# blindrop-crypto

Zero-knowledge encryption utilities and atomic operation patterns for building secure secret-sharing applications.

Extracted from [Blindrop](https://blindrop.com) - a zero-knowledge secret sharing service.

## Features

- **AES-256-GCM Encryption** - Industry-standard authenticated encryption
- **Zero-Knowledge Architecture** - Keys never touch the server
- **Atomic Redis Operations** - Lua scripts to prevent race conditions
- **TypeScript First** - Full type definitions included

## Installation

```bash
npm install blindrop-crypto
```

## Zero-Knowledge Encryption

The encryption module implements a zero-knowledge pattern where:

1. Encryption key is generated client-side
2. Secret is encrypted before leaving the browser
3. Key is stored in URL fragment (never sent to server)
4. Server only sees encrypted ciphertext

```typescript
import {
  generateKey,
  encrypt,
  decrypt,
  keyToBase64,
  base64ToKey,
} from "blindrop-crypto";

// === SENDER (Client-Side) ===

// Generate a new encryption key
const key = await generateKey();

// Encrypt the secret
const { ciphertext, iv } = await encrypt("my secret password", key);

// Convert key to base64 for URL
const keyBase64 = await keyToBase64(key);

// Send ciphertext + iv to server, keep key in URL fragment
// The fragment (#...) is NEVER sent to the server
const shareUrl = `https://example.com/s/${secretId}#${keyBase64}`;

// === RECIPIENT (Client-Side) ===

// Extract key from URL fragment
const fragment = window.location.hash.slice(1);
const key = await base64ToKey(fragment);

// Fetch ciphertext from server, decrypt client-side
const plaintext = await decrypt(ciphertext, iv, key);
console.log(plaintext); // "my secret password"
```

### Why URL Fragments?

The URL fragment (everything after `#`) has a special property: **browsers never send it to the server**. This is defined in [RFC 3986](https://tools.ietf.org/html/rfc3986#section-3.5).

This means:
- Server logs don't contain the key
- Network proxies can't see the key
- Even if the server is compromised, secrets remain safe

## Atomic Redis Operations

When building view-limited secrets, you need atomic decrement operations to prevent race conditions.

### The Problem

```typescript
// VULNERABLE: Race condition!
const secret = await redis.get(key);     // Thread A reads: views = 2
                                          // Thread B reads: views = 2
secret.viewsRemaining--;                  // Both see 2, decrement to 1
await redis.set(key, secret);             // Secret viewed 3+ times!
```

### The Solution

```typescript
import { ATOMIC_DECREMENT_SCRIPT, parseDecrementResult } from "blindrop-crypto";
import { Redis } from "@upstash/redis";

const redis = new Redis({ url: "...", token: "..." });

// Atomic operation - no race condition possible
const result = await redis.eval(
  ATOMIC_DECREMENT_SCRIPT,
  ["secret:abc123"],
  []
);

const parsed = parseDecrementResult(result);
if (!parsed) {
  console.log("Secret not found or expired");
} else if (parsed.burned) {
  console.log("Last view - secret deleted");
} else {
  console.log(`Views remaining: ${parsed.secret.viewsRemaining}`);
}
```

### How It Works

The Lua script executes atomically in Redis:

```lua
local data = redis.call('GET', key)
if not data then return nil end

local secret = cjson.decode(data)
secret.viewsRemaining = secret.viewsRemaining - 1

if secret.viewsRemaining <= 0 then
  redis.call('DEL', key)  -- Burn after reading
  return cjson.encode({secret = secret, burned = true})
else
  local ttl = redis.call('TTL', key)
  redis.call('SET', key, cjson.encode(secret), 'EX', ttl)
  return cjson.encode({secret = secret, burned = false})
end
```

## Security Model

### What's Protected

| Threat | Mitigation |
|--------|------------|
| Server compromise | Zero-knowledge - server never has the key |
| Network eavesdropping | Key in fragment, never transmitted |
| Database breach | Only encrypted data stored |
| Race conditions | Atomic Lua scripts |
| Replay attacks | View limits + expiration |

### What's NOT Protected

| Threat | Notes |
|--------|-------|
| Compromised client | If attacker controls browser, game over |
| Link interception | If attacker gets the full URL, they can decrypt |
| Weak key generation | Uses `crypto.subtle` which uses secure random |

## API Reference

### Encryption

| Function | Description |
|----------|-------------|
| `generateKey()` | Generate a new AES-256-GCM key |
| `encrypt(plaintext, key)` | Encrypt string, returns `{ ciphertext, iv }` |
| `decrypt(ciphertext, iv, key)` | Decrypt back to string |
| `keyToBase64(key)` | Export key for URL storage |
| `base64ToKey(base64)` | Import key from URL |

### Atomic Operations

| Export | Description |
|--------|-------------|
| `ATOMIC_DECREMENT_SCRIPT` | Lua script for atomic view counting |
| `ATOMIC_INCREMENT_WITH_LIMIT_SCRIPT` | Lua script for rate limiting |
| `parseDecrementResult(result)` | Parse Lua script response |

## Browser Support

Requires browsers with [Web Crypto API](https://caniuse.com/cryptography) support:
- Chrome 37+
- Firefox 34+
- Safari 11+
- Edge 12+

For Node.js, requires Node 18+ (native Web Crypto).

## License

MIT - See [LICENSE](LICENSE)

## Credits

Built by [BastionForge](https://bastionforge.com). See it in action at [Blindrop](https://blindrop.com).
