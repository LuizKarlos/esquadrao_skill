---
name: skill-media-producer
version: "1.6.0"
description: "Set up Esquadrão Studio and configure video aspect ratio, captions, cuts, audio gain, EditPlan validation, rendering, and QA. Use for initial setup and video configuration requests."
allowed-tools: ["terminal"]
---

# Media Producer — Esquadrão de Conteúdo

Guia canônico e motor de execução para agentes de IA e LLMs produzirem vídeos automatizados via `@esquadrao/cli` e FFmpeg local.

## When to Use

- Configuração inicial do estúdio de vídeo e setup do ambiente local.
- Criação de planos de corte e edição estruturados (`EditPlan v1`) sem alucinações.
- Fatiamento de podcasts e gravações longas com legendas sincronizadas (`podcast_clip`).
- Decupagem e junção contígua de trechos de vídeo (`edit_only`).
- Vídeos com tipografia destacada (`dark`), exclusivamente sob demanda expressa do usuário.
- Inspeção técnica automatizada de qualidade (`studio qa`) e validação de conformidade.

## NOT for

- Validação de ledgers Merkle criptográficos (`skill-audit`).
- Orquestração de enxames e bloqueios de leasing (`skill-orchestrate`).
- Fatiamento sintático de AST (`skill-context`).
- Auditorias visuais WCAG de páginas web (`skill-ui`).

---

## 1. Princípio Fundamental de Escolha do Usuário (Anti-Padrão Forçado)

> **REGRA MANDATÓRIA PARA A LLM:**
> **A forma de edição com fundo preto e widescreen NÃO é o padrão do sistema.**
> Quem escolhe a proporção e o estilo visual é SEMPRE o usuário. A LLM NUNCA deve assumir proporção 16:9 ou fundo escuro sem perguntar explicitamente.

A LLM deve obter a confirmação do usuário para dois eixos decisórios fundamentais:

1. **Proporção de Tela / Formato:**
   - **Vertical 9:16 (`1080x1920`):** Ideal para TikTok, Instagram Reels, YouTube Shorts e consumo mobile.
   - **Widescreen 16:9 (`1920x1080`):** Ideal para YouTube padrão, desktop, apresentações e TV.
2. **Estilo de Edição / Mídia de Fundo:**
   - **`podcast_clip` (Cortes com Legendas):** Fatiamento de falas longas com áudio balanceado e queima gráfica de legendas dinâmicas.
   - **`edit_only` (Decupagem de Vídeo):** Junção contígua de 2 cortes a partir de filmagens do usuário ou packs de vídeos e imagens cinematográficas.
   - **`dark` (Fundo Escuro Tipográfico):** Animação tipográfica de texto centralizado sobre fundo escuro com silêncio ou trilha sintética (usar apenas se o usuário pedir explicitamente).

---

## 2. Guia de Conversação e Setup Passo a Passo para LLMs

Quando o usuário solicitar ajuda para produzir vídeos ou configurar a esteira, a LLM deve seguir exatamente esta sequência:

### Passo 1: Sondagem Inicial de Preferências
A LLM pergunta de forma direta e objetiva:
1. *"Qual formato você prefere para o seu vídeo? (1) Vertical 9:16 para Reels/Shorts/TikTok ou (2) Widescreen 16:9 para YouTube?"*
2. *"Qual estilo você quer aplicar? (1) Cortar uma gravação com legendas (via SRT, OpenAI ou modelo local), (2) Decupar e unir trechos de vídeos/packs, ou (3) Vídeo tipográfico sobre fundo escuro?"*

### Passo 2: Instalação no Agente de IA e Resolução de Dependências
O usuário instala o pacote executando apenas o comando npm através do seu agente de IA preferido (Claude Code, OpenAI Codex, Gemini, Cursor):
```bash
npm install -g @esquadrao/cli
```
> **Resolução Automática:** Caso o Node.js (>=18) ou o FFmpeg/ffprobe não estejam presentes na máquina, o próprio comando `esquadrao setup` ou o agente de IA realiza a instalação necessária de forma transparente. O usuário não precisa executar comandos de sistema operacional além do npm.

> **Onboarding Real (`onboard`):** No modo `podcast_clip`, o `onboard` executa o pipeline real de `auto-clip` (detecção de silêncio, cortes, legendas e QA). Use `--captions`, `--openai`, `--local` ou `--no-captions`; sem motor de legenda, ele aplica `--no-captions`, gera o corte real sem legendas e avisa.

### Passo 3: Definição do Workspace e Configuração das Skills
O usuário escolhe uma pasta no computador para ser seu repositório/workspace principal de uso diário (ex.: `./meu-estudio`). É nessa pasta que as skills inteligentes do Esquadrão operam:
```bash
# Dentro da pasta do seu projeto/workspace
esquadrao setup
```
> **Acervo de Apoio:** Os packs de vídeos e imagens adquiridos na plataforma devem ser descompactados e mantidos dentro dessa mesma pasta de trabalho (ex.: `./packs/`), garantindo acesso imediato aos agentes para cortes e B-rolls.

### Passo 4: Inicialização do Estúdio
```bash
# Inicializa a estrutura atômica de pastas do workspace
esquadrao studio init --dest ./workspace
```

Estrutura criada por `studio init`:
```text
workspace/
├── assets/       # Arquivos de mídia importados e cópias locais
├── packages/     # Planos de edição (editplan.json) e transcrições
├── artifacts/    # Vídeos finais renderizados em MP4
└── studio.json   # Manifesto do estúdio e inventário de assets
```
*(Nota: o comando cria apenas `assets/`, `packages/`, `artifacts/` e `studio.json`. Pastas como `editplans/`, `renders/` e `qa/` não existem.)*

### Passo 5: Importação das Fontes de Mídia (se aplicável)
```bash
# Importa o arquivo de vídeo e inspeciona duração, codecs e áudio
esquadrao studio import ./caminho/meu-video.mp4 --dest ./workspace --json
```

### Passo 6: Criação do EditPlan e Aprovação do Usuário
A LLM gera o arquivo `./workspace/packages/editplan.json` com base nos modelos canônicos abaixo.
**A LLM deve exibir os cortes, a duração final e as legendas para o usuário aprovar antes de renderizar.**

### Passo 7: Renderização e Verificação de Qualidade (QA)
```bash
# Renderiza o artefato final em MP4
esquadrao studio render ./workspace/packages/editplan.json --dest ./workspace --json

# Valida conformidade técnica (áudio, resolução e duração)
esquadrao studio qa ./workspace/artifacts/video.mp4 --plan ./workspace/packages/editplan.json
```

### Passo Alternativo: Pipeline Integrado de Auto-Corte (`auto-clip`)
Para vídeos falados com remoção de pausas e silêncios (>0.8s):
```bash
esquadrao studio auto-clip ./caminho/meu-video.mp4 --dest ./workspace --json
```

**Caminhos de legendas no `auto-clip`:**
1. `--captions <arquivo.srt>`: Determinístico, offline e testado (caminho recomendado).
2. `--openai`: Requer a variável de ambiente `OPENAI_API_KEY` para transcrição remota via API Whisper.
3. `--local`: Utiliza `@xenova/transformers` + `Xenova/whisper-tiny` (declarada em `optionalDependencies`). Se o pacote opcional não estiver instalado, o comando falha com instrução acionável; use `--no-captions` para cortar sem legendas.

> **Templates de legenda:** o catálogo canônico tem nove presets em [`references/caption-templates.md`](references/caption-templates.md), disponíveis no CLI 1.5.0 via `--caption-template <id>` ou `captions[].template`. `--caption-style impact|word|full` permanece como legado.

---

## 3. Modelos Canônicos de EditPlan v1 (Prontos para LLM sem Alucinação)

### Modelo 1: Vertical 9:16 (`1080x1920`) — `podcast_clip` (Cortes com Legendas)
```json
{
  "schema_version": 1,
  "mode": "podcast_clip",
  "output": {
    "width": 1080,
    "height": 1920,
    "fps_num": 30,
    "fps_den": 1,
    "video_codec": "h264",
    "audio_codec": "aac"
  },
  "clips": [
    {
      "kind": "video",
      "clip_id": "clip-01",
      "asset_id": "AST-12345678",
      "in_ms": 1000,
      "out_ms": 7000,
      "timeline_start_ms": 0,
      "speed": 1
    }
  ],
  "audio_tracks": [
    {
      "kind": "source",
      "clip_id": "clip-01",
      "gain_db": 0
    }
  ],
  "captions": [
    {
      "text": "Vídeo longo parado não dá visualização.",
      "timeline_start_ms": 0,
      "duration_ms": 3000
    },
    {
      "text": "A esteira local corta silêncios e gera legendas.",
      "timeline_start_ms": 3000,
      "duration_ms": 3000
    }
  ]
}
```

### Modelo 2: Widescreen 16:9 (`1920x1080`) — `edit_only` (Decupagem Contígua)
```json
{
  "schema_version": 1,
  "mode": "edit_only",
  "output": {
    "width": 1920,
    "height": 1080,
    "fps_num": 30,
    "fps_den": 1,
    "video_codec": "h264",
    "audio_codec": "aac"
  },
  "clips": [
    {
      "kind": "video",
      "clip_id": "corte-01",
      "asset_id": "AST-12345678",
      "in_ms": 0,
      "out_ms": 4000,
      "timeline_start_ms": 0,
      "speed": 1
    },
    {
      "kind": "video",
      "clip_id": "corte-02",
      "asset_id": "AST-12345678",
      "in_ms": 4000,
      "out_ms": 8000,
      "timeline_start_ms": 4000,
      "speed": 1
    }
  ],
  "audio_tracks": [
    {
      "kind": "source",
      "clip_id": "corte-01",
      "gain_db": 0
    },
    {
      "kind": "source",
      "clip_id": "corte-02",
      "gain_db": 0
    }
  ]
}
```

### Modelo 3: Vertical 9:16 (`1080x1920`) — `edit_only` (Dois Cortes com Cenas de Fundo)
```json
{
  "schema_version": 1,
  "mode": "edit_only",
  "output": {
    "width": 1080,
    "height": 1920,
    "fps_num": 30,
    "fps_den": 1,
    "video_codec": "h264",
    "audio_codec": "aac"
  },
  "clips": [
    {
      "kind": "video",
      "clip_id": "take-01",
      "asset_id": "AST-CENA0001",
      "in_ms": 0,
      "out_ms": 3000,
      "timeline_start_ms": 0,
      "speed": 1
    },
    {
      "kind": "video",
      "clip_id": "take-02",
      "asset_id": "AST-CENA0002",
      "in_ms": 0,
      "out_ms": 3500,
      "timeline_start_ms": 3000,
      "speed": 1
    }
  ],
  "audio_tracks": [
    {
      "kind": "source",
      "clip_id": "take-01",
      "gain_db": 0
    },
    {
      "kind": "source",
      "clip_id": "take-02",
      "gain_db": 0
    }
  ]
}
```

### Modelo 4: Fundo Escuro Tipográfico — `dark` (Sob Solicitação Expressa do Usuário)
```json
{
  "schema_version": 1,
  "mode": "dark",
  "output": {
    "width": 1080,
    "height": 1920,
    "fps_num": 30,
    "fps_den": 1,
    "video_codec": "h264",
    "audio_codec": "aac"
  },
  "clips": [
    {
      "kind": "text",
      "text": "Ideia Principal em Destaque",
      "duration_ms": 2000,
      "timeline_start_ms": 0
    },
    {
      "kind": "text",
      "text": "Conclusão e Próximo Passo",
      "duration_ms": 2500,
      "timeline_start_ms": 2000
    }
  ]
}
```

---

## 4. Fronteiras Rígidas e Regras Anti-Alucinação para LLMs

1. **Resoluções Válidas:** Estritamente `1080x1920` (Vertical 9:16) ou `1920x1080` (Widescreen 16:9). Qualquer outro valor causa falha na validação de QA.
2. **Taxa de Quadros e Codecs:** Sempre `fps_num: 30`, `fps_den: 1`, `video_codec: "h264"`, `audio_codec: "aac"`.
3. **Cortes de Vídeo:** Mínimo de 100 milissegundos por corte. O ponto de término `out_ms` não pode exceder a duração real do asset importado.
4. **Legendas:**
   - 1 a 200 caracteres por frase.
   - Normalização NFC sem caracteres invisíveis.
   - Zero tags HTML (`<b>`, `<font>`, `<br>`).
   - Caracteres especiais são tratados pelo motor: `%` vira `\%`, `'` vira `\'`, `\` vira `\\`.
5. **Ganho de Áudio e Ducking:**
   - Intervalo restrito entre `-60` dB e `+12` dB. `0` dB preserva o volume original.
   - `music_tracks.ducking`: Com `true`, aplica ducking dinâmico via `sidechaincompress` usando a fala como chave; com `false`, usa atenuação fixa de `-22 dB` via `amix` (CLI-05 resolvido em 1.7.0).
6. **Overlays e Layouts:**
   - Layouts funcionais no renderizador: `fullscreen`, `pip`, `split_bottom` e `split_top`.
   - **Split permanente:** `auto-clip --broll <pack> --layout split_bottom --overlay-duration full` mantém o orador no topo e o pack na base durante todo o clipe; o pack é repetido em loop e o áudio original é preservado.
   - O layout `split_top` está implementado desde 1.7.0: orador na metade inferior e pack na metade superior, com loop (CLI-06).
   - **Recorte de pessoa com troca de fundo:** disponível em `studio cutout <video> --background <pack> --python <interpretador>`, como experimental. Requer Python com `rembg`, `onnxruntime`, `opencv-python-headless`, `numpy` e Pillow; ~18–20 min de CPU por 60 s em 15 fps. Não prometa tempo real nem qualidade de estúdio. Detalhes em [`references/composicoes-especiais.md`](./references/composicoes-especiais.md).
7. **Verificação Técnica Independente:** Sempre execute `studio qa` com `--plan` para validar integridade antes de concluir a tarefa.
8. **Renderização em Lote:** Para múltiplos planos, use `esquadrao studio batch <dir> --dest <workspace> --json`; o comando renderiza em sequência e agrega o QA (CLI-07).
9. **Onboarding Real:** O comando `esquadrao onboard --mode podcast_clip` usa o pipeline real de `auto-clip`; os modos `dark` e `edit_only` continuam gerando planos guiados.

---

## 5. Referências Adicionais

- [`references/llm-agent-guide.md`](references/llm-agent-guide.md): Guia de conversação completo com fluxos de tratamento de erro.
- [`references/configuracao-inicial.md`](references/configuracao-inicial.md): Guia passo a passo para execução via PowerShell / Windows.
- [`references/caption-templates.md`](references/caption-templates.md): catálogo canônico dos nove templates de legenda, com fonte, cores, contorno, sombra e contrato CLI.
- [`references/corte-podcast-3-niveis.md`](references/corte-podcast-3-niveis.md): procedimento validado para demonstrar corte de pausas longas e respiros curtos em três níveis, com métricas e critérios de aceite.
