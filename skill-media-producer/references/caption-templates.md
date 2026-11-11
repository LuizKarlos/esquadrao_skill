# Catálogo de Templates de Legenda

> **Status:** especificação de referência validada em um grid 3×3 (2026-11-11). O CLI **1.4.0** ainda expõe apenas os estilos `impact`, `word` e `full`. Os nove presets abaixo são o contrato do motor nativo de templates, planejado no backlog **CLI-12**. Não use `--caption-template` até a entrega; hoje ele não existe.

Este documento é a fonte canônica para fonte, cor, contorno, sombra, posição e animação das legendas. Ele descreve os nove estilos usados no grid de demonstração e serve de base para a implementação no `@esquadrao/cli`.

---

## 1. Princípios

1. **Sem fundo sólido:** nenhum template usa caixa, tarja ou retângulo colorido atrás do texto. A legibilidade vem de preenchimento, contorno e sombra.
2. **Duas linhas curtas:** o texto é dividido em `LEGENDA DO` / `SEU JEITO`; tamanho e quebra são calculados para caber em 90% da largura segura.
3. **Contraste alto:** preenchimento claro com contorno escuro, ou preenchimento escuro com contorno claro; contorno mínimo de 5 px na referência 640×360.
4. **Área segura:** margem mínima de 5% em cada borda. Nenhum texto encosta na borda da célula.
5. **Escala relativa:** todos os valores são proporcionais à largura do canvas. A referência é **640×360**; o fator é `k = largura / 640`.
6. **Sem áudio no grid:** o catálogo é visual; o grid de demonstração é renderizado com `-an`.
7. **Fontes licenciadas:** Anton, Poppins e Bebas Neue são OFL (Google Fonts); Liberation Sans e DejaVu Sans Mono são fontes de sistema. O CLI deve empacotar as OFL ou aplicar fallback documentado.

---

## 2. Escala e coordenadas

Referência de projeto: célula **640×360** (16:9). Para outro canvas, multiplique tamanhos por `k = largura / 640` e calcule `y` pela porcentagem da altura.

| Token | Referência 640×360 | Fórmula | Equivalente 1080×1920 |
| :--- | ---: | :--- | ---: |
| `font_size` base | 64 px | `64 * k` | 108 px |
| `stroke` base | 7 px | `7 * k` | 12 px |
| `shadow` base | 4 px | `4 * k` | 7 px |
| linha 1 (`y1`) | 100 px (27,8%) | `0.2778 * altura` | 533 px |
| linha 2 (`y2`) | 170 px (47,2%) | `0.4722 * altura` | 907 px |
| lower third (`y`) | 276 px (76,7%) | `0.7667 * altura` | 1472 px |

O motor deve arredondar para inteiro e garantir `stroke >= 2` e `font_size >= 12` em qualquer canvas.

---

## 3. Catálogo

| # | ID | Nome | Fonte | Preenchimento | Contorno | Sombra | Posição (640×360) | Uso |
| ---: | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `mrbeast-yellow` | MrBeast Yellow | Anton | `#FFE600` | `#000000` 7 px | 4 px, 4 px | 100 / 170 | Alto impacto, retenção |
| 2 | `tiktok-white` | TikTok White | Poppins Bold | `#FFFFFF` | `#000000` 8 px | 3 px, 3 px | 105 / 175 | Padrão social, legível |
| 3 | `gold-stroke` | Gold Stroke | Anton | `#FFF6D6` | `#FFC400` 5 px | 3 px, 3 px | 100 / 170 | Premium, luxo |
| 4 | `green-stroke` | Green Stroke | Bebas Neue | `#FFFFFF` | `#00E676` 6 px | 3 px, 3 px | 108 / 176 | Karaokê, energia |
| 5 | `neon-glitch` | Neon Glitch | Anton | `#FFFFFF` + offsets `#00E5FF` / `#FF00E5` | `#000000` 3 px no núcleo | halo 0 px, 70% | 100 / 170 | Gaming, tech |
| 6 | `minimal-lower-third` | Minimal Lower Third | Liberation Sans Bold | `#FFFFFF` | `#000000` 3 px | 2 px, 2 px | 276 (linha única) | Corporativo, clean |
| 7 | `red-stroke` | Red Stroke | Poppins Bold | `#FFFFFF` | `#E11D2E` 6 px | 3 px, 3 px | 105 / 175 | Alerta, ênfase |
| 8 | `heavy-white` | Heavy White | Poppins Bold | `#FFFFFF` | `#000000` 10 px | 4 px, 4 px | 105 / 178 | Máxima leitura |
| 9 | `mono-clean` | Mono Clean | DejaVu Sans Mono Bold | `#FFFFFF` | `#000000` 9 px | 4 px, 4 px | 112 / 178 | Técnico, typewriter |

> **Sem fundo:** nenhum dos nove usa `box=1` ou `drawbox` atrás do texto. A linha horizontal do template 6 e a do template 9 são elementos gráficos, não fundos.

---

## 4. Especificação por template

### 4.1. `mrbeast-yellow`

- **Fonte:** Anton Regular, 64 px (`k * 64`).
- **Texto:** `LEGENDA DO` / `SEU JEITO`, caixa alta, centralizado.
- **Preenchimento:** `#FFE600`.
- **Contorno:** `#000000`, 7 px.
- **Sombra:** `#000000` a 80%, deslocamento 4×4.
- **Animação:** fade-in de 400 ms (`alpha='if(lt(t,0.4),t/0.4,1)'`).

```bash
drawtext=fontfile='Anton-Regular.ttf':text='LEGENDA DO':fontsize=64:fontcolor=#FFE600:borderw=7:bordercolor=black:shadowx=4:shadowy=4:shadowcolor=black@0.8:x=(w-text_w)/2:y=100:alpha='if(lt(t,0.4),t/0.4,1)'
```

### 4.2. `tiktok-white`

- **Fonte:** Poppins Bold, 54 px.
- **Preenchimento:** `#FFFFFF`.
- **Contorno:** `#000000`, 8 px.
- **Sombra:** `#000000` a 70%, 3×3.
- **Uso:** estilo padrão de TikTok/Reels; máxima compatibilidade.

### 4.3. `gold-stroke`

- **Fonte:** Anton Regular, 64 px.
- **Preenchimento:** `#FFF6D6` (creme).
- **Contorno:** `#FFC400` (dourado), 5 px.
- **Sombra:** preta a 85%, 3×3.
- **Uso:** imobiliário, luxo, viagens.

### 4.4. `green-stroke`

- **Fonte:** Bebas Neue, 70 px.
- **Preenchimento:** `#FFFFFF`.
- **Contorno:** `#00E676`, 6 px.
- **Sombra:** preta a 85%, 3×3.
- **Uso:** karaokê, música, fitness.

### 4.5. `neon-glitch`

- **Fonte:** Anton Regular, 62 px.
- **Núcleo:** `#FFFFFF`, contorno preto 3 px.
- **Camada ciano:** `#00E5FF`, deslocada −4 px em X e +2 px em Y.
- **Camada magenta:** `#FF00E5`, deslocada +4 px em X e −2 px em Y.
- **Halo preto no núcleo:** sombra de 0 px a 70% para separar do fundo.
- **Uso:** gaming, tecnologia, edição.

### 4.6. `minimal-lower-third`

- **Fonte:** Liberation Sans Bold, 40 px.
- **Texto:** uma linha, `LEGENDA DO SEU JEITO`.
- **Preenchimento:** `#FFFFFF`.
- **Contorno:** `#000000` a 90%, 3 px.
- **Sombra:** preta a 90%, 2×2.
- **Elemento gráfico:** linha horizontal branca de 2 px, 500 px de largura, 24 px acima do texto.
- **Uso:** corporativo, documentário, notícias.

### 4.7. `red-stroke`

- **Fonte:** Poppins Bold, 54 px.
- **Preenchimento:** `#FFFFFF`.
- **Contorno:** `#E11D2E`, 6 px.
- **Sombra:** preta a 85%, 3×3.
- **Uso:** alerta, erro, urgência.

### 4.8. `heavy-white`

- **Fonte:** Poppins Bold, 60 px.
- **Preenchimento:** `#FFFFFF`.
- **Contorno:** `#000000`, 10 px.
- **Sombra:** preta a 90%, 4×4.
- **Uso:** máxima legibilidade; é o template corrigido da posição inferior central.

### 4.9. `mono-clean`

- **Fonte:** DejaVu Sans Mono Bold, 48 px.
- **Preenchimento:** `#FFFFFF`.
- **Contorno:** `#000000`, 9 px.
- **Sombra:** preta a 85%, 4×4.
- **Uso:** técnico, tutorial, terminal.

---

## 5. Contrato CLI planejado (CLI-12)

O motor nativo deve aceitar:

```bash
esquadrao studio auto-clip <video> --caption-template heavy-white
esquadrao studio render <plan.json> --caption-template mrbeast-yellow
esquadrao studio caption-templates --json
```

No `EditPlan`, o campo planejado é:

```json
{
  "captions": [
    {
      "text": "LEGENDA DO SEU JEITO",
      "timeline_start_ms": 0,
      "duration_ms": 3000,
      "template": "heavy-white"
    }
  ]
}
```

Regras de contrato:
- `template` é opcional; ausente usa `impact` (compatibilidade).
- `template` inválido falha com código 1 e lista os IDs disponíveis.
- `caption-templates --json` devolve `{ version, reference_canvas, templates: [...] }`.
- O renderizador não deve introduzir fundo sólido em nenhum template do catálogo.
- Fontes ausentes usam fallback explícito e registram aviso, nunca falham em silêncio.

**Estado:** não implementado no CLI 1.4.0. O CLI atual aceita apenas `--caption-style impact|word|full`.

---

## 6. Regras para agentes de IA

1. Não prometa `--caption-template` enquanto CLI-12 não estiver entregue.
2. Use `--caption-style impact` para o visual MrBeast/TikTok; `word` para palavra única; `full` para frase completa.
3. Se o usuário pedir um template deste catálogo, explique que ele é referência documentada e ofereça o estilo nativo mais próximo.
4. Nunca aplique `drawbox`/`box=1` atrás do texto ao recriar estes templates.
5. Preserve a área segura de 5% e o contorno mínimo.

---

## 7. Checklist de QA do catálogo

- [ ] Texto completo e sem corte em 640×360 e 1080×1920.
- [ ] Contraste >= 4.5:1 entre preenchimento e contorno/fundo imediato.
- [ ] Nenhum fundo sólido atrás das letras.
- [ ] Fonte e fallback resolvidos no ambiente.
- [ ] Fade-in de 400 ms sem flicker.
- [ ] Nenhuma faixa de áudio no grid de demonstração.
- [ ] Nove IDs únicos, nove estilos visualmente distintos.
