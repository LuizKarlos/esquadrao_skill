# Dual-Blind Adjudication Specification

Methodology for impartial adversarial review of code and design proposals.

## Adjudication Protocol

1. **Independent Evaluation**: Reviewer assesses the pull request or diff without author context or commit narrative.
2. **Adversarial Probing**: Actively search for:
   - Untested edge conditions (null, boundary numbers, network timeouts).
   - Leaked credentials or unescaped user inputs.
   - Resource leaks (unclosed streams, uncleared timers).
3. **Verdict Categories**:
   - `APPROVED`: Patch passes all constraints and tests.
   - `NEEDS_REVISION`: Actionable defects found with concrete reproduction steps.
   - `REJECTED`: Fundamental architectural regression.
