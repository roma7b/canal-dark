# Canal Dark

Vídeos curtos verticais (TikTok, Reels, Shorts) no formato "como funciona por dentro":
3D low poly, corte em raio-x, texto em português. Feitos com código (three.js) e
renderizados frame a frame em MP4 1080x1920.

Base: [claude-motion](https://github.com/whaleyxbt/claude-motion) (licença MIT, ver `LICENSE`
e `README-claude-motion.md`).

## Vídeos

| # | Tema | Arquivos | Saída |
|---|---|---|---|
| 01 | Por que a caixa da descarga nunca transborda? | `sims/descarga/`, `sfx/cues/descarga.py` | `videos/teste01-descarga.mp4` |

## Como gerar um vídeo

Requisitos: Node 20+, Python 3, ffmpeg, Chromium.

```bash
npm install
node sims/build.mjs descarga
python3 -m sfx sfx/cues/descarga.py
node sims/capture.mjs descarga --size 1080x1920 --dpr 1 --fps 30 --crf 18 --out out/sims/descarga-silent.mp4
ffmpeg -y -i out/sims/descarga-silent.mp4 -i out/sims/descarga.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -movflags +faststart -shortest videos/teste01-descarga.mp4
```

Frames de revisão (antes do render completo):

```bash
node sims/capture.mjs descarga --size 1080x1920 --dpr 1 --stills 0,8,17,27.5 --cols 4 --out out/sims/descarga-review.png
```

Se o Chromium não for encontrado, defina `CHROMIUM=/caminho/do/chrome`.

## Estrutura de um vídeo

- `sims/<nome>/timeline.json`: tempos de cada cena e as legendas.
- `sims/<nome>/main.js`: a cena 3D; `render(t)` desenha o frame do instante `t`.
- `sims/<nome>/style.css`: legendas, etiquetas, marca.
- `sfx/cues/<nome>.py`: efeitos sonoros, lidos do mesmo `timeline.json`.

## Identidade (provisória)

- Fundo azul-escuro, contornos ciano de raio-x, peças em cores chapadas
  (verde = entrada, laranja = boia, vermelho = comporta, amarelo = ladrão).
- Legenda grande no topo (fora da área da descrição dos apps), destaque em amarelo.
- Último frame igual ao primeiro, pra emendar em loop.
