# Configuração inicial do Universal Skill Studio

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
$cli = "C:\caminho\universal-skill-cli\bin\cli.js"
node $cli studio --help
```

Alternativamente, após a publicação do pacote no npm, instale com `npm install -g @universal-skill/cli` e substitua `node $cli` por `universal-skill` nos comandos deste guia.

## 2. Criar o projeto e instalar as skills

Escolha uma pasta exclusiva para o vídeo. `setup` copia as skills e atualiza as integrações de agentes detectadas nessa pasta; use uma pasta nova para preservar configurações de outros projetos.

```powershell
$projeto = Join-Path $env:USERPROFILE "Videos\StudioUniversal\meu-primeiro-video"
New-Item -ItemType Directory -Force -Path $projeto | Out-Null
Set-Location $projeto
node $cli setup
if ($LASTEXITCODE -ne 0) { throw "Falha ao instalar as skills." }
node $cli studio init --dest $projeto
if ($LASTEXITCODE -ne 0) { throw "Falha ao inicializar o Studio." }
```

Abra o agente nessa pasta em uma nova sessão para carregar `skill-media-producer`. `assets/` guarda cópias das fontes, `packages/` guarda os planos, `artifacts/` recebe os MP4 e `studio.json` registra as importações e resultados.

Para experimentar o fluxo guiado com valores padrão, use `node $cli onboard`. Para controlar proporção, cortes e legendas explicitamente, siga os próximos passos.

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

O ganho de cada corte aceita -60 a +12 dB. Zero preserva o volume, valores negativos reduzem e valores positivos aumentam. Confira distorção ao aumentar o ganho.

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
