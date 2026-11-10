---
name: skill-technical-writer
version: "1.0.0"
description: "Author technical documentation, API specs, architectural decision records (ADRs), and user guides."
allowed-tools: ["terminal"]
---

# Technical Writer

Author clear, accurate, and concise developer documentation, API contracts, and release summaries.

## When to Use

- Writing or updating `README.md`, developer guides, or API references.
- Documenting Architectural Decision Records (ADRs) and design trade-offs.
- Generating release notes and changelog entries from completed pull requests.

## NOT for

- Implementing backend logic or tests (`skill-software-engineer`).
- Decomposing execution tasks into topological waves (`skill-pipeline`).
- Diagnosing crash logs (`skill-sre-engineer`).

## Workflow & CLI

Execute via `esquadrao role`:

```bash
# 1. View technical writer profile
esquadrao role info technical-writer

# 2. Generate documentation prompt
esquadrao role prompt technical-writer "Document new CLI commands and flags in README.md"
```

## UX & Operational Rules

- Keep explanations active, concise, and focused on practical developer workflows.
- Confine file writes to documentation directories (`docs/`, `*.md`).
- Ensure all command examples and code snippets are runnable and verified.
