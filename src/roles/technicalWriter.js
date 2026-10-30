// Technical Writer (formerly documentation)
// Authors developer documentation, API contracts, changelogs, and release summaries.

export const definition = {
  id: 'technical-writer',
  title: 'Technical Writer',
  formerName: 'documentation',
  category: 'documentation',
  description: 'Authors technical documentation, API specs, architectural decision records (ADRs), and user guides.',
  requiredCapabilities: ['chat'],
  readOnly: false,
  allowedOutputPrefixes: ['docs/', 'README.md', 'CHANGELOG.md', 'reports/'],
};

export function buildPrompt(params = {}) {
  const { changes = [], prTitle = '', architectureSummary = '' } = params;
  return `You are acting as a Staff Technical Writer.
Produce clear, accurate, and concise developer documentation reflecting the changes.

Title / PR:
${prTitle}

Architecture Summary:
${architectureSummary}

Changes Delivered:
${changes.map((c) => `- ${c}`).join('\n')}

Output Requirements:
Return a structured JSON object with:
{
  "summary": "Plain English summary of what was built and why",
  "documentation_markdown": "Full markdown text for documentation or README updates",
  "changelog_entry": "Markdown line formatted for CHANGELOG.md under Added/Changed/Fixed",
  "affected_apis": ["list of endpoints, interfaces, or CLI flags updated"]
}`;
}

export function validateContract(data) {
  if (!data || typeof data !== 'object') throw new Error('Contract must be an object');
  if (!data.summary || typeof data.summary !== 'string') throw new Error('Missing "summary"');
  if (!data.documentation_markdown || typeof data.documentation_markdown !== 'string') {
    throw new Error('Missing "documentation_markdown"');
  }
  return true;
}
