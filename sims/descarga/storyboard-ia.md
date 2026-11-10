# Teste 02: descarga em 3D realista (Higgsfield)

Mesma narração do teste 01 (`narracao.mp3`, 30,5 s). Legendas, etiquetas, som e montagem em código.
Referência de estrutura: frames limpos da simulação (`out/ref/ref-frames`, gerados com `{"clean": true, "camAt": 5.6}`).

## Economia de créditos

Quatro quadros-chave, reaproveitados como início e fim de vários clipes.
Um quadro final de um clipe é o quadro inicial do seguinte, então os cortes encaixam.

| Quadro | Conteúdo | Base |
|---|---|---|
| K0 | Vaso inteiro, porcelana opaca, caixa fechada, fundo escuro azul | gerado do zero |
| K1 | Caixa em corte transparente, cheia: boia alta, comporta fechada | ref-cheia |
| K2 | Caixa quase vazia: boia baixa, comporta aberta | ref-vazia |
| K3 | Caixa cheia até o topo do ladrão, água entrando no ladrão | ref-transbordo |

## Clipes (Seedance 2.0 Mini, 720p, sem áudio)

| Clipe | Narração | Início → fim | Duração | Créditos |
|---|---|---|---|---|
| A | 0–4,6 s: gancho + "olha só o que tem lá dentro" | K0 → K1 | 5 s | 5 |
| B | 4,7–8,8 s: botão, comporta abre, água desce | K1 → K2 | 5 s | 5 |
| C | 8,8–19,6 s: boia desce, entrada abre, enche, fecha | K2 → K1 | 10 s | 10 |
| D | 19,7–25,6 s: boia trava, nível sobe, ladrão | K1 → K3 | 6 s | 6 |
| Final | 25,7–30,5 s: "nunca transborda" + CTA | clipe A invertido em código | 0 | 0 |

Quadros: 4 × 2 = 8 créditos. Clipes: 26 créditos. **Total previsto: 34 créditos.**
Ajuste de duração entre clipe e narração: corte ou leve mudança de velocidade, em código.

## Regras dos prompts

- Ângulo, enquadramento e iluminação iguais nos quatro quadros (mesma câmera 3/4 da simulação).
- Só existem: caixa, válvula de entrada verde, boia laranja na haste, comporta vermelha no fundo, tubo ladrão amarelo, botão no topo.
- Nenhum texto, logo ou mão na imagem.
- Primeiros 0,2 s do clipe iguais ao quadro inicial; último 0,5 s parado, igual ao quadro final.
- Cor de cada clipe corrigida pelo quadro inicial (o Mini escurece no fim).
