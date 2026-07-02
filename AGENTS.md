# AGENTS.md

Guidelines for AI agents (and humans) contributing code to this repository.

## What this app is

Retro Arcade is a web + mobile (PWA) platform for playing small retro-style
mini games (Pong, Space Invaders, Whirlybird, Stack Tower, ...) directly in
the browser, and tracking leaderboards per game. Games run on an HTML5
`<canvas>` via the `kaplay` game engine; React + React Router provide the
shell (home grid, game page, layout, navigation) around the canvas. The app
installs as a PWA so it works well on mobile home screens.

## Project structure

```
src/
  main.tsx           # app entry point
  App.tsx            # router setup (routes: "/" home, "/games/:gameId" game page)
  index.css          # global styles
  components/
    Layout.tsx        # page shell/nav wrapper
    GameCanvas.tsx     # generic canvas host, wires a game's start() fn to a <canvas>
  pages/
    Home.tsx           # game grid + leaderboard entry points
    Game.tsx           # resolves :gameId, mounts the matching game via GameCanvas
  games/
    registry.ts        # GameMeta list (id, title, description) — single source of truth for games shown on Home
    <game-id>/
      index.ts          # exports start(canvas): cleanup — the kaplay game implementation
public/
  fonts/, images/       # static assets referenced with import.meta.env.BASE_URL
```

Each game lives in its own folder under `src/games/<game-id>/` and exposes a
`start(canvas: HTMLCanvasElement): () => void` function (setup + returned
cleanup/teardown). `GameCanvas` calls `start` in a `useEffect` and invokes the
returned cleanup on unmount. To add a new game: create `src/games/<id>/index.ts`
with a `start` function, and add an entry to `src/games/registry.ts`.

## Rules for AI-written code

- **No new dependencies.** Do not add, suggest, or install new npm packages.
  Build features with what's already in `package.json` (React, react-router-dom,
  kaplay) and the browser/DOM APIs. If a task truly seems to need a new
  library, stop and ask the user first instead of installing one.
- **No `useMemo` / `useCallback`.** Do not introduce memoization hooks. Write
  plain components; only `useState`, `useEffect`, and `useRef` are expected in
  this codebase (see `GameCanvas.tsx` for the established pattern). If
  something feels slow, that's a signal to raise it with the user rather than
  reach for memoization.
- **Keep it simple.** Match the existing minimal style: small functional
  components, no unnecessary abstractions, no speculative configuration
  options, no half-finished features.
- **TypeScript everywhere**, no `any` unless truly unavoidable. Reuse existing
  types (e.g. `GameMeta`) instead of redefining shapes.
- **Follow existing conventions**: `@/` path alias for imports from `src/`
  (see `tsconfig.app.json` / `vite.config.ts`), Prettier formatting (runs via
  lint-staged/husky pre-commit — don't fight it), and the existing file/folder
  naming patterns above.
- **Tests**: colocate as `*.test.ts(x)` next to the file under test (see
  `registry.test.ts`, `App.test.tsx`), run with `npm test` (Vitest).
- Before finishing a change, run `npm run typecheck` and `npm run lint`.
