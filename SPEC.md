# Especificação Técnica Canônica — Esquadrão de Conteúdo CLI (`@esquadrao/cli`)

> **Repositório:** `LuizKarlos/esquadrao_skill`  
> **Funil Integrado:** `LuizKarlos/esquadrao_funil`  
> **Versão:** 1.7.0\
> **Status:** Ativo / Homologado  
> **Pacote npm:** `@esquadrao/cli`  
> **Nome Comercial:** Esquadrão de Conteúdo  
> **Documentos Relacionados:** [`GLOSSARY.md`](./GLOSSARY.md), [`ROADMAP.md`](./ROADMAP.md), [`README.md`](./README.md)

> **Estado de implementação (2026-11-11):** os contratos abaixo são a meta; o que está entregue, as lacunas e o backlog estão no §8.

---

## 1. Visão Geral e Princípios Arquiteturais

O **Esquadrão de Conteúdo CLI** (`@esquadrao/cli`) é um framework autônomo e executável localmente para orquestração de skills, execução de papéis técnicos e produção automatizada de vídeo vertical (9:16) e horizontal (16:9) via FFmpeg.

### 1.1. Invariantes Arquiteturais e Limites Estritos
1. **Zero Dependências Obrigatórias em Runtime (`dependencies: {}`):** O projeto utiliza estritamente as bibliotecas nativas do Node.js (`node:fs`, `node:path`, `node:child_process`, `node:crypto`, `node:readline`, `node:os`). A transcrição local usa `@xenova/transformers` como `optionalDependencies`; nenhum recurso obrigatório depende dela.
2. **Execução 100% Local:** Todo o processamento de áudio, decupagem, queima de legendas e renderização em lote ocorre na CPU/GPU da máquina do usuário. Proibido envio de gravações para servidores externos ou taxímetro de créditos por minuto.
3. **Soberania Digital e Posse Vitalícia:** Sem DRM, sem validação periódica de chaves em nuvem, sem restrição de dispositivos e sem telemetria oculta. O cliente é dono definitivo do seu ambiente e dos seus arquivos.
4. **Decisão do Usuário sobre Formato e Fundo (Anti-Padrão Forçado):** O sistema e os agentes de IA NUNCA forçam fundo preto (`dark`) ou widescreen (`16:9`) como padrão. O usuário define ativamente o formato (Vertical 9:16 para mobile ou Widescreen 16:9 para desktop) e o estilo de edição (cortes com legendas `podcast_clip`, decupagem `edit_only` com packs/fontes ou tipografia `dark`).
5. **Resiliência a Falhas do FFmpeg:** Todo comando FFmpeg é executado com captura de streams e sanitização de logs. Falhas de execução limpam artefatos temporários parciais (`SIGINT`) e exibem diagnósticos objetivos sem despejar comandos quilométricos por padrão.
6. **Compatibilidade Multi-Plataforma:** Suporte homogêneo a Windows, macOS e Linux, detectando nativamente binários de `ffmpeg` e `ffprobe` no PATH com mensagens de instalação acionáveis por sistema operacional.

---

## 2. Subsistemas e Contratos de Comandos

O CLI expõe o binário `esquadrao`.

### 2.1. Agente de Onboarding Guiado (`esquadrao onboard`)
Conduz o usuário do zero absoluto até a renderização do seu primeiro vídeo vertical validado em menos de 2 minutos.

- **Sintaxe:**
  ```bash
  esquadrao onboard [--mode <dark|edit_only|podcast_clip>] [--format <9:16|16:9>] [--dest <path>] [--file <file>] [--captions <file.srt>] [--openai] [--local] [--no-captions] [--verbose] [--json]
  ```
- **Modos de Operação:**
  - `dark`: Renderização de vídeo vertical sem necessidade de footage prévio, utilizando overlays de texto centralizados, fundo escuro e áudio sintetizado ou de apoio.
  - `edit_only`: Decupagem e junção contígua de 2 cortes de fontes de vídeo fornecidas, aplicando corte determinístico de tempo de entrada (`in_ms`) e saída (`out_ms`).
  - `podcast_clip`: geração de corte vertical a partir de gravação longa com legendas sincronizadas. O `onboard` executa o pipeline real de `studio auto-clip` (detecção de silêncio, cortes, legendas e QA); aceita `--captions`, `--openai`, `--local` e `--no-captions`. Sem qualquer fonte de legenda, aplica `--no-captions` automaticamente, gera o corte real sem legendas e avisa; já o `studio auto-clip` direto, sem `--no-captions`, falha com código `1`.
- **Detecção de Ambiente e Pré-requisitos:**
  - Verifica disponibilidade de `ffmpeg` e `ffprobe` antes de iniciar.
  - Em caso de ausência, encerra imediatamente com código `1` exibindo o comando exato de instalação para o sistema operacional ativo:
    - Windows: `winget install Gyan.FFmpeg` ou `choco install ffmpeg`
    - macOS: `brew install ffmpeg`
    - Linux: `sudo apt update && sudo apt install -y ffmpeg`
- **Persistência de Perfil:**
  - O diretório de destino (`--dest`) persiste a configuração no perfil do workspace (`<workspace>/.esquadrao/profile.json`, com espelho em `studio.json`), permitindo execuções subsequentes sem redigitação de caminhos.

### 2.2. Motor de Vídeo Studio (`esquadrao studio`)
Fornece o pipeline operacional de criação, importação de mídias, renderização via FFmpeg e inspeção de controle de qualidade (QA).

#### 2.2.1. `esquadrao studio init [--dest <path>]`
- Inicializa a estrutura de pastas do estúdio:
  - `workspace/assets/`: Arquivos brutos importados (`MP4`/`MOV`).
  - `workspace/packages/`: Planos de edição (`editplan.json`) e transcrições (`transcript.json`).
  - `workspace/artifacts/`: Vídeos finais renderizados (`MP4`); os relatórios de QA são emitidos em JSON/stdout, não persistidos automaticamente.
  - `workspace/studio.json`: Manifesto de estado atômico.
- Garante escrita atômica via arquivo temporário com `fs.renameSync` para evitar corrupção em caso de encerramento abrupto.

#### 2.2.2. `esquadrao studio import <file>`
- Inspeciona o arquivo de mídia usando `ffprobe -v quiet -print_format json -show_format -show_streams`.
- Extrai metadados essenciais: duração em milissegundos, largura, altura, framerate (`fps_num`/`fps_den`), codec de vídeo, presença de faixa de áudio e tamanho em bytes.
- Gera um identificador único de asset (`AST-XXXXXXXX`) e registra no `studio.json`.

#### 2.2.3. `esquadrao studio render <editplan.json>`
- Valida estritamente o contrato `EditPlan v1` antes de acionar o FFmpeg:
  - Rejeita planos com `out_ms` superior à duração real do asset fonte.
  - Rejeita planos com cortes inferiores a 100 milissegundos.
  - Rejeita planos com `speed` diferente de `1` (o contrato v1 aceita apenas velocidade 1).
- Monta filtros complexos do FFmpeg:
  - Filtro de corte e velocidade: `[0:v]trim=start_pts=...:end_pts=...,setpts=...[v0]`.
  - Tratamento de caracteres especiais em legendas (`drawtext`): escape obrigatório de `%` (`\%`), apóstrofo `'` (`\'`) e contra-barra `\`.
  - Fallback automático para fontes de vídeo sem áudio: sintetiza stream de silêncio (`anullsrc`) impedindo falhas na multiplexação final.
  - Interrupção segura (`SIGINT`): captura o sinal de cancelamento, encerra o processo filho do FFmpeg e remove o arquivo de vídeo parcial incompleto do disco.

#### 2.2.4. `esquadrao studio qa <artifact.mp4> [--plan <editplan.json>]`
- Inspeciona o artefato gerado via `ffprobe`.
- Valida presença obrigatória de stream de áudio (falha com código `1` caso ausente).
- Quando informado `--plan`:
  - Compara a duração real do artefato com o esperado pelo plano (tolerância máxima de 350ms).
  - Valida conformidade estrita de resolução (ex: 1080x1920) e framerate.

#### 2.2.5. `esquadrao studio detect-silence <video>`
- Executa análise de áudio via filtro FFmpeg `silencedetect=noise=-30dB:d=0.8` (customizável via `--silence-thresh` e `--silence-duration`).
- Mapeia intervalos exatos de silêncio e calcula os segmentos de fala contígua (`computeSpeechIntervals`).
- Emite relatório detalhado em texto ou JSON com contagem de pausas e tempo ativo de fala.

#### 2.2.6. `esquadrao studio auto-clip <video.mp4> [opções]`
- Executa o pipeline automatizado completo:
  1. Ingestão e probe do vídeo original (`ffprobe`).
  2. Detecção e remoção de silêncios maiores que 0.8s (ou valor configurado).
  3. Transcrição e legendas por três caminhos:
     - SRT offline (`--captions arquivo.srt`): determinístico, offline e testado.
     - OpenAI com chave (`--openai`): requer `OPENAI_API_KEY` configurada via API remota.
     - Local (`--local`): via `@xenova/transformers` (`Xenova/whisper-tiny`), declarada em `optionalDependencies` (^2.17.2); se o pacote opcional não estiver instalado, o comando falha com instrução de instalação.
     - *Comportamento sem legenda:* sem SRT, OpenAI ou motor local, o comando encerra com código `1` e mensagem acionável; use `--no-captions` para gerar o corte explicitamente sem legendas.
  4. Agrupamento de legendas: Estilo A (impacto com 2 a 4 palavras em caixa alta, centralizadas e fundo contrastante por padrão), Estilo B (palavra única) ou Estilo C (frase completa).
  5. Remapeamento temporal exato das legendas sobre a linha de tempo sem pausas (`remapCaptionsToSpeechTimeline`).
  6. Geração atômica de `EditPlan v1` e renderização final via FFmpeg.
  7. Verificação técnica de QA (`resolution`, `fps`, `audio`) sobre o arquivo MP4 entregue.

#### 2.2.7. `esquadrao studio transcribe <video.mp4> [opções]`
- Extrai áudio de gravações longas (podcasts de 30min a 2h) e executa transcrição estruturada com Whisper via API OpenAI ou motor local.
- *Motor local:* compartilha `transcribeAudio`; `@xenova/transformers` é `optionalDependencies`. O áudio é convertido para PCM 16 kHz e transcrito localmente; ausência do pacote ou falha do binário `sharp` retorna erro acionável (CLI-04 resolvido em 1.7.0).
- Gera `workspace/packages/transcript.json` com segmentos temporais exatos (`start_s`, `end_s`, `text`) e marcações de palavras, além de exportar `.srt`.
- Permite que modelos de linguagem analisem o conteúdo textual estruturado para seleção de cortes.

#### 2.2.8. Overlays de B-Roll e Layouts Visuais Dinâmicos
O contrato `EditPlan v1` estende o suporte a cenas de apoio (`overlays`) aplicadas sobre a timeline contígua:
- **`layout: "fullscreen"` (Padrão, entregue):** O B-roll preenche 100% da tela durante 2 a 4 segundos enquanto o áudio da voz principal continua ativo sem interrupção.
- **`layout: "pip"` (Picture-in-Picture, entregue):** O B-roll é renderizado em janela flutuante centralizada sobre o orador.
- **`layout: "split_bottom"` (Entregue em 1.6.0):** O renderizador divide a tela com orador no topo e B-roll na metade inferior. O `auto-clip` aceita `--layout split_bottom` e `--overlay-duration full`; o pack é repetido em loop e cobre toda a linha do tempo, com áudio original preservado.
- **`layout: "split_top"` (Entregue em 1.7.0):** O orador ocupa a metade inferior e o B-roll a metade superior; `auto-clip` aceita `--layout split_top` e o pack é repetido em loop.

#### 2.2.9. Trilha Sonora de Fundo e Atenuação de Áudio
- O estúdio aceita arquivos de música de fundo via catálogo de áudio ou arquivos importados pelo usuário (`music_tracks`).
- O plano aceita o parâmetro `ducking`; quando verdadeiro, o áudio da fala é usado como sidechain no filtro `sidechaincompress`, reduzindo a música apenas nos intervalos de voz. `ducking: false` mantém a atenuação fixa de -22 dB via `amix` (CLI-05 resolvido em 1.7.0).

#### 2.2.10. Metodologia de Copy para Agentes de IA em Vídeos Longos
Orienta agentes a selecionar trechos de 30s a 60s (ajustáveis conforme a ideia) com 3 pilares editoriais:
1. **Gancho (0s-3s):** Frase de abertura (pergunta contraintuitiva, declaração ou dor).
2. **Desenvolvimento (4s-50s):** Explicação da ideia com inserção de B-roll a cada 4-7 segundos para sustentação da retenção visual.
3. **Punchline (50s-60s):** Fechamento conclusivo sem despedidas vazias, finalizando no ápice da resposta.
*Nota de escopo:* A metodologia e os scripts fornecem triagem determinística de texto editorial; não constituem garantia de viralidade ou retenção.

#### 2.2.11. `esquadrao studio find-hooks <video.mp4 | transcript.json> [opções]`
- Analisa a transcrição estruturada com heurísticas determinísticas de copywriting sobre o texto:
  - Pontua gatilhos de curiosidade, quebras de padrão, dores e perguntas contraintuitivas no início de frases.
  - Constrói intervalos contíguos de raciocínio respeitando a janela alvo (padrão 30s a 60s, flexível via `--min-dur` e `--max-dur`).
  - Detecta punchlines estruturadas com pontuação conclusiva e penaliza transições mortas.
  - Retorna o ranking dos trechos candidatos com timestamps em milissegundos (`in_ms`, `out_ms`), gancho identificado e punchline de fechamento.
  - *Heurística determinística:* `find-hooks` é uma ferramenta de triagem textual com regras determinísticas de pontuação, não uma garantia de viralidade ou alcance em plataformas externas.

#### 2.2.12. Auto-Clip com B-Rolls e Trilha Sonora
- O comando `esquadrao studio auto-clip` aceita as flags `--broll <arquivo>` (múltiplas cenas), `--music <arquivo>`, `--layout <fullscreen|pip|split_bottom>` e `--overlay-duration <inserts|full>`.
- Quando informados, o estúdio distribui as cenas de apoio sobre a fala (mantendo a voz ininterrupta) e aplica a música com ducking dinâmico por sidechain quando `ducking: true`; sem ducking, usa atenuação fixa de -22 dB via `amix`.
- Com `--overlay-duration full`, o primeiro `--broll` cobre toda a linha do tempo e é repetido em loop; com `split_bottom`, o resultado é o split permanente (orador no topo, pack na base).

#### 2.2.13. Renderização em Lote
- O comando `esquadrao studio batch <dir>` varre os arquivos `*.json` do diretório, renderiza cada plano sequencialmente e agrega o relatório de QA (CLI-07 resolvido em 1.7.0).
- A renderização permanece sequencial; paralelismo pode ser orquestrado externamente para volumes maiores.

#### 2.2.14. Catálogo de Templates de Legenda
- O catálogo canônico de nove presets visuais está em [`skill-media-producer/references/caption-templates.md`](./skill-media-producer/references/caption-templates.md).
- Os presets definem fonte, preenchimento, contorno, sombra, posição, animação e fallback, sempre **sem fundo sólido**.
- **Estado:** implementado no CLI 1.5.0. `--caption-template <id>` em `auto-clip`/`render` e `captions[].template` no EditPlan aplicam os nove presets; IDs inválidos falham com código 1 e lista de opções. `--caption-style impact|word|full` permanece como legado.

#### 2.2.15. Composições Especiais: Split Permanente e Recorte de Pessoa
- **Split permanente (CLI-13, entregue em 1.6.0):** `esquadrao studio auto-clip <video> --no-captions --broll <pack> --layout split_bottom --overlay-duration full` gera 1080×1920 com o orador no topo e o pack na base durante todo o clipe. O pack é silenciado, repetido em loop e o áudio original é preservado. `split_top` também está disponível desde 1.7.0 (CLI-06).
- **Recorte de pessoa (CLI-14, entregue em 1.6.0 como opcional):** `esquadrao studio cutout <video> --background <pack> --python <interpretador>` recorta a pessoa com `rembg`/`u2net_human_seg`, refina a máscara com GrabCut e compõe sobre o pack. Requer `rembg`, `onnxruntime`, `opencv-python-headless`, `numpy` e Pillow no Python escolhido; sem eles, o comando falha com instrução acionável. Saída 9:16, 15 fps por padrão, áudio original; custo de ~18–20 min de CPU por 60 s.
- **Limites:** o cutout é experimental, não tem cache de máscaras nem aceleração GPU; halo pode aparecer em cabelo/fone em frames difíceis.
- **Especificação completa, comandos e critérios:** [`skill-media-producer/references/composicoes-especiais.md`](./skill-media-producer/references/composicoes-especiais.md).

### 2.3. Configuração Multi-Harness (`esquadrao setup`)
Distribui as 18 skills empacotadas para os diretórios locais dos agentes de IA suportados e detecta os demais harnesses presentes no workspace do usuário:
- **Grok Build:** `.agents/skills/`
- **Claude Code:** `.claude/skills/`
- **OpenAI Codex CLI:** `.codex/skills/` e `AGENTS.md`
- **Cursor IDE:** `.cursor/rules/*.mdc`
- **Hermes / VS Code:** detectados em `~/.hermes/` e `.vscode/`; o setup não copia skills para esses diretórios, apenas registra o harness.
- *Invariante de Segurança:* O setup local nunca emite configurações ou credenciais de servidor MCP, operando exclusivamente no modelo de arquivos locais.

### 2.4. Governança e Matriz de Papéis Técnicos (`esquadrao role`)
Expõe a matriz canônica de 12 papéis técnicos de engenharia de software com limites rígidos de autoridade.

- **Comandos:**
  - `esquadrao role list`: Lista todos os 12 papéis e status.
  - `esquadrao role info <id>`: Detalha autoridade, regras e outputs permitidos do papel.
  - `esquadrao role prompt <id>`: Exibe o prompt de sistema especializado para injeção em harnesses de IA.
  - `esquadrao role matrix`: Tabela completa de permissões (Leitura/Escrita).

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

A integridade do CLI é atestada deterministicamente pelo test runner nativo do Node.js (95 testes, com skips condicionais para Whisper local e ausência do motor) e pelo linter (40 arquivos verificados):
```bash
npm test
npm run lint
```
A suíte cobre:
- CLI core: argumentos, ajuda, versão e códigos de erro de saída (95 testes; skips condicionais de Whisper local).
- Onboard em todos os 3 modos (`dark`, `edit_only`, `podcast_clip`).
- Studio engine: integridade do `studio.json`, cancelamento via SIGINT, proteção de caracteres de legendas e validação de QA.
- Oráculos de papéis e autoridades (12 papéis canônicos).
- Testes de estresse com 50 nós lineares e paralelos nos scripts autônomos.
- Verificação de estilo em 40 arquivos via lint sem pendências.

---

## 7. Registro de Auditoria Atlas MCP & Jev: Conformidade de Nomenclatura

### 7.1. Decisão Executiva de Governança
- **Status:** **CONFORMIDADE ESTABELECIDA**.
- **Ações Realizadas:**
  1. Pacote npm: Marca canônica `@esquadrao/cli`.
  2. Binários: binário canônico `esquadrao`; o alias legado `esquadrao-skill` foi removido do `package.json` em 1.7.0 (CLI-09).
  3. Manifesto do estúdio: Saneado para `esquadrao-studio`.
  4. Perfil do workspace: Saneado para `<workspace>/.esquadrao/profile.json` (com espelho em `studio.json`).
  5. Esteira de vídeo: Comandos atualizados para refletir o nome limpo.

---

## 8. Registro de Auditoria de Capacidades (2026-11-11)

### 8.1. Método de Verificação e Evidências Operacionais
A auditoria das capacidades do pacote `@esquadrao/cli` (versão 1.7.0) foi executada em 2026-11-11 por inspeção direta de código, verificação do manifesto e execução determinística de testes:
1. **Suíte de Testes Unitários e Integração:** `npm test` executou 95 testes distribuídos em 15 arquivos de teste, com skips condicionais para Whisper local e ausência do motor (`0 fail`).
2. **Auditoria Estática de Código:** `npm run lint` validou a conformidade sintática e estilística em 40 arquivos de código-fonte sem avisos ou falhas.
3. **Inspeção de Estrutura do Estúdio:** Execução real de `esquadrao studio init` em diretório temporário isolado confirmou a criação exclusiva dos diretórios `assets/`, `packages/`, `artifacts/` e do arquivo `studio.json`. Os diretórios `editplans/`, `renders/` e `qa/` não são gerados pelo comando.
4. **Inspeção de Dependências e Runtime:** O manifesto `package.json` declara `dependencies: {}` e `optionalDependencies: { "@xenova/transformers": "^2.17.2" }`. O motor local é opcional: se a instalação do pacote opcional falhar, `--local` retorna erro acionável e o restante do CLI permanece funcional.
5. **Inventário de Papéis e Habilidades:** Validação via `esquadrao role list --json` confirmou os 12 papéis técnicos canônicos. O comando `esquadrao setup` distribui 18 skills empacotadas para os diretórios dos agentes suportados.

### 8.2. Matriz de Capacidades: Entregue vs. Previsto

| Subsistema / Recurso | Estado Atual | Classificação | Evidência / Comportamento Observado | Referência |
| :--- | :--- | :--- | :--- | :--- |
| `onboard --mode dark` | Entregue | Operacional | Gera vídeo vertical com texto centralizado e trilha de áudio silenciosa (`anullsrc`). | §2.1 |
| `onboard --mode edit_only` | Entregue | Operacional | Executa decupagem e união contígua de 2 trechos de vídeo. | §2.1 |
| `onboard --mode podcast_clip` | Entregue | Operacional | Executa `auto-clip` real (silêncio, cortes, legendas e QA); sem motor de legenda, corta sem legenda e avisa. | §2.1, CLI-01 |
| `studio init` | Entregue | Operacional | Cria `assets/`, `packages/`, `artifacts/` e `studio.json`. | §2.2.1 |
| `studio import` | Entregue | Operacional | Extrai metadados via `ffprobe` e registra asset atômico. | §2.2.2 |
| `studio render` | Entregue | Operacional | Renderiza via FFmpeg, trata escape e cancelamento SIGINT. | §2.2.3 |
| `studio qa` | Entregue | Operacional | Valida resolução, framerate e faixa de áudio via `ffprobe`. | §2.2.4 |
| `studio detect-silence` | Entregue | Operacional | Detecta pausas via `silencedetect` e mapeia trechos contíguos de fala. | §2.2.5 |
| `auto-clip` com `--captions` | Entregue | Operacional | Sincroniza legendas SRT sobre corte de silêncio determinístico. | §2.2.6 |
| `auto-clip` com `--openai` | Entregue | Operacional | Transcreve via API externa mediante presença de chave de acesso. | §2.2.6 |
| `auto-clip` local / sem chaves | Entregue | Operacional | `--local` exige a dependência opcional; sem qualquer fonte, falha com código 1; `--no-captions` gera corte explícito. | CLI-02, CLI-03 |
| `studio transcribe` local | Entregue (opcional) | Operacional | Motor local via `optionalDependencies`, PCM 16 kHz; teste real opt-in em `tests/local_whisper.integration.test.js`. | CLI-04 |
| B-roll `fullscreen` e `pip` | Entregue | Operacional | Aplica overlays de tela cheia ou janela flutuante sobre a voz. | §2.2.8 |
| B-roll `split_bottom` | Entregue | Operacional | `auto-clip --layout split_bottom --overlay-duration full` mantém orador no topo e pack na base, em loop. | §2.2.8 / CLI-13 |
| B-roll `split_top` | Entregue | Operacional | Orador na metade inferior e pack na superior, com loop e áudio original. | CLI-06 |
| Split permanente no `auto-clip` | Entregue | Operacional | `--layout split_bottom --overlay-duration full` mantém o pack na base em loop, com áudio original. | CLI-13 |
| Recorte de pessoa (cutout) | Entregue (opcional) | Experimental | `studio cutout` recorta com `rembg`/GrabCut; requer Python e dependências; ~18–20 min/60 s em CPU. | §2.2.15 / CLI-14 |
| Música de fundo com atenuação | Entregue | Operacional | Aplica atenuação estática de -22dB e mixagem via filtro `amix`. | §2.2.9 |
| Audio ducking dinâmico | Entregue | Operacional | `ducking: true` usa `sidechaincompress` com a fala como chave. | CLI-05 |
| `studio find-hooks` | Entregue | Heurística | Classifica segmentos de texto por heurística determinística de copy. | §2.2.11 |
| Renderização em lote | Entregue | Operacional | `studio batch <dir>` renderiza todos os planos e agrega QA. | CLI-07 |
| Suporte multi-plataforma | Entregue | CI | Matriz GitHub Actions com Ubuntu, Windows e macOS. | CLI-08 |
| Binário canônico e alias | Entregue | Higienização | Apenas o binário `esquadrao` é exposto no `package.json`. | CLI-09 |
| Interface CLI (`--help`) | Entregue | Operacional | Help 1.7.0 lista `--broll`, `--music`, `--layout`, `--overlay-duration`, `--background`, `--engine`, `--fps`, `--python` e `--stop-on-error`. | CLI-10 |
| Documentação do estúdio | Corrigido | Sincronizado | Estrutura de pastas e métricas de teste alinhadas aos fatos reais. | CLI-11 |
| Templates de legenda (9 presets) | Entregue | Operacional | `--caption-template` e `captions[].template` aplicam os nove presets, sem fundo sólido. | CLI-12 |

### 8.3. Backlog Técnico Priorizado

#### Prioridade P0 (Integridade Operacional e Contratos Críticos)
- **CLI-01: Implementação real do pipeline em `onboard --mode podcast_clip`**
  *Status:* **RESOLVIDO em 1.4.0** — `onboard --mode podcast_clip` chama `studio auto-clip`; teste dedicado em `tests/autoclip.test.js`.
  *Contexto:* O modo anterior gerava um clipe estático demonstrativo de até 1s por asset com o texto fixo "Esquadrão Podcast Clip".
  *Meta:* Integrar o fluxo real de detecção de silêncio, montagem de cortes dinâmicos e legendas (SRT/OpenAI/modelo local) a partir de gravações fornecidas pelo usuário.
- **CLI-02: Gerenciamento da dependência opcional de transcrição local**
  *Status:* **RESOLVIDO em 1.4.0** — `@xenova/transformers` em `optionalDependencies`; ausência resulta em erro acionável, sem quebrar a instalação.
  *Contexto:* O pacote `@xenova/transformers` não constava em `dependencies` nem `optionalDependencies`, inviabilizando a transcrição offline out-of-the-box.
  *Meta:* Definir o mecanismo formal de consumo da biblioteca local (como dependência opcional documentada ou script de pré-requisito com verificação preventiva).
- **CLI-03: Tratamento de exceção e aviso de ausência de legendas em `auto-clip`**
  *Status:* **RESOLVIDO em 1.4.0** — `auto-clip`/`transcribe` falham antes de importar/renderizar; `--no-captions` é a válvula explícita.
  *Contexto:* Quando não há arquivo SRT, chave OpenAI nem pacote local instalado, o comando prosseguia silenciosamente e emitia vídeo sem faixas de texto.
  *Meta:* Interromper a execução com código de erro ou emitir aviso explícito ao operador antes de iniciar a renderização sem legendas.

#### Prioridade P1 (Completude Funcional do Pipeline de Mídia)
- **CLI-04: Resiliência e diagnóstico na transcrição local (`studio transcribe`)**
  *Status:* **RESOLVIDO em 1.7.0** — áudio convertido para PCM 16 kHz, teste real opt-in em `tests/local_whisper.integration.test.js` e job `local-whisper` no GitHub Actions.
  *Contexto:* Falhas na importação de bibliotecas locais de inferência ocorriam de forma silenciosa ou opaca.
  *Meta:* Exibir diagnóstico claro orientando a instalação das extensões necessárias ou fornecimento de chave de API externa.
- **CLI-05: Implementação de áudio ducking dinâmico via sidechain**
  *Status:* **RESOLVIDO em 1.7.0** — `ducking: true` usa `sidechaincompress` com a fala como chave; teste em `tests/cli_improvements.test.js`.
  *Contexto:* A atenuação da trilha sonora é estática (-22dB fixos) durante toda a duração do clipe.
  *Meta:* Implementar compressão sidechain no grafo de filtros FFmpeg para rebaixar o volume musical exclusivamente durante intervalos de fala ativa.
- **CLI-06: Suporte ao layout visual `split_top` no renderizador**
  *Status:* **RESOLVIDO em 1.7.0** — orador na metade inferior, pack na superior, com loop; teste de render em `tests/cli_improvements.test.js`.
  *Contexto:* O schema de `EditPlan` valida `split_top`, mas o gerador FFmpeg executa o corte em modo fullscreen.
  *Meta:* Adicionar o ramo de composição com B-roll no quadrante superior e orador no quadrante inferior no construtor de filtros.
- **CLI-07: Subcomando de renderização em lote (`studio batch`)**
  *Status:* **RESOLVIDO em 1.7.0** — `studio batch <dir>` renderiza todos os planos e agrega QA; teste em `tests/cli_improvements.test.js`.
  *Contexto:* A produção de múltiplos vídeos a partir de diretórios de planos requer scripts de shell externos.
  *Meta:* Introduzir comando dedicado para varredura de diretórios de planos, execução controlada e relatório consolidado de QA.
- **CLI-08: Matriz de integração contínua multiplataforma**
  *Status:* **RESOLVIDO em 1.7.0** — matriz Ubuntu, Windows e macOS no workflow de CI.
  *Contexto:* A suíte de testes é executada apenas em ambiente Linux x86_64 na esteira atual.
  *Meta:* Adicionar runners de Windows e macOS na esteira de CI validando a resolução de caminhos e binários FFmpeg.
- **CLI-12: Motor nativo de templates de legenda**
  *Status:* **RESOLVIDO em 1.5.0** — `--caption-template`, `captions[].template`, listagem JSON e validação de IDs; testes em `tests/caption_templates.test.js`.
  *Contexto:* Os nove presets de `skill-media-producer/references/caption-templates.md` foram validados em grid 3×3, mas o CLI só oferece `impact`, `word` e `full`; não há flag nem campo de EditPlan para escolher um template.
  *Meta:* Implementar `--caption-template <id>` e `captions[].template`, com validação de ID, fallback de fonte, renderização sem fundo sólido e teste por template.
- **CLI-13: Split permanente no `auto-clip`**
  *Status:* **RESOLVIDO em 1.6.0** — `--layout` + `--overlay-duration full`; pack silenciado e repetido em loop; teste em `tests/autoclip.test.js`.
  *Contexto:* O formato "podcast em cima + pack embaixo" exigia `EditPlan` manual e `studio render`.
  *Meta:* Expor `--layout split_bottom` e duração de overlay total no `auto-clip`, com pack silenciado, loop/corte e teste de render.

#### Prioridade P2 (Polimento de Interface e Higiene de Repositório)
- **CLI-09: Depreciação e remoção do alias legado `esquadrao-skill`**
  *Status:* **RESOLVIDO em 1.7.0** — `bin` expõe apenas `esquadrao`; teste de documentação verifica o manifesto.
  *Contexto:* O campo `bin` do `package.json` ainda referencia `esquadrao-skill` em desacordo com a marca canônica única.
  *Meta:* Remover o alias secundário preservando estritamente o binário canônico `esquadrao`.
- **CLI-10: Atualização do manual de ajuda de `studio`**
  *Status:* **RESOLVIDO em 1.6.0** — `--broll`, `--music`, `--layout`, `--overlay-duration`, `--background`, `--engine`, `--fps` e `--python` constam no `--help`.
  *Contexto:* As opções `--broll` e `--music` operavam no código de `auto-clip`, mas não constavam na saída de `--help`.
- **CLI-11: Alinhamento contínuo de referências documentais**
  *Status:* **RESOLVIDO em 1.7.0** — `tests/documentation.test.js` verifica versão, binário, perfil e flags do help.
  *Contexto:* Documentações anteriores citavam diretórios inexistentes (`editplans/`, `renders/`, `qa/`) e contagens desatualizadas de testes.
  *Meta:* Manter testes automatizados de documentação prevenindo descompassos entre o código e as especificações.
- **CLI-14: Recorte de pessoa com troca de fundo (cutout)**
  *Status:* **RESOLVIDO em 1.6.0 (experimental)** — `studio cutout --background`, motor `rembg` via Python, correção RGB→BGR, refino GrabCut e erro acionável; teste de contrato em `tests/cutout.test.js`.
  *Contexto:* O formato "pessoa recortada sobre pack" exige segmentação por frame, máscara alfa, composição e correção de cor RGB/BGR; custo de CPU alto e halo em cabelo/fone.
  *Meta:* Manter dependências Python opcionais; falta cache de máscaras e GPU para volumes maiores.

### 8.4. Critérios de Aceite para Resolução do Backlog
1. **P0 Resolvido:** `onboard --mode podcast_clip` processa áudio real ou encerra com instrução acionável; falhas de transcrição local emitem saída de erro diagnóstica com código diferente de zero;
2. **P1 Resolvido:** O layout `split_top` produz vídeo com orador na metade inferior e B-roll na superior verificado via teste de QA; o filtro de áudio aplica atenuação variável por envelope de voz; comando de lote executa múltiplos planos com relatório agregado;
3. **P2 Resolvido:** Saídas de `--help` refletem todas as opções funcionais; apenas o comando `esquadrao` é exposto no manifesto de publicação.

### 8.5. Cobertura das 18 Skills Empacotadas

O pacote instala 18 skills, mas a cobertura de execução é heterogênea: 12 skills de papel são prompts de autoridade e 6 skills de engenharia são majoritariamente advisory, com quatro scripts locais (DAG, Merkle, AST e WCAG). Apenas `skill-media-producer` executa o pipeline de vídeo.

| Skill | Promessa no `SKILL.md` | Entrega local verificada | Status |
| :--- | :--- | :--- | :--- |
| `skill-orchestrate` | Swarms, budget, locks, checkpoints, rollback e `WorkRecord` | `scripts/dag_validator.js` + branches/reset do git | Parcial — swarms, locks e WorkRecord não executam |
| `skill-pipeline` | DAG, ondas topológicas e auto-healing | `scripts/dag_validator.js` | Parcial — auto-healing é padrão textual, sem executor |
| `skill-review` | Revisão dual-blind, anti-slop lint e voice calibration | `git diff`, `npm test`, `npm run lint` | Advisory — sem motor de anti-slop ou consenso |
| `skill-audit` | Merkle SHA-256, recibos ed25519 e time-travel replay | `scripts/merkle_verify.js` | Parcial — recibos e replay não executam |
| `skill-context` | AST, OpenAPI 3.1 e context packets <3k tokens | `scripts/ast_slice.js` | Parcial — OpenAPI e packet não executam |
| `skill-ui` | WCAG, alvos 44x44, DOM semântico e visual TDD | `scripts/wcag_check.js` | Parcial — DOM e visual TDD não executam |
| `skill-media-producer` | Pipeline de vídeo, legendas, overlays, split, cutout e batch | Comandos `studio` e `onboard` | Entregue; cutout experimental sem cache/GPU (CLI-14) |
| 11 skills de papel | Autoridade, prompt e outputs permitidos | `esquadrao role list/info/prompt/matrix` | Entregue como prompt; enforcement de outputs é advisory |

### 8.6. Gaps entre Promessa Comercial e Capacidade Entregue

| # | Promessa comercial | Onde aparece | Realidade no CLI 1.7.0 | ID |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Renderização em lote e semanas de postagens | `COPY.md` §1.1/§3, `hero.tsx`, `faq.tsx` | Entregue via `studio batch <dir>` (sequencial, com relatório agregado) | CLI-07 resolvido |
| 2 | 20 a 40 cortes dinâmicos de uma gravação longa | `COPY.md` §5.1 | `auto-clip` entrega um vídeo consolidado; `find-hooks` apenas ranqueia trechos | CLI-07 |
| 3 | Enquadramento inteligente | `COPY.md` §5.1 | Fonte 16:9 em 9:16 usa `scale=decrease` + `pad` (tarjas), sem tracking | — |
| 4 | Legendas automáticas palavra por palavra | `hero.tsx`, `faq.tsx`, `capabilities.tsx` | Exige SRT, OpenAI ou motor local; SRT distribui o tempo linearmente; sem fonte, o `onboard` corta sem legenda | CLI-03 |
| 5 | Rebaixamento automático de volume durante a fala | `COPY.md` §3.5 | Entregue via `sidechaincompress` quando `ducking: true` | CLI-05 resolvido |
| 6 | Retenção de mais de 70% do público | `capabilities.tsx` | Métrica não medida; deve ser removida ou qualificada | — |
| 7 | 18 skills como esquadrão completo | `GLOSSARY.md` §4, `README.md` | 12 prompts + 6 skills de engenharia parciais; só `media-producer` executa o pipeline de vídeo | CLI-11 |

**Conclusão:** corte de silêncio, templates, split (top/bottom), batch, ducking dinâmico e cutout estão entregues. As lacunas restantes são de copy/produto: múltiplos cortes separados por gravação, enquadramento inteligente de fonte widescreen, legendas sem fonte e métrica de retenção; o cutout segue experimental sem cache/GPU.

### 8.7. Cláusula de Precedência Normativa
Em caso de conflito, ambiguidade ou divergência técnica entre os contratos conceituais descritos nas Seções 1 a 7 e o inventário factual registrado nesta Seção 8, **prevalecem as disposições desta Seção 8** como a expressão autoritativa do estado de entrega e do backlog oficial do software.
