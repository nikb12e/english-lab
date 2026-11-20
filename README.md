# English Lab

English practice app for Slovenian students: all 196 irregular verbs, grammar drills, test style checks and spaced repetition that keeps bringing back what you got wrong.

This is the **open source, offline build** of [English Lab](https://english.xtrslab.com). It runs entirely in the browser: no accounts, no server, no API keys, no external services. Progress is saved in `localStorage`.

<p align="center">
  <img src="docs/home.png" width="280" alt="Home screen">
  &nbsp;&nbsp;
  <img src="docs/session.png" width="280" alt="Practice session">
</p>

## Features

* **196 irregular verbs** with Slovenian meanings, three forms and accepted variants
* **Placement test** that marks what you already know, so you never drill it again
* **FSRS 5 spaced repetition** with adaptive difficulty: tasks sit at the edge of what you know
* **Test mode** in the order of a real mock test, graded at the end
* **Quick games**: 60 second sprint, crossword, picture naming
* **Arena**: 8 fast questions against bots with realistic skill levels and timing
* **Grammar banks**: present tenses, articles, nouns, vocabulary for tests
* **Weak spot tracking**: mistakes come back as similar tasks until they stick
* Installable PWA, works offline after the first load

## What is different from the hosted version

| Hosted version | Open source build |
|---|---|
| Accounts (Google, email code) and cloud sync | No accounts, progress stays in this browser |
| AI grading of explanations and essays | Disabled, tasks use built in answer checking |
| AI generated fresh test items | Uses the bundled test bank |
| Natural voice recordings | Browser speech synthesis |
| Weekly league and live multiplayer Arena | Arena against bots only |

The server layer was replaced by a small local module (`src/lib/supabase.ts`) with the same interface, so the rest of the code is unchanged and easy to read.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static files in dist/
```

Deploy `dist/` to any static host (Cloudflare Pages, Netlify, GitHub Pages).

### Optional: verb recordings

Put MP3 files in `public/audio/v2/<verb>.mp3` and set `HAS_VERB_AUDIO = true` in `src/lib/speech.ts`.

## Stack

React 19, TypeScript, Vite, Framer Motion, Tailwind CSS, vite-plugin-pwa.

## License

MIT, see [LICENSE](LICENSE). Made by [Nik Bogataj](https://github.com/nikb12e) · [XTRSlab](https://xtrslab.com).
