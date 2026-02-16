# ADR-0003: Atomic Redis Operations with Lua Scripts

## Status

Accepted

## Context

Blindrop implements view-limited secrets that self-destruct after N views. This requires atomic decrement operations to prevent race conditions.

### The Problem

Non-atomic read-modify-write creates a TOCTOU (Time-of-Check to Time-of-Use) vulnerability:

```
Timeline:
T1: Request A reads viewsRemaining = 2
T2: Request B reads viewsRemaining = 2  (same value!)
T3: Request A decrements to 1, writes
T4: Request B decrements to 1, writes   (overwrites A's write)
Result: 2 views consumed, but counter shows 1 remaining
```

This allows secrets to be viewed more times than intended, breaking the security guarantee.

Options considered:

| Approach | Atomicity | Complexity | Performance |
|----------|-----------|------------|-------------|
| Lua scripts | Full | Low | Single round-trip |
| Redis transactions (MULTI/EXEC) | Optimistic | Medium | Multiple round-trips |
| Distributed locks (Redlock) | Full | High | Lock acquisition overhead |
| Application-level mutex | Process-local only | Medium | Doesn't scale horizontally |

## Decision

Use **Lua scripts** executed via `EVAL` for all read-modify-write operations.

Redis executes Lua scripts atomically - no other commands can interleave during script execution. This is guaranteed by Redis's single-threaded execution model.

Two scripts provided in `src/atomic.ts`:

### ATOMIC_DECREMENT_SCRIPT

Atomically decrements view counter and burns secret when exhausted:

```lua
local key = KEYS[1]
local data = redis.call('GET', key)
if not data then return nil end

local secret = cjson.decode(data)
secret.viewsRemaining = secret.viewsRemaining - 1

if secret.viewsRemaining <= 0 then
  redis.call('DEL', key)  -- Atomic burn
  return cjson.encode({secret = secret, burned = true})
else
  local ttl = redis.call('TTL', key)
  redis.call('SET', key, cjson.encode(secret), 'EX', ttl)
  return cjson.encode({secret = secret, burned = false})
end
```

### ATOMIC_INCREMENT_WITH_LIMIT_SCRIPT

Atomically increments counter with maximum limit (for rate limiting):

```lua
local key = KEYS[1]
local max_count = tonumber(ARGV[1])
local expire_seconds = tonumber(ARGV[2])

local current = redis.call('GET', key)
if current and tonumber(current) >= max_count then
  return -1  -- Limit exceeded
end

local new_count = redis.call('INCR', key)
if new_count == 1 then
  redis.call('EXPIRE', key, expire_seconds)
end
return new_count
```

## Consequences

### Positive

- **True atomicity**: Entire operation executes as single unit; impossible to observe intermediate state
- **Single round-trip**: All logic executes server-side; no network latency between operations
- **Horizontal scalability**: Works correctly with any number of application instances
- **TTL preservation**: Scripts correctly preserve and restore key TTL
- **Type safety**: Scripts validate `viewsRemaining` is numeric before decrementing

### Negative

- **Script complexity**: Logic in Lua is harder to test than application code. Mitigated by comprehensive tests in `atomic.test.ts`
- **Redis dependency**: Tight coupling to Redis; scripts don't work with other stores. Acceptable given Redis is core infrastructure
- **Debugging difficulty**: Lua errors in Redis are cryptic. Mitigated by returning structured error responses
- **Script caching**: First execution compiles script; subsequent calls use SHA1 cache. Not an issue for long-running servers

### Error Handling

Scripts return structured JSON for error cases:

```lua
if type(secret.viewsRemaining) ~= "number" then
  return cjson.encode({error = "invalid_viewsRemaining_type"})
end
```

Parsed by `parseDecrementResult()` and `parseIncrementResult()` which throw typed `InvalidResultError` exceptions.

### Alternative Rejected: MULTI/EXEC

Redis transactions with `WATCH` provide optimistic locking:

```typescript
// REJECTED: Race condition still possible
await redis.watch(key);
const value = await redis.get(key);
await redis.multi()
  .set(key, newValue)
  .exec(); // Fails if key changed
```

Problems:
1. Requires retry loop on contention
2. Multiple network round-trips
3. Higher complexity for same guarantee

Lua scripts are simpler and faster.

## References

- Redis EVAL documentation: https://redis.io/commands/eval
- `src/atomic.ts` - `ATOMIC_DECREMENT_SCRIPT` constant
- `src/atomic.ts` - `ATOMIC_INCREMENT_WITH_LIMIT_SCRIPT` constant
- `src/atomic.test.ts` - Comprehensive Lua script tests
