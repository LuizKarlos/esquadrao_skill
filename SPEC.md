# Especificação Técnica Canônica — Esquadrão de Conteúdo CLI (`@universal-skill/cli`)

> **Versão:** 1.0.0  
> **Status:** Ativo / Homologado  
> **Pacote npm:** `@universal-skill/cli`  
> **Nome Comercial:** Esquadrão de Conteúdo  
> **Documentos Relacionados:** [`GLOSSARY.md`](./GLOSSARY.md), [`ROADMAP.md`](./ROADMAP.md), [`README.md`](./README.md)

---

## 1. Visão Geral e Princípios Arquiteturais

O **Esquadrão de Conteúdo CLI** (`@universal-skill/cli`) é um framework autônomo e executável localmente para orquestração de skills, execução de papéis técnicos e produção automatizada de vídeo vertical (9:16) e horizontal (16:9) via FFmpeg.

### 1.1. Invariantes Arquiteturais e Limites Estritos
1. **Zero Dependências Externas em Runtime (`dependencies: {}`):** O projeto utiliza estritamente as bibliotecas nativas do Node.js (`node:fs`, `node:path`, `node:child_process`, `node:crypto`, `node:readline`, `node:os`).
2. **Execução 100% Local:** Todo o processamento de áudio, decupagem, queima de legendas e renderização em lote ocorre na CPU/GPU da máquina do usuário. Proibido envio de gravações para servidores externos ou taxímetro de créditos por minuto.
3. **Soberania Digital e Posse Vitalícia:** Sem DRM, sem validação periódica de chaves em nuvem, sem restrição de dispositivos e sem telemetria oculta. O cliente é dono definitivo do seu ambiente e dos seus arquivos.
4. **Decisão do Usuário sobre Formato e Fundo (Anti-Padrão Forçado):** O sistema e os agentes de IA NUNCA forçam fundo preto (`dark`) ou widescreen (`16:9`) como padrão. O usuário define ativamente o formato (Vertical 9:16 para mobile ou Widescreen 16:9 para desktop) e o estilo de edição (cortes com legendas `podcast_clip`, decupagem `edit_only` com packs/fontes ou tipografia `dark`).
5. **Resiliência a Falhas do FFmpeg:** Todo comando FFmpeg é executado com captura de streams e sanitização de logs. Falhas de execução limpam artefatos temporários parciais (`SIGINT`) e exibem diagnósticos objetivos sem despejar comandos quilométricos por padrão.
6. **Compatibilidade Multi-Plataforma:** Suporte homogêneo a Windows, macOS e Linux, detectando nativamente binários de `ffmpeg` e `ffprobe` no PATH com mensagens de instalação acionáveis por sistema operacional.

---

## 2. Subsistemas e Contratos de Comandos

O CLI expõe os binários `universal-skill` e o alias legado `agent-skill`.

### 2.1. Agente de Onboarding Guiado (`universal-skill onboard`)
Conduz o usuário do zero absoluto até a renderização do seu primeiro vídeo vertical validado em menos de 2 minutos.

- **Sintaxe:**
  ```bash
  universal-skill onboard [--mode <dark|edit_only|podcast_clip>] [--format <9:16|16:9>] [--dest <path>] [--file <file>] [--verbose] [--json]
  ```
- **Modos de Operação:**
  - `dark`: Renderização de vídeo vertical sem necessidade de footage prévio, utilizando overlays de texto centralizados, fundo escuro e áudio sintetizado ou de apoio.
  - `edit_only`: Decupagem e junção contígua de 2 cortes de fontes de vídeo fornecidas, aplicando corte determinístico de tempo de entrada (`in_ms`) e saída (`out_ms`).
  - `podcast_clip`: Geração de corte vertical a partir de gravação longa com queima gráfica de legendas dinâmicas sincronizadas.
- **Detecção de Ambiente e Pré-requisitos:**
  - Verifica disponibilidade de `ffmpeg` e `ffprobe` antes de iniciar.
  - Em caso de ausência, encerra imediatamente com código `1` exibindo o comando exato de instalação para o sistema operacional ativo:
    - Windows: `winget install Gyan.FFmpeg` ou `choco install ffmpeg`
    - macOS: `brew install ffmpeg`
    - Linux: `sudo apt update && sudo apt install -y ffmpeg`
- **Persistência de Perfil:**
  - O diretório de destino (`--dest`) persiste a configuração no perfil local do usuário (`~/.universal-skill/profile.json`), permitindo execuções subsequentes sem redigitação de caminhos.

### 2.2. Motor de Vídeo Studio (`universal-skill studio`)
Fornece o pipeline operacional de criação, importação de mídias, renderização via FFmpeg e inspeção de controle de qualidade (QA).

#### 2.2.1. `universal-skill studio init [--dest <path>]`
- Inicializa a estrutura de pastas do estúdio:
  - `workspace/assets/`: Arquivos brutos importados (`MP4`/`MOV`).
  - `workspace/editplans/`: Arquivos de plano de edição em JSON.
  - `workspace/renders/`: Vídeos finais renderizados.
  - `workspace/qa/`: Relatórios de auditoria e métricas técnicas.
  - `workspace/studio.json`: Manifesto de estado atômico.
- Garante escrita atômica via arquivo temporário com `fs.renameSync` para evitar corrupção em caso de encerramento abrupto.

#### 2.2.2. `universal-skill studio import <file>`
- Inspeciona o arquivo de mídia usando `ffprobe -v quiet -print_format json -show_format -show_streams`.
- Extrai metadados essenciais: duração em milissegundos, largura, altura, framerate (`fps_num`/`fps_den`), codec de vídeo, presença de faixa de áudio e tamanho em bytes.
- Gera um identificador único de asset (`AST-XXXXXXXX`) e registra no `studio.json`.

#### 2.2.3. `universal-skill studio render <editplan.json>`
- Valida estritamente o contrato `EditPlan v1` antes de acionar o FFmpeg:
  - Rejeita planos com `out_ms` superior à duração real do asset fonte.
  - Rejeita planos com cortes inferiores a 100 milissegundos.
  - Rejeita planos com `speed <= 0`.
- Monta filtros complexos do FFmpeg:
  - Filtro de corte e velocidade: `[0:v]trim=start_pts=...:end_pts=...,setpts=...[v0]`.
  - Tratamento de caracteres especiais em legendas (`drawtext`): escape obrigatório de `%` (`\%`), apóstrofo `'` (`\'`) e contra-barra `\`.
  - Fallback automático para fontes de vídeo sem áudio: sintetiza stream de silêncio (`anullsrc`) impedindo falhas na multiplexação final.
  - Interrupção segura (`SIGINT`): captura o sinal de cancelamento, encerra o processo filho do FFmpeg e remove o arquivo de vídeo parcial incompleto do disco.

#### 2.2.4. `universal-skill studio qa <artifact.mp4> [--plan <editplan.json>]`
- Inspeciona o artefato gerado via `ffprobe`.
- Valida presença obrigatória de stream de áudio (falha com código `1` caso ausente).
- Quando informado `--plan`:
  - Compara a duração real do artefato com o esperado pelo plano (tolerância máxima de 250ms).
  - Valida conformidade estrita de resolução (ex: 1080x1920) e framerate.

### 2.3. Configuração Multi-Harness (`universal-skill setup`)
Distribui as 18 skills empacotadas para os diretórios locais dos diferentes agentes de IA presentes no workspace do usuário:
- **Grok Build:** `.agents/skills/`
- **Claude Code:** `.claude/skills/`
- **OpenAI Codex CLI:** `.codex/skills/` e `AGENTS.md`
- **Cursor IDE:** `.cursor/rules/*.mdc`
- **Hermes / VS Code:** `~/.hermes/` e `.vscode/`
- *Invariante de Segurança:* O setup local nunca emite configurações ou credenciais de servidor MCP, operando exclusivamente no modelo de arquivos locais.

### 2.4. Governança e Matriz de Papéis Técnicos (`universal-skill role`)
Expõe a matriz canônica de 12 papéis técnicos de engenharia de software com limites rígidos de autoridade.

- **Comandos:**
  - `universal-skill role list`: Lista todos os 12 papéis e status.
  - `universal-skill role info <id>`: Detalha autoridade, regras e outputs permitidos do papel.
  - `universal-skill role prompt <id>`: Exibe o prompt de sistema especializado para injeção em harnesses de IA.
  - `universal-skill role matrix`: Tabela completa de permissões (Leitura/Escrita).

---

## 3. Matriz Canônica de Papéis e Autoridade Técnica

| Papel (`role_id`) | Denominação Oficial | Nível de Acesso | Responsabilidade & Limites de Autoridade |
| :--- | :--- | :--- | :--- |
| `product-manager` | Product Manager | Leitura/Escrita | Síntese de contratos, definição de escopo estrito e critérios de aceite. |
| `system-analyst` | Systems Analyst | Somente Leitura | Mapeamento de dependências, inspeção estrutural e grafos do repositório. |
| `software-architect` | Principal Software Architect | Leitura/Escrita | Decomposição em subsistemas, invariantes e critérios determinísticos de rollback. |
| `tech-lead` | Technical Lead | Leitura/Escrita | Arbitragem técnica, avaliação de débitos e aplicação de padrões de engenharia. |
| `security-engineer` | Security Engineer | Somente Leitura | Modelagem de ameaças, varredura de injeção e validação de limites de privilégio. |
| `software-engineer` | Senior Software Engineer | Leitura/Escrita | Implementação de patches atômicos e suítes de testes unitários focados. |
| `code-reviewer` | Code Reviewer | Somente Leitura | Revisão independente de diffs, linting anti-slop e proteção anti-auto-revisão. |
| `sre-engineer` | Site Reliability Engineer | Leitura/Escrita | Diagnóstico de falhas, análise de causa raiz (RCA) e contratos determinísticos de reparo. |
| `qa-engineer` | QA Engineer | Somente Leitura | Portões finais de homologação, verificação operacional e aceite de release. |
| `technical-writer` | Technical Writer | Leitura/Escrita | Guias para desenvolvedores, especificação técnica, changelogs e registros de ADR. |
| `engineering-manager` | Engineering Manager | Leitura/Escrita | Marcos do roadmap, derivação de backlogs e planejamento ágil de esteira. |
| `media-producer` | Media Producer | Leitura/Escrita | Planos de edição de vídeo, cortes verticais (>=100ms), legendas e QA de mídia. |

### 3.1. Regra de Proteção Anti-Auto-Revisão (`anti-self-review`)
O papel `code-reviewer` possui guard nativo que impede a aprovação de revisões quando o autor da alteração e o revisor são o mesmo agente ou utilizam o mesmo identificador de sessão.

---

## 4. Scripts Utilitários Unix Autônomos (`scripts/`)

Todos os scripts são construídos com biblioteca padrão do Node.js e executam de forma independente:
1. `scripts/dag_validator.js`: Valida aciclicidade em grafos de tarefas (DAG), detecta ciclos e calcula ondas topológicas de execução paralela.
2. `scripts/merkle_verify.js`: Valida a continuidade criptográfica de blocos Merkle encadeados em ledgers de auditoria.
3. `scripts/ast_slice.js`: Extrai assinaturas e contornos sintáticos em código JS, TS e Python, reduzindo o contexto em mais de 60%.
4. `scripts/wcag_check.js`: Avalia taxas de contraste visual (mínimo WCAG 2.1 AA/AAA) e alvos de toque interativos (mínimo 44x44px).

---

## 5. Garantia da Qualidade e Suíte de Testes

A integridade do CLI é atestada deterministicamente pelo test runner nativo do Node.js:
```bash
npm test
npm run lint
```
A suíte cobre:
- CLI core: argumentos, ajuda, versão e códigos de erro de saída.
- Onboard em todos os 3 modos (`dark`, `edit_only`, `podcast_clip`).
- Studio engine: integridade do `studio.json`, cancelamento via SIGINT, proteção de caracteres de legendas e validação de QA.
- Oráculos de papéis e autoridades.
- Testes de estresse com 50 nós lineares e paralelos nos scripts autônomos.
