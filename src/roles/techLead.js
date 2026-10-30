// Tech Lead / Architecture Arbiter (formerly architecture_adjudicator)
// Arbitrates architectural disputes, evaluates technical trade-offs, and enforces engineering guidelines.

export const definition = {
  id: 'tech-lead',
  title: 'Technical Lead',
  formerName: 'architecture_adjudicator',
  category: 'architecture',
  description: 'Arbitrates architectural disagreements, evaluates trade-offs between competing proposals, and governs technical standards.',
  requiredCapabilities: ['chat', 'reasoning'],
  readOnly: false,
  allowedOutputPrefixes: ['docs/', 'reports/'],
};

export function buildPrompt(params = {}) {
  const { proposals = [], issue = '', constraints = [] } = params;
  return `You are acting as the Technical Lead and Architecture Arbiter.
Review the competing technical proposals, evaluate trade-offs against constraints, and make a binding adjudication.

Dispute / Architecture Decision:
${issue}

Constraints:
${constraints.map((c) => `- ${c}`).join('\n')}

Proposals:
${JSON.stringify(proposals, null, 2)}

Output Requirements:
Return a structured JSON object with:
{
  "verdict": "APPROVED_PROPOSAL_A | APPROVED_PROPOSAL_B | COMPROMISE | REJECTED",
  "chosen_solution": "Summary of the accepted approach",
  "rationale": "Clear technical justification citing simplicity, maintainability, and constraints",
  "required_adjustments": ["mandatory modifications required before implementation"],
  "technical_debt_impact": "LOW | MEDIUM | HIGH with explanation"
}`;
}

export function validateContract(data) {
  if (!data || typeof data !== 'object') throw new Error('Contract must be an object');
  if (!data.verdict || typeof data.verdict !== 'string') throw new Error('Missing "verdict"');
  if (!data.chosen_solution || typeof data.chosen_solution !== 'string') throw new Error('Missing "chosen_solution"');
  if (!data.rationale || typeof data.rationale !== 'string') throw new Error('Missing "rationale"');
  return true;
}
