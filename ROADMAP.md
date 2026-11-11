# Roadmap de Engenharia — Esquadrão de Conteúdo CLI (`@esquadrao/cli`)

> **Repositório:** `LuizKarlos/esquadrao_skill`
> **Funil Integrado:** `LuizKarlos/esquadrao_funil`
> **Esteira Viva:** Este roadmap governa o ciclo de desenvolvimento, os testes contínuos e os marcos de entrega do pacote `@esquadrao/cli`.
> **Autoridades Canônicas:** [`SPEC.md`](./SPEC.md), [`GLOSSARY.md`](./GLOSSARY.md), [`README.md`](./README.md)
> **Estado de Conformidade (2026-11-11):** 87/87 testes verdes, lint em 37 arquivos aprovado; Fases 1, 2 e 4 entregues; Fase 3 parcial; Fase 5 em andamento.
> **Legenda:** `[x]` = implementado e testado; `[ ]` = previsto, pendente ou demonstração.

---

## Fase 1: Fundação do CLI, Setup Multi-Harness e Utilitários Unix
> **Status:** Concluída
> **Objetivo:** Estabelecer a arquitetura zero-dependency baseada em Node.js stdlib, comandos de despacho e utilitários Unix de suporte a agentes.

- [x] **1.1. Estrutura Base e CLI Runner:**
  - [x] Ponto de entrada binário em `bin/cli.js` com suporte a `esquadrao`.
  - [x] Tratamento de flags globais (`--help`, `-h`, `--version`, `-v`).
  - [x] Encerramento seguro com código `1` para comandos inexistentes.
- [x] **1.2. Comando Setup Multi-Harness:**
  - [x] Implementação de `esquadrao setup [--dest <path>]`.
  - [x] Instalação de skills para Claude Code (`.claude/skills/`), Codex CLI (`.codex/skills/`), Grok Build (`.agents/skills/`), Cursor (`.cursor/rules/`) e Hermes (`~/.hermes/`).
  - [x] Invariante de isolamento: zero emissão de configurações de servidor remoto MCP.
- [x] **1.3. Scripts Unix Autônomos com Node.js stdlib:**
  - [x] `scripts/dag_validator.js`: validação de DAGs acíclicos e cálculo de ondas topológicas paralelas.
  - [x] `scripts/merkle_verify.js`: verificação criptográfica de integridade de ledgers em cadeia de blocos SHA-256.
  - [x] `scripts/ast_slice.js`: fatiamento sintático de AST para redução de contexto (>60%).
  - [x] `scripts/wcag_check.js`: validação determinística de contraste e alvos de toque mínimos.

---

## Fase 2: Agente de Onboarding e Experiência do Primeiro Vídeo
> **Status:** Entregue: `onboard --mode podcast_clip` executa o pipeline real de `auto-clip`.
> **Objetivo:** Implementar o fluxo guiado de primeiro acesso para levar o usuário do zero ao primeiro vídeo vertical gerado em menos de 2 minutos.

- [x] **2.1. Detecção Precoce de Dependências:**
  - [x] Verificação nativa da presença de `ffmpeg` e `ffprobe` no PATH antes de executar operações.
  - [x] Instruções de instalação personalizadas e acionáveis por sistema operacional (Windows, macOS, Linux).
- [x] **2.2. Modos de Onboarding e Formatos Escolhidos pelo Usuário:**
  - [x] Soberania do usuário: escolha explícita entre vertical 9:16 e widescreen 16:9 via flag `--format` e assistente de terminal, sem forçar fundo preto ou widescreen como padrão.
  - [x] Modo `podcast_clip`: onboard executa `auto-clip` real, com `--captions`, `--openai`, `--local` ou `--no-captions` (CLI-01).
  - [x] Modo `edit_only`: corte e concatenação contígua de 2 trechos de vídeo a partir de fontes do usuário ou packs.
  - [x] Modo `dark`: renderização de vídeo tipográfico sob demanda expressa do usuário.
  - [x] Guia canônico para LLMs e agentes de IA (`references/llm-agent-guide.md`) para onboarding sem alucinações.
- [x] **2.3. Interface e Execução:**
  - [x] Modo interativo orientado a perguntas de múltipla escolha via `node:readline`.
  - [x] Modo não interativo via flags completas (`--mode`, `--file`, `--dest`, `--json`, `--verbose`).
  - [x] Persistência do perfil do workspace em `~/.esquadrao/profile.json`.

---

## Fase 3: Motor de Vídeo Studio e Pipeline FFmpeg
> **Status:** Parcial: motor base e templates de legenda entregues; ducking dinâmico e `split_top` pendentes.
> **Objetivo:** Construir o pipeline local completo de decupagem, importação, queima de legendas seguras e inspeção automatizada de QA.

- [x] **3.1. Gerenciamento do Workspace do Estúdio:**
  - [x] Comando `esquadrao studio init`: geração atômica de pastas (`assets`, `packages`, `artifacts`) e manifesto `studio.json`.
  - [x] Gravação segura via arquivo temporário para prevenir corrupção de estado.
- [x] **3.2. Importação e Inspeção de Mídia:**
  - [x] Comando `esquadrao studio import <file>`: extração de resolução, duração em ms, taxa de quadros e faixas de áudio via `ffprobe`.
  - [x] Atribuição de identificador imutável `AST-XXXXXXXX`.
- [x] **3.3. Motor de Renderização via FFmpeg:**
  - [x] Comando `esquadrao studio render <editplan.json>`.
  - [x] Validação rigorosa do contrato `EditPlan v1` (cortes >= 100ms, tempos dentro dos limites da fonte).
  - [x] Tratamento de caracteres especiais em legendas (`%`, `'`, `\`) no filtro `drawtext`.
  - [x] Síntese de áudio mudo (`anullsrc`) para fontes sem áudio original, evitando falhas de multiplexação.
  - [x] Tratamento de `SIGINT`: cancelamento gracioso e expurgo imediato de artefatos parciais.
- [x] **3.4. Inspeção Automatizada de Qualidade (QA):**
  - [x] Comando `esquadrao studio qa <artifact.mp4> [--plan <editplan.json>]`.
  - [x] Verificação obrigatória de presença de stream de áudio.
  - [x] Validação de resolução (1080x1920 / 1920x1080) e conformidade de duração contra o plano.
- [x] **3.5. Detecção de Silêncio e Auto-Clip Integrado:**
  - [x] Comando `esquadrao studio detect-silence <video>` com filtros nativos FFmpeg (`silencedetect`).
  - [x] Comando `esquadrao studio auto-clip <video.mp4>` integrando fatiamento de silêncios e legendas dinâmicas estilo impacto viral (Opção A por padrão).
  - [x] Suporte a legendas via SRT (`--captions`) e OpenAI (`--openai`).
  - [x] Suporte a Whisper local (CLI-02): `@xenova/transformers` declarado em `optionalDependencies`; ausência gera erro acionável.
- [x] **3.6. Transcrição Estruturada e Copy para Vídeos Longos:**
  - [x] Comando `esquadrao studio transcribe <video.mp4>` exportando `transcript.json` com timestamps exatos de fala.
  - [x] Playbook e heurísticas de Copywriting ensinando agentes LLM a identificar ganchos (0-3s), miolo de retenção e punchlines (30-60s flexíveis).
- [x] **3.7. Vídeos Dinâmicos com B-Rolls e Trilha Ducking:**
  - [x] Suporte a `overlays` no `EditPlan v1` com layouts dinâmicos testados (`fullscreen`, `pip`, `split_bottom`).
  - [ ] Layout visual `split_top` (CLI-06): aceito na validação do plano, mas renderizado em modo fallback fullscreen.
  - [x] Suporte a `music_tracks` com atenuação de volume estático (-22dB) e mixagem sonora via `amix`.
  - [ ] Suporte a ducking dinâmico de áudio (CLI-05): compressão sidechain para atenuação musical dinâmica vinculada aos intervalos de fala ativa.
- [x] **3.8. Detector Heurístico de Ganchos e Auto-Clip Dinâmico:**
  - [x] Comando `esquadrao studio find-hooks <video | transcript.json>` para mineração automática de melhores trechos (30s-60s) baseados em copy.
  - [x] Suporte operacional a `--broll` e `--music` diretamente no comando `esquadrao studio auto-clip` para produção autônoma.
  - [ ] Documentação de `--broll` e `--music` no help do comando (CLI-10): registrar flags operacionais no texto descritivo de ajuda do `studio`.

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
  - [x] `esquadrao role list`, `info <id>`, `prompt <id>` e `matrix`.

---

## Fase 5: Publicação no Registro npm e Homologação de Entrega
> **Status:** Em Andamento
> **Objetivo:** Tornar o repositório público, publicar o pacote `@esquadrao/cli` no registro oficial do npm e validar execução em ambiente limpo.
> **Issue GitHub Ativa:** [#26 — Publicar @esquadrao/cli no npm](https://github.com/LuizKarlos/esquadrao_skill/issues/26)

- [ ] **5.1. Homologação da Publicação:**
  - [x] Testes unitários com cobertura total de 87 testes verdes.
  - [x] Linting nativo `node scripts/lint.js` aprovado em todos os 37 arquivos.
  - [x] Documentação canônica integrada (`SPEC.md`, `ROADMAP.md`, `GLOSSARY.md`, `README.md`).
  - [ ] Abertura do repositório para visibilidade pública no GitHub.
  - [ ] Publicação do pacote no registro npm oficial (`npm publish --access public`).
- [ ] **5.2. Validação Externa em Diretório Limpo:**
  - [ ] Execução de teste em máquina/ambiente sem arquivos locais via `npx @esquadrao/cli onboard --mode dark --dest ./test-clean`.
  - [ ] Verificação de integração pós-compra no painel do funil (`/app` com `NEXT_PUBLIC_CLI_NPM_PUBLISHED=true`).

---

## Diagnóstico de Conformidade e Backlog CLI (2026-11-11)
> **Autoridade Detalhada:** Consulte a especificação técnica formal em [`SPEC.md §8`](./SPEC.md#8-registro-de-auditoria-de-capacidades-2026-11-11).

### Prioridade P0 (Integridade Operacional e Contratos Críticos)
- [x] **CLI-01: Implementação real do pipeline em `onboard --mode podcast_clip`** — resolvido em 1.4.0; `onboard` chama `auto-clip`.
  *Critério de aceite:* Integrar chamada real ao pipeline de `auto-clip` com detecção de silêncio e cortes dinâmicos de fala, substituindo o clipe estático demonstrativo (entregue em 1.4.0).
- [x] **CLI-02: Gerenciamento da dependência de transcrição local (Whisper)** — resolvido em 1.4.0; `optionalDependencies`.
  *Critério de aceite:* Incluir `@xenova/transformers` em dependências ou fornecer script de instalação preventiva, viabilizando transcrição offline sem API externa.
- [x] **CLI-03: Tratamento de erro e bloqueio de renderização sem legendas** — resolvido em 1.4.0; `--no-captions` é a válvula explícita.
  *Critério de aceite:* Emitir aviso claro e erro com código `1` ao executar `auto-clip` sem legendas (sem SRT, sem OpenAI e sem pacote local), prevenindo artefatos incompletos.

### Prioridade P1 (Completude Funcional do Pipeline de Mídia)
- [ ] **CLI-04: Resiliência e diagnóstico na transcrição local (`studio transcribe`)** — parcialmente resolvido em 1.4.0 (erros acionáveis); falta teste com motor local real.
  *Critério de aceite:* Exibir mensagem orientadora e saída de erro acionável em caso de ausência do motor Whisper local.
- [ ] **CLI-05: Implementação de áudio ducking dinâmico via sidechain**
  *Critério de aceite:* Aplicar atenuação adaptativa na trilha musical via compressor sidechain no FFmpeg exclusivamente durante intervalos de voz ativa.
- [ ] **CLI-06: Suporte ao layout visual `split_top` no renderizador**
  *Critério de aceite:* Renderizar B-roll no topo e orador na base sem redirecionamento para tela cheia (`fullscreen`).
- [ ] **CLI-07: Subcomando de renderização em lote (`studio batch`)**
  *Critério de aceite:* Orquestrar renderização concorrente ou sequencial de múltiplos editplans com relatório unificado de QA.
- [ ] **CLI-08: Matriz de integração contínua multiplataforma**
  *Critério de aceite:* Validar execução de testes em ambientes Windows e macOS no GitHub Actions.

- [x] **CLI-12: Motor nativo de templates de legenda** — resolvido em 1.5.0; `--caption-template` e `captions[].template`.
  *Critério de aceite:* Implementar `--caption-template <id>` e `captions[].template` com os nove IDs de [`references/caption-templates.md`](./skill-media-producer/references/caption-templates.md), fallback de fontes e teste de render por template.

### Prioridade P2 (Polimento de Interface e Higiene de Repositório)
- [ ] **CLI-09: Depreciação e remoção do alias legado `esquadrao-skill`**
  *Critério de aceite:* Remover o alias do campo `bin` no `package.json`, expondo exclusivamente o comando canônico `esquadrao`.
- [ ] **CLI-10: Atualização do manual de ajuda de `studio`**
  *Critério de aceite:* Documentar flags `--broll` e `--music` na saída de `esquadrao studio auto-clip --help`.
- [ ] **CLI-11: Alinhamento contínuo de referências documentais**
  *Critério de aceite:* Manter métricas de teste (87 testes), contagem de lint (37 arquivos) e estrutura real do estúdio sincronizadas nos testes de documentação.

### Critérios de Aceite Globais
- **P0 Resolvido:** `podcast_clip` executa corte dinâmico real e ausência de legendas bloqueia renderização com código de erro.
- **P1 Resolvido:** Layout `split_top` renderizado corretamente, trilha sonora atenua dinamicamente com a voz e lote possui comando nativo.
- **P2 Resolvido:** Manual de ajuda exibe todas as flags operacionais e alias legado é descontinuado.

---

## Auditoria de Governança Atlas MCP & Jev: Conformidade da Etapa de Tutoriais
> **Status:** CONFORME E LIBERADA
A esteira de tutoriais e onboarding visual teve a sanitização de pacotes (@esquadrao/cli), binários e manifestos concluída com 100% de conformidade.
