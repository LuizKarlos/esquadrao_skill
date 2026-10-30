---
name: skill-review
version: "1.0.0"
description: "Perform adversarial dual-blind code review, anti-slop pattern linting, and voice calibration."
allowed-tools: ["terminal"]
---

# Agent Review

Perform dual-blind peer review, filter out AI code slop, and enforce rigorous engineering standards.

## When to Use

- Pre-merge verification of git branches or patches.
- Detecting AI boilerplate, dead code, and speculative abstractions.
- Calibrating technical tone and adherence to project conventions.

## NOT for

- Merkle block verification (`skill-audit`).
- Generating AST outlines (`skill-context`).
- Scheduling multi-wave jobs (`skill-pipeline`).

## Workflow & CLI

Execute via git and local test runners:

```bash
# 1. Review changed diff
git diff main...HEAD

# 2. Run test suites and linting
npm run lint
npm test
```

## UX & Operational Rules

- Reviews must cite specific file and line numbers.
- Reject boilerplate such as unused interfaces, empty catch blocks, or decorative comments.

## References

- Anti-slop patterns: [references/anti-slop-patterns.md](references/anti-slop-patterns.md)
- Dual-blind adjudication: [references/dual-blind-adjudication.md](references/dual-blind-adjudication.md)
- Voice calibration: [references/voice-calibration.md](references/voice-calibration.md)
