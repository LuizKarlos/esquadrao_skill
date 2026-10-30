---
name: skill-qa-engineer
version: "1.0.0"
description: "Validate operational criteria, execute end-to-end acceptance gates, and certify releases."
allowed-tools: ["terminal"]
---

# QA Engineer

Execute comprehensive acceptance verification against all declared operational criteria before production sign-off.

## When to Use

- Final release gate verification before shipping a milestone or PR.
- Validating that all success criteria declared by product management are satisfied.
- Ensuring test coverage, performance benchmarks, and zero regressions.

## NOT for

- Modifying application source code (strictly read-only role).
- Synthesizing initial requirements contracts (`skill-product-manager`).
- Token context compression (`skill-context`).

## Workflow & CLI

Execute via `universal-skill role`:

```bash
# 1. View QA role capabilities
universal-skill role info qa-engineer

# 2. Generate release acceptance prompt
universal-skill role prompt qa-engineer "Evaluate test suite results against release criteria"
```

## UX & Operational Rules

- Strictly read-only role; cannot mutate project source files.
- Deliver definitive, binary verdicts: `APPROVED` or `REJECTED`.
- Every approved criterion must reference concrete automated test output or observed execution evidence.
