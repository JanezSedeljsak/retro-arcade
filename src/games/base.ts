import kaplay, { type Key } from "kaplay";

export type GameOverHandler = (score: number) => void;

/** Which touch controls a game wants — GamePage renders them accordingly. */
export type GameControls = {
  /** Drag joystick below the field (touch devices) driving the move* hooks. */
  joystick: boolean;
  /** Tap/click on the canvas (or Space) firing press(). */
  press: boolean;
};

/** Per-game engine options, passed as the third super() argument. */
export type GameOptions = {
  /** Board size in world units; defaults to the 16:9 GAME_WIDTH×GAME_HEIGHT. */
  width?: number;
  height?: number;
};

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

// Joystick tilt below this fraction of full travel counts as centered.
const JOYSTICK_DEADZONE = 0.35;

// Board background: dark purple in the same family as the app theme
// (#1d1d40 / #14142c in index.css).
const BOARD_BACKGROUND: [number, number, number, number] = [0, 0, 0, 0];

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
  /** Touch controls this game uses; override in subclasses that need them. */
  readonly controls: GameControls = { joystick: false, press: false };
  /** The kaplay engine instance — build the scene through this. */
  protected _k: ReturnType<typeof kaplay>;
  /** Running point total; the default calculateScore() returns it. */
  protected score = 0;
  /** performance.now() ms when the current run started (monotonic). */
  protected startTime = performance.now();
  protected gameOver = false;
  protected canvas: HTMLCanvasElement;
  /** Board size in world units (the canvas keeps this aspect ratio). */
  protected readonly width: number;
  protected readonly height: number;
  private onGameOver?: GameOverHandler;
  /** Normalized joystick tilt (-1..1 per axis), fed by the TouchJoystick. */
  private joystickX = 0;
  private joystickY = 0;

  constructor(
    canvas: HTMLCanvasElement,
    onGameOver?: GameOverHandler,
    options?: GameOptions,
  ) {
    this.canvas = canvas;
    this.onGameOver = onGameOver;
    this.width = options?.width ?? GAME_WIDTH;
    this.height = options?.height ?? GAME_HEIGHT;
    this._k = kaplay({
      canvas,
      width: this.width,
      height: this.height,
      global: false,
      background: BOARD_BACKGROUND,
    });

    // kaplay overwrites canvas.style on init, so apply our sizing after.
    // width/height stay "auto" so the canvas keeps its intrinsic aspect
    // ratio (from the board size above) while maxWidth/maxHeight scale it.
    canvas.style.width = "auto";
    canvas.style.height = "auto";
    canvas.style.maxWidth = "100%";
    canvas.style.maxHeight = "100%";
    canvas.style.border = "min(0.6vmin, 4px) solid rgba(255, 120, 220, 0.6)";
    canvas.style.borderRadius = "min(1vmin, 8px)";

    this._k.onKeyPress("r", () => this.restart());

    // Keyboard and joystick drive the same move* hooks: WASD/arrows fire
    // them every frame while held, the joystick every frame while tilted.
    const bindHeldKeys = (keys: Key[], move: () => void) => {
      for (const key of keys) {
        this._k.onKeyDown(key, () => {
          if (!this.gameOver) move();
        });
      }
    };
    bindHeldKeys(["w", "up"], () => this.moveUp());
    bindHeldKeys(["s", "down"], () => this.moveDown());
    bindHeldKeys(["a", "left"], () => this.moveLeft());
    bindHeldKeys(["d", "right"], () => this.moveRight());

    // press() fires on canvas tap/click (kaplay maps touch to mouse) or Space.
    this._k.onKeyPress("space", () => {
      if (!this.gameOver) this.press();
    });
    this._k.onMousePress(() => {
      if (!this.gameOver) this.press();
    });

    this._k.onUpdate(() => {
      if (this.gameOver) return;
      if (this.joystickY < -JOYSTICK_DEADZONE) this.moveUp();
      if (this.joystickY > JOYSTICK_DEADZONE) this.moveDown();
      if (this.joystickX < -JOYSTICK_DEADZONE) this.moveLeft();
      if (this.joystickX > JOYSTICK_DEADZONE) this.moveRight();
      this.update();
    });
  }

  /** Per-frame game logic. Not called once the run has ended. */
  protected abstract update(): void;

  /** Direction hooks — called every frame the key/joystick is held. */
  protected moveUp(): void {}
  protected moveDown(): void {}
  protected moveLeft(): void {}
  protected moveRight(): void {}

  /** Tap/click/Space action (shoot, cut, …); no-op unless overridden. */
  protected press(): void {}

  /** Fed by the TouchJoystick with normalized tilt (-1..1 per axis). */
  setJoystickDirection(x: number, y: number): void {
    this.joystickX = x;
    this.joystickY = y;
  }

  /**
   * Reset for a fresh run. Subclasses override this, call super.restart(),
   * then rebuild their own run state (positions, serves, …).
   */
  restart(): void {
    this.score = 0;
    this.startTime = performance.now();
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
