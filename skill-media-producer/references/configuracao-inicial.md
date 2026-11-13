# Configuração inicial do Esquadrão Studio

Guia para Windows / PowerShell: instalar, escolher proporção, configurar cortes e legendas, renderizar e verificar o MP4. Execute os blocos na mesma sessão. O Studio executa localmente pelo CLI, com Node.js e FFmpeg.

## 1. Pré-requisitos e instalação

Use Node.js 18 ou superior. Confira:

```powershell
node --version
npm --version
ffmpeg -version
ffprobe -version
```

Se precisar instalar FFmpeg:

```powershell
winget install --id Gyan.FFmpeg -e
```

Abra um novo PowerShell após instalar para atualizar o PATH.

Se você já tem o repositório clonado, defina o caminho absoluto para `bin\cli.js`:

```powershell
$cli = "C:\caminho\esquadrao-cli\bin\cli.js"
node $cli studio --help
```

Alternativamente, após a publicação do pacote no npm, instale com `npm install -g @esquadrao/cli` e substitua `node $cli` por `esquadrao` nos comandos deste guia.

## 2. Criar o projeto e instalar as skills

Escolha uma pasta exclusiva para o vídeo. `setup` copia as skills e atualiza as integrações de agentes detectadas nessa pasta; use uma pasta nova para preservar configurações de outros projetos.

```powershell
$projeto = Join-Path $env:USERPROFILE "Videos\StudioEsquadrao\meu-primeiro-video"
New-Item -ItemType Directory -Force -Path $projeto | Out-Null
Set-Location $projeto
node $cli setup
if ($LASTEXITCODE -ne 0) { throw "Falha ao instalar as skills." }
node $cli studio init --dest $projeto
if ($LASTEXITCODE -ne 0) { throw "Falha ao inicializar o Studio." }
```

Para Claude Code em um projeto novo, prepare a integração e execute novamente o setup:

```powershell
New-Item -ItemType Directory -Force -Path (Join-Path $projeto ".claude") | Out-Null
node $cli setup
if ($LASTEXITCODE -ne 0) { throw "Falha ao instalar as skills para Claude Code." }
```

Abra o agente nessa pasta em uma nova sessão para carregar `skill-media-producer`. `assets/` guarda cópias das fontes, `packages/` guarda os planos, `artifacts/` recebe os MP4 e `studio.json` registra as importações e resultados. `studio init` cria exclusivamente essas pastas e arquivos.

Para experimentar o fluxo guiado com valores padrão, use `node $cli onboard --mode podcast_clip --file <video> --captions <legendas.srt>`. Sem SRT/OpenAI/motor local, o onboard aplica `--no-captions`, gera um corte real sem legendas e avisa. Para controlar proporção, cortes e legendas explicitamente, siga os próximos passos.

## 3. Importar um vídeo com áudio

Substitua o caminho por um arquivo com pelo menos 8 segundos e áudio. O original permanece preservado; a importação cria uma cópia.

```powershell
$origem = "C:\caminho\seu-video.mp4"
$resultado = node $cli studio import $origem --dest $projeto --json
if ($LASTEXITCODE -ne 0) { throw "Falha ao importar o vídeo." }
$asset = ($resultado -join "`n") | ConvertFrom-Json
$asset | Select-Object id, name, metadata
if ($asset.metadata.duration_s -lt 8 -or !$asset.metadata.audio_codec) {
    throw "O exemplo requer uma fonte com áudio e pelo menos 8 segundos."
}
```

## 4. Criar o plano de edição

Crie `packages/editplan.json` a partir deste modelo. Os tempos são inteiros em milissegundos: `1000` equivale a um segundo.

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
      "clip_id": "corte-1",
      "asset_id": "AST-SUBSTITUIR",
      "in_ms": 0,
      "out_ms": 4000,
      "timeline_start_ms": 0
    },
    {
      "kind": "video",
      "clip_id": "corte-2",
      "asset_id": "AST-SUBSTITUIR",
      "in_ms": 4000,
      "out_ms": 8000,
      "timeline_start_ms": 4000
    }
  ],
  "audio_tracks": [
    { "kind": "source", "clip_id": "corte-1", "gain_db": 0 },
    { "kind": "source", "clip_id": "corte-2", "gain_db": 0 }
  ],
  "captions": [
    { "text": "Sua primeira frase", "timeline_start_ms": 0, "duration_ms": 4000 },
    { "text": "Sua segunda frase", "timeline_start_ms": 4000, "duration_ms": 4000 }
  ]
}
```

Para criar o arquivo, execute e cole apenas o JSON acima no editor, depois salve e feche:

```powershell
$arquivoPlano = Join-Path $projeto "packages\editplan.json"
notepad $arquivoPlano
```

Carregue o arquivo e vincule os dois cortes ao vídeo importado:

```powershell
$plano = Get-Content -Raw -Encoding UTF8 $arquivoPlano | ConvertFrom-Json
$plano.clips[0].asset_id = $asset.id
$plano.clips[1].asset_id = $asset.id
```

## 5. Escolher proporção e cortes

> **Nota de Escolha do Usuário:** O formato e o estilo de edição são definidos livremente por você. O sistema não impõe fundo preto nem formato widescreen como padrão. Você escolhe entre a proporção vertical 9:16 (mobile) ou horizontal 16:9 (widescreen), e define se usará suas filmagens, packs de apoio ou telas tipográficas.

| Formato | Largura | Altura | Uso |
|---|---:|---:|---|
| 9:16 | 1080 | 1920 | Reels, Shorts, TikTok |
| 16:9 | 1920 | 1080 | Vídeo horizontal |

Para vertical:

```powershell
$plano.output.width = 1080
$plano.output.height = 1920
```

Para horizontal, use `width = 1920` e `height = 1080`. Estes são os dois formatos aceitos, a 30 fps com H.264/AAC. O enquadramento preserva a proporção da fonte e completa o espaço restante com bordas. Recorte automático e saída quadrada ficam fora das opções atuais.

`in_ms` e `out_ms` selecionam o trecho do original. `timeline_start_ms` posiciona esse trecho no vídeo final. O modo `edit_only` exige exatamente dois cortes consecutivos na montagem, com uma faixa de áudio original por corte.

Exemplo opcional para uma fonte de pelo menos 34 segundos: selecionar 10–14s e 30–34s, mantendo 8 segundos de montagem:

```powershell
$plano.clips[0].in_ms = 10000
$plano.clips[0].out_ms = 14000
$plano.clips[1].in_ms = 30000
$plano.clips[1].out_ms = 34000
$plano.clips[1].timeline_start_ms = 4000
```

Ao alterar a duração do primeiro corte, ajuste o início do segundo para a nova duração. Mantenha os pontos de saída dentro da duração da fonte.

## 6. Configurar legenda e áudio

Texto, início e duração são configuráveis:

```powershell
$plano.captions[0].text = "Veja como configurar seu vídeo"
$plano.captions[0].timeline_start_ms = 0
$plano.captions[0].duration_ms = 4000
$plano.captions[1].text = "Agora é só renderizar"
$plano.captions[1].timeline_start_ms = 4000
$plano.captions[1].duration_ms = 4000
```

Use frases curtas de até 200 caracteres, sem HTML, com início e duração dentro do vídeo final. O renderizador atual usa texto branco, tamanho 48 pixels, centralizado horizontalmente e posicionado 200 pixels acima da borda inferior. A fonte é do sistema; no Windows, Arial é a primeira opção. As legendas ficam gravadas na imagem. O modo `dark` posiciona seus textos no centro da tela.

Cor, tamanho, fonte, contorno, fundo, posição e quebra automática de linha ainda dependem de alterações no renderizador. Campos extras de estilo no JSON não configuram essas propriedades. Transcrição automática e importação SRT também ficam fora deste fluxo atual.

Para remover as legendas, use `$plano.captions = @()`.

O ganho de cada corte aceita -60 a +12 dB. Zero preserva o volume, valores negativos reduzem e valores positivos aumentam. Confira distorção ao aumentar o ganho. Caso utilize trilha musical (`music_tracks`) com `ducking: true`, a fala atua como chave no `sidechaincompress` e a trilha é atenuada dinamicamente; com `ducking: false`, a atenuação é fixa em `-22 dB` via `amix` (CLI-05 resolvido em 1.7.0).

```powershell
$plano.audio_tracks[0].gain_db = 0
$plano.audio_tracks[1].gain_db = 0
```

## 7. Salvar, renderizar e verificar

Após qualquer ajuste, salve em UTF-8 sem BOM para compatibilidade com o leitor JSON:

```powershell
$utf8 = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText(
    $arquivoPlano,
    ($plano | ConvertTo-Json -Depth 10),
    $utf8
)
$resultado = node $cli studio render $arquivoPlano --dest $projeto --json
if ($LASTEXITCODE -ne 0) { throw "Falha ao renderizar o vídeo." }
$render = ($resultado -join "`n") | ConvertFrom-Json
$videoFinal = Join-Path $projeto $render.path
node $cli studio qa $videoFinal --plan $arquivoPlano
if ($LASTEXITCODE -ne 0) { throw "O vídeo falhou na verificação técnica." }
Start-Process -FilePath $videoFinal
```

O QA compara dimensões, fps e duração com o plano e verifica os streams. Assista ao resultado para avaliar sincronização das frases, legibilidade, enquadramento e volume. Detecção de quadros pretos e avaliação visual de sincronização exigem revisão adicional.

## Pedido pronto para o agente

> Use skill-media-producer e o guia de configuração inicial. Pergunte o arquivo de origem, formato vertical ou horizontal, dois trechos, frases e horários das legendas e ganho do áudio. Prepare packages/editplan.json com as opções disponíveis. Antes de renderizar, mostre os cortes e a duração final para aprovação. Depois execute render e qa com --plan e informe o caminho do MP4.

## 8. Esteira rápida de auto-corte de silêncios e legendas (`auto-clip`)

Se você possui um vídeo falado (ex.: podcast, aula ou gravação direta) e deseja cortar pausas e silêncios maiores que 0.8s:

```powershell
# Auto-corte com arquivo SRT de legendas, gerando plano em packages/ e MP4 em artifacts/:
node $cli studio auto-clip $origem --dest $projeto --captions (Join-Path $projeto "packages\legendas.srt")

# Ou apenas analisar silêncios e pausas mortas antes de renderizar:
node $cli studio detect-silence $origem
```

O comando expurga as pausas, transcreve o áudio caso um arquivo SRT ou provedor de transcrição esteja configurado, remapeia as legendas quando existentes para a linha de tempo pós-corte e valida o arquivo MP4 final em `artifacts/`.

Três caminhos de legendas no `auto-clip`:
1. `--captions <arquivo.srt>`: Determinístico, offline e testado (recomendado).
2. `--openai`: Requer a variável de ambiente `OPENAI_API_KEY` para transcrição via API remota da OpenAI.
3. `--local`: Utiliza `@xenova/transformers` + `Xenova/whisper-tiny`, declarada em `optionalDependencies`. Se o pacote opcional não estiver instalado, o comando falha com instrução acionável; use `--no-captions` para cortar sem legendas.

> **Templates:** o catálogo de nove presets está em [`caption-templates.md`](caption-templates.md). Use `--caption-template <id>` no `auto-clip`/`render` ou `captions[].template` no EditPlan; `--caption-style impact|word|full` continua como legado.

Caso adicione trilha de fundo (`--music`) com `ducking: true`, a atenuação é dinâmica via sidechain; sem ducking, fica fixa em `-22 dB`.
