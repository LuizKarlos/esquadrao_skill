// Structural Authority Matrix and Permission Guard for Engineering Roles.
// Zero-dependency native Node.js implementation.

export const FORBIDDEN_COMMAND_PATTERNS = [
  /git\s+push\b.*?\b(main|master)\b/i,
  /git\s+push\b.*?\s+(-f|--force)\b/i,
  /git\s+merge\b.*?\b(main|master)\b/i,
  /git\s+reset\s+--hard\b/i,
  /rm\s+-rf\s+[\/\\]/i,
];

export const READ_ONLY_ROLES = new Set([
  'system-analyst',
  'security-engineer',
  'code-reviewer',
]);

export const ALLOWED_READ_COMMAND_PREFIXES = [
  'git status',
  'git diff',
  'git log',
  'git rev-parse',
  'git branch',
  'node -v',
  'npm test',
  'dir',
  'ls',
  'find',
];

export function checkCommandExecution(roleId, command) {
  const cmd = (command || '').trim();
  for (const pattern of FORBIDDEN_COMMAND_PATTERNS) {
    if (pattern.test(cmd)) {
      throw new Error(`Structural violation: Command matches forbidden pattern '${pattern}' for role '${roleId}'.`);
    }
  }

  if (READ_ONLY_ROLES.has(roleId)) {
    const isAllowed = ALLOWED_READ_COMMAND_PREFIXES.some((prefix) =>
      cmd.toLowerCase().startsWith(prefix.toLowerCase())
    );
    if (!isAllowed) {
      throw new Error(`Structural violation: Role '${roleId}' is strictly read-only and cannot execute mutating command: '${cmd}'.`);
    }
  }
}

export function checkFileWrite(roleId, filePath) {
  if (READ_ONLY_ROLES.has(roleId)) {
    throw new Error(`Structural violation: Role '${roleId}' is strictly read-only. File write denied for '${filePath}'.`);
  }
}
