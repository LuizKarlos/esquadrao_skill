import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const SKILLS = [
  'skill-orchestrate',
  'skill-pipeline',
  'skill-review',
  'skill-audit',
  'skill-context',
  'skill-ui',
  'skill-product-manager',
  'skill-system-analyst',
  'skill-software-architect',
  'skill-tech-lead',
  'skill-security-engineer',
  'skill-software-engineer',
  'skill-code-reviewer',
  'skill-sre-engineer',
  'skill-qa-engineer',
  'skill-technical-writer',
  'skill-engineering-manager',
  'skill-media-producer',
];

// ponytail: synchronous copy; upgrade to async workers when syncing >50 skills
export async function run({ positionals = [], flags = {} } = {}) {
  if (flags?.help) {
    console.log('Usage: esquadrao setup [--dest <path>] [--json]');
    return;
  }

  const rootDir = fileURLToPath(new URL('../../', import.meta.url));
  const cwd = process.cwd();
  const destArg = typeof flags?.dest === 'string' ? flags.dest : (positionals[0] || null);
  const destDir = destArg || path.join(cwd, '.agents', 'skills');

  fs.mkdirSync(destDir, { recursive: true });
  const installed = [];
  for (const item of [...SKILLS, 'scripts']) {
    const src = path.join(rootDir, item);
    if (fs.existsSync(src)) {
      fs.cpSync(src, path.join(destDir, item), { recursive: true });
      installed.push(item);
    }
  }

  const harnesses = [];

  // If a custom destination was not explicitly passed, configure local project harnesses
  if (!destArg) {
    // 1. Grok Build / Agent Skills
    if (fs.existsSync(path.join(cwd, '.agents'))) {
      harnesses.push('.agents');
    }

    // 2. Claude Code
    const claudeDir = path.join(cwd, '.claude');
    if (fs.existsSync(claudeDir)) {
      harnesses.push('.claude');
      const claudeSkillsDir = path.join(claudeDir, 'skills');
      fs.mkdirSync(claudeSkillsDir, { recursive: true });
      for (const item of SKILLS) {
        const src = path.join(rootDir, item);
        if (fs.existsSync(src)) {
          fs.cpSync(src, path.join(claudeSkillsDir, item), { recursive: true });
        }
      }
    }

    // 3. Codex CLI (detects .codex or ~/.codex or AGENTS.md)
    const codexDir = path.join(cwd, '.codex');
    const userCodex = path.join(os.homedir(), '.codex');
    if (fs.existsSync(codexDir) || fs.existsSync(userCodex) || fs.existsSync(path.join(cwd, 'AGENTS.md'))) {
      harnesses.push('.codex');
      const codexSkillsDir = path.join(codexDir, 'skills');
      fs.mkdirSync(codexSkillsDir, { recursive: true });
      for (const item of SKILLS) {
        const src = path.join(rootDir, item);
        if (fs.existsSync(src)) {
          fs.cpSync(src, path.join(codexSkillsDir, item), { recursive: true });
        }
      }

      // Ensure AGENTS.md references the skills
      const agentsMdPath = path.join(cwd, 'AGENTS.md');
      if (!fs.existsSync(agentsMdPath)) {
        fs.writeFileSync(
          agentsMdPath,
          '# Agent Instructions\n\nSkills are installed in `.codex/skills/` and `.agents/skills/`.\n'
        );
      }
    }

    // 4. Cursor Rules (.cursor/rules/*.mdc)
    const cursorDir = path.join(cwd, '.cursor');
    if (fs.existsSync(cursorDir)) {
      harnesses.push('.cursor');
      const rulesDir = path.join(cursorDir, 'rules');
      fs.mkdirSync(rulesDir, { recursive: true });
      fs.writeFileSync(
        path.join(rulesDir, 'esquadrao.mdc'),
        '---\ndescription: Esquadrao Skills Rules\nglobs: *\n---\nUse esquadrao tools and CLI.\n'
      );
    }

    // 5. VS Code
    if (fs.existsSync(path.join(cwd, '.vscode'))) harnesses.push('.vscode');

    // 6. Hermes
    if (fs.existsSync(path.join(os.homedir(), '.hermes'))) harnesses.push('.hermes');
  }

  const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
  const nodeOk = nodeMajor >= 18;

  const report = {
    status: nodeOk ? 'ok' : 'degraded',
    prerequisites: { node: { version: process.version, valid: nodeOk } },
    installation: { destination: destDir, installed },
    harnesses,
  };

  if (flags?.json) {
    console.log(JSON.stringify(report));
  } else {
    console.log(`Esquadrão Setup: ${report.status.toUpperCase()}`);
    console.log(`- Node.js: ${process.version} (${nodeOk ? 'OK' : 'Requires >= 18'})`);
    console.log(`- Installed ${installed.length} items to ${destDir}`);
    if (harnesses.length) console.log(`- Harnesses detected: ${harnesses.join(', ')}`);
  }
  return report;
}

export default run;
