---
name: skill-software-architect
version: "1.0.0"
description: "Decompose complex systems, define strict interface boundaries, establish invariants, and author implementation contracts."
allowed-tools: ["terminal"]
---

# Principal Software Architect

Design robust software systems, define immutable boundaries, and enforce implementation contracts.

## When to Use

- High-level system design and multi-component decomposition.
- Authoring implementation contracts with strict `allowed_changes` and `invariants`.
- Establishing deterministic rollback criteria before high-risk changes.

## NOT for

- Routine bug fixing or single-file line edits (`skill-software-engineer`).
- Performing visual accessibility audits (`skill-ui`).
- Cryptographic Merkle chain audits (`skill-audit`).

## Workflow & CLI

Execute via `esquadrao role`:

```bash
# 1. View architectural role capabilities
esquadrao role info software-architect

# 2. Generate prompt for technical specification design
esquadrao role prompt software-architect "Design zero-dependency RPC client"
```

## UX & Operational Rules

- Require models with explicit reasoning capabilities.
- Always provide explicit, concrete file paths in `allowed_changes` (never wildcards or globs).
- Define measurable invariants and observable rollback conditions for every architectural change.
