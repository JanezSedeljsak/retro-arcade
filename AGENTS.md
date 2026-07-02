# AGENTS.md

Guidelines for AI agents (and humans) contributing to this repository.

## What this app is

Retro Arcade: a web + mobile (PWA) platform for playing retro mini games
(Pong, Space Invaders, Whirlybird, Stack Tower) in the browser, with a
Supabase-backed leaderboard per game. Games run on an HTML5 `<canvas>` via
the `kaplay` engine; React + React Router provide the shell around it.

## Commands

- `npm run dev` — dev server (`vite --host`)
- `npm test` — Vitest (`test:watch` for watch mode)
- `npm run typecheck` / `npm run lint` — run both before finishing a change

## Project structure

```
src/
  main.tsx                  # app entry point
  App.tsx                   # routes: "/" Home, "/games/:gameId" GamePage
  index.css                 # global styles
  assets/                   # bundled images, imported via @/assets/...
  lib/
    supabase.ts             # getSupabase() — lazy singleton Supabase client
  hooks/
    useLeaderboard.ts       # scores fetch/submit for a gameId + stored username
  components/
    Layout.tsx              # page shell/nav wrapper
    GameCanvas.tsx          # canvas host, wires a game's start() to <canvas>
    LeaderboardModal.tsx    # score list + submit form (lazy-loaded)
  pages/
    Home.tsx                # game grid + leaderboard entry points
    Game.tsx                # resolves :gameId, lazy-loads game via import.meta.glob
  games/
    registry.ts             # GameMeta list — single source of truth for Home
    <game-id>/index.ts      # the kaplay game, exports start()
public/
  fonts/, images/           # static assets, referenced with import.meta.env.BASE_URL
```

## Games

Each game exports:

```ts
start(canvas: HTMLCanvasElement, onGameOver?: (score: number) => void): () => void
```

`start` sets up the game and returns a cleanup/teardown function.
`GameCanvas` calls it in an effect and runs the cleanup on unmount. Call
`onGameOver(finalScore)` when the run ends — `GamePage` uses it to open the
leaderboard modal with a submit form. See `src/games/pong/index.ts` for the
reference implementation (canvas sizing quirks, sprites, mobile controls).

To add a game: create `src/games/<id>/index.ts` exporting `start`, add an
entry to `src/games/registry.ts`. `Game.tsx` picks it up automatically via
`import.meta.glob`.

## Leaderboard / Supabase

- Client: `getSupabase()` from `@/lib/supabase` — never create another client.
  Reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `.env`
  (gitignored, not in the repo).
- Data: one `scores` table — `id, game_id, username, score, created_at`.
  `useLeaderboard(gameId)` fetches top 30 by score and handles submits;
  the username persists in localStorage (`retro-arcade:username`).
- UI: `LeaderboardModal` — opened from Home (view only) and from GamePage
  after game over (with score submit). Always lazy-load it
  (`lazy(() => import(...))`) so Supabase stays out of the initial bundle.

## Rules for AI-written code

- **No new dependencies.** Build with what's in `package.json` (React,
  react-router-dom, kaplay, @supabase/supabase-js) and browser/DOM APIs. If a
  task truly needs a new library, stop and ask the user first.
- **No `useMemo` / `useCallback`.** Stick to `useState`, `useEffect`,
  `useRef` (see `GameCanvas.tsx`). Sole existing exception: the lazy game
  loading in `Game.tsx` — don't spread that pattern. If something feels
  slow, raise it with the user instead of memoizing.
- **Keep it simple.** Small functional components, no speculative
  abstractions or configuration, no half-finished features.
- **Styling:** inline `const styles: { ... } = { ... }` of `CSSProperties`
  for simple cases — no hover/focus, animations, or media queries, under
  ~30 lines (see `GameCanvas.tsx`). Otherwise a colocated `.css` file (see
  `Layout.css`, `LeaderboardModal.css`).
- **TypeScript everywhere**, no `any` unless truly unavoidable. Reuse
  existing types (`GameMeta`, the `Score` shape in `useLeaderboard.ts`)
  instead of redefining them.
- **Imports: always the `@/` alias** (maps to `src/`), never `./` or `../`.
  Two exceptions that stay relative: colocated CSS (`import "./Layout.css"`)
  and `import.meta.glob(...)` patterns (`Game.tsx`, `registry.test.ts`).
- **Tests:** colocate as `*.test.ts(x)` next to the file under test.
- **Formatting:** Prettier runs via lint-staged/husky pre-commit — don't
  fight it.

## Searching the codebase

`node_modules` is gitignored — never search or glob through it. Scope
searches to `src/`, `public/`, and root config files (`rg` respects
`.gitignore` by default).
