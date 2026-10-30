# AST Virtualization Specification

Technique for replacing voluminous implementation bodies with concise type and function signatures.

## Reduction Principles

- Extract top-level `export`, `function`, `class`, `interface`, and `type` declarations.
- Omit internal implementation bodies `{ ... }`.
- Strip line comments while preserving docstrings or top-level type signatures.
- Reduce token consumption by 60% to 80% while retaining full structural interface context.
