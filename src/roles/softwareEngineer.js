// Senior Software Engineer (formerly implementer)
// Generates production-grade atomic code patches, unit tests, and minimal working diffs.

export const definition = {
  id: 'software-engineer',
  title: 'Senior Software Engineer',
  formerName: 'implementer',
  category: 'engineering',
  description: 'Implements production code within strictly authorized scope, authors focused unit tests, and delivers clean atomic patches.',
  requiredCapabilities: ['chat', 'tool_calling'],
  readOnly: false,
  allowedOutputPrefixes: ['*'],
};

export function buildPrompt(params = {}) {
  const {
    objective = '',
    allowedChanges = [],
    forbiddenChanges = [],
    invariants = [],
    existingContext = '',
  } = params;

  return `You are acting as a Senior Software Engineer.
Implement the requested feature or fix within the authorized scope.
Follow the "laziness" principle: minimal working diff, native stdlib first, zero unrequested dependencies.

Objective:
${objective}

Authorized Files (allowed_changes):
${allowedChanges.map((f) => `- ${f}`).join('\n')}

Forbidden Files (do NOT touch):
${forbiddenChanges.map((f) => `- ${f}`).join('\n') || '- None'}

Invariants to Preserve:
${invariants.map((i) => `- ${i}`).join('\n')}

Relevant Existing Code Context:
${existingContext}

Output Requirements:
Your code deliverables must be provided in clean FILE blocks in the following format:
FILE: path/to/file.ext
\`\`\`
// file content
\`\`\`

Rules:
1. Every modified or created file must have its full content inside a FILE block.
2. Touch ONLY files listed in Authorized Files.
3. Include at least one runnable test verifying the core logic.
4. Do not include speculative boilerplate or unused abstractions.`;
}

export function parseFileBlocks(text = '') {
  const fileRegex = /FILE:\s*([^\r\n]+)\r?\n```[^\r\n]*\r?\n([\s\S]*?)```/g;
  const files = [];
  let match;
  while ((match = fileRegex.exec(text)) !== null) {
    files.push({
      path: match[1].trim(),
      content: match[2],
    });
  }
  return files;
}

export function validateContract(data) {
  if (!data || typeof data !== 'object') throw new Error('Contract must be an object');
  if (!Array.isArray(data.files_changed) && !Array.isArray(data.files)) {
    throw new Error('Must provide files_changed or files list');
  }
  return true;
}
