# Composições especiais: split permanente e recorte de pessoa

Status deste documento: **especificação de lacunas e proposta**. Nenhum dos dois formatos abaixo é um comando nativo do CLI 1.5.0. Eles foram validados como protótipos externos para decidir se entram no produto.

Legenda de status:

- **Entregue:** funciona no CLI atual, com teste.
- **Parcial:** o motor tem parte do caminho, mas o fluxo público não expõe ou não cobre o caso completo.
- **Previsto:** não existe no CLI; a implementação está descrita aqui como proposta.

## 1. Split permanente (orador no topo + pack na base)

### O que existe hoje

O `EditPlan v1` aceita `overlays[].layout` com quatro valores: `fullscreen`, `pip`, `split_bottom` e `split_top` (`src/roles/mediaProducer.js`).

O renderizador implementa:

- `fullscreen`: B-roll cobre a tela inteira.
- `pip`: B-roll em janela flutuante.
- `split_bottom`: orador no topo e B-roll na metade inferior.
- `split_top`: aceito no schema, mas renderizado como `fullscreen` (CLI-06).

Limites atuais:

1. `split_bottom` é um **overlay com janela de tempo** (`timeline_start_ms` + `duration_ms`). Ele foi desenhado para inserir B-roll por 2–4 s, não para manter o pack na base durante todo o clipe.
2. `auto-clip --broll` distribui os arquivos e grava `layout: "fullscreen"` fixo no plano (`src/commands/studio.js`). Não existe `--layout` nem `--broll-layout` no `auto-clip`.
3. O caminho de um split de duração total existe apenas montando um `EditPlan` manual com um overlay que cubra a linha do tempo inteira e chamando `studio render <editplan.json>`.
4. Não há teste dedicado a `split_bottom`; a matriz da SPEC o declara entregue, mas a cobertura é indireta.

### Protótipo validado (externo ao CLI)

O protótipo entregue para aprovação usou FFmpeg diretamente:

- Entrada: corte de podcast em 16:9, 60 s, áudio original.
- Topo: podcast escalado/cortado para 1080×960.
- Base: pack 9:16 escalado/cortado para 1080×960.
- Saída: 1080×1920, 30 fps, áudio do podcast, sem legendas.
- O pack foi escolhido pelo tema da fala; no exemplo, um pack de treino/superação para uma fala sobre lesão e recuperação.

Esse protótipo **não** foi produzido por `auto-clip`; ele demonstra o resultado visual que o CLI deve gerar quando o layout for exposto.

### Proposta CLI-13: split permanente no `auto-clip`

Objetivo: permitir o formato de duas metades em um único comando, sem editar JSON à mão.

Sintaxe proposta:

```bash
esquadrao studio auto-clip entrada.mp4 \
  --no-captions \
  --format 9:16 \
  --broll pack.mp4 \
  --layout split_bottom \
  --overlay-duration full
```

Alternativa mais simples, sem nova flag de duração:

```bash
esquadrao studio auto-clip entrada.mp4 --no-captions --split-broll pack.mp4
```

Regras:

- `split_bottom`: orador no topo, pack na base, 50/50 ou proporção configurável.
- `split_top`: somente depois de CLI-06; não prometer antes.
- O pack deve ser silenciado; o áudio do orador permanece intacto.
- Se o pack for mais curto que o clipe, repetir em loop; se for mais longo, cortar.
- O pack deve preencher a metade sem tarjas; usar `scale` + `crop` (não `pad`).
- O plano gerado deve ser inspecionável e reproduzível via `studio render`.

Critérios de aceite:

- [ ] `auto-clip --broll ... --layout split_bottom` gera 1080×1920 com duas metades iguais.
- [ ] O pack cobre a metade inferior durante todo o clipe, sem frame preto.
- [ ] Áudio original preservado; pack sem áudio.
- [ ] `--help` documenta a flag.
- [ ] Teste de render com fixture curto verifica resolução, duração e presença do overlay.
- [ ] `split_top` continua como lacuna CLI-06, sem fallback silencioso.

## 2. Recorte de pessoa com troca de fundo (cutout)

### O que existe hoje

**Nada no CLI.** Não há segmentação de pessoa, chroma key, remoção de fundo, máscara alfa ou composição de pack atrás do orador. Também não há dependência, comando, flag, teste ou documentação de produto para isso.

O protótipo entregue foi feito fora do CLI com:

- FFmpeg para decodificar/encodar e manter o áudio.
- OpenCV para ler/escrever frames e compor o pack.
- `rembg` com o modelo `u2net_human_seg` para gerar a máscara da pessoa.
- Um pack de vídeo em loop como fundo.

Pipeline do protótipo:

1. Cortar o trecho do podcast e manter o áudio original.
2. Decodificar em 15 fps (taxa escolhida por custo de CPU).
3. Para cada frame, gerar RGBA com `rembg` e `u2net_human_seg`.
4. Redimensionar/cortar a pessoa para a área desejada (ex.: 1080×1000, apoiada na base).
5. Compor sobre o pack 1080×1920; o pack é silenciado e repetido.
6. Encodar H.264/AAC com o áudio do podcast.

Cuidado de cor obrigatório: o `rembg` devolve **RGB**, enquanto o OpenCV trabalha em **BGR**. Converter `RGBA` para `BGRA` antes de compor. Sem isso, vermelho e azul trocam e a pele fica azul — foi o defeito corrigido no protótipo.

### Limitações do protótipo

- Custo: ~8 minutos de CPU para 60 s em 15 fps (1080×1920), sem GPU.
- Halo/contorno em cabelo, fone e ombros em alguns frames; não há matting temporal.
- Modelo de segmentação precisa ser baixado (~176 MB para `u2net_human_seg`); não deve ser empacotado no npm sem decisão de licença e tamanho.
- Sem consistência temporal: a máscara pode tremer entre frames.
- Sem tratamento de mãos/objetos finos (microfone, cabo) em todos os casos.
- O pack de fundo precisa ser escolhido por tema; isso é decisão editorial, não automática.

### Proposta CLI-14: `studio cutout`

Sintaxe proposta:

```bash
esquadrao studio cutout entrada.mp4 \
  --background pack.mp4 \
  --engine rembg \
  --fps 15 \
  --format 9:16 \
  --dest artifacts/
```

Regras:

- `--background` é obrigatório; o pack é silenciado e repetido/cortado para a duração.
- `--engine rembg` é o único motor inicial; a ausência de `rembg`/`onnxruntime`/OpenCV gera erro acionável, não falha silenciosa.
- Dependências em `optionalDependencies`; a instalação base continua sem elas.
- Cache de máscaras por hash do vídeo + fps + modelo para não reprocessar em re-render.
- Progresso no stderr e `--json` com contagem de frames, tempo e caminho do artefato.
- Conversão explícita RGB→BGR antes da composição; teste de cor com frame de pele/vermelho.
- QA via `studio qa`: resolução, fps, áudio e duração.

Critérios de aceite:

- [ ] 60 s em 15 fps conclui sem intervenção e gera 1080×1920.
- [ ] Pele e cores originais preservadas (sem troca R/B).
- [ ] Áudio original do podcast; pack silenciado.
- [ ] Sem `rembg` instalado: exit 1 com instrução de instalação.
- [ ] Teste com fixture de 2–3 s verifica máscara, cor e duração.
- [ ] Documentar custo de CPU e recomendar GPU/processamento em lote para volumes maiores.
- [ ] Não prometer “tempo real” nem “qualidade de estúdio”.

## 3. Regra de comunicação

Enquanto CLI-13/CLI-14 não estiverem entregues:

- Landing page, README, SKILL.md e respostas de agentes **não** devem dizer que o CLI faz split permanente ou recorte de pessoa.
- O máximo permitido: “split_bottom existe como overlay temporário de B-roll” e “recorte de pessoa é protótipo externo, previsto no backlog”.
- Ao citar um protótipo, dizer explicitamente que ele foi gerado fora do CLI.

## 4. Evidências e artefatos

- Split: `podpah-neymar-split-pack.mp4` (protótipo externo, 60 s, 1080×1920).
- Cutout: `podpah-neymar-cutout-pack.mp4` (protótipo externo, 60 s, 1080×1920, cor corrigida).
- O CLI 1.5.0 permanece com 87 testes e sem alteração de código por esta documentação.
