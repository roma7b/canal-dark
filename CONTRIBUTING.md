# Contributing

## Add your video to the gallery

Made something with this repo? Add it.

1. Put your composition in `src/` (its own folder is fine) and register it in `src/Root.tsx`.
2. Create `examples/NN-short-name/README.md` using [`examples/01-effort`](examples/01-effort/) as the template: preview GIF, the exact prompt(s) you gave, how long it took, model and effort level.
3. Add a row to the Gallery table in the main README.
4. Open a PR. Prefer to just show it off? Open a [Showcase issue](../../issues/new?template=showcase.yml).

Keep GIFs under ~4 MB (`npm run gif` settings are a good start).

## Improve the rules

The skills in `.claude/skills/` are the heart of this repo. If you found a rule that made Claude's output noticeably better, open a PR with:

- the rule, with a number wherever possible (not "smoother", but which curve or duration),
- a before/after contact sheet from `npm run sheet`.
