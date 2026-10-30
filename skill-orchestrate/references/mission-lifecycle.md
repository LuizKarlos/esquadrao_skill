# Mission Lifecycle Specification

Governs mission state transitions and atomic checkpointing in agent orchestration.

## Lifecycle States

- **INIT**: Task intake and contract refinement (`refine_prompt`). WorkRecord instantiated with DAG.
- **RUNNING**: Topological waves executing subtasks concurrently with GREEN test gates.
- **CHECKPOINT**: Execution paused to persist immutable state snapshot before risky mutations.
- **COMPLETED**: All subtasks verified GREEN (`verify_subtask`) and Merkle ledger exported.
- **FAILED**: Unrecoverable regression or exhausted remediations; triggers fail-closed state.

```
INIT ──> RUNNING ──┬──> CHECKPOINT ──> RUNNING
                   ├──> COMPLETED (all gates GREEN)
                   └──> FAILED (unrecoverable / budget exhausted)
```

## Checkpoint & Rollback Protocol

1. **Snapshot (`create_checkpoint`)**:
   - Takes `work_id` and optional `label`.
   - Serializes atomic snapshot of `WorkRecord` (DAG, task outputs, event log).
   - Returns immutable `checkpoint_id`.
2. **Rollback (`rollback_checkpoint`)**:
   - Takes `work_id` and `checkpoint_id`.
   - Deterministically restores `WorkRecord` to snapshot and releases acquired locks.
   - Appends signed rollback event to audit ledger.

```bash
# Capture checkpoint via git branch or stash
git stash save "checkpoint-pre-patch"

# Rollback checkpoint on failure
git reset --hard HEAD
```
