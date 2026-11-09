# Changelog

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

O formato segue as diretrizes do [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/), e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

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
- **Trilha Sonora com Audio Ducking**:
  - Suporte a `music_tracks` com atenuação inteligente de volume (`amix` e ducking de -22dB durante falas ativas).
- **Suíte de Testes Dinâmicos**:
  - Adicionado `tests/studio_dynamic.test.js` com validação de contrato, transcrição e renderização de vídeo dinâmico com QA (69/69 testes passando).

---

## [1.1.0] - 2026-11-09

### Adicionado
- **Comando Canônico `esquadrao`**: Adicionado alias binário oficial `esquadrao` e `esquadrao-skill` em conjunto com `universal-skill`.
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
- Lançamento inicial do `@universal-skill/cli` com arquitetura modular zero-dependency em 5 camadas.
- 12 papéis canônicos de engenharia de software e produção de mídia.
- Comandos `setup`, `role`, `studio` (init, import, render, qa) e `onboard`.
- Soberania do usuário sobre proporção (Vertical 9:16 ou Widescreen 16:9) e estilos (`dark`, `edit_only`, `podcast_clip`).
