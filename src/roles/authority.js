// Structural Authority Matrix and Permission Guard for Engineering Roles.
// Zero-dependency native Node.js implementation.

import { definition as productManager } from './productManager.js';
import { definition as systemAnalyst } from './systemAnalyst.js';
import { definition as softwareArchitect } from './softwareArchitect.js';
import { definition as techLead } from './techLead.js';
import { definition as securityEngineer } from './securityEngineer.js';
import { definition as softwareEngineer } from './softwareEngineer.js';
import { definition as codeReviewer } from './codeReviewer.js';
import { definition as sreEngineer } from './sreEngineer.js';
import { definition as qaEngineer } from './qaEngineer.js';
import { definition as technicalWriter } from './technicalWriter.js';
import { definition as engineeringManager } from './engineeringManager.js';
import { definition as mediaProducer } from './mediaProducer.js';

const ROLE_DEFINITIONS = {
  'product-manager': productManager,
  'system-analyst': systemAnalyst,
  'software-architect': softwareArchitect,
  'tech-lead': techLead,
  'security-engineer': securityEngineer,
  'software-engineer': softwareEngineer,
  'code-reviewer': codeReviewer,
  'sre-engineer': sreEngineer,
  'qa-engineer': qaEngineer,
  'technical-writer': technicalWriter,
  'engineering-manager': engineeringManager,
  'media-producer': mediaProducer,
};

export const LEGACY_ALIASES = {
  mission_compiler: 'product-manager',
  cartographer: 'system-analyst',
  chief_architect: 'software-architect',
  architecture_adjudicator: 'tech-lead',
  spec_critic: 'security-engineer',
  implementer: 'software-engineer',
  reviewer: 'code-reviewer',
  failure_diagnostician: 'sre-engineer',
  critical_acceptance: 'qa-engineer',
  documentation: 'technical-writer',
  next_mission_generator: 'engineering-manager',
  studio_director: 'media-producer',
};

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

  const normalized = (roleId || '').toLowerCase().replace(/_/g, '-');
  const canonical = LEGACY_ALIASES[roleId?.toLowerCase()] || normalized;
  if (READ_ONLY_ROLES.has(roleId) || READ_ONLY_ROLES.has(canonical)) {
    const isAllowed = ALLOWED_READ_COMMAND_PREFIXES.some((prefix) =>
      cmd.toLowerCase().startsWith(prefix.toLowerCase())
    );
    if (!isAllowed) {
      throw new Error(`Structural violation: Role '${roleId}' is strictly read-only and cannot execute mutating command: '${cmd}'.`);
    }
  }
}

export function checkOutputWrite(roleId, filePath) {
  const normalized = (roleId || '').toLowerCase().replace(/_/g, '-');
  const canonical = LEGACY_ALIASES[roleId?.toLowerCase()] || normalized;
  const def = ROLE_DEFINITIONS[canonical];

  if (!def) {
    throw new Error(`Structural violation: Unknown role '${roleId}'.`);
  }

  const prefixes = def.allowedOutputPrefixes || def.allowedOutputs || [];
  if (prefixes.includes('*')) {
    return;
  }

  // ponytail: relative prefix and exact match only; upgrade to glob engine if complex wildcard patterns needed
  const normalizedPath = filePath.replace(/\\/g, '/').replace(/^\.\//, '');
  const isAllowed = prefixes.some((prefix) => {
    if (prefix.endsWith('/')) {
      return normalizedPath.startsWith(prefix) || normalizedPath === prefix.slice(0, -1);
    }
    return normalizedPath === prefix;
  });

  if (!isAllowed) {
    throw new Error(`Structural violation: File '${filePath}' violates allowed output prefixes for role '${roleId}'. Allowed: ${prefixes.join(', ')}`);
  }
}

export function checkFileWrite(roleId, filePath) {
  const normalized = (roleId || '').toLowerCase().replace(/_/g, '-');
  const canonical = LEGACY_ALIASES[roleId?.toLowerCase()] || normalized;
  if (READ_ONLY_ROLES.has(roleId) || READ_ONLY_ROLES.has(canonical)) {
    throw new Error(`Structural violation: Role '${roleId}' is strictly read-only. File write denied for '${filePath}'.`);
  }
  checkOutputWrite(roleId, filePath);
}
