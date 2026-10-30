---
name: skill-ui
version: "1.0.0"
description: "Perform headless visual TDD, WCAG 2.1 accessibility audits, and design token validation."
allowed-tools: ["terminal", "mcp__*"]
---

# Agent UI

Perform automated WCAG 2.1 accessibility auditing, interactive target size checks, and visual TDD.

## When to Use

- Auditing color contrast ratios (WCAG 2.1 AA / AAA).
- Validating interactive touch target dimensions (minimum 44x44px).
- Checking semantic DOM hierarchies and design tokens.

## NOT for

- Merkle ledger verification (`skill-audit`).
- DAG wave scheduling (`skill-pipeline`).
- Token context compression (`skill-context`).

## Workflow & CLI

Execute via local script or CLI:

```bash
# 1. Audit color contrast and touch target size
node scripts/wcag_check.js --fg="#000000" --bg="#ffffff" --width=48 --height=48

# 2. Output WCAG audit in JSON format
node scripts/wcag_check.js --fg="#767676" --bg="#ffffff" --json

# 3. Validate design tokens
universal-skill call audit_tokens '{"css_file": "src/styles.css"}'
```

## UX & Operational Rules

- Normal text requires at least 4.5:1 contrast ratio for WCAG AA compliance.
- Interactive elements must maintain at least 44x44px bounding boxes.

## References

- Design tokens specification: [references/design-tokens-spec.md](references/design-tokens-spec.md)
- Visual TDD methodology: [references/visual-tdd-methodology.md](references/visual-tdd-methodology.md)
- WCAG target sizes: [references/wcag-target-sizes.md](references/wcag-target-sizes.md)
