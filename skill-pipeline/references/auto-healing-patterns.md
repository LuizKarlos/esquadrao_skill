# Auto-Healing Patterns

Deterministic remediation patterns for test failures and execution anomalies.

## Failure Classification

1. **Assertion Failure**: Code output deviates from expected contract.
   - *Remediation*: Inspect AST diff, locate mutated function, revert to last known green contract.
2. **Environment Failure**: Missing dependency or uninitialized database/service.
   - *Remediation*: Trigger idempotent initialization hook; re-verify preflight prerequisites.
3. **Flaky / Timing Failure**: Race condition or asynchronous event timeout.
   - *Remediation*: Isolate concurrent promises, replace arbitrary sleep with deterministic event listener.

## Remediation Protocol

- Maximum 3 auto-healing cycles per subtask.
- If cycle count exceeds threshold, escalate to parent orchestrator with full error trace.
