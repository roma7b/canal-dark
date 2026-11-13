# Guia: vídeos Vai Bem / @lucasmontemorr

Linha de vídeos curtos informativos para a agência **Vai Bem Viagens** (@vaibemviagens),
postados no Instagram do **@lucasmontemorr** (collab opcional com @vaibemviagens).
Quem aprova o conteúdo é a **Brena** (Vai Bem). Primeiro vídeo: `sims/portugal/` → `videos/vaibem-portugal.mp4`.

## Público e tom

- Brasileiros que querem viajar ou morar fora. Tom de amiga que explica, direto, sem prometer nada.
- Foco no que a agência faz: **vistos, documentação, viagem**. A Brena pediu para tirar assuntos fora do escopo
  (ex.: saída fiscal na Receita, IOF), porque a agência não oferece esses serviços.
- Nunca prometer visto, prazo ou resultado. Sempre fechar com "as regras mudam rápido, confira no site do consulado".

## Regra número 1: só informação verdadeira

- Pesquisar cada afirmação em fonte oficial (consulado, gov.pt, AIMA, Portal Diplomático, VFS Global, Receita, Planalto)
  ou jornalismo sério antes de escrever. Vídeos virais de referência costumam ter erros (ex.: "visto CPLP" de 819 € sem contrato não existe).
- Valores e taxas só entram se confirmados e atuais; na dúvida, ficam de fora.
- Usar os nomes oficiais (ex.: "visto de procura de trabalho", não "visto pra procurar emprego").
- Deixar claro quando a lista é parcial ("essas são só algumas das modalidades", "esse é só um dos documentos exigidos").
- Fontes vão no fim do `narracao.md` de cada vídeo, com a data da consulta.

## Roteiro

- 70 a 90 s, uma frase por linha no bloco ``` do `sims/<nome>/narracao.md`.
- Estrutura: gancho que derruba um mito → o que mudou (com data) → o caminho certo, passo a passo → aviso de que há outros casos → "confira no consulado" → CTA "salva e comenta: <pergunta>".
- Frases curtas e faladas. Cada frase vira uma ou duas cenas.

## Estilo visual (motion graphics 2D em canvas, sem custo de créditos)

- Código: `sims/portugal/main.js` é o modelo. Copiar a pasta para um tema novo e trocar as cenas.
- **Cenas rápidas**: um corte a cada 2-3 s, com flash branco e leve zoom de entrada. A lista de cenas fica em
  `timeline.json` como `[id, linha, palavra-que-dispara]`; tudo sincroniza pela narração.
- Cada elemento entra na palavra que o nomeia (carimbos "ACABOU", "APROVADO", X vermelho, checks verdes).
- Paleta da marca: azul `#2b40d3`, vermelho `#e8193f`, lilás `#e2e4f1`, azul-marinho `#0e1030`, creme `#fff6ea`.
  Fonte Inter Black. Personagem 2D `traveler` (de `sims/loteria/char.js`).
- Título fixo no topo ("como morar em portugal / do jeito certo") e selo "regras de <mês>/<ano>".
- Legenda grande de 1-2 palavras, com palavras-chave em vermelho (lista `accent` no `timeline.json`).
- Final: logo Vai Bem, pergunta do CTA, "salva e comenta", @lucasmontemorr.
- Logo atual: `sims/portugal/logo-vaibem-branco.png` (recorte do rodapé das cotações, baixa resolução — pedir PNG/SVG em alta).

## Dois formatos de saída

- **Tela cheia** 1080x1920: `--size 1080x1920`.
- **Metade de cima** 1080x960 (o Lucas aparece gravado embaixo): `--config half.json` com `{"half": true}` e `--size 1080x960`.
  Esconde o selo, título vira faixa fina, cenas reenquadradas.

## Voz (ElevenLabs, chave já salva no ambiente canal-dark)

- Voz **Jenifer** `GOkMqfyKMLVUcYfO2WbB` (feminina, natural, interior de SP). Testadas e recusadas: Leonardo (muito "história"), Roberta (estranha às vezes).
- Gerar **inteira de uma vez** (gerar frase por frase ficou picotado):
  `ELEVEN_MODE=full ELEVEN_VOICE=GOkMqfyKMLVUcYfO2WbB ELEVEN_STABILITY=0.6 ELEVEN_STYLE=0.1 ELEVEN_SPEED=1.0 python3 scripts/tts.py sims/<nome>`
- Depois acelerar sem mudar o tom: `python3 scripts/voice_fit.py sims/<nome> --speed 1.12`
- Se o final soar robótico, gerar em 3 blocos maiores (não frase por frase).
- Cada geração completa gasta ~1.200 caracteres (plano Starter: 30.881/mês).

## Passo a passo de um vídeo

1. Pesquisar e escrever o roteiro com fontes → mostrar ao usuário e esperar aprovação.
2. Gerar a voz (comando acima) e ajustar `duration` no `timeline.json` (= fim da última palavra + 1,6 s).
3. Montar as cenas, `node sims/build.mjs <nome>`, revisar quadros com `--stills` antes do render completo.
4. Som: `sfx/cues/<nome>.py` (copiar de `sfx/cues/portugal.py`), mixar com a voz (comando no README) e renderizar.
5. Entregar o MP4 (e a versão metade, se pedirem) + legenda em `posts/<nome>-post.md`.
6. Ajustes da Brena chegam como áudio transcrito: aplicar e reenviar.

## Legenda de post (modelo)

Ver `posts/vaibem-portugal-post.md`: gancho, 3 linhas com ✈️ ❌ ✅, aviso de que há outras modalidades,
"Regras de <mês>/<ano>... confira no site do consulado", CTA, hashtags (#vaibemviagens #lucasmontemorr).

## Ideias de próximos temas

- Visto de estudante em Portugal (D4): o que muda entre curso profissionalizante, técnico e graduação.
- Nômade digital (D8): quem pode e o que comprovar.
- Documentos para viajar com criança sozinha ou com um dos pais.
- Visto americano: mitos da entrevista. Canadá: eTA x visto.
- Passaporte brasileiro: prazos, urgência, o que levar.
