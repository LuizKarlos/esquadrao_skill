# Universal Skill CLI

Universal CLI and autonomous skill orchestration framework for AI agents and Model Context Protocol (MCP) integrations.

## Overview

`@universal-skill/cli` provides a portable, zero-dependency bridge to run skills, roles, and tools across any AI coding agent and CLI:

- **Grok Build** (`.agents/skills/`)
- **Claude Code** (`.claude/skills/`)
- **Codex CLI** (`.codex/skills/`, `AGENTS.md`)
- **Cursor** (`.cursor/rules/*.mdc`)
- **Hermes / VS Code** (`~/.hermes/`, `.vscode/`)

## Installation

### Run directly via npx
```bash
npx @universal-skill/cli setup
```

### Install globally via npm
```bash
npm install -g @universal-skill/cli
universal-skill setup
```

## Commands

```bash
# Set up skills and rules in current workspace harnesses
universal-skill setup [--dest <path>] [--endpoint <url>] [--write-mcp] [--json]

# Inspect and execute industry roles
universal-skill role [list | info <id> | prompt <id> | matrix] [--json]

# Check MCP server status and health
universal-skill status [--endpoint <url>] [--json]

# Call an MCP tool directly from the terminal
universal-skill call <tool_name> '[json_arguments]' [--endpoint <url>] [--json]

# Persist authentication credentials locally (~/.config/universal-skill/credentials.json)
universal-skill login <token> [--endpoint <url>]
```

## Industry Roles Matrix

All roles follow standardized industry nomenclature, structural authority boundaries, and zero-dependency contract validation:

| Role ID | Title | Access | Description |
| :--- | :--- | :--- | :--- |
| `product-manager` | Product Manager | Read/Write | Requirements contracts, bounded scope, acceptance criteria |
| `system-analyst` | Systems Analyst | Read-Only | Repository mapping, dependency graphs, architectural recon |
| `software-architect` | Principal Software Architect | Read/Write | System decomposition, interface invariants, rollback criteria |
| `tech-lead` | Technical Lead | Read/Write | Architectural adjudication, technical trade-offs, standard enforcement |
| `security-engineer` | Security Engineer | Read-Only | Adversarial threat modeling, vulnerability auditing, boundary checks |
| `software-engineer` | Senior Software Engineer | Read/Write | Production code implementation, unit tests, minimal working diffs |
| `code-reviewer` | Code Reviewer | Read-Only | Independent peer review, anti-slop linting, anti-self-review guard |
| `sre-engineer` | Site Reliability Engineer | Read/Write | Failure diagnosis, root cause analysis (RCA), fix contracts |
| `qa-engineer` | QA Engineer | Read-Only | Release verification, operational criteria check, terminal gates |
| `technical-writer` | Technical Writer | Read/Write | Developer guides, API documentation, changelogs, ADR records |
| `engineering-manager` | Engineering Manager | Read/Write | Milestone roadmaps, sprint backlogs, follow-up task generation |
| `media-producer` | Media Producer | Read/Write | Video edit plans, timeline cuts (>=100ms), NFC text, media QA |

## Skills Matrix

| Skill | Description |
| :--- | :--- |
| `skill-orchestrate` | Autonomous missions, multi-agent swarms, atomic checkpoints, and rollbacks |
| `skill-pipeline` | DAG decomposition, topological wave calculation, and auto-healing |
| `skill-review` | Adversarial dual-blind code review, anti-slop pattern linting, and voice calibration |
| `skill-audit` | SHA-256 Merkle chain integrity, receipt verification, and time-travel replay |
| `skill-context` | AST outline slicing, OpenAPI 3.1 contract synthesis, and context packets <3k tokens |
| `skill-ui` | Headless WCAG 2.1 AA/AAA contrast check, 44x44px touch targets, and visual TDD |
| `skill-product-manager` | Requirements synthesis, scope boundaries, and acceptance criteria |
| `skill-system-analyst` | Read-only codebase reconnaissance, dependency mapping, and touchpoints |
| `skill-software-architect` | Architectural contracts, system invariants, and rollback conditions |
| `skill-tech-lead` | Proposal arbitration, technical debt evaluation, and engineering guidelines |
| `skill-security-engineer` | Threat modeling, injection and privilege audit, fail-closed enforcement |
| `skill-software-engineer` | Implementation of atomic patches and focused unit tests |
| `skill-code-reviewer` | Independent diff review, anti-slop inspection, and anti-self-review |
| `skill-sre-engineer` | Root-cause analysis (RCA) and deterministic fix contracts |
| `skill-qa-engineer` | Final operational release gates and acceptance certification |
| `skill-technical-writer` | Developer guides, ADR documentation, and changelog authoring |
| `skill-engineering-manager` | Milestone derivations, sprint task backlogs, and agile planning |
| `skill-media-producer` | Video timeline cuts, audio gain leveling, NFC text overlays, media QA |

## Standalone Scripts

All scripts run directly with Node.js stdlib (zero dependencies):

- `node scripts/dag_validator.js tasks.json` - Validates DAG acyclicity and computes topological waves.
- `node scripts/merkle_verify.js ledger.json` - Verifies cryptographic continuity of Merkle blocks.
- `node scripts/ast_slice.js src/app.js` - Extracts structural AST signatures reducing tokens by >60%.
- `node scripts/wcag_check.js --fg="#000" --bg="#fff"` - Checks WCAG contrast ratios and target sizes.

## Testing

Run the native test suite:
```bash
npm test
```

## License

MIT
