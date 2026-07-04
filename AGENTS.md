# AGENTS.md

Guidelines for AI agents (and humans) contributing to this repository.

## What this app is

Retro Arcade: a web + mobile (PWA) platform for playing retro mini games
(Pong, Space Invaders, Whirlybird, Stack Tower, Whack Zogez, Flappy Zogez) in
the browser, with a Supabase-backed leaderboard per game. Games run on an
HTML5 `<canvas>` via the `kaplay` engine; React + React Router provide the
shell around it.

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
    utils.ts                # generic helpers with no other natural home (getErrorMessage, formatDateTime)
  hooks/
    useLeaderboard.ts       # scores fetch/submit for a gameId + stored username
  components/
    Layout.tsx              # page shell/nav wrapper
    GameCanvas.tsx          # canvas host, instantiates a game class on <canvas>
    TouchJoystick.tsx       # drag joystick for touch devices (GamePage renders it)
    LeaderboardModal.tsx    # score list + submit form (lazy-loaded)
    Icons.tsx               # shared inline-SVG icons (PlayIcon, TrophyIcon, CloseIcon, …)
  pages/
    Home.tsx                # game grid + leaderboard entry points
    Game.tsx                # resolves :gameId, lazy-loads game via import.meta.glob
  games/
    registry.ts             # GameMeta list — single source of truth for Home
    base.ts                 # BaseGame — lifecycle/score contract for all games; also exports clamp()
    <game-id>/index.ts      # the kaplay game, exports its <PascalCaseId>Game class
    <game-id>/banner.webp   # Home game-card art; picked up by import.meta.glob
public/
  fonts/, images/           # static assets, referenced with import.meta.env.BASE_URL
scripts/
  make_banners.sh           # converts src/games/*/*.png to */banner.webp (q80), deletes the PNG
  png-to-webp.sh            # same conversion for src/assets/*.png
  game_stats.sh             # prints each game's index.ts line count, longest first
```

## Games

Each game's `index.ts` exports a class extending `BaseGame`
(`src/games/base.ts`). The class name is derived from the game id —
`"space-invaders"` must export `SpaceInvadersGame` (see `gameExportName`
in `registry.ts`; `Game.tsx` resolves it by that name and
`registry.test.ts` enforces it):

```ts
import {
  BaseGame,
  GAME_WIDTH,
  GAME_HEIGHT,
  type GameOverHandler,
} from "@/games/base";

export class MyGame extends BaseGame {
  constructor(canvas: HTMLCanvasElement, onGameOver?: GameOverHandler) {
    super(canvas, onGameOver); // boots kaplay on the canvas
    // build the scene through this._k, bind inputs, start the first run
  }
  protected update() {} // per-frame logic; skipped once the run has ended
}
```

What `BaseGame` owns (don't redo any of this in games):

- **The engine** — `this._k` is the kaplay instance, with the themed
  background and canvas sizing/border already applied. The board defaults
  to the 16:9 `GAME_WIDTH`×`GAME_HEIGHT`; pass `{ width, height }` as the
  third `super()` argument for other aspect ratios (the square games use
  a `BOARD_SIZE`×`BOARD_SIZE` board — see `stacktower`). `destroy()`
  (called by `GameCanvas` on unmount) quits it; override only if you have
  extra cleanup.
- **The frame loop** — implement `update()`; the base wires it to
  `this._k.onUpdate` and stops calling it when `this.gameOver` is set.
- **Restart** — "r" is bound to `restart()`, which resets
  score/startTime/gameOver. Override it, call `super.restart()`, then
  rebuild your run state.
- **Input** — override the hooks you need: `moveUp/moveDown/moveLeft/
moveRight()` fire every frame while WASD/arrows are held or the touch
  joystick is tilted; `press()` fires on canvas tap/click or Space (shoot,
  cut, …). Never bind movement/action keys yourself. Declare what the game
  uses via `controls` (`{ joystick, press }` booleans) — on touch devices
  `GamePage` renders the `TouchJoystick` below the field when `joystick` is
  true; `press` needs no extra UI (the canvas itself is the button).
- **Score** — accumulate points in `this.score`; the default
  `calculateScore()` returns it. Override `calculateScore()` for other
  schemes (pong returns negated elapsed seconds so faster wins rank
  higher). Call `endGame()` when the run ends — it reports the final score
  to the page exactly once, and `GamePage` opens the leaderboard modal.

To add a game: create `src/games/<id>/index.ts` exporting the
`<PascalCaseId>Game` class, add an entry to `src/games/registry.ts`.
`Game.tsx` picks it up automatically via `import.meta.glob`.

## Leaderboard / Supabase

- Client: `getSupabase()` from `@/lib/supabase` — never create another client.
  Reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `.env`
  (gitignored, not in the repo — see `.env.example` for the required keys).
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
- **Reuse shared modules** instead of redeclaring: icons live in
  `src/components/Icons.tsx`, generic non-domain helpers in
  `src/lib/utils.ts`, and the games' `clamp()` in `src/games/base.ts`. Add
  to these when something is genuinely reusable — don't fork a new inline
  copy of an icon or a `Math.max(min, Math.min(max, v))` clamp.
- **Fonts:** the site font stack (`VT323` body / `Amused` headings, set
  globally in `index.css`) does not reach form controls — browsers give
  `button`/`input`/`select`/`textarea` their own UI font by default. Any
  rule for one of these elements (or a class applied to one, e.g.
  `.default-btn`, `.game-card-btn`) must set `font-family: inherit;`
  explicitly. Don't introduce a button or input that silently falls back
  to the system font.
- **Styling:** inline `const styles: { ... } = { ... }` of `CSSProperties`
  for simple cases — no hover/focus, animations, or media queries, under
  ~30 lines (see `GameCanvas.tsx`). Otherwise a colocated `.css` file (see
  `Layout.css`, `LeaderboardModal.css`). The palette and shared chrome live
  in `index.css` — use the `:root` vars (`--pink`, `--pink-rgb`, `--fg`, …)
  and the `.retro-panel` / `.default-btn` classes instead of hardcoding
  colors or re-declaring panel/button looks.
- **Named exports only** — no default exports in `src/` (they don't enforce
  a name at the import site; ESLint's `no-restricted-exports` errors on
  them). Root configs (`vite.config.ts`, `eslint.config.js`) are the only
  exemption because their tools require default exports.
- **No magic numbers** — every tunable value (sizes, speeds, angles,
  ratios, colors) is a named module constant, grouped and commented at the
  top of the file. In games, derive them from `GAME_WIDTH`/`GAME_HEIGHT` so
  one change rescales everything — see the constants block in
  `src/games/pong/index.ts`. Err on the side of too many constants.
- **Comments say why, not what** — a short line above a constant or block
  explaining intent or units (`// radians; hit at a paddle's very edge`),
  in the same style as pong and `base.ts`. No narrating obvious code.
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
