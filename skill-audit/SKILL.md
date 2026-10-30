---
name: skill-audit
version: "1.0.0"
description: "Verify cryptographic Merkle ledgers, validate execution receipts, and enable time-travel replays."
allowed-tools: ["terminal"]
---

# Agent Audit

Validate tamper-evident execution ledgers, check cryptographic receipts, and audit historical agent runs.

## When to Use

- Verifying SHA-256 Merkle chain integrity across task executions.
- Auditing cryptographic receipts and provenance of generated artifacts.
- Deterministic time-travel replay of prior mission checkpoints.

## NOT for

- Real-time swarm leasing (`skill-orchestrate`).
- WCAG color contrast checks (`skill-ui`).
- In-memory AST slicing (`skill-context`).

## Workflow & CLI

Execute via local script:

```bash
# Verify ledger continuity and payload hashes
node scripts/merkle_verify.js ledger.json
```

## UX & Operational Rules

- Ledgers must maintain strict `previous_hash` continuity across all blocks.
- Genesis blocks must declare valid genesis previous hashes (`0` or null).

## References

- Merkle ledger specification: [references/merkle-ledger-spec.md](references/merkle-ledger-spec.md)
- Receipt verification: [references/receipt-ed25519-verification.md](references/receipt-ed25519-verification.md)
- Time-travel replay: [references/time-travel-replay.md](references/time-travel-replay.md)
