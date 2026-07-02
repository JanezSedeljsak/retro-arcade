import kaplay from "kaplay";

export type GameOverHandler = (score: number) => void;

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

// Board background: dark purple in the same family as the app theme
// (#1d1d40 / #14142c in index.css).
const BOARD_BACKGROUND: [number, number, number] = [42, 42, 74];

/**
 * Base class for all games (src/games/<id>/index.ts default-exports a
 * subclass). The base owns the kaplay engine: it creates `this._k` on the
 * given canvas, applies the shared canvas sizing/border, binds "r" to
 * restart(), and calls update() every frame until the run ends.
 *
 * Lifecycle, driven by GameCanvas:
 *
 *   1. `new Game(canvas, onGameOver)` — super() boots kaplay, then the
 *      subclass constructor builds the scene and starts the first run.
 *   2. `update()` — per-frame game logic (movement, collisions, scoring).
 *   3. `restart()` — reset for a fresh run.
 *   4. `destroy()` — tear down the engine; called when the page unmounts.
 *
 * During a run, accumulate points in `this.score` — or override
 * `calculateScore()` for other schemes (e.g. pong scores by time-to-win).
 * Call `endGame()` when the run finishes.
 */
export abstract class BaseGame {
  /** The kaplay engine instance — build the scene through this. */
  protected _k: ReturnType<typeof kaplay>;
  /** Running point total; the default calculateScore() returns it. */
  protected score = 0;
  /** Epoch ms when the current run started. */
  protected startTime = Date.now();
  protected gameOver = false;
  protected canvas: HTMLCanvasElement;
  private onGameOver?: GameOverHandler;

  constructor(canvas: HTMLCanvasElement, onGameOver?: GameOverHandler) {
    this.canvas = canvas;
    this.onGameOver = onGameOver;
    this._k = kaplay({
      canvas,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      global: false,
      background: BOARD_BACKGROUND,
    });

    // kaplay overwrites canvas.style on init, so apply our sizing after.
    // width/height stay "auto" so the canvas keeps its intrinsic 16:9 ratio
    // (from the width/height above) while maxWidth/maxHeight scale it down.
    canvas.style.width = "auto";
    canvas.style.height = "auto";
    canvas.style.maxWidth = "100%";
    canvas.style.maxHeight = "100%";
    canvas.style.border = "min(0.6vmin, 4px) solid rgba(255, 120, 220, 0.6)";
    canvas.style.borderRadius = "min(1vmin, 8px)";

    this._k.onKeyPress("r", () => this.restart());
    this._k.onUpdate(() => {
      if (this.gameOver) return;
      this.update();
    });
  }

  /** Per-frame game logic. Not called once the run has ended. */
  protected abstract update(): void;

  /**
   * Reset for a fresh run. Subclasses override this, call super.restart(),
   * then rebuild their own run state (positions, serves, …).
   */
  restart(): void {
    this.score = 0;
    this.startTime = Date.now();
    this.gameOver = false;
  }

  /** Tear down the engine. Called on unmount; override for extra cleanup. */
  destroy(): void {
    this._k.quit();
  }

  /** Final score of the current run. Defaults to the accumulated score. */
  calculateScore(): number {
    return this.score;
  }

  /** End the current run and report the final score to the host page once. */
  protected endGame(): void {
    if (this.gameOver) return;
    this.gameOver = true;
    this.onGameOver?.(this.calculateScore());
  }
}

export type GameConstructor = new (
  canvas: HTMLCanvasElement,
  onGameOver?: GameOverHandler,
) => BaseGame;
