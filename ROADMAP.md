# Roadmap de Engenharia — Esquadrão de Conteúdo CLI (`@universal-skill/cli`)

> **Repositório:** `LuizKarlos/esquadrao_skill`  
> **Funil Integrado:** `LuizKarlos/esquadrao_funil`  
> **Esteira Viva:** Este roadmap governa o ciclo de desenvolvimento, os testes contínuos e os marcos de entrega do pacote `@universal-skill/cli`.  
> **Autoridades Canônicas:** [`SPEC.md`](./SPEC.md), [`GLOSSARY.md`](./GLOSSARY.md), [`README.md`](./README.md)

---

## Fase 1: Fundação do CLI, Setup Multi-Harness e Utilitários Unix
> **Status:** Concluída  
> **Objetivo:** Estabelecer a arquitetura zero-dependency baseada em Node.js stdlib, comandos de despacho e utilitários Unix de suporte a agentes.

- [x] **1.1. Estrutura Base e CLI Runner:**
  - [x] Ponto de entrada binário em `bin/cli.js` com suporte a `universal-skill` e `agent-skill`.
  - [x] Tratamento de flags globais (`--help`, `-h`, `--version`, `-v`).
  - [x] Encerramento seguro com código `1` para comandos inexistentes.
- [x] **1.2. Comando Setup Multi-Harness:**
  - [x] Implementação de `universal-skill setup [--dest <path>]`.
  - [x] Instalação de skills para Claude Code (`.claude/skills/`), Codex CLI (`.codex/skills/`), Grok Build (`.agents/skills/`), Cursor (`.cursor/rules/`) e Hermes (`~/.hermes/`).
  - [x] Invariante de isolamento: zero emissão de configurações de servidor remoto MCP.
- [x] **1.3. Scripts Unix Autônomos com Node.js stdlib:**
  - [x] `scripts/dag_validator.js`: validação de DAGs acíclicos e cálculo de ondas topológicas paralelas.
  - [x] `scripts/merkle_verify.js`: verificação criptográfica de integridade de ledgers em cadeia de blocos SHA-256.
  - [x] `scripts/ast_slice.js`: fatiamento sintático de AST para redução de contexto (>60%).
  - [x] `scripts/wcag_check.js`: validação determinística de contraste e alvos de toque mínimos.

---

## Fase 2: Agente de Onboarding e Experiência do Primeiro Vídeo
> **Status:** Concluída  
> **Objetivo:** Implementar o fluxo guiado de primeiro acesso para levar o usuário do zero ao primeiro vídeo vertical gerado em menos de 2 minutos.

- [x] **2.1. Detecção Precoce de Dependências:**
  - [x] Verificação nativa da presença de `ffmpeg` e `ffprobe` no PATH antes de executar operações.
  - [x] Instruções de instalação personalizadas e acionáveis por sistema operacional (Windows, macOS, Linux).
- [x] **2.2. Modos de Onboarding e Formatos Escolhidos pelo Usuário:**
  - [x] Soberania do usuário: escolha explícita entre vertical 9:16 e widescreen 16:9 via flag `--format` e assistente de terminal, sem forçar fundo preto ou widescreen como padrão.
  - [x] Modo `podcast_clip`: decupagem de fala com queima gráfica de legendas dinâmicas e áudio balanceado.
  - [x] Modo `edit_only`: corte e concatenação contígua de 2 trechos de vídeo a partir de fontes do usuário ou packs.
  - [x] Modo `dark`: renderização de vídeo tipográfico sob demanda expressa do usuário.
  - [x] Guia canônico para LLMs e agentes de IA (`references/llm-agent-guide.md`) para onboarding sem alucinações.
- [x] **2.3. Interface e Execução:**
  - [x] Modo interativo orientado a perguntas de múltipla escolha via `node:readline`.
  - [x] Modo não interativo via flags completas (`--mode`, `--file`, `--dest`, `--json`, `--verbose`).
  - [x] Persistência do perfil do workspace em `~/.universal-skill/profile.json`.

---

## Fase 3: Motor de Vídeo Studio e Pipeline FFmpeg
> **Status:** Concluída  
> **Objetivo:** Construir o pipeline local completo de decupagem, importação, queima de legendas seguras e inspeção automatizada de QA.

- [x] **3.1. Gerenciamento do Workspace do Estúdio:**
  - [x] Comando `universal-skill studio init`: geração atômica de pastas (`assets`, `editplans`, `renders`, `qa`) e manifesto `studio.json`.
  - [x] Gravação segura via arquivo temporário para prevenir corrupção de estado.
- [x] **3.2. Importação e Inspeção de Mídia:**
  - [x] Comando `universal-skill studio import <file>`: extração de resolução, duração em ms, taxa de quadros e faixas de áudio via `ffprobe`.
  - [x] Atribuição de identificador imutável `AST-XXXXXXXX`.
- [x] **3.3. Motor de Renderização via FFmpeg:**
  - [x] Comando `universal-skill studio render <editplan.json>`.
  - [x] Validação rigorosa do contrato `EditPlan v1` (cortes >= 100ms, tempos dentro dos limites da fonte).
  - [x] Tratamento de caracteres especiais em legendas (`%`, `'`, `\`) no filtro `drawtext`.
  - [x] Síntese de áudio mudo (`anullsrc`) para fontes sem áudio original, evitando falhas de multiplexação.
  - [x] Tratamento de `SIGINT`: cancelamento gracioso e expurgo imediato de artefatos parciais.
- [x] **3.4. Inspeção Automatizada de Qualidade (QA):**
  - [x] Comando `universal-skill studio qa <artifact.mp4> [--plan <editplan.json>]`.
  - [x] Verificação obrigatória de presença de stream de áudio.
  - [x] Validação de resolução (1080x1920 / 1920x1080) e conformidade de duração contra o plano.
- [x] **3.5. Detecção de Silêncio e Auto-Clip Integrado:**
  - [x] Comando `esquadrao studio detect-silence <video>` com filtros nativos FFmpeg (`silencedetect`).
  - [x] Comando `esquadrao studio auto-clip <video.mp4>` integrando fatiamento de silêncios, Whisper e legendas dinâmicas estilo impacto viral (Opção A por padrão).
  - [x] Suporte dual a Whisper: gratuito local (padrão) e API oficial OpenAI (opcional via autorização do usuário).
- [x] **3.6. Transcrição Estruturada e Copy para Vídeos Longos:**
  - [x] Comando `esquadrao studio transcribe <video.mp4>` exportando `transcript.json` com timestamps exatos de fala.
  - [x] Playbook e heurísticas de Copywriting ensinando agentes LLM a identificar ganchos (0-3s), miolo de retenção e punchlines (30-60s flexíveis).
- [x] **3.7. Vídeos Dinâmicos com B-Rolls e Trilha Ducking:**
  - [x] Suporte a `overlays` no `EditPlan v1` com layouts dinâmicos (`fullscreen`, `pip`, `split_bottom`, `split_top`).
  - [x] Suporte a `music_tracks` com ducking suave de áudio (-20dB a -24dB) e mixagem sonora equilibrada.

---

## Fase 4: Matriz de Papéis Técnicos e Governança de Engenharia
> **Status:** Concluída  
> **Objetivo:** Estabelecer a governança dos 12 papéis canônicos de engenharia, matriz de autoridade e oráculos de permissão.

- [x] **4.1. Registro Canônico de Papéis:**
  - [x] Definição dos 12 papéis canônicos da indústria (`product-manager`, `software-architect`, `software-engineer`, `code-reviewer`, `qa-engineer`, `media-producer`, etc.).
  - [x] Normalização transparente de designações legadas para nomes oficiais.
- [x] **4.2. Matriz de Autoridade e Permissões:**
  - [x] Enforçamento estrito de níveis de acesso (Leitura/Escrita vs. Somente Leitura).
  - [x] Validação de outputs permitidos por papel.
  - [x] Oráculo `anti-self-review`: bloqueio de aprovação quando autor e revisor são idênticos.
- [x] **4.3. Interface CLI de Papéis:**
  - [x] `universal-skill role list`, `info <id>`, `prompt <id>` e `matrix`.

---

## Fase 5: Publicação no Registro npm e Homologação de Entrega
> **Status:** Em Andamento  
> **Objetivo:** Tornar o repositório público, publicar o pacote `@universal-skill/cli` no registro oficial do npm e validar execução em ambiente limpo.  
> **Issue GitHub Ativa:** [#26 — Publicar @universal-skill/cli no npm](https://github.com/LuizKarlos/esquadrao_skill/issues/26)

- [ ] **5.1. Homologação da Publicação:**
  - [x] Testes unitários com cobertura total de 55 testes verdes.
  - [x] Linting nativo `node scripts/lint.js` aprovado em todos os 31 arquivos.
  - [x] Documentação canônica integrada (`SPEC.md`, `ROADMAP.md`, `GLOSSARY.md`, `README.md`).
  - [ ] Abertura do repositório para visibilidade pública no GitHub.
  - [ ] Publicação do pacote no registro npm oficial (`npm publish --access public`).
- [ ] **5.2. Validação Externa em Diretório Limpo:**
  - [ ] Execução de teste em máquina/ambiente sem arquivos locais via `npx @universal-skill/cli onboard --mode dark --dest ./test-clean`.
  - [ ] Verificação de integração pós-compra no painel do funil (`/app` com `NEXT_PUBLIC_CLI_NPM_PUBLISHED=true`).
