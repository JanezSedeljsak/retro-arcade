import type {
  AnchorComp,
  AreaComp,
  ColorComp,
  GameObj,
  OpacityComp,
  PosComp,
  ScaleComp,
  SpriteComp,
  TextComp,
  TimerController,
} from "kaplay";
import zogezSprite from "@/assets/character.webp";
import {
  BaseGame,
  type GameControls,
  type GameOverHandler,
} from "@/games/base";

// Square board so the hole grid reads the same on phones and desktops.
const BOARD_SIZE = 720;
const ROUND_SECONDS = 60;

const COLS = 3;
const ROWS = 3;
const GRID_LEFT = BOARD_SIZE * 0.18;
const GRID_RIGHT = BOARD_SIZE * 0.82;
const GRID_TOP = BOARD_SIZE * 0.34;
const GRID_BOTTOM = BOARD_SIZE * 0.92;

const MOUND_RADIUS = BOARD_SIZE * 0.09;
const HOLE_RADIUS = BOARD_SIZE * 0.065;
// Mound/hole are drawn as flattened circles so they read as ellipses.
const HOLE_SQUASH = 0.45;

const MOUND_COLOR = [120, 74, 34] as const;
const HOLE_COLOR = [15, 10, 8] as const;
const HUD_COLOR = [241, 234, 255] as const;
const HUD_TEXT_SIZE = BOARD_SIZE * 0.045;

// character.webp is a 225px-wide sprite of a circular character (same asset
// Pong scales for its ball) — sized here a bit larger than the hole so Zogez
// visibly peeks out over the mound.
const ZOGEZ_DIAMETER = HOLE_RADIUS * 2.4;
const ZOGEZ_SCALE = ZOGEZ_DIAMETER / 225;
// How far above/below the hole's center Zogez rises to/from while popping.
const RISE_DISTANCE = HOLE_RADIUS * 0.9;
const PEEK_OFFSET = HOLE_RADIUS * 0.35;
// The clickable area is a separate, generously oversized invisible box —
// deliberately bigger than the sprite and NOT tied to its pop-in/out scale
// tween, so taps register reliably the instant Zogez starts rising instead
// of only once he's fully grown. Taller than wide since he rises/sinks
// vertically, so fingers landing slightly above or below him still connect.
const HITBOX_HALF_WIDTH = HOLE_RADIUS * 1.8;
const HITBOX_HALF_HEIGHT = HOLE_RADIUS * 2.4;

const POP_UP_DURATION = 0.16;
const RETRACT_DURATION = 0.14;

// How long a popped-up Zogez stays before retracting unhit, in ms — shrinks
// over the round so the game gets harder as time runs low.
const VISIBLE_MS_START: [number, number] = [900, 1500];
const VISIBLE_MS_END: [number, number] = [500, 850];
// Pause between a hole resolving (hit or missed) and the next pop.
const GAP_MS: [number, number] = [150, 400];

type Hole = GameObj<PosComp>;
type Zogez = GameObj<SpriteComp | PosComp | AnchorComp | ScaleComp>;
type Hitbox = GameObj<PosComp | AreaComp>;
type Hud = GameObj<TextComp | PosComp | AnchorComp | ColorComp | OpacityComp>;

export class WhackZogezGame extends BaseGame {
  readonly controls: GameControls = { joystick: false, press: true };
  private holes: Hole[] = [];
  private zogez: Zogez;
  private hitbox: Hitbox;
  private hud: Hud;
  private activeHoleIndex = -1;
  private isUp = false;
  private pendingTimer?: TimerController;

  constructor(canvas: HTMLCanvasElement, onGameOver?: GameOverHandler) {
    super(canvas, onGameOver, { width: BOARD_SIZE, height: BOARD_SIZE });
    const k = this._k;

    k.loadSprite("zogez", zogezSprite);

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const x = k.lerp(GRID_LEFT, GRID_RIGHT, col / (COLS - 1));
        const y = k.lerp(GRID_TOP, GRID_BOTTOM, row / (ROWS - 1));

        k.add([
          k.circle(MOUND_RADIUS),
          k.pos(x, y),
          k.anchor("center"),
          k.scale(1, HOLE_SQUASH),
          k.color(...MOUND_COLOR),
          k.z(0),
        ]);
        const hole = k.add([
          k.circle(HOLE_RADIUS),
          k.pos(x, y),
          k.anchor("center"),
          k.scale(1, HOLE_SQUASH),
          k.color(...HOLE_COLOR),
          k.z(1),
        ]);
        this.holes.push(hole);
      }
    }

    this.zogez = k.add([
      k.sprite("zogez"),
      k.pos(GRID_LEFT, GRID_TOP),
      k.anchor("center"),
      k.scale(0),
      k.z(2),
    ]);

    // Invisible, fixed-size click target — kept separate from `zogez` above
    // so the hitbox doesn't shrink along with his pop-in/pop-out animation.
    // The shape is centered on `pos` (top-left offset by -radius on each axis)
    // rather than relying on an anchor, since it has no sprite/rect to anchor.
    this.hitbox = k.add([
      k.pos(GRID_LEFT, GRID_TOP),
      k.area({
        shape: new k.Rect(
          k.vec2(-HITBOX_HALF_WIDTH, -HITBOX_HALF_HEIGHT),
          HITBOX_HALF_WIDTH * 2,
          HITBOX_HALF_HEIGHT * 2,
        ),
        cursor: "pointer",
      }),
      k.z(2),
    ]);
    this.hitbox.onClick(() => this.handleHit());

    this.hud = k.add([
      k.text(this.hudText(), { size: HUD_TEXT_SIZE }),
      k.pos(BOARD_SIZE / 2, BOARD_SIZE * 0.06),
      k.anchor("top"),
      k.color(...HUD_COLOR),
      k.opacity(0.8),
      k.z(3),
    ]);

    this.popZogez();
  }

  restart() {
    super.restart();
    this.popZogez();
  }

  destroy(): void {
    this.pendingTimer?.cancel();
    super.destroy();
  }

  protected update() {
    this.hud.text = this.hudText();
    if (this.remainingSeconds() <= 0) {
      this.endGame();
    }
  }

  private remainingSeconds() {
    const elapsed = (performance.now() - this.startTime) / 1000;
    return Math.max(0, Math.ceil(ROUND_SECONDS - elapsed));
  }

  private hudText() {
    return `Whacks: ${this.score}   Time: ${this.remainingSeconds()}s`;
  }

  private pickHoleIndex() {
    const k = this._k;
    if (this.holes.length <= 1) return 0;
    let index = this.activeHoleIndex;
    while (index === this.activeHoleIndex) {
      index = Math.floor(k.rand(0, this.holes.length));
    }
    return index;
  }

  // Visible window shrinks from VISIBLE_MS_START towards VISIBLE_MS_END as
  // the round progresses.
  private visibleDuration() {
    const k = this._k;
    const elapsed = (performance.now() - this.startTime) / 1000;
    const t = Math.min(1, elapsed / ROUND_SECONDS);
    const min = k.lerp(VISIBLE_MS_START[0], VISIBLE_MS_END[0], t);
    const max = k.lerp(VISIBLE_MS_START[1], VISIBLE_MS_END[1], t);
    return k.rand(min, max) / 1000;
  }

  // Cancels whatever animation/wait is currently in flight (pop-up tween,
  // visible-window wait, retract tween, or gap wait) before starting the
  // next one, since `zogez`/`hitbox` are reused across holes and only one
  // of these should ever be driving them at a time.
  private popZogez() {
    if (this.gameOver) return;
    this.pendingTimer?.cancel();
    const k = this._k;
    this.activeHoleIndex = this.pickHoleIndex();
    const hole = this.holes[this.activeHoleIndex];
    const finalY = hole.pos.y - PEEK_OFFSET;
    const startY = finalY + RISE_DISTANCE;

    this.zogez.pos.x = hole.pos.x;
    this.zogez.pos.y = startY;
    this.zogez.scaleTo(0);
    // Full-size and in place immediately — clickable for the entire time
    // Zogez is up, not just once his pop-in animation finishes growing.
    this.hitbox.pos.x = hole.pos.x;
    this.hitbox.pos.y = finalY;
    this.isUp = true;

    const popTween = k.tween(
      0,
      1,
      POP_UP_DURATION,
      (t) => {
        this.zogez.scaleTo(t * ZOGEZ_SCALE);
        this.zogez.pos.y = k.lerp(startY, finalY, t);
      },
      k.easings.easeOutBack,
    );
    this.pendingTimer = popTween;
    popTween.onEnd(() => {
      if (this.gameOver || !this.isUp) return;
      this.pendingTimer = k.wait(this.visibleDuration(), () => {
        if (!this.isUp) return;
        this.missZogez(finalY);
      });
    });
  }

  // A hit chains straight into the next pop — no retract animation, no gap
  // — so the score is a pure measure of how fast you can find and click the
  // next one, rather than capped by a fixed pop cadence everyone converges
  // toward.
  private handleHit() {
    if (this.gameOver || !this.isUp) return;
    this.score++;
    this.isUp = false;
    this.popZogez();
  }

  // Unhit Zogez sinks back down by RISE_DISTANCE while shrinking, mirroring
  // the pop-up rise, then waits out GAP_MS before the next pop — this pacing
  // only applies when the player misses, not on a hit.
  private missZogez(peekY: number) {
    this.isUp = false;
    const k = this._k;
    const undergroundY = peekY + RISE_DISTANCE;

    const retractTween = k.tween(
      1,
      0,
      RETRACT_DURATION,
      (t) => {
        this.zogez.scaleTo(t * ZOGEZ_SCALE);
        this.zogez.pos.y = k.lerp(undergroundY, peekY, t);
      },
      k.easings.easeInQuad,
    );
    this.pendingTimer = retractTween;
    retractTween.onEnd(() => {
      if (this.gameOver) return;
      const gap = k.rand(GAP_MS[0], GAP_MS[1]) / 1000;
      this.pendingTimer = k.wait(gap, () => this.popZogez());
    });
  }
}
