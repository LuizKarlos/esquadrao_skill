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
universal-skill setup

# 3. Inicializar o estúdio
universal-skill studio init --dest ./workspace
```

### Fase 4: Importação da Mídia e Leitura dos Metadados
Importe o arquivo do usuário e anote o ID do asset:
```bash
universal-skill studio import /caminho/do/video.mp4 --dest ./workspace --json
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
universal-skill studio render ./workspace/packages/editplan.json --dest ./workspace --json
universal-skill studio qa ./workspace/artifacts/video.mp4 --plan ./workspace/packages/editplan.json
```
Entregue o caminho do vídeo final gerado e confirme que a checagem técnica passou com sucesso.

---

## 3. Matriz de Tratamento de Erros Comuns

| Erro Observado | Causa Raiz | Ação Corretiva Determinística |
| :--- | :--- | :--- |
| `ffmpeg is not installed` | Binário ausente no PATH | Orientar instalação via `winget`, `brew` ou `apt` e reabrir terminal. |
| `out_ms exceeds asset duration` | Ponto de saída além do arquivo | Obter duração real com `studio import` e recalcular `out_ms`. |
| `Missing audio stream in artifact` | Fonte sem áudio ou falha de mix | Garantir `anullsrc` para vídeo mudo ou verificar se o arquivo original tem áudio. |
| `Caption special characters error` | Caracteres `%` ou `'` na legenda | O motor trata com `\%` e `\'`. Não usar tags HTML em legendas. |
| `QA duration mismatch > 250ms` | Cortes inconsistentes com a timeline | Alinhar `timeline_start_ms` com o somatório dos cortes anteriores. |
