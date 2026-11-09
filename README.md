# Esquadrão de Conteúdo CLI (`@universal-skill/cli`)

Framework autônomo local e CLI de orquestração de skills, execução de papéis técnicos e produção automatizada de vídeo vertical (9:16) e widescreen (16:9) via FFmpeg, com formato e estilo definidos pelo usuário.

---

## Documentação Canônica e Sincronia de Desenvolvimento

Este repositório (`LuizKarlos/esquadrao_skill`) adota engenharia rigorosa centrada no código e opera sincronizado com o funil de vendas e área de membros (`LuizKarlos/esquadrao_funil`):

- **[`SPEC.md`](./SPEC.md)**: Especificação técnica canônica contendo arquitetura zero-dependency, contratos dos comandos `onboard` e `studio`, soberania de escolha de formato pelo usuário e matriz de papéis.
- **[`GLOSSARY.md`](./GLOSSARY.md)**: Fonte canônica de terminologia, equivalências técnicas, códigos de saída e matriz anti-delírio.
- **[`ROADMAP.md`](./ROADMAP.md)**: Esteira viva de engenharia estruturada em 5 fases vinculadas às issues do repositório.
- **[`Guia Operacional para LLMs`](./skill-media-producer/references/llm-agent-guide.md)**: Playbook completo para agentes inteligentes (Claude, Cursor, Codex, Grok, Hermes) conduzirem onboarding sem alucinações.

---

## Overview

`@universal-skill/cli` provides a portable, zero-dependency bridge to run skills, roles, and tools across any AI coding agent and CLI:

- **Grok Build** (`.agents/skills/`)
- **Claude Code** (`.claude/skills/`)
- **Codex CLI** (`.codex/skills/`, `AGENTS.md`)
- **Cursor** (`.cursor/rules/*.mdc`)
- **Hermes / VS Code** (`~/.hermes/`, `.vscode/`)

## Requisitos

- **Node.js** >= 18.0.0
- **FFmpeg & ffprobe** no PATH (obrigatório para renderização de vídeo e comandos de studio/onboard):
  - **Windows**: `winget install Gyan.FFmpeg` ou `choco install ffmpeg`
  - **macOS**: `brew install ffmpeg`
  - **Linux (Debian/Ubuntu)**: `sudo apt update && sudo apt install -y ffmpeg`

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
# Comando principal canônico: esquadrao (ou universal-skill)
esquadrao onboard [--mode <mode>] [--dest <path>] [--file <file>] [--verbose] [--json]

# Auto-corte integrado: detecta silêncio, corta pausas, transcreve com Whisper e renderiza com QA
esquadrao studio auto-clip <video.mp4> [--silence-thresh -30dB] [--silence-duration 0.8] [--format 9:16] [--caption-style impact]

# Detector rápido de silêncio e pausas mortas
esquadrao studio detect-silence <video.mp4> [--json]

# Transcrição estruturada para análise de copy (exporta transcript.json e transcript.srt)
esquadrao studio transcribe <video.mp4> [--json]

# Configurar skills nos harnesses locais do usuário (.agents, .claude, .codex, .cursor)
esquadrao setup [--dest <path>] [--json]

# Inspecionar e executar papéis canônicos
esquadrao role [list | info <id> | prompt <id> | matrix] [--json]

# Inicializar workspace e importar mídia
esquadrao studio init [--dest <path>]
esquadrao studio import <file>

# Renderizar plano manual ou executar QA
esquadrao studio render <editplan.json>
esquadrao studio qa <artifact.mp4> [--plan <editplan.json>]
```

## Primeiro acesso

O comando `onboard` conduz o cliente do zero até o primeiro vídeo renderizado com validação automatizada de QA:

```bash
# Fluxo guiado interativo:
universal-skill onboard

# Execução não interativa com flags:
universal-skill onboard --mode dark --dest ./workspace
universal-skill onboard --mode edit_only --file ./raw.mp4 --dest ./workspace
universal-skill onboard --mode podcast_clip --file ./clip1.mp4 --file ./clip2.mp4 --dest ./workspace
```

### Flags do Onboard:
- `--mode <podcast_clip | edit_only | dark>`: Modo de vídeo (cortes com legendas, decupagem ou tipografia).
- `--format <9:16 | 16:9>`: Proporção de tela definida pelo usuário (Vertical 9:16 para mobile ou Widescreen 16:9 para desktop).
- `--dest <path>`: Diretório do workspace (persiste no perfil para reuso).
- `--file <path>`: Arquivo de vídeo fonte (pode ser repetido para múltiplos arquivos).
- `--verbose`: Exibe logs detalhados do FFmpeg em caso de erro.
- `--json`: Retorna resultado estruturado em formato JSON.

> **Importante — Soberania do Usuário:** Nem fundo preto (`dark`) nem widescreen (`16:9`) são impostos como padrão. O usuário escolhe a proporção e o estilo de edição.

### Configurar proporção, legendas e áudio

Siga o [guia completo de configuração inicial para Windows / PowerShell](skill-media-producer/references/configuracao-inicial.md): preparação do projeto, importação, plano de edição, formatos vertical/horizontal, legendas, áudio, renderização e QA. A referência acompanha a instalação da `skill-media-producer` e documenta as opções disponíveis e os limites atuais.

## Exemplos de EditPlan por Modo

### 1. Modo `dark` (zero footage, textos/overlays):
```json
{
  "schema_version": 1,
  "mode": "dark",
  "clips": [
    {
      "kind": "text",
      "text": "Universal Skill Onboarding",
      "duration_ms": 1000,
      "timeline_start_ms": 0
    }
  ],
  "output": {
    "width": 1080,
    "height": 1920,
    "fps_num": 30,
    "fps_den": 1,
    "video_codec": "h264",
    "audio_codec": "aac"
  }
}
```

### 2. Modo `edit_only` (2 cortes contíguos de fontes de vídeo):
```json
{
  "schema_version": 1,
  "mode": "edit_only",
  "clips": [
    {
      "kind": "video",
      "asset_id": "AST-12345678",
      "clip_id": "c1",
      "in_ms": 0,
      "out_ms": 500,
      "timeline_start_ms": 0,
      "speed": 1
    },
    {
      "kind": "video",
      "asset_id": "AST-12345678",
      "clip_id": "c2",
      "in_ms": 500,
      "out_ms": 1000,
      "timeline_start_ms": 500,
      "speed": 1
    }
  ],
  "audio_tracks": [
    { "kind": "source", "clip_id": "c1", "gain_db": 0 },
    { "kind": "source", "clip_id": "c2", "gain_db": 0 }
  ],
  "output": {
    "width": 1080,
    "height": 1920,
    "fps_num": 30,
    "fps_den": 1,
    "video_codec": "h264",
    "audio_codec": "aac"
  }
}
```

### 3. Modo `podcast_clip` (>= 1 corte com legendas visuais):
```json
{
  "schema_version": 1,
  "mode": "podcast_clip",
  "clips": [
    {
      "kind": "video",
      "asset_id": "AST-12345678",
      "clip_id": "c1",
      "in_ms": 0,
      "out_ms": 1000,
      "timeline_start_ms": 0,
      "speed": 1
    }
  ],
  "audio_tracks": [
    { "kind": "source", "clip_id": "c1", "gain_db": 0 }
  ],
  "captions": [
    {
      "text": "Universal Podcast Clip",
      "timeline_start_ms": 0,
      "duration_ms": 1000
    }
  ],
  "output": {
    "width": 1080,
    "height": 1920,
    "fps_num": 30,
    "fps_den": 1,
    "video_codec": "h264",
    "audio_codec": "aac"
  }
}
```

### 4. Modo `podcast_clip` dinâmico (com B-Rolls, Trilha Sonora e Ducking):
```json
{
  "schema_version": 1,
  "mode": "podcast_clip",
  "clips": [
    {
      "kind": "video",
      "clip_id": "orador-01",
      "asset_id": "AST-PODCAST01",
      "in_ms": 15000,
      "out_ms": 45000,
      "timeline_start_ms": 0,
      "speed": 1
    }
  ],
  "audio_tracks": [
    { "kind": "source", "clip_id": "orador-01", "gain_db": 0 }
  ],
  "overlays": [
    {
      "asset_id": "AST-BROLL01",
      "layout": "fullscreen",
      "in_ms": 0,
      "out_ms": 3000,
      "timeline_start_ms": 5000,
      "duration_ms": 3000
    }
  ],
  "music_tracks": [
    {
      "asset_id": "AST-TRILHA01",
      "gain_db": -22,
      "ducking": true
    }
  ],
  "captions": [
    {
      "text": "O MAIOR SEGREDO",
      "timeline_start_ms": 0,
      "duration_ms": 1500,
      "style": "impact"
    }
  ],
  "output": {
    "width": 1080,
    "height": 1920,
    "fps_num": 30,
    "fps_den": 1,
    "video_codec": "h264",
    "audio_codec": "aac"
  }
}
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
