---
name: skill-orchestrate
version: "1.0.0"
description: "Orchestrate autonomous multi-agent missions, manage checkpoints, and coordinate execution."
allowed-tools: ["terminal"]
---

# Agent Orchestrate

Orchestrate end-to-end missions, autonomous pipelines, and checkpoint rollbacks via CLI or git branches.

## When to Use

- Executing end-to-end autonomous missions across multi-phase tasks.
- Coordinating autonomous multi-agent swarms with bounded resource budgets.
- Capturing atomic state snapshots (`checkpoints`) before high-risk mutations.
- Reverting failed or regressed mission states deterministically (`rollback`).

## NOT for

- AST slicing or syntax graph extraction (`skill-context`).
- WCAG accessibility or visual TDD audits (`skill-ui`).
- Isolated forensic ledger verification (`skill-audit`).
- Single-wave pipeline scheduling (`skill-pipeline`).

## Workflow & CLI

Execute via local script and git commands:

```bash
# 1. Validate DAG and execution waves
node scripts/dag_validator.js tasks.json

# 2. Capture git checkpoint before mutation
git checkout -b checkpoint/pre-mutation

# 3. Rollback to checkpoint on failure
git reset --hard HEAD
```

## UX & Operational Rules

- **Anti-Context-Dumping**: Dispatch minimal context packets (<3,000 tokens). Never dump full workspace trees.
- **Structured Communication**: Return concise status summaries with work IDs, checkpoint hashes, and gate results.

## References

- Mission lifecycle & transitions: [references/mission-lifecycle.md](references/mission-lifecycle.md)
- Swarm coordination & arbitration: [references/swarm-coordination.md](references/swarm-coordination.md)
