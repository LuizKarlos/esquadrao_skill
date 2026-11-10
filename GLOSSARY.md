# Glossário Terminológico e Matriz Anti-Delírio — Esquadrão de Conteúdo CLI

> **Repositório:** `LuizKarlos/esquadrao_skill`  
> **Funil Integrado:** `LuizKarlos/esquadrao_funil`  
> **Documento Canônico:** Governa a nomenclatura, equivalências técnicas e limites conceituais do pacote `@universal-skill/cli`.  
> **Autoridade Vinculada:** [`SPEC.md`](./SPEC.md), [`ROADMAP.md`](./ROADMAP.md)

---

## 1. Glossário Terminológico Estrito

A tabela a seguir estabelece as equivalências obrigatórias entre os conceitos de mercado e a arquitetura técnica local:

| Termo Proibido / Enganoso | Denominação Canônica Obrigatória | Definição Operacional & Regra de Arquitetura |
| :--- | :--- | :--- |
| **Universal / Universal Skill / @universal-skill / universal-studio** | **Esquadrão de Conteúdo / @esquadrao / esquadrao** | **ERRO GRAVE DE BRANDING & REGRA INVIOLÁVEL:** Não deve ter a palavra 'universal' em nenhum lugar. Se estiver presente é erro grave. A ferramenta, os comandos e todo o ecossistema pertencem exclusivamente ao Esquadrão de Conteúdo. |
| **Assinatura / Mensalidade / Plano Recorrente** | **Pagamento único / Compra única** | O software é distribuído sem renovação automática, cobranças periódicas ou travas temporais. |
| **Taxímetro de créditos / Créditos por segundo** | **Renderização local ilimitada** | O processamento executa 100% no hardware do cliente via FFmpeg; o custo marginal por vídeo gerado é estritamente zero. |
| **Chave de ativação / Validação em nuvem / DRM** | **Uso livre / Sem restrição técnica** | Não existe proteção anticópia ou comunicação com servidores de validação. O cliente tem posse definitiva do executável. |
| **B-roll técnico / Mídia bruta** | **Packs de Vídeos e Imagens** | Identificadores técnicos preservam `media`, enquanto o vocabulário para o usuário refere-se a packs temáticos em alta definição e proporção vertical 9:16. |
| **Jargão de IA abstrato / LLMs / Redes Neurais** | **Esteira Automatizada de Corte** | A comunicação foca no resultado palpável: decupagem de trechos mortos, legendas sincronizadas e cortes prontos para redes sociais. |
| **Instalador binário fechado (.exe / .zip)** | **Instalação via registro oficial npm** | O pacote é distribuído globalmente pelo npm (`@universal-skill/cli`) e executável também via `npx`. |

---

## 2. Matriz de Dualidade: Engenharia vs. Venda e Realização

| Termo Técnico no Código | Linguagem de Realização para o Usuário | Arquitetura Técnica Subjacente |
| :--- | :--- | :--- |
| `@universal-skill/cli` | **Esquadrão de Conteúdo** | Pacote executável em Node.js com stdlib pura e comandos de terminal. |
| `universal-skill onboard` | **Primeiro Vídeo Guiado** | Agente interativo que conduz o usuário até o primeiro arquivo `.mp4` validado. |
| `esquadrao` / `universal-skill` | **Esquadrão CLI** | Comando de linha unificado para orquestração de papéis e estúdio de vídeo. |
| `esquadrao studio auto-clip` | **Esteira de Auto-Corte** | Pipeline completo: detecção de silêncio, transcrição Whisper, legendas e renderização. |
| `esquadrao studio find-hooks` | **Detector de Ganchos Virais** | Heurística determinística de copy para localizar os melhores inícios e finais de ideias (30-60s). |
| `esquadrao studio transcribe` | **Transcrição Estruturada** | Extração de áudio e transcrição Whisper com timestamps para análise de copy. |
| `B-Roll Overlay` | **Cena de Apoio Dinâmica** | Imagem ou vídeo sobreposto à fala em tela cheia (`fullscreen`), janela (`pip`) ou tela dividida (`split`). |
| `Audio Ducking` | **Atenuação Inteligente de Trilha** | Rebaixamento automático do volume da música de fundo para dar destaque à voz. |
| `Gancho de Retenção` | **Hook de Abertura (0-3s)** | Primeiro trecho selecionado pela copy para prender a atenção e maximizar a retenção. |
| `esquadrao studio detect-silence` | **Detector de Silêncios** | Análise por FFmpeg silencedetect para identificar pausas e duração de fala ativa. |
| `universal-skill studio` | **Estúdio Local de Produção** | Pipeline de decupagem, junção de fontes e aplicação de filtros de áudio/vídeo. |
| `EditPlan v1` | **Plano de Corte e Edição** | Esquema JSON determinístico com trilhas, cortes milimétricos e textos. |
| `mode: "dark"` | **Canais Dark / Vídeo Rápido** | Renderização sem necessidade de gravação prévia, usando fundos e tipografia. |
| `mode: "edit_only"` | **Decupagem Contígua** | Seleção e união rápida de trechos com transições suaves e ritmo acelerado. |
| `mode: "podcast_clip"` | **Cortes Verticais com Legendas** | Fatiamento de falas longas com queima gráfica de legendas dinâmicas. |
| `silenceremove` / `afftdn` | **Higienização Sonora Avançada** | Filtros de áudio aplicados para remover pausas mortas e ruídos de fundo. |
| `drawtext` | **Legendas Sincronizadas** | Renderização tipográfica direta no fluxo de vídeo com escape de caracteres. |
| `amix` com sidechain ducking | **Trilha Sonora Inteligente** | Rebaixamento automático do volume da música enquanto há fala ativa. |

---

## 3. Matriz Anti-Delírio (Perguntas e Respostas Arquiteturais)

| Pergunta Frequente | Resposta Determinística |
| :--- | :--- |
| **"O CLI força fundo preto ou proporção widescreen por padrão?"** | **NÃO.** Nem fundo escuro nem widescreen são padrões obrigatórios. O usuário escolhe livremente entre vertical 9:16 (mobile) e horizontal 16:9 (desktop), e define se usará gravações, packs de apoio ou fundo escuro. |
| **"O CLI envia vídeos para a nuvem para renderizar?"** | **NÃO.** Todo o pipeline de decupagem, mixagem e renderização executa estritamente na máquina local do cliente através do FFmpeg. |
| **"O CLI exige chave de API ou conexão de rede para funcionar?"** | **NÃO.** Os comandos de criação, edição, renderização e QA executam completamente offline uma vez que o pacote e o FFmpeg estejam instalados. |
| **"O CLI pode apagar arquivos de vídeo originais?"** | **NÃO.** O estúdio opera em modo estritamente não destrutivo. Os arquivos originais importados são mantidos intactos e os novos vídeos são salvos na pasta de renders. |
| **"O comando onboard exige parâmetros complexos?"** | **NÃO.** Executado sem parâmetros (`universal-skill onboard`), ele abre um assistente de terminal interativo com perguntas simples de múltipla escolha. |
| **"O CLI depende de dependências pesadas no package.json?"** | **NÃO.** A seção `dependencies` do `package.json` é vazia (`{}`). O CLI usa estritamente a biblioteca padrão do Node.js. |

---

## 4. Dicionário Fechado de Códigos de Saída (Exit Codes)

| Código | Nome do Estado | Causa e Comportamento |
| :--- | :--- | :--- |
| `0` | `SUCCESS` | Comando concluído com êxito e artefato/operação validada. |
| `1` | `PRECONDITION_FAILED` / `INVALID_ARGUMENT` | Ausência de FFmpeg/ffprobe no sistema, flag inválida ou plano com erro de contrato. |
| `130` | `SIGINT_ABORT` | Usuário interrompeu a renderização via Ctrl+C; arquivos temporários incompletos são expurgados. |

---

## 5. Mapeamento de Papéis Legados (Compatibilidade)

O subsistema de papéis técnicos normaliza designações históricas para a matriz oficial:
- `chief_architect` ➔ `software-architect`
- `spec_critic` ➔ `product-manager`
- `architecture_adjudicator` ➔ `tech-lead`
- `critical_acceptance` ➔ `qa-engineer`
- `documentation` ➔ `technical-writer`
- `next_mission_generator` ➔ `engineering-manager`

---

## 5. Registro de Erros Graves Detectados na Auditoria (Atlas MCP & Jev)

> **DECISÃO DESTEIRA:** A etapa de tutorial está **ENCERRADA E SUSPENSA** por encontro de erros graves de violação de marca.

Em auditoria conjunta realizada via **MegaBrain Atlas MCP** e classificador **Jev**, foram identificadas 149 ocorrências residuais do termo e identificador proibido **`universal`** neste repositório:
1. **Nome do Pacote npm:** `@universal-skill/cli` no `package.json` e documentações.
2. **Binários e Executáveis:** Menção aos binários legados `universal-skill` e `agent-skill`.
3. **Manifesto do Estúdio:** Criação padrão com `"name": "universal-studio"` em `studio.json`.
4. **Caminho de Perfil:** Persistência em `~/.universal-skill/profile.json`.
5. **Comandos nos Tutoriais:** Menção aos comandos `universal-skill setup` e `universal-skill onboard`.

Toda a esteira de gravação em Playwright e produção de tutoriais fica paralisada até a erradicação e sanitização de todos os resíduos.
