# Anti-Slop Patterns Specification

Identifies and removes unnecessary abstractions and defensive boilerplate in AI-generated code.

## Slop Indicators

1. **Premature Abstraction**:
   - Single-use interfaces, abstract base classes with only one child, factory functions wrapping simple constructors.
2. **Defensive Ghost Logic**:
   - Checking for null/undefined on values already validated or guaranteed by types.
   - Catch blocks that catch generic errors and swallow them or log redundant warnings.
3. **Comment Slop**:
   - Comments repeating the obvious code line (e.g. `// increment i by 1`).
   - Placeholder TODOs without clear ownership or tracking.

## Standard
Write the minimum code that satisfies the requirement. Delete before adding.
