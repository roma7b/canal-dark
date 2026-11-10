# Fluxo de vídeo com IA generativa (Higgsfield / Seedance)

Checklist do canal para vídeos feitos com modelos de imagem e vídeo.
Adaptado do artigo de @EianLu (X, 05/11/2026) sobre Claude + Seedance.

## Regra principal: erro achado cedo custa menos

Texto não custa nada, imagem custa pouco (2 créditos), vídeo custa caro (10+ créditos por 10 s).
O que dá para corrigir no roteiro não vai para a imagem. O que dá para corrigir na imagem não vai para o vídeo.

## Ordem de trabalho

1. **Roteiro.** Uma frase resume a mensagem. O gancho abre o vídeo. Cada passo segue a lógica real do objeto.
2. **Storyboard.** Uma linha por cena: duração, enquadramento, posição da câmera, movimento, o que se mexe, como passa para a próxima.
3. **Estilo e paleta.** Definidos antes da primeira imagem, com uma tabela de cores por cena.
4. **Quadros inicial e final de cada cena.** Aprovados antes de gerar vídeo.
5. **Prompt de vídeo**, revisado contra os dois quadros.
6. **Geração.** Começar pela cena mais difícil.
7. **Montagem em código.** Legendas, etiquetas, narração, cor e ampliação.
8. **Revisão final** do arquivo, quadro a quadro.

## Storyboard

- Mudar o ângulo a cada cena. Visão frontal reta no máximo duas vezes no vídeo.
- Sempre algo em movimento no quadro: câmera, água, peça, luz.
- Movimento de câmera precisa de motivo: seguir um objeto, aproximar devagar ou afastar devagar.
- No máximo uma ou duas ações principais por cena.
- Cenas independentes (em blocos) são mais estáveis que uma história contínua.
- Qualquer quadro pausado deve ficar bonito. Ponto de interesse a cerca de 38% ou 62% da largura, não no centro.
- Conferir a paleta em preto e branco. Se o objeto some no fundo, falta contraste.

## O que a IA faz mal (evitar no roteiro)

- Texto dentro da imagem. Legendas e etiquetas entram depois, em código.
- Mãos segurando objetos pequenos, pessoas se cruzando, muitos personagens.
- Espelhos e reflexos.
- Três ações seguidas na mesma cena.
- Objetos que aparecem do nada. Tudo o que a cena usa já deve estar no quadro inicial.

## Quadros inicial e final

- Escrever o que cada quadro mostra e o que acontece entre eles antes de gerar.
- Gerar primeiro o quadro com mais conteúdo e criar o outro editando esse, para câmera e composição baterem.
- Para aproximação lenta, o quadro final pode ser um recorte ampliado do inicial.
- Os dois quadros precisam ter o mesmo tamanho e a proporção do vídeo (9:16).
- Conferir quantidades, posições (esquerda e direita), cores e tamanhos entre os dois quadros.
- Para o mecanismo sair certo, usar um frame da simulação em código (`sims/`) como referência de estrutura.

## Prompt de vídeo em sete partes

1. **Estilo:** uma frase.
2. **Cena:** duração, enquadramento, posição da câmera, movimento.
3. **Composição e cor:** onde está cada coisa e de que cor.
4. **Elementos:** aparência de cada peça, com detalhes fixos.
5. **Segundo a segundo:** nos primeiros 0,2 s o quadro fica igual ao inicial; depois, quem faz o quê; no último 0,5 s tudo para, igual ao quadro final.
6. **Som:** só o que deve existir. Sem fala.
7. **Restrições:** "no quadro só existem estes elementos", formas não mudam, uma tomada contínua.

Escrever no positivo ("só existe X") funciona melhor que "não faça Y". Quantidades vão por extenso.

## Geração

- Gerar em 720p e ampliar para 1080p na montagem.
- Seedance 2.0 Mini basta para cenas simples. O 2.5 custa várias vezes mais.
- O Mini tende a escurecer no fim do clipe. Corrigir a cor de cada clipe pelo próprio quadro inicial.
- Não gerar som com música embutida. Trilha e efeitos entram na montagem.

## Quando uma cena sai errada

1. Dá para cortar o trecho ruim?
2. Dá para corrigir em código (cor, velocidade, recorte)?
3. Só então gerar de novo, e mudando o prompt ou os quadros antes. Repetir igual tende a errar igual.

Guardar as tomadas antigas. Versão nova vira arquivo novo.

## Limites de quem monta (Claude)

- Não ouve o áudio nem vê movimento. Confere por quadros extraídos.
- Ritmo, som e naturalidade do movimento precisam da revisão do dono do canal.
- Nunca recarregar créditos nem ativar plano sem pedido explícito.
