// CLI command: universal-skill role [list|info|prompt|matrix]
import { listRoles, getRole, READ_ONLY_ROLES, FORBIDDEN_COMMAND_PATTERNS } from '../roles/index.js';

export async function run({ positionals = [], flags = {} } = {}) {
  const sub = positionals[0] || 'list';

  if (flags.help || sub === 'help') {
    console.log(`Universal Skill Roles Command

Usage:
  universal-skill role [subcommand] [arguments] [options]

Subcommands:
  list              List all standard industry engineering roles (default)
  info <id>         Display role specification, capabilities, and authority
  prompt <id>       Generate calibrated prompt for an agent role
  matrix            Display structural authority matrix and permission boundaries

Options:
  --json            Output results in JSON format
  -h, --help        Show this help message`);
    return;
  }

  if (sub === 'list') {
    const roles = listRoles();
    if (flags.json) {
      console.log(JSON.stringify(roles, null, 2));
      return;
    }
    console.log('Universal Industry Roles Matrix:\n');
    for (const r of roles) {
      const roTag = r.readOnly ? '[READ-ONLY]' : '[READ/WRITE]';
      console.log(`  ${r.id.padEnd(22)} ${roTag.padEnd(14)} ${r.title}`);
      console.log(`    Description:  ${r.description}`);
      console.log(`    Capabilities: ${r.requiredCapabilities.join(', ')}`);
      if (r.formerName) console.log(`    Former name:  ${r.formerName}`);
      console.log('');
    }
    return;
  }

  if (sub === 'info') {
    const target = positionals[1];
    if (!target) {
      console.error('Error: Missing role identifier. Usage: universal-skill role info <role_id>');
      process.exit(1);
    }
    const roleMod = getRole(target);
    if (!roleMod) {
      console.error(`Error: Unknown role '${target}'. Run 'universal-skill role list' to see available roles.`);
      process.exit(1);
    }
    if (flags.json) {
      console.log(JSON.stringify(roleMod.definition, null, 2));
      return;
    }
    const def = roleMod.definition;
    console.log(`Role Specification: ${def.title} (${def.id})`);
    console.log(`--------------------------------------------------`);
    console.log(`Category:        ${def.category}`);
    console.log(`Access:          ${def.readOnly ? 'Strictly Read-Only' : 'Read/Write'}`);
    console.log(`Capabilities:    ${def.requiredCapabilities.join(', ')}`);
    console.log(`Allowed Outputs: ${def.allowedOutputPrefixes.join(', ')}`);
    if (def.formerName) console.log(`Former Alias:    ${def.formerName}`);
    console.log(`\nDescription:\n  ${def.description}`);
    return;
  }

  if (sub === 'prompt') {
    const target = positionals[1];
    if (!target) {
      console.error('Error: Missing role identifier. Usage: universal-skill role prompt <role_id> [intent]');
      process.exit(1);
    }
    const roleMod = getRole(target);
    if (!roleMod) {
      console.error(`Error: Unknown role '${target}'.`);
      process.exit(1);
    }
    const intent = positionals.slice(2).join(' ') || 'Fulfill the primary engineering task.';
    const prompt = roleMod.buildPrompt({ intent, objective: intent });
    if (flags.json) {
      console.log(JSON.stringify({ role: roleMod.definition.id, prompt }, null, 2));
      return;
    }
    console.log(prompt);
    return;
  }

  if (sub === 'matrix') {
    const matrix = {
      readOnlyRoles: Array.from(READ_ONLY_ROLES),
      forbiddenPatterns: FORBIDDEN_COMMAND_PATTERNS.map((p) => p.source),
      roles: listRoles().map((r) => ({
        id: r.id,
        title: r.title,
        readOnly: r.readOnly,
        allowedPrefixes: r.allowedOutputPrefixes,
      })),
    };
    if (flags.json) {
      console.log(JSON.stringify(matrix, null, 2));
      return;
    }
    console.log('Structural Authority Matrix:\n');
    console.log(`Read-Only Roles: ${matrix.readOnlyRoles.join(', ')}`);
    console.log(`Forbidden Command Patterns:\n${matrix.forbiddenPatterns.map((p) => `  - ${p}`).join('\n')}\n`);
    for (const r of matrix.roles) {
      console.log(`- ${r.id.padEnd(20)} ${r.readOnly ? 'RO' : 'RW'} (Outputs: ${r.allowedPrefixes.join(', ')})`);
    }
    return;
  }

  console.error(`Unknown subcommand '${sub}'. Run 'universal-skill role --help' for usage.`);
  process.exit(1);
}

export default run;
