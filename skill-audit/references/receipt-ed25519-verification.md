# Receipt Verification Specification

Protocol for cryptographically verifying signed execution receipts.

## Receipt Fields

- `receipt_id`: Unique identifier for the execution record.
- `timestamp`: UTC ISO-8601 creation timestamp.
- `task_digest`: SHA-256 hash of task definition and input context.
- `result_digest`: SHA-256 hash of generated output and test verification logs.
- `signature`: Ed25519 or HMAC signature over canonical `task_digest + result_digest`.

## Verification Steps

1. Recalculate `task_digest` from input context.
2. Recalculate `result_digest` from output artifacts.
3. Verify public key signature matches the concatenated digests.
