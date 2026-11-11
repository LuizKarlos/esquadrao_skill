# Prova de Corte de Podcast em 3 Níveis

> **Status:** procedimento validado em 2026-11-11 com o CLI 1.5.0. A skill **consegue** detectar pausas longas e respiros curtos, cortar, remapear legendas, renderizar e medir. A composição visual de comparação (três painéis + timelines) é feita **fora** da skill, com FFmpeg/Python.

Este documento descreve o teste que mostra, na prática, a diferença entre:

1. **Pausa longa:** silêncio de 1,2–1,5 s entre blocos de fala.
2. **Respiro curto:** pausa de 0,35–0,45 s entre frases.
3. **Controle:** o mesmo vídeo cortado em três níveis, sem refazer a gravação.

---

## 1. O que a skill faz e o que não faz

| Etapa | A skill faz? | Comando / observação |
| :--- | :--- | :--- |
| Detectar pausas e respiros | **Sim** | `esquadrao studio detect-silence <video> --silence-duration <s>` |
| Cortar pausas longas | **Sim** | `auto-clip` com `--silence-duration 0.8` (padrão) |
| Cortar respiros curtos | **Sim** | `auto-clip` com `--silence-duration 0.35` |
| Remapear legendas após o corte | **Sim** | `--captions <arquivo.srt>` |
| Renderizar e validar QA | **Sim** | `auto-clip` gera MP4 e roda `qa` |
| Reportar métricas | **Sim** | JSON com `silences_detected`, `silence_cut_s`, `speech_clips_count`, `captions_count`, `qa` |
| Montar o comparativo de 3 painéis | **Não** | Composição externa com FFmpeg (`xstack`/`hstack`) e timelines |
| Gerar timeline visual verde/vermelho | **Não** | Script Python/PIL ou SVG externo |

**Conclusão:** o corte e a medição são 100% da skill; a peça de marketing é uma composição posterior.

---

## 2. Fixture de validação

Para o teste ser determinístico, use uma gravação limpa, sem ruído de fundo:

- **8 frases** de 2–3 s cada.
- **4 pausas longas** de 1,5 s entre blocos.
- **3 respiros curtos** de 0,40 s entre frases.
- Áudio final com ~28 s.
- Legenda SRT com os tempos de cada frase.
- Vídeo vertical 1080×1920 com cena de apoio contínua (a cena não interfere no corte).

Padrão dos intervalos:

```text
frase 1 [1,5 s] frase 2 [0,4 s] frase 3 [1,5 s] frase 4
frase 4 [0,4 s] frase 5 [1,5 s] frase 6 [0,4 s] frase 7
frase 7 [1,5 s] frase 8
```

> **Dica:** se usar TTS, corte o silêncio residual do início e do fim de cada arquivo antes de concatenar. Caso contrário, o arredondamento do encoder pode transformar um respiro de 0,40 s em 0,80 s e ele será cortado já no nível padrão.

---

## 3. Passo a passo

### Passo 1 — Montar o bruto

1. Gere ou grave as 8 frases separadas.
2. Remova o silêncio residual de cada frase:

```bash
ffmpeg -i frase.mp3 \
  -af "silenceremove=start_periods=1:start_duration=0:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_duration=0:start_threshold=-45dB,areverse" \
  -c:a aac frase-limpa.m4a
```

3. Concatene na ordem do padrão acima, inserindo os intervalos de 1,5 s e 0,40 s.
4. Monte o vídeo vertical com a cena de apoio e o áudio concatenado.
5. Crie o `raw.srt` com os tempos de cada frase.

### Passo 2 — Verificar o que será detectado

Rode a detecção nos dois níveis antes de renderizar:

```bash
esquadrao studio detect-silence raw.mp4 --silence-duration 0.8 --json
esquadrao studio detect-silence raw.mp4 --silence-duration 0.35 --json
```

**Esperado no fixture de referência:**

| Nível | `--silence-duration` | Silêncios detectados | Clipes de fala |
| :--- | ---: | ---: | ---: |
| Padrão | `0.8` | 4 (apenas pausas longas) | 5 |
| Respiro | `0.35` | 7 (4 longas + 3 curtas) | 8 |

Se o nível de 0,35 detectar muito mais que 7, há ruído ou pausas naturais da locução sendo tratadas como respiro. Ajuste para `0.40` ou `0.45`.

### Passo 3 — Rodar os três níveis

O nível “original” é o próprio `raw.mp4`, sem corte. Os outros dois usam o mesmo arquivo e a mesma legenda:

```bash
# Padrão: remove pausas longas, preserva respiros
esquadrao studio auto-clip raw.mp4 \
  --captions raw.srt \
  --silence-duration 0.8 \
  --dest workspace-padrao --json

# Respiro: remove pausas longas e respiros curtos
esquadrao studio auto-clip raw.mp4 \
  --captions raw.srt \
  --silence-duration 0.35 \
  --dest workspace-respiro --json
```

Cada execução devolve um JSON com os campos usados na comparação:

```json
{
  "status": "ok",
  "silences_detected": 7,
  "silence_cut_s": 7.339,
  "speech_clips_count": 8,
  "captions_count": 17,
  "qa": { "passed": true, "duration_s": 21.1 }
}
```

### Passo 4 — Validar os números

Critérios de aceite:

- [ ] O nível padrão tem menos silêncios que o nível respiro.
- [ ] O nível respiro tem duração menor que o nível padrão.
- [ ] Os dois MP4s passam no QA (`qa.passed = true`).
- [ ] As legendas continuam sincronizadas e sem corte nas duas saídas.
- [ ] O nível respiro não remove fala: compare os `speech_clips_count` e ouça as junções.

### Passo 5 — Montar o comparativo (fora da skill)

A skill entrega três MP4s verticais. A peça de LP é montada depois:

1. Três painéis verticais de 360×640, centralizados em um canvas 1920×1080.
2. Rótulos: `Original`, `Corte padrão 0,8 s`, `Corte de respiro 0,35 s`.
3. Abaixo de cada painel, uma timeline:
   - verde = fala;
   - vermelho = trecho removido;
   - marcações nas pausas longas e nos respiros.
4. Métricas reais extraídas do JSON:
   - `8 pausas • 14,2 s removidos • 27% mais curto` (exemplo).
5. Sem áudio no comparativo; é uma peça visual em loop.

Composição de referência:

```bash
ffmpeg -i original.mp4 -i padrao.mp4 -i respiro.mp4 \
  -filter_complex "\
    [0:v]scale=360:640,setsar=1[a];\
    [1:v]scale=360:640,setsar=1[b];\
    [2:v]scale=360:640,setsar=1[c];\
    [a][b][c]hstack=inputs=3[out]" \
  -map "[out]" -an -c:v libx264 -pix_fmt yuv420p comparativo.mp4
```

> A timeline verde/vermelha não é gerada pelo `auto-clip`; use o JSON de `detect-silence` para desenhar os blocos.

---

## 4. Resultado da validação (2026-11-11)

Fixture de referência: 28,4 s de vídeo, 8 frases, 4 pausas de 1,5 s e 3 respiros de 0,40 s.

| Nível | `--silence-duration` | Silêncios | Clipes de fala | Duração final | QA |
| :--- | ---: | ---: | ---: | ---: | :--- |
| Original | — | — | 1 | 28,4 s | — |
| Padrão | `0.8` | 4 | 5 | 22,3 s | aprovado |
| Respiro | `0.35` | 7 | 8 | 21,1 s | aprovado |

**Leitura:** o nível padrão removeu 6,07 s (4 pausas longas); o nível respiro removeu 7,34 s (as 4 longas + 3 curtas). A diferença de 1,27 s é exatamente o conjunto de respiros, sem perda de fala.

---

## 5. Limites e recomendações

- **0,35 s é agressivo.** Use apenas em áudio limpo, sem ruído e com locução pausada. Para podcast com respiração audível ou ambiente, comece em `0.45` ou `0.5`.
- **Ruído de fundo impede o `silencedetect`.** Normalize ou aplique redução de ruído antes; caso contrário, o silêncio “real” pode não cruzar o limiar de `-30dB`.
- **TTS tem silêncio residual.** Sem o corte de bordas, o respiro de 0,40 s pode virar 0,8 s e ser removido no nível padrão.
- **O comparativo não é um comando da skill.** Se virar item de produto, entra como backlog próprio; hoje é composição externa.
- **Sempre ouça as junções.** Métrica verde não substitui a checagem auditiva de respiração cortada no meio da palavra.
