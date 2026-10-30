// Principal Software Architect (formerly chief_architect)
// Strategic decomposition, interface contract synthesis, invariant definitions, and rollback criteria.

export const definition = {
  id: 'software-architect',
  title: 'Principal Software Architect',
  formerName: 'chief_architect',
  category: 'architecture',
  description: 'Decomposes complex systems, defines strict interface boundaries, establishes invariants, and authors implementation contracts.',
  requiredCapabilities: ['chat', 'reasoning'],
  readOnly: false,
  allowedOutputPrefixes: ['docs/', 'reports/', 'schemas/'],
};

export function buildPrompt(params = {}) {
  const { objective = '', requirements = {}, repoSummary = '', allowedCandidates = [] } = params;
  return `You are acting as a Principal Software Architect.
Synthesize an authoritative implementation contract with strict invariants and rollback criteria.

Objective:
${objective}

Requirements & Constraints:
${JSON.stringify(requirements, null, 2)}

Codebase Context:
${repoSummary}

Candidate Files for Modification:
${allowedCandidates.map((c) => `- ${c}`).join('\n') || '- None specified'}

Output Requirements:
Return a structured JSON object with:
{
  "architecture": "High-level technical solution design",
  "decisions": [
    {"decision": "choice made", "rationale": "why this choice was made"}
  ],
  "allowed_changes": ["concrete file paths authorized for modification, NO GLOBS"],
  "forbidden_changes": ["files or paths strictly protected from modification"],
  "invariants": ["system invariants that must not be broken"],
  "rollback_conditions": ["observable failure states that trigger immediate abort/revert"],
  "implementation_sequence": ["step 1", "step 2", "step 3"]
}`;
}

export function validateContract(data) {
  if (!data || typeof data !== 'object') throw new Error('Contract must be an object');
  if (!data.architecture || typeof data.architecture !== 'string') throw new Error('Missing "architecture"');
  if (!Array.isArray(data.allowed_changes)) throw new Error('"allowed_changes" must be an array');
  if (!Array.isArray(data.invariants) || data.invariants.length === 0) {
    throw new Error('"invariants" must be a non-empty array');
  }
  if (!Array.isArray(data.rollback_conditions) || data.rollback_conditions.length === 0) {
    throw new Error('"rollback_conditions" must be a non-empty array');
  }
  return true;
}
