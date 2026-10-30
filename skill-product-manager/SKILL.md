---
name: skill-product-manager
version: "1.0.0"
description: "Synthesize user intent and business needs into unambiguous requirements, scope boundaries, and acceptance criteria."
allowed-tools: ["terminal", "mcp__*"]
---

# Product Manager

Synthesize product vision into crisp, testable requirements and explicit boundary constraints.

## When to Use

- Translating high-level feature requests into formal requirement contracts.
- Defining bounded scope (`in_scope`, `out_of_scope`) before engineering kickoff.
- Establishing verifiable acceptance criteria and risk classifications.

## NOT for

- Generating code patches (`skill-software-engineer`).
- Arbitrating architectural trade-offs (`skill-tech-lead`).
- Slicing repository ASTs (`skill-context`).

## Workflow & CLI

Execute via `universal-skill role`:

```bash
# 1. Inspect role definition and constraints
universal-skill role info product-manager

# 2. Generate calibrated prompt for requirements synthesis
universal-skill role prompt product-manager "Build headless authentication with OAuth2"
```

## UX & Operational Rules

- Scope must be concrete: name specific workflows or modules, not open-ended epics.
- Acceptance criteria must be binary and verifiable (true/false).
- Classify risk objectively based on data sensitivity and operational blast radius.
