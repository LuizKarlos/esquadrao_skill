# Universal Skill CLI

Universal CLI and autonomous skill orchestration framework for AI agents and Model Context Protocol (MCP) integrations.

## Overview

`@universal-skill/cli` provides a portable, zero-dependency bridge to run skills and tools across any AI coding agent and CLI:

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

# Check MCP server status and health
universal-skill status [--endpoint <url>] [--json]

# Call an MCP tool directly from the terminal
universal-skill call <tool_name> '[json_arguments]' [--endpoint <url>] [--json]

# Persist authentication credentials locally (~/.config/universal-skill/credentials.json)
universal-skill login <token> [--endpoint <url>]
```

## Environment Variables

- `MCP_ENDPOINT`: MCP server endpoint URL (default: `http://127.0.0.1:8000/mcp`)
- `MCP_TOKEN`: Bearer authentication token for MCP server

## Skills Matrix

| Skill | Description |
| :--- | :--- |
| `skill-orchestrate` | Autonomous missions, multi-agent swarms, atomic checkpoints, and rollbacks |
| `skill-pipeline` | DAG decomposition, topological wave calculation, and auto-healing |
| `skill-review` | Adversarial dual-blind code review, anti-slop pattern linting, and voice calibration |
| `skill-audit` | SHA-256 Merkle chain integrity, receipt verification, and time-travel replay |
| `skill-context` | AST outline slicing, OpenAPI 3.1 contract synthesis, and context packets <3k tokens |
| `skill-ui` | Headless WCAG 2.1 AA/AAA contrast check, 44x44px touch targets, and visual TDD |

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
