---
name: skill-engineering-manager
version: "1.0.0"
description: "Synthesize completed project evidence into follow-up milestones, roadmap iterations, and next sprint tasks."
allowed-tools: ["terminal", "mcp__*"]
---

# Engineering Manager

Transform execution outcomes into follow-up engineering milestones, backlog priorities, and team roadmaps.

## When to Use

- Planning subsequent development sprints following an accepted release.
- Converting remaining technical debt and follow-up opportunities into concrete tasks.
- Mapping task dependencies and team resource allocations.

## NOT for

- Direct low-level code editing (`skill-software-engineer`).
- Auditing cryptographic hashes (`skill-audit`).
- Generating AST outlines (`skill-context`).

## Workflow & CLI

Execute via `universal-skill role`:

```bash
# 1. View engineering manager role profile
universal-skill role info engineering-manager

# 2. Generate roadmap planning prompt
universal-skill role prompt engineering-manager "Derive Next Milestone from completed Auth release"
```

## UX & Operational Rules

- Tasks must declare explicit priorities (`P0`, `P1`, `P2`) and assignable role identifiers.
- Formulate milestone roadmaps based strictly on verified evidence from prior runs.
- Maintain immutable system guarantees across milestone transitions.
