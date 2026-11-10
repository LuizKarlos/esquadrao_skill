---
name: skill-system-analyst
version: "1.0.0"
description: "Navigate codebases, extract module dependency graphs, map architectural boundaries, and identify touchpoints."
allowed-tools: ["terminal"]
---

# Systems Analyst

Explore repository architecture, map structural dependencies, and isolate relevant components.

## When to Use

- Initial repository reconnaissance on unfamiliar codebases.
- Identifying entry points, routes, and touched modules for a given task.
- Generating repository maps and dependency graphs without modifying state.

## NOT for

- Modifying or writing production code (strictly read-only role).
- Running speculative test mutations.
- Authoring release documentation (`skill-technical-writer`).

## Workflow & CLI

Execute via `esquadrao role`:

```bash
# 1. Inspect role capabilities
esquadrao role info system-analyst

# 2. Generate calibrated reconnaissance prompt
esquadrao role prompt system-analyst "Map authentication flows in src/"
```

## UX & Operational Rules

- Strictly read-only: mutating commands and file writes are forbidden.
- Output concise summaries citing exact file paths and module dependencies.
- Minimize token overhead by prioritizing AST outlines over full-file dumps.
