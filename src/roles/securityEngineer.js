// Application Security Engineer (formerly spec_critic)
// Adversarial security reviews, threat modeling, attack surface analysis, and edge case identification.

export const definition = {
  id: 'security-engineer',
  title: 'Security Engineer',
  formerName: 'spec_critic',
  category: 'security',
  description: 'Conducts adversarial audits, threat modeling, vulnerability assessments, and boundary validation.',
  requiredCapabilities: ['chat'],
  readOnly: true,
  allowedOutputPrefixes: ['reports/'],
};

export function buildPrompt(params = {}) {
  const { implementationContract = {}, architecture = '' } = params;
  return `You are acting as an Application Security Engineer.
Perform an adversarial security review of the technical design and contract. Search for trust boundary violations, injection vectors, authorization bypasses, and data-loss edge cases.

Architecture / Contract:
${JSON.stringify(implementationContract, null, 2)}
${architecture}

Output Requirements:
Return a structured JSON object with:
{
  "verdict": "PASS | REVISE | BLOCK",
  "findings": [
    {
      "severity": "INFO | MINOR | MAJOR | BLOCKER",
      "category": "AUTH | INJECTION | DATA_LOSS | PRIVACY | RESOURCE_EXHAUSTION | EDGE_CASE",
      "description": "Clear explanation of the risk",
      "remediation": "Concrete action required to mitigate"
    }
  ],
  "threat_model_summary": "Concise summary of evaluated attack vectors",
  "recommended_mitigations": ["mitigation 1", "mitigation 2"]
}`;
}

export function validateContract(data) {
  if (!data || typeof data !== 'object') throw new Error('Contract must be an object');
  if (!['PASS', 'REVISE', 'BLOCK'].includes(data.verdict)) {
    throw new Error('verdict must be PASS, REVISE, or BLOCK');
  }
  if (!Array.isArray(data.findings)) throw new Error('"findings" must be an array');
  for (const f of data.findings) {
    if (!['INFO', 'MINOR', 'MAJOR', 'BLOCKER'].includes(f.severity)) {
      throw new Error(`Invalid finding severity: ${f.severity}`);
    }
  }
  return true;
}
