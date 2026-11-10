# Canal Dark

Vídeos curtos verticais (TikTok, Reels, Shorts) no formato "como funciona por dentro":
3D low poly, corte em raio-x, texto em português. Feitos com código (three.js) e
renderizados frame a frame em MP4 1080x1920.

Base: [claude-motion](https://github.com/whaleyxbt/claude-motion) (licença MIT, ver `LICENSE`
e `README-claude-motion.md`).

## Vídeos

| # | Tema | Arquivos | Saída |
|---|---|---|---|
| 03 | Você Decide: O Túnel, ep. 1 (imagens Higgsfield animadas em código, ~13 créditos) | `sims/tunel/`, `sfx/cues/tunel.py` | `videos/tunel-ep1.mp4` |
| 02 | O homem que ganhou na loteria 14 vezes (estilo novo: personagem 2D em mundo 3D) | `sims/loteria/`, `sfx/cues/loteria.py` | `videos/loteria-final.mp4` |
| 01 | Por que a caixa da descarga nunca transborda? | `sims/descarga/`, `sfx/cues/descarga.py` | `videos/teste01-descarga-narrado.mp4` (com voz), `videos/teste01-descarga.mp4` (sem voz) |

## Como gerar um vídeo

Requisitos: Node 20+, Python 3, ffmpeg, Chromium.

```bash
npm install
node sims/build.mjs descarga
python3 -m sfx sfx/cues/descarga.py
node sims/capture.mjs descarga --size 1080x1920 --dpr 1 --fps 30 --crf 18 --out out/sims/descarga-silent.mp4
# voz (ElevenLabs) + efeitos abaixados quando a voz fala, masterizado em -14 LUFS
ffmpeg -y -i sims/descarga/narracao.mp3 -i out/sims/descarga-sfx.wav -filter_complex "[0:a]aresample=48000,pan=stereo|c0=c0|c1=c0,highpass=f=80,acompressor=threshold=-20dB:ratio=3:attack=5:release=80,asplit=2[v][sc];[1:a]volume=-9dB[s];[s][sc]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=300[sd];[v][sd]amix=inputs=2:normalize=0:duration=longest,apad=whole_dur=30.5,loudnorm=I=-14:TP=-1.5:LRA=11" -ar 48000 out/sims/descarga-mix.wav
ffmpeg -y -i out/sims/descarga-silent.mp4 -i out/sims/descarga-mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -movflags +faststart -shortest videos/teste01-descarga-narrado.mp4
```

Frames de revisão (antes do render completo):

```bash
node sims/capture.mjs descarga --size 1080x1920 --dpr 1 --stills 0,8,17,27.5 --cols 4 --out out/sims/descarga-review.png
```

Se o Chromium não for encontrado, defina `CHROMIUM=/caminho/do/chrome`.

## Fluxo com narração pela API (vídeo 02 em diante)

1. Roteiro em `sims/<nome>/narracao.md` (bloco ``` com uma frase por linha).
2. `python3 scripts/tts.py sims/<nome>`: gera `narracao.mp3` e o tempo de cada palavra (`narracao-words.json`).
3. `python3 scripts/voice_fit.py sims/<nome> --speed 1.12 --pause 8=0.8`: acelera sem mudar o tom e abre pausas.
4. As cenas e legendas leem `narracao-fit-words.json`, então mudar a voz re-cronometra o vídeo inteiro.

## Fluxo com narração

1. Escrever o roteiro em `sims/<nome>/narracao.md` (uma frase por linha).
2. Gerar a voz no ElevenLabs (um arquivo só) e salvar em `sims/<nome>/narracao.mp3`.
3. Achar onde cada frase começa: `ffmpeg -i sims/<nome>/narracao.mp3 -af silencedetect=noise=-38dB:d=0.25 -f null -`
4. Colocar esses tempos no `timeline.json` (cenas e legendas) e renderizar.

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
