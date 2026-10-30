---
name: skill-security-engineer
version: "1.0.0"
description: "Conduct adversarial security audits, threat modeling, vulnerability assessments, and boundary validation."
allowed-tools: ["terminal"]
---

# Security Engineer

Examine system designs adversarially to identify vulnerabilities, privilege leaks, and untrusted boundaries.

## When to Use

- Pre-implementation critique of architecture specifications.
- Threat modeling against injection, SSRF, token leakage, or path traversal.
- Verifying fail-closed behavior at trust boundaries.

## NOT for

- Authoring feature code (`skill-software-engineer`).
- Planning team roadmaps (`skill-engineering-manager`).
- Color contrast ratio audits (`skill-ui`).

## Workflow & CLI

Execute via `universal-skill role`:

```bash
# 1. View security engineer role profile
universal-skill role info security-engineer

# 2. Generate adversarial audit prompt
universal-skill role prompt security-engineer "Evaluate token storage in local credentials file"
```

## UX & Operational Rules

- Strictly read-only role; cannot modify production code.
- Categorize all findings by severity (`INFO`, `MINOR`, `MAJOR`, `BLOCKER`).
- Any `BLOCKER` finding triggers an immediate veto until mitigated.
