# DAG Decomposition Rules

Rules for breaking complex engineering goals into parallelizable execution units.

## Core Rules

1. **Atomic Boundaries**: Each task touches at most 3 related source files.
2. **Explicit Verification**: Every task must define at least one executable check (unit test or command).
3. **Strict Acyclicity**: No task may directly or transitively depend on its own output.
4. **Declared Dependencies**: All inputs from previous tasks must be listed in `depends_on`.

```json
[
  { "id": "task_1", "description": "Define data schema", "depends_on": [] },
  { "id": "task_2", "description": "Implement repository", "depends_on": ["task_1"] },
  { "id": "task_3", "description": "Create HTTP routes", "depends_on": ["task_2"] }
]
```
