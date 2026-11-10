# Guia Operacional para LLMs e Agentes de IA — Esquadrão de Conteúdo Studio

Este guia estabelece o padrão de comportamento, diálogo e orquestração para assistentes inteligentes (Claude Code, Cursor, Codex CLI, Grok Build e Hermes) ao interagir com usuários na produção de vídeos automatizados.

---

## 1. Regra de Ouro: Soberania da Decisão do Usuário

O assistente de IA **nunca** deve impor uma configuração padrão arbitrária:
- **Não force formato widescreen (16:9):** Mais de 80% do consumo atual de cortes ocorre em formato vertical (9:16). Sempre pergunte a intenção do usuário.
- **Não force fundo preto (`dark`):** O modo `dark` é voltado para testes ou canais puramente tipográficos. A maioria dos usuários deseja cortar vídeos longos com legendas (`podcast_clip`) ou unir cenas de apoio e filmagens (`edit_only`).

---

## 2. Roteiro de Interação com o Usuário

Ao ser acionado pelo usuário com comandos como *"quero criar um corte"*, *"edite este vídeo"* ou *"configure o estúdio de vídeo"*, siga este fluxo:

### Fase 1: Sondagem e Descoberta
Envie uma mensagem amigável e direta coletando as decisões essenciais:
> *"Vou preparar a esteira de edição para você. Para deixar o vídeo no ponto certo, me diga:*
> *1. **Formato:** Você quer em formato **vertical 9:16** (Reels, TikTok, Shorts) ou **widescreen 16:9** (YouTube tradicional)?*
> *2. **Estilo:** Você quer **fatiar uma gravação com legendas** sincronizadas, **unir trechos de vídeo** ou prefere **texto sobre fundo escuro**?*
> *3. Qual é o arquivo de vídeo que vamos usar de fonte?"*

### Fase 2: Checagem de Ambiente
Antes de criar arquivos, verifique se a máquina possui os requisitos operacionais:
```bash
node -v
ffmpeg -version
ffprobe -version
```
Se o FFmpeg não for encontrado, responda com o comando de instalação imediato:
- **Windows:** `winget install Gyan.FFmpeg`
- **macOS:** `brew install ffmpeg`
- **Linux:** `sudo apt update && sudo apt install -y ffmpeg`

### Fase 3: Preparação do Workspace
Execute no terminal:
```bash
# 1. Instalar o CLI globalmente se ainda não estiver presente
npm install -g @universal-skill/cli

# 2. Configurar o workspace atual
esquadrao setup

# 3. Inicializar o estúdio
esquadrao studio init --dest ./workspace
```

### Fase 4: Importação da Mídia e Leitura dos Metadados
Importe o arquivo do usuário e anote o ID do asset:
```bash
esquadrao studio import /caminho/do/video.mp4 --dest ./workspace --json
```
A resposta retorna:
```json
{
  "id": "AST-A1B2C3D4",
  "metadata": {
    "duration_s": 45.2,
    "width": 1920,
    "height": 1080,
    "has_audio": true
  }
}
```

### Fase 5: Montagem do EditPlan
Com base nas escolhas do usuário, crie `./workspace/packages/editplan.json`.
- Para formato vertical: `width: 1080`, `height: 1920`.
- Para formato widescreen: `width: 1920`, `height: 1080`.
- Ajuste os pontos de corte (`in_ms`, `out_ms`) garantindo que `out_ms <= duration_s * 1000`.

**Apresente um resumo claro para o usuário antes de renderizar:**
> *"Preparei o plano de corte:*
> *- Formato: Vertical 9:16 (1080x1920)*
> *- Trecho: 00:05 a 00:35 (30 segundos)*
> *- Legendas: 3 frases sincronizadas com áudio nivelado*
> *Posso iniciar a renderização no seu computador?"*

### Fase 6: Renderização e QA
Após a confirmação:
```bash
esquadrao studio render ./workspace/packages/editplan.json --dest ./workspace --json
esquadrao studio qa ./workspace/artifacts/video.mp4 --plan ./workspace/packages/editplan.json
```
Entregue o caminho do vídeo final gerado e confirme que a checagem técnica passou com sucesso.

### Fase Alternativa Rápida: Pipeline Integrado de Auto-Corte (`auto-clip`)
Quando o usuário deseja fatiar pausas mortas e aplicar legendas automáticas a partir de um vídeo longo sem montar o `editplan.json` manualmente:
```bash
# Executa corte de silêncios (0.8s), transcrição Whisper, legendas dinâmicas e renderização com QA:
esquadrao studio auto-clip /caminho/do/video.mp4 --dest ./workspace --json
```
O comando emite o resumo com total de silêncio expurgado, quantidade de cortes contíguos e o artefato renderizado aprovado.

---

## 3. Matriz de Tratamento de Erros Comuns

| Erro Observado | Causa Raiz | Ação Corretiva Determinística |
| :--- | :--- | :--- |
| `ffmpeg is not installed` | Binário ausente no PATH | Orientar instalação via `winget`, `brew` ou `apt` e reabrir terminal. |
| `out_ms exceeds asset duration` | Ponto de saída além do arquivo | Obter duração real com `studio import` e recalcular `out_ms`. |
| `Missing audio stream in artifact` | Fonte sem áudio ou falha de mix | Garantir `anullsrc` para vídeo mudo ou verificar se o arquivo original tem áudio. |
| `Caption special characters error` | Caracteres `%` ou `'` na legenda | O motor trata com `\%` e `\'`. Não usar tags HTML em legendas. |
| `QA duration mismatch > 250ms` | Cortes inconsistentes com a timeline | Alinhar `timeline_start_ms` com o somatório dos cortes anteriores. |


---

## 4. Playbook Avançado: Corte de Vídeo Longo, Copy Viral, B-Rolls e Música

Quando o usuário fornecer uma gravação longa (podcast, aula, live ou entrevista de 30min a 2h), siga este roteiro de 5 passos para entregar um corte viral de alto nível:

### Passo 1: Transcrição Estruturada
Extraia o mapa textual completo com marcações de tempo:
```bash
esquadrao studio transcribe /caminho/do/video_longo.mp4 --dest ./workspace --json
```
O arquivo `./workspace/packages/transcript.json` conterá todos os blocos com `start_s`, `end_s` e `text`.

### Passo 2: Análise de Copy e Seleção dos Melhores Trechos
A LLM pode rodar o detector automatizado de ganchos ou analisar manualmente o `transcript.json`:
```bash
esquadrao studio find-hooks ./workspace/packages/transcript.json --min-dur 30 --max-dur 60 --json
```
O comando retorna os Top 3 candidatos ranqueados com pontuação de gancho, timestamps exatos (`start_ms`, `end_ms`) e punchlines.

A LLM deve aplicar a **Fórmula Tripartite de Retenção Viral**:
1. **O Gancho (0 a 3 segundos):** Identifique o momento em que o orador faz uma pergunta contraintuitiva, revela um segredo ou expõe um erro comum. O corte DEVE começar exatamente na primeira palavra do gancho (ex: *"O maior erro de quem tenta vender..."*).
2. **Janela de Retenção (30s a 60s flexível):** A ideia central precisa ser explicada com clareza sem prolixidade. Se o raciocínio exigir 45s ou 55s, respeite a conclusão natural da ideia. Permita ajuste se o usuário solicitar cortes mais curtos ou mais longos.
3. **Punchline de Fechamento:** O corte encerra no clímax da resposta ou conclusão, cortando antes de transições vazias ("é isso", "então pessoal", "deixa o like").

### Passo 3: Escolha Dinâmica dos B-Rolls e Layouts
Para evitar que o corte fique monótono ("cabeça falante"), a LLM insere B-rolls (`overlays`) e escolhe o layout ideal:
- **`layout: "fullscreen"` (Padrão):** Insira a cada 5 a 8 segundos cenas de apoio temáticas (ex: dinheiro, mansões, carros, trabalho) cobrindo 100% da tela durante 2 a 3 segundos, mantendo a voz do orador contínua.
- **`layout: "split_bottom"` (Dupla Retenção):** Para canais de alta velocidade (TikTok/Shorts), divida a tela com o orador em cima e o vídeo de apoio/pack embaixo.
- **`layout: "pip"` (Picture-in-Picture):** Quando o orador estiver apontando para um objeto ou reagindo a algo.

### Passo 4: Trilha Sonora com Ducking
Importe a música de fundo e configure atenuação automática de volume (`ducking`):
- Volume de fundo da música: `-22dB` durante a fala (suave, sem abafar a voz).

### Passo 5: Geração do EditPlan Completo e Renderização
Exemplo canônico de EditPlan com cortes, B-rolls, música e legendas estilo impacto:
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
      "clip_id": "fala-principal",
      "asset_id": "AST-PODCAST01",
      "in_ms": 124000,
      "out_ms": 168000,
      "timeline_start_ms": 0,
      "speed": 1
    }
  ],
  "audio_tracks": [
    { "kind": "source", "clip_id": "fala-principal", "gain_db": 0 }
  ],
  "overlays": [
    {
      "kind": "video",
      "asset_id": "AST-BROLL-DINHEIRO",
      "layout": "fullscreen",
      "in_ms": 0,
      "out_ms": 3000,
      "timeline_start_ms": 6000,
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
      "text": "O MAIOR ERRO",
      "timeline_start_ms": 0,
      "duration_ms": 1200,
      "style": "impact"
    }
  ]
}
```
Renderize e verifique com:
```bash
esquadrao studio render ./workspace/packages/editplan.json --dest ./workspace
esquadrao studio qa ./workspace/artifacts/video.mp4 --plan ./workspace/packages/editplan.json
```
