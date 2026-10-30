// Canonical Registry of Industry Roles for AI Agent Orchestration.
// Zero dependencies - Node.js stdlib only.

import * as productManager from './productManager.js';
import * as systemAnalyst from './systemAnalyst.js';
import * as softwareArchitect from './softwareArchitect.js';
import * as techLead from './techLead.js';
import * as securityEngineer from './securityEngineer.js';
import * as softwareEngineer from './softwareEngineer.js';
import * as codeReviewer from './codeReviewer.js';
import * as sreEngineer from './sreEngineer.js';
import * as qaEngineer from './qaEngineer.js';
import * as technicalWriter from './technicalWriter.js';
import * as engineeringManager from './engineeringManager.js';
import * as mediaProducer from './mediaProducer.js';
import { checkCommandExecution, checkFileWrite, checkOutputWrite, READ_ONLY_ROLES, FORBIDDEN_COMMAND_PATTERNS } from './authority.js';

export const ROLES = {
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

// Legacy name alias mapping for backwards compatibility
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

export function getRole(idOrAlias) {
  if (!idOrAlias) return null;
  const normalized = idOrAlias.toLowerCase().replace(/_/g, '-');
  if (ROLES[normalized]) return ROLES[normalized];
  const mapped = LEGACY_ALIASES[idOrAlias.toLowerCase()];
  if (mapped && ROLES[mapped]) return ROLES[mapped];
  return null;
}

export function listRoles() {
  return Object.values(ROLES).map((mod) => mod.definition);
}

export {
  checkCommandExecution,
  checkFileWrite,
  checkOutputWrite,
  READ_ONLY_ROLES,
  FORBIDDEN_COMMAND_PATTERNS,
  productManager,
  systemAnalyst,
  softwareArchitect,
  techLead,
  securityEngineer,
  softwareEngineer,
  codeReviewer,
  sreEngineer,
  qaEngineer,
  technicalWriter,
  engineeringManager,
  mediaProducer,
};
