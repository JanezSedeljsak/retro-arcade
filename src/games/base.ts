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
  /** kaplay caches font atlases module-wide by font name, and an atlas
      created before a quit() belongs to that dead WebGL context — reusing
      its name after re-init draws text as black boxes. A unique name per
      engine instance always gets a fresh atlas. */
  private static fontInstance = 0;
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
  private portraitQuery = window.matchMedia("(orientation: portrait)");

  /** Board fills the screen while keeping its aspect ratio: full width in
      portrait, full height in landscape — the remaining max-* cap lets the
      browser re-resolve the other axis when the preferred one won't fit. */
  private applyCanvasSizing = () => {
    if (this.portraitQuery.matches) {
      this.canvas.style.width = "100%";
      this.canvas.style.height = "auto";
      this.canvas.style.maxWidth = "";
      this.canvas.style.maxHeight = "100%";
    } else {
      this.canvas.style.width = "auto";
      this.canvas.style.height = "100%";
      this.canvas.style.maxWidth = "100%";
      this.canvas.style.maxHeight = "";
    }
  };

  constructor(
    canvas: HTMLCanvasElement,
    onGameOver?: GameOverHandler,
    options?: GameOptions,
  ) {
    this.canvas = canvas;
    this.onGameOver = onGameOver;
    this.width = options?.width ?? GAME_WIDTH;
    this.height = options?.height ?? GAME_HEIGHT;
    const fontName = `vt323-${BaseGame.fontInstance++}`;
    this._k = kaplay({
      canvas,
      width: this.width,
      height: this.height,
      global: false,
      background: BOARD_BACKGROUND,
      font: fontName,
    });
    // The app font, served from public/ — matches the rest of the UI.
    this._k.loadFont(fontName, `${import.meta.env.BASE_URL}fonts/vt323.ttf`);

    // kaplay overwrites canvas.style on init, so apply our sizing after —
    // and again whenever the device flips between portrait and landscape.
    this.applyCanvasSizing();
    this.portraitQuery.addEventListener("change", this.applyCanvasSizing);
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
    this.portraitQuery.removeEventListener("change", this.applyCanvasSizing);
    this._k.quit();
  }

  /**
   * Return keyboard focus to the canvas. kaplay binds its key listeners to
   * the canvas (not window), so it must hold DOM focus to receive them —
   * an autofocused input elsewhere (e.g. the leaderboard modal) steals it.
   */
  focus(): void {
    this.canvas.focus();
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
