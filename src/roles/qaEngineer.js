// Quality Assurance Engineer / Release Gate Lead (formerly critical_acceptance)
// Verifies terminal operational criteria, test results, and issues definitive acceptance verdicts.

export const definition = {
  id: 'qa-engineer',
  title: 'QA Engineer',
  formerName: 'critical_acceptance',
  category: 'quality',
  description: 'Validates operational criteria, executes end-to-end acceptance gates, and certifies releases.',
  requiredCapabilities: ['chat'],
  readOnly: true,
  allowedOutputPrefixes: ['reports/'],
};

export function buildPrompt(params = {}) {
  const { criteria = [], testResults = {}, reviewVerdict = '' } = params;
  return `You are acting as a Quality Assurance Lead and Release Acceptance Engineer.
Perform the final acceptance evaluation against operational success criteria.

Acceptance Criteria:
${criteria.map((c) => `- ${c}`).join('\n')}

Review Verdict:
${reviewVerdict}

Test Results:
${JSON.stringify(testResults, null, 2)}

Output Requirements:
Return a structured JSON object with:
{
  "verdict": "APPROVED | REJECTED",
  "criteria_results": [
    {
      "criterion": "Name of criterion",
      "satisfied": true,
      "evidence": "Observed test output or check"
    }
  ],
  "open_risks": ["unresolved risks, if any"],
  "release_readiness": "READY_FOR_PRODUCTION | BLOCKED"
}`;
}

export function validateContract(data) {
  if (!data || typeof data !== 'object') throw new Error('Contract must be an object');
  if (!['APPROVED', 'REJECTED'].includes(data.verdict)) {
    throw new Error('verdict must be APPROVED or REJECTED');
  }
  if (!Array.isArray(data.criteria_results)) {
    throw new Error('"criteria_results" must be an array');
  }
  return true;
}
