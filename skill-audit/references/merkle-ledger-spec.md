# Merkle Ledger Specification

Tamper-evident audit log format maintaining hash chains across execution events.

## Block Structure

Each block contains metadata and payload, hashed canonically:

```json
{
  "index": 1,
  "timestamp": 1700000015,
  "previous_hash": "c7be1d82...",
  "data": {
    "action": "task_completed",
    "task_id": "auth_service",
    "status": "GREEN"
  },
  "hash": "e3b0c442..."
}
```

## Hash Invariant

- `hash = SHA256(canonicalStringify(block_without_hash))`
- `block[i].previous_hash === block[i - 1].hash`
- Canonical serialization sorts object keys alphabetically and omits undefined values.
