# Notes for agents working on this repo

1. Read `PLAN.md` (decisions, architecture, roadmap, status) and `docs/KRILL_API.md` (store API) first.
2. App code is in `app/` (Vite + React + TypeScript; Capacitor for Android comes later).
   - `npm install` then `npm run dev` (browser) or `npm run build` (single-file `dist/index.html`).
   - `src/domain/` pure logic (types, price analysis) – no React here.
   - `src/data/` seed data from the real Krill order history (prototype only).
   - `src/state/store.tsx` reducer + localStorage persistence (sync adapter goes here later).
   - `src/stores/<store>/` store connectors (only `krill/` so far – keep store-specific code here).
   - `src/screens/` one file per tab; `src/ui/common.tsx` shared widgets; `src/i18n.ts` EN/PT/SV strings.
3. Conventions: plain readable TS, comments explain *why*; no minification of shipped code;
   every user-facing string goes through `i18n.ts` (add to `en` first – TS forces pt/sv).
4. Safety rule for store automation (Krill): the app may fill/edit the cart but must **never place an order
   without the user confirming**. Never commit Krill tokens or cookies.
5. Keep `PLAN.md` → "Status" updated at the end of each session.
