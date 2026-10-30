# Time-Travel Replay Specification

Framework for deterministic replay and state reconstruction from audit events.

## Replay Architecture

1. **Genesis State**: Replay initializes from clean baseline or checkpoint 0.
2. **Sequential Application**: Events from the verified Merkle ledger are applied in exact index order.
3. **State Checksum**: After applying each wave of events, compute state checksum and compare with recorded checkpoint hash.
4. **Deviation Halt**: If calculated checksum deviates, replay halts immediately, flagging the anomalous block.
