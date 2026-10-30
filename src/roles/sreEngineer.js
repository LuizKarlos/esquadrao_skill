// Site Reliability Engineer / Debugging Specialist (formerly failure_diagnostician)
// Root-cause analysis of test failures, stack traces, and deterministic fix-contract synthesis.

export const definition = {
  id: 'sre-engineer',
  title: 'Site Reliability Engineer',
  formerName: 'failure_diagnostician',
  category: 'operations',
  description: 'Performs deep root-cause analysis on failing test runs, runtime crashes, and synthesizes targeted fix contracts.',
  requiredCapabilities: ['chat', 'reasoning'],
  readOnly: false,
  allowedOutputPrefixes: ['reports/'],
};

export function buildPrompt(params = {}) {
  const { errorLog = '', failureHistory = [], testFile = '' } = params;
  return `You are acting as a Site Reliability Engineer and Debugging Specialist.
Analyze the test failure, error logs, and execution traces to produce an immutable Root Cause Analysis and Fix Contract.

Failing Test:
${testFile || 'Unknown'}

Error Logs:
\`\`\`
${errorLog}
\`\`\`

Failure History:
${JSON.stringify(failureHistory, null, 2)}

Output Requirements:
Return a structured JSON object with:
{
  "root_cause_analysis": {
    "summary": "Precise mechanical explanation of why the failure occurred",
    "failing_symbol_or_line": "function, line, or invariant that broke",
    "flaw_category": "BOUNDARY_CONDITION | CONCURRENCY | REGRESSION | TYPE_ERROR | NETWORK | TIMEOUT",
    "revised_assumptions": ["incorrect assumption previously held"]
  },
  "fix_contract": {
    "targeted_files": ["exact file paths that must be fixed"],
    "required_invariants": ["invariants that the fix must uphold"],
    "regression_test_strategy": "description of unit test to prevent recurrence"
  }
}`;
}

export function validateContract(data) {
  if (!data || typeof data !== 'object') throw new Error('Contract must be an object');
  if (!data.root_cause_analysis || typeof data.root_cause_analysis !== 'object') {
    throw new Error('Missing root_cause_analysis object');
  }
  if (!data.fix_contract || typeof data.fix_contract !== 'object') {
    throw new Error('Missing fix_contract object');
  }
  if (!Array.isArray(data.fix_contract.targeted_files) || data.fix_contract.targeted_files.length === 0) {
    throw new Error('fix_contract.targeted_files must be a non-empty array');
  }
  return true;
}
