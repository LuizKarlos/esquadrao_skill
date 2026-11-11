# Composições especiais: split permanente e recorte de pessoa

Status: **implementado no CLI 1.6.0**. O split permanente está operacional; o recorte de pessoa é experimental e depende de Python.

## 1. Split permanente (orador no topo + pack na base)

### Comando

```bash
esquadrao studio auto-clip entrada.mp4 \
  --no-captions \
  --broll pack.mp4 \
  --layout split_bottom \
  --overlay-duration full
```

Regras:

- `--layout` aceita `fullscreen`, `pip` e `split_bottom`. `split_top` continua pendente (CLI-06).
- `--overlay-duration inserts` (padrão) distribui B-rolls de 2–4 s; `full` usa o primeiro `--broll` durante toda a linha do tempo.
- O pack é silenciado e repetido em loop; se for mais longo que o clipe, é cortado.
- O áudio do orador é preservado; o pack não entra no mix.
- `split_bottom` preenche a metade inferior com `scale` + `crop` (sem tarjas).
- O plano gerado fica em `packages/autoclip-plan.json` e pode ser reproduzido com `studio render`.

Limites:

- Apenas o primeiro `--broll` é usado no modo `full`; os demais são ignorados com aviso.
- O pack não é escolhido automaticamente por tema; a seleção é editorial.
- `split_top` não está implementado.

Critérios de aceite:

- [x] `auto-clip --broll ... --layout split_bottom --overlay-duration full` gera 1080×1920 com duas metades.
- [x] O pack cobre a metade inferior durante todo o clipe, em loop.
- [x] Áudio original preservado; pack silenciado.
- [x] `--help` documenta `--layout` e `--overlay-duration`.
- [x] Teste de render em `tests/autoclip.test.js` verifica plano, loop e QA.
- [ ] `split_top` (CLI-06).

## 2. Recorte de pessoa com troca de fundo (cutout)

### Comando

```bash
esquadrao studio cutout entrada.mp4 \
  --background pack.mp4 \
  --python python3 \
  --fps 15
```

Pré-requisitos no interpretador Python escolhido:

```bash
python3 -m pip install "rembg[cpu]" onnxruntime opencv-python-headless numpy
```

Regras:

- Saída 1080×1920 (9:16) nesta versão; `--format 16:9` é rejeitado.
- `--fps` aceita 1–30; padrão 15.
- O pack é silenciado, repetido/cortado para a duração.
- Áudio original preservado; se a entrada não tiver áudio, o script adiciona uma faixa silenciosa para o QA.
- O motor é `rembg` com `u2net_human_seg`.
- A máscara do `u2net` é refinada com GrabCut e tem a borda suavizada; isso remove o halo escuro do fundo original.
- Conversão obrigatória RGB→BGR antes da composição. Sem isso, vermelho e azul trocam e a pele fica azul.
- O script fica em `scripts/cutout.py` e é chamado pelo comando Node.

Custo e limites:

- ~18–20 min de CPU para 60 s em 15 fps (1080×1920), sem GPU.
- Halo residual possível em cabelo/fone em frames difíceis; não há matting temporal.
- Sem cache de máscaras e sem aceleração GPU nesta versão.
- Modelo `u2net_human_seg` (~176 MB) é baixado pelo `rembg` na primeira execução; não é empacotado no npm.
- Sem segmentação de mãos/objetos finos garantida em todos os frames.
- O pack de fundo é escolha editorial, não automática.

Critérios de aceite:

- [x] `studio cutout --background` gera 1080×1920 com áudio e passa no QA.
- [x] Pele e cores originais preservadas (RGB→BGR).
- [x] Pack silenciado; áudio original do podcast.
- [x] Sem `rembg`: exit 1 com instrução de instalação.
- [x] Teste de contrato em `tests/cutout.test.js` cobre validação e help.
- [ ] Cache de máscaras.
- [ ] Aceleração GPU / processamento em lote.
- [ ] Matting temporal para eliminar halo em movimento.

## 3. Regra de comunicação

- Pode afirmar que o CLI 1.6.0 faz split permanente e cutout, **desde que** qualifique o cutout como experimental e informe as dependências Python e o custo de CPU.
- Não prometa tempo real, qualidade de estúdio ou ausência total de halo.
- `split_top` e ducking dinâmico continuam pendentes.

## 4. Evidências

- Split: `podpah-neymar-split-pack.mp4` (protótipo externo, 60 s, 1080×1920) e teste `split_bottom full loops a short b-roll`.
- Cutout: `podpah-neymar-cutout-pack.mp4` (protótipo externo, 60 s, 1080×1920, cor corrigida) e teste de contrato do comando.
- Suíte: 91 testes, lint em 38 arquivos.
