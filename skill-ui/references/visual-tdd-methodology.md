# Visual TDD Methodology

Test-driven design flow verifying headless accessibility and visual rendering.

## Development Cycle

1. **Contract Definition**: Define required contrast ratios, target dimensions, and token variables.
2. **Failing Audit (RED)**: Run `scripts/wcag_check.js` against preliminary styles; verify failure flags.
3. **Implementation (GREEN)**: Apply CSS values meeting token constraints (e.g. `min-width: 44px; min-height: 44px`).
4. **Refactoring**: Consolidate repetitive utility rules into reusable component styles while maintaining GREEN check.
