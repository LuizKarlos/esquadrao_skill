# Swarm Coordination Specification

Framework for coordinating autonomous multi-agent swarms, budgets, and concurrency locks via MCP and CLI.

## Autonomous Swarm Coordination (`coordinate_mission_swarm`)

Swarms execute autonomous agents across topological DAG waves:
- **Wave Partitioning**: Subtasks grouped by disjoint file paths for safe parallelism.
- **Context Virtualization**: Minimal surgical context packets (<3,000 tokens) dispatched per agent.
- **Evidence Gates**: Subtask progression requires deterministic GREEN test verification.

## Budget Allocation (Tokens & Time)

Strict operational ceilings prevent runaway resource consumption:
- **Token Quotas**: Per-task allocation with SHA-256 context deduplication (>75% token savings).
- **Timeout Ceilings**: Bounded wall-clock timeouts trigger auto-remediation or fail-closed abort.

## Concurrency Arbitration (`arbitrate_concurrency`)

Prevents file access collisions and deadlocks across concurrent subagents:
- **Lock Modes**:
  - `SHARED`: Simultaneous read-only access by multiple agents.
  - `EXCLUSIVE`: Single-agent write lock on specific file paths.
- **Lease Operations**:
  - `acquire`: Claims lock on `paths` with `agent_id`, `workspace_id`, and `ttl_seconds`.
  - `renew`: Heartbeat extends `expires_at` for long-running executions.
  - `release`: Deterministic cleanup requiring matching `agent_id` in `finally` blocks.
- **Zombie Purging**: Expired leases (`expires_at < now()`) auto-evict, promoting waiters.

```bash
universal-skill call arbitrate_concurrency '{"action": "acquire", "mode": "EXCLUSIVE", "paths": ["src/core.js"], "ttl_seconds": 30}'
```
