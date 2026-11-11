# Changelog

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

O formato segue as diretrizes do [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/), e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [1.6.0] - 2026-11-11

### Adicionado
- **Split permanente no `auto-clip` (CLI-13):** `--layout split_bottom` + `--overlay-duration full` mantém o orador no topo e o pack na base durante todo o clipe, com pack silenciado em loop e áudio original.
- **Layout configurável no `auto-clip`:** `--layout fullscreen|pip|split_bottom` e `--overlay-duration inserts|full`; `split_top` continua pendente (CLI-06).
- **Recorte de pessoa (CLI-14, experimental):** `studio cutout <video> --background <pack>` com `rembg`/`u2net_human_seg`, refino GrabCut, composição 1080×1920, áudio original e QA.
- **Motor Python opcional:** `scripts/cutout.py` chamado via `--python`; dependências `rembg`, `onnxruntime`, `opencv-python-headless`, `numpy` e Pillow não entram no npm.
- **Ajuda:** `--broll`, `--music`, `--layout`, `--overlay-duration`, `--background`, `--engine`, `--fps` e `--python` documentados no `--help` (CLI-10).

### Corrigido
- **Split sem tarjas:** o overlay `split_bottom` usa `scale` + `crop` para preencher a metade, em vez de `pad`.
- **Loop de pack:** overlays com `loop: true` usam `-stream_loop -1` no render, permitindo pack curto cobrir clipe longo.
- **Cor do cutout:** conversão explícita RGBA→BGRA evita a troca de vermelho/azul que deixava a pele azul.
- **Halo do cutout:** máscara do `u2net` refinada com GrabCut em resolução cheia; a franja escura ao redor da cabeça é removida.

### Testes
- **91/91 testes** (4 novos: split permanente, contrato do cutout, engine inválido e help) e lint em 38 arquivos.
- Teste de split cobre plano `split_bottom`, `loop: true`, duração total e QA.

### Documentação
- `SPEC`, `ROADMAP`, `README`, `GLOSSARY`, `SKILL.md`, guia de agentes e `references/composicoes-especiais.md` sincronizados com o estado 1.6.0.
- Cutout qualificado como experimental: ~18–20 min de CPU por 60 s em 15 fps, sem cache de máscaras ou GPU.

---

## [1.5.0] - 2026-11-11

### Adicionado
- **Motor nativo de templates de legenda (CLI-12):** `--caption-template <id>` em `studio auto-clip`/`studio render`, `caption_template` e `captions[].template` no EditPlan, e `studio caption-templates --json`.
- **Nove presets:** MrBeast Yellow, TikTok White, Gold Stroke, Green Stroke, Neon Glitch, Minimal Lower Third, Red Stroke, Heavy White e Mono Clean, todos sem fundo sólido.
- **Fontes empacotadas:** Anton, Bebas Neue e Poppins em `assets/fonts` (OFL 1.1), com fallback para Liberation/DejaVu/Poppins.
- **Validação:** ID desconhecido falha com código 1 e lista os templates disponíveis.

### Corrigido
- **Escala vertical:** a segunda linha usa `lineGap * font_size`, mantendo o bloco compacto em 9:16 em vez de abrir um vão proporcional à altura.
- **Heavy White:** contorno reduzido de 10 px para 8 px para não fechar o espaço entre as palavras.

### Testes
- 87/87 testes (8 novos) e lint em 37 arquivos cobrindo catálogo, fontes, divisão de linhas, geometria vertical, validação de ID, listagem CLI e render ponta a ponta.

---

## [1.4.0] - 2026-11-11

### Adicionado
- **Onboarding real no modo `podcast_clip`:** `esquadrao onboard --mode podcast_clip` agora executa o pipeline `auto-clip` (detecção de silêncio, cortes, legendas e QA), com `--captions`, `--openai`, `--local` e `--no-captions`.
- **Corte explícito sem legendas:** flag `--no-captions` em `studio auto-clip` e `onboard` para gerar o vídeo sem transcrição de forma intencional.
- **Motor local opcional:** `@xenova/transformers@^2.17.2` declarado em `optionalDependencies`; ausência gera erro acionável e não quebra a instalação.
- **Testes:** 79/79 (6 novos) cobrindo falha sem legenda, `--no-captions`, ausência do motor local, `transcribe` sem fonte, onboarding real e overlays/música no plano.

### Corrigido
- `auto-clip` e `transcribe` falham com código `1` e mensagem acionável quando não há SRT, OpenAI nem motor local, em vez de renderizar sem legendas.
- `--captions` funciona em vídeo sem faixa de áudio (SRT não exige extração).
- `auto-clip --broll` e `--music` agora anexam overlays e `music_tracks` ao EditPlan; antes eram construídos e descartados por um retorno antecipado. A distribuição usa todos os b-rolls informados em cortes de ~2,4 s.
- `onboard` em `podcast_clip` sem motor de legenda gera corte real com aviso explícito, sem legenda fixa.
- Documentação sincronizada: SPEC §8, ROADMAP, GLOSSARY, README, `skill-media-producer` e referências refletem o estado entregue.

### Documentação
- **Catálogo de templates de legenda:** `skill-media-producer/references/caption-templates.md` documenta nove presets (MrBeast Yellow, TikTok White, Gold Stroke, Green Stroke, Neon Glitch, Minimal Lower Third, Red Stroke, Heavy White e Mono Clean), com fonte, cores, contorno, sombra, posição e animação, todos sem fundo sólido.
- **Status explícito:** o CLI 1.4.0 expõe apenas `impact|word|full`; `--caption-template` e `captions[].template` ficam no backlog CLI-12.

---

## [1.3.1] - 2026-11-10

### Modificado
- **Erradicação Total do Termo Proibido 'universal' e Padronização Canônica**:
  - Pacote oficial renomeado para `@esquadrao/cli` em `package.json` e em todas as referências canônicas.
  - Binários limpos: mantido exclusivamente o comando canônico `esquadrao` (expurgados aliases legados `universal-skill` e `agent-skill`).
  - Manifesto padrão do estúdio saneado de `universal-studio` para `esquadrao-studio` em `src/commands/studio.js`.
  - Diretório de perfil do usuário saneado de `~/.universal-skill` para `~/.esquadrao/profile.json`.
  - Auditoria conjunta Atlas MCP e Jev confirmando zero ocorrências residuais de 'universal' em código e testes.
  - Todos os 73 testes automatizados aprovados sem falhas (`pass: 73, fail: 0`).

---

## [1.3.0] - 2026-11-09

### Adicionado
- **Detector Heurístico de Ganchos (`esquadrao studio find-hooks`)**:
  - Mineração automatizada de trechos virais com base em padrões de copywriting (perguntas contraintuitivas, quebras de padrão, dores e segredos).
  - Janela de raciocínio inteligente com agrupamento de 30s a 60s (customizável via `--min-dur` e `--max-dur`).
  - Identificação de punchline final e pontuação de retenção para apoiar a seleção por agentes LLM.
- **Auto-Clip Totalmente Dinâmico (`--broll` e `--music`)**:
  - `esquadrao studio auto-clip` agora aceita `--broll <arquivo>` (múltiplas cenas de apoio) e `--music <arquivo>`.
  - Distribuição automática de B-rolls durante a fala e mixagem suave de trilha sonora com ducking (-22dB) em um único comando.
- **Suíte de Testes para Detecção de Ganchos e Auto-Clip Dinâmico**:
  - Adicionado `tests/find_hooks.test.js` com testes unitários e de integração (72/72 testes passando).

---

## [1.2.0] - 2026-11-09

### Adicionado
- **Transcrição Estruturada para Vídeos Longos (`studio transcribe`)**:
  - Extração de áudio e transcrição Whisper (30min a 2h de gravação) gerando `transcript.json` com marcações de início/fim e exportando `transcript.srt`.
- **Playbook de Copywriting para LLMs (Corte de Vídeos Longos)**:
  - Ensina agentes de IA a identificar ganchos de alta retenção (0-3s), janela de raciocínio de 30s a 60s (flexível) e punchlines conclusivas.
- **Overlays Visuais Dinâmicos (B-Rolls)**:
  - Suporte a `overlays` no contrato `EditPlan v1` e renderização no FFmpeg.
  - Layouts suportados: `fullscreen` (padrão, corte de apoio cobrindo a tela mantendo a voz ininterrupta), `pip` (janela flutuante) e `split_bottom` (dupla retenção / tela dividida).
- **Trilha Sonora com Atenuação**:
  - Suporte a `music_tracks` com atenuação fixa de volume em -22 dB via `amix` (ducking dinâmico por sidechain ainda pendente, CLI-05).
- **Suíte de Testes Dinâmicos**:
  - Adicionado `tests/studio_dynamic.test.js` com validação de contrato, transcrição e renderização de vídeo dinâmico com QA (69/69 testes passando).

---

## [1.1.0] - 2026-11-09

### Adicionado
- **Comando Canônico `esquadrao`**: Adicionado alias binário oficial `esquadrao` e `esquadrao-skill` .
- **Corte Automático de Silêncio (`detectSilence` / `computeSpeechIntervals`)**:
  - Filtro nativo FFmpeg `silencedetect=noise=-30dB:d=0.8` (customizável via `--silence-thresh` e `--silence-duration`).
  - Mapeamento determinístico de intervalos de silêncio e geração automática de segmentos de fala ativa.
- **Transcrição Whisper e Legendas Dinâmicas**:
  - Suporte ao Whisper gratuito local via ONNX / `@xenova/transformers` ou importação de arquivos `.srt`/`.vtt`.
  - Suporte opcional à API oficial OpenAI Whisper (`v1/audio/transcriptions`) com consulta interativa prévia ao usuário quando `OPENAI_API_KEY` estiver configurada.
  - Formatação de legendas no Estilo A (impacto viral com 2 a 4 palavras em caixa alta, centralizadas e com fundo contrastante de alta legibilidade).
- **Remapeamento Temporal Exato (`remapCaptionsToSpeechTimeline`)**:
  - Sincronização matemática dos blocos de legenda sobre a linha de tempo pós-corte, eliminando dessincronia após o expurgo das pausas.
- **Novos Comandos de Linha**:
  - `esquadrao studio detect-silence <video.mp4>`: emite diagnóstico detalhado de silêncios detectados e tempo de fala líquida.
  - `esquadrao studio auto-clip <video.mp4>`: pipeline ponta a ponta (ingestão, corte de silêncios, Whisper, montagem de EditPlan, renderização MP4 e QA técnico).
- **Suíte de Testes Automatizados**:
  - Adicionado `tests/autoclip.test.js` com 9 testes unitários e de integração E2E com FFmpeg (66/66 testes passando).

### Modificado
- `SPEC.md`, `ROADMAP.md` e `GLOSSARY.md` atualizados com as especificações de auto-corte, Whisper e equivalências de terminologia.
- `llm-agent-guide.md` e `configuracao-inicial.md` enriquecidos com exemplos práticos de execução do `auto-clip`.

---

## [1.0.0] - 2026-11-09

### Adicionado
- Lançamento inicial do `@esquadrao/cli` com arquitetura modular zero-dependency em 5 camadas.
- 12 papéis canônicos de engenharia de software e produção de mídia.
- Comandos `setup`, `role`, `studio` (init, import, render, qa) e `onboard`.
- Soberania do usuário sobre proporção (Vertical 9:16 ou Widescreen 16:9) e estilos (`dark`, `edit_only`, `podcast_clip`).
