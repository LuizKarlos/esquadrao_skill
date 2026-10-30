// Systems Analyst / Codebase Navigator (formerly cartographer)
// Maps repository structure, dependencies, entry points, and identifies affected modules.

export const definition = {
  id: 'system-analyst',
  title: 'Systems Analyst',
  formerName: 'cartographer',
  category: 'engineering',
  description: 'Navigates codebases, extracts module dependency graphs, maps architectural boundaries, and identifies touchpoints.',
  requiredCapabilities: ['chat'],
  readOnly: true,
  allowedOutputPrefixes: ['reports/'],
};

export function buildPrompt(params = {}) {
  const { files = [], objective = '' } = params;
  return `You are acting as a Systems Analyst and Codebase Navigator.
Perform read-only repository reconnaissance and map structural dependencies for the stated objective.

Objective:
${objective}

Discovered File Tree (sample):
${files.slice(0, 100).map((f) => `- ${f}`).join('\n')}

Output Requirements:
Return a structured JSON object with:
{
  "summary": "High-level summary of relevant codebase modules",
  "entrypoints": ["main entrypoint files"],
  "affected_components": ["components likely impacted"],
  "dependency_graph": {
    "moduleA": ["dependsOnB", "dependsOnC"]
  },
  "suggested_scope": ["concrete file paths to inspect or modify"]
}`;
}

export function validateContract(data) {
  if (!data || typeof data !== 'object') throw new Error('Contract must be an object');
  if (!data.summary || typeof data.summary !== 'string') throw new Error('Missing or invalid "summary"');
  if (!Array.isArray(data.entrypoints)) throw new Error('"entrypoints" must be an array');
  if (!Array.isArray(data.suggested_scope)) throw new Error('"suggested_scope" must be an array');
  return true;
}
