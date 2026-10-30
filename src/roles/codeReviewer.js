// Code Reviewer (formerly reviewer)
// Independent verification, anti-slop pattern linting, code quality inspection, and anti-self-review enforcement.

export const definition = {
  id: 'code-reviewer',
  title: 'Code Reviewer',
  formerName: 'reviewer',
  category: 'quality',
  description: 'Conducts independent peer code reviews, filters out boilerplate/slop, validates diff correctness, and enforces anti-self-review.',
  requiredCapabilities: ['chat'],
  readOnly: true,
  allowedOutputPrefixes: ['reports/'],
};

export function buildPrompt(params = {}) {
  const { diff = '', objective = '', implementerId = '', reviewerId = '' } = params;

  if (implementerId && reviewerId && implementerId === reviewerId) {
    throw new Error(`Anti-self-review violation: Reviewer '${reviewerId}' cannot review its own work from '${implementerId}'.`);
  }

  return `You are acting as an Independent Code Reviewer.
Inspect the provided diff with adversarial scrutiny.
Verify that the diff is minimal, adheres strictly to requirements, avoids speculative abstractions, and includes tests.

Objective:
${objective}

Git Diff:
\`\`\`diff
${diff}
\`\`\`

Anti-Slop Checklist:
- No unused interfaces or single-implementation factories.
- No empty catch blocks or suppressed errors.
- No unrequested dependencies.
- No decorative/tautological comments.
- Test coverage present and passing.

Output Requirements:
Return a structured JSON object with:
{
  "verdict": "PASS | FAIL_MINOR | FAIL_MAJOR | BLOCKER",
  "findings": [
    {
      "severity": "INFO | MINOR | MAJOR | BLOCKER",
      "file": "path/to/file.ext",
      "line": 42,
      "issue": "Specific description of bug or violation",
      "suggestion": "How to fix"
    }
  ],
  "recommendation": "Ready to merge | Requires targeted fixes | Reject"
}`;
}

export function validateContract(data) {
  if (!data || typeof data !== 'object') throw new Error('Contract must be an object');
  if (!['PASS', 'FAIL_MINOR', 'FAIL_MAJOR', 'BLOCKER'].includes(data.verdict)) {
    throw new Error('Invalid review verdict');
  }
  if (!Array.isArray(data.findings)) throw new Error('"findings" must be an array');
  return true;
}
