// Product Manager Role (formerly mission_compiler)
// Synthesizes business & human intent into validated requirement contracts and bounded scope.

export const definition = {
  id: 'product-manager',
  title: 'Product Manager',
  formerName: 'mission_compiler',
  category: 'product',
  description: 'Compiles initial product briefs, synthesizes user intent into formal requirements, constraints, and scope boundaries.',
  requiredCapabilities: ['chat'],
  readOnly: false,
  allowedOutputPrefixes: ['docs/', 'reports/', 'requirements/'],
};

export function buildPrompt(params = {}) {
  const { intent = '', constraints = [], scopeHint = [] } = params;
  return `You are acting as a Staff Product Manager.
Analyze the human intent and produce a crisp, canonical requirements contract.

Input Intent:
${intent}

Constraints:
${constraints.map((c) => `- ${c}`).join('\n') || '- None provided'}

Scope Hint:
${scopeHint.map((s) => `- ${s}`).join('\n') || '- None provided'}

Output Requirements:
Return a structured JSON object with the following fields:
{
  "objective": "A single concise statement of the primary goal",
  "problem_statement": "Detailed description of the issue or feature",
  "scope": ["concrete in-scope item 1", "concrete in-scope item 2"],
  "out_of_scope": ["explicitly excluded items"],
  "constraints": ["technical, operational, or business boundaries"],
  "success_criteria": ["measurable criterion 1", "measurable criterion 2"],
  "risk_level": "LOW | MEDIUM | HIGH | CRITICAL"
}`;
}

export function validateContract(data) {
  if (!data || typeof data !== 'object') throw new Error('Contract must be an object');
  if (!data.objective || typeof data.objective !== 'string') throw new Error('Missing or invalid "objective"');
  if (!Array.isArray(data.scope)) throw new Error('"scope" must be an array');
  if (!Array.isArray(data.success_criteria) || data.success_criteria.length === 0) {
    throw new Error('"success_criteria" must be a non-empty array');
  }
  return true;
}
