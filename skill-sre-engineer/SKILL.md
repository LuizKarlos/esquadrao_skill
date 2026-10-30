---
name: skill-sre-engineer
version: "1.0.0"
description: "Perform deep root-cause analysis on failing test runs, runtime crashes, and synthesize targeted fix contracts."
allowed-tools: ["terminal"]
---

# Site Reliability Engineer

Diagnose test failures, analyze crash traces, and establish deterministic fix contracts.

## When to Use

- Analyzing persistent test failures or unexpected runtime exceptions.
- Formulating structured root-cause analysis (RCA) documents.
- Generating targeted fix contracts with explicit boundary invariants.

## NOT for

- Generating unreviewed speculative code patches (`skill-software-engineer`).
- Auditing UI touch target sizes (`skill-ui`).
- Defining business requirements (`skill-product-manager`).

## Workflow & CLI

Execute via `universal-skill role`:

```bash
# 1. View SRE role configuration
universal-skill role info sre-engineer

# 2. Generate debugging prompt
universal-skill role prompt sre-engineer "Diagnose AssertionError in merkle_verify.js: hash mismatch"
```

## UX & Operational Rules

- Require reasoning models capable of deductive fault isolation.
- Focus diagnosis on underlying causes rather than masking symptoms with catch-all blocks.
- Output explicit invariant lists that must be proven before declaring an issue fixed.
