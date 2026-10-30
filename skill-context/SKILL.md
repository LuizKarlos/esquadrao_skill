---
name: skill-context
version: "1.0.0"
description: "Extract structural AST outlines, synthesize OpenAPI contracts, and condense context packets under 3k tokens."
allowed-tools: ["terminal"]
---

# Agent Context

Reduce token footprints by extracting structural AST signatures, synthesizing contracts, and filtering noise.

## When to Use

- Generating concise structural outlines of large source files (JS, TS, Python).
- Packaging surgical context (<3,000 tokens) for LLM subagents.
- Synthesizing OpenAPI 3.1 contracts from route definitions and handlers.

## NOT for

- Running execution waves or resolving task dependencies (`skill-pipeline`).
- Visual accessibility testing (`skill-ui`).
- Cryptographic Merkle verification (`skill-audit`).

## Workflow & CLI

Execute via local script:

```bash
# 1. Extract AST outline of file
node scripts/ast_slice.js src/server.js

# 2. Extract AST outline in JSON format
node scripts/ast_slice.js src/app.py --json
```

## UX & Operational Rules

- Never send entire code files when an outline or interface signature suffices.
- Target token reduction >60% compared to raw file contents.

## References

- AST virtualization: [references/ast-virtualization.md](references/ast-virtualization.md)
- OpenAPI contract synthesis: [references/openapi-contract-synthesis.md](references/openapi-contract-synthesis.md)
