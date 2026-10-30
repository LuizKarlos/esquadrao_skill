---
name: skill-pipeline
version: "1.0.0"
description: "Decompose complex tasks into acyclic execution DAGs, compute topological waves, and auto-heal test failures."
allowed-tools: ["terminal", "mcp__*"]
---

# Agent Pipeline

Decompose tasks into topological waves, enforce acyclic dependencies, and trigger deterministic auto-healing.

## When to Use

- Breaking down epics into granular, testable DAG tasks.
- Validating dependency acyclicity and computing execution waves.
- Automated error diagnosis and targeted test remediation (auto-healing).

## NOT for

- Merkle ledger verification (`skill-audit`).
- Multi-agent swarm leasing and concurrency locks (`skill-orchestrate`).
- Codebase outline and AST extraction (`skill-context`).

## Workflow & CLI

Execute via `universal-skill call` or local script:

```bash
# 1. Validate DAG and compute topological waves
node scripts/dag_validator.js tasks.json

# 2. Decompose epic into execution tasks
universal-skill call decompose_epic '{"epic": "Implement OAuth", "files": ["src/auth.js"]}'

# 3. Auto-heal failing tests
universal-skill call auto_heal '{"error_log": "AssertionError: expected 200 got 500", "test_file": "tests/auth.test.js"}'
```

## UX & Operational Rules

- Tasks must declare strict `depends_on` lists referencing valid IDs.
- Never execute cyclical DAGs; validate with Kahn's algorithm before running.

## References

- Topological waves: [references/topological-waves.md](references/topological-waves.md)
- DAG decomposition rules: [references/dag-decomposition-rules.md](references/dag-decomposition-rules.md)
- Auto-healing patterns: [references/auto-healing-patterns.md](references/auto-healing-patterns.md)
