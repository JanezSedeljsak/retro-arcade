import type {
  AnchorComp,
  ColorComp,
  GameObj,
  OpacityComp,
  PosComp,
  RectComp,
  RotateComp,
  ScaleComp,
  SpriteComp,
  TextComp,
} from "kaplay";
import zogezSprite from "@/assets/character.webp";
import {
  BaseGame,
  type GameControls,
  type GameOverHandler,
} from "@/games/base";

// Portrait board — flappy games read best tall and narrow on phones and desktops alike.
const BOARD_WIDTH = 480;
const BOARD_HEIGHT = 720;

// Gravity is high relative to the flap impulse so a tap traces a clear
// up/down arc (~0.5s here — floatier than the original Flappy Bird's
// ~0.37s, tuned by feel) — with much weaker gravity a normal tap cadence
// nets upward every cycle and the bird just pins itself to the ceiling.
const GRAVITY = BOARD_HEIGHT * 3.2;
const FLAP_VELOCITY = -BOARD_HEIGHT * 0.78;
const MAX_FALL_SPEED = BOARD_HEIGHT * 1.8;
// Tilt range: nose-up while rising, nose-down diving — purely cosmetic.
const MAX_TILT_UP = -30;
const MAX_TILT_DOWN = 90;

const BIRD_X = BOARD_WIDTH * 0.28;
// character.webp is a 225px-wide sprite (same asset Pong and WhackZogez use).
const BIRD_DIAMETER = BOARD_WIDTH * 0.13;
const BIRD_SPRITE_SCALE = BIRD_DIAMETER / 225;
// Slightly smaller than the visible sprite so near-misses feel fair.
const BIRD_HITBOX_RADIUS = (BIRD_DIAMETER / 2) * 0.75;

const GROUND_HEIGHT = BOARD_HEIGHT * 0.09;
const GROUND_Y = BOARD_HEIGHT - GROUND_HEIGHT;
const GROUND_COLOR = [46, 28, 74] as const;
const GROUND_LINE_HEIGHT = BOARD_HEIGHT * 0.012;
const GROUND_LINE_COLOR = [124, 58, 237] as const;

// Each pipe is 2 rectangles: a narrow shaft and a wider cap/rim at the gap
// opening — the classic Mario-pipe silhouette, both in shades of purple.
const PIPE_SHAFT_WIDTH = BOARD_WIDTH * 0.12;
const PIPE_CAP_WIDTH = PIPE_SHAFT_WIDTH * 1.35;
const PIPE_CAP_HEIGHT = BOARD_HEIGHT * 0.035;
const PIPE_SHAFT_COLOR = [124, 58, 237] as const;
const PIPE_CAP_COLOR = [168, 85, 247] as const;

const PIPE_GAP = BOARD_HEIGHT * 0.19;
const PIPE_SPACING = BOARD_WIDTH * 0.62;
const PIPE_SPEED = BOARD_WIDTH * 0.42;
// Gap center is randomized within this range, leaving room for the cap and
// a margin above the ceiling / above the ground.
const GAP_Y_MIN = PIPE_GAP / 2 + BOARD_HEIGHT * 0.08;
const GAP_Y_MAX = GROUND_Y - PIPE_GAP / 2 - BOARD_HEIGHT * 0.05;
// Consecutive gaps can't be more than this far apart vertically — pipes are
// ~1.5s apart at scroll speed, and a ceiling-to-floor jump between gaps
// isn't reachable with a fair tap cadence in that time.
const MAX_GAP_Y_STEP = BOARD_HEIGHT * 0.22;
// First pipe spawns further out than the steady-state spacing so the player
// gets a beat to get their bearings before it arrives.
const FIRST_PIPE_X = BOARD_WIDTH * 1.3;
// Where follow-up pipes spawn: just past the right edge, cap fully offscreen.
const PIPE_SPAWN_X = BOARD_WIDTH + PIPE_CAP_WIDTH;
// Scroll distance until the second pipe spawns, chosen so it lands exactly
// PIPE_SPACING behind the first pipe.
const FIRST_SPAWN_DELAY = FIRST_PIPE_X - PIPE_SPAWN_X + PIPE_SPACING;

const HUD_COLOR = [241, 234, 255] as const;
const HUD_TEXT_SIZE = BOARD_HEIGHT * 0.045;

type Bird = GameObj<
  SpriteComp | PosComp | AnchorComp | ScaleComp | RotateComp
> & { vel: number };
type PipeRect = GameObj<RectComp | PosComp | AnchorComp | ColorComp>;
type Hud = GameObj<TextComp | PosComp | AnchorComp | ColorComp | OpacityComp>;

type PipePair = {
  x: number;
  passed: boolean;
  topShaft: PipeRect;
  topCap: PipeRect;
  bottomShaft: PipeRect;
  bottomCap: PipeRect;
};

export class FlappyZogezGame extends BaseGame {
  readonly controls: GameControls = { joystick: false, press: true };
  private bird: Bird;
  private hud: Hud;
  private pipes: PipePair[] = [];
  private lastGapY: number | null = null;
  private spawnTimer = FIRST_SPAWN_DELAY;
  private started = false;

  constructor(canvas: HTMLCanvasElement, onGameOver?: GameOverHandler) {
    super(canvas, onGameOver, { width: BOARD_WIDTH, height: BOARD_HEIGHT });
    const k = this._k;

    k.loadSprite("zogez", zogezSprite);

    k.add([
      k.rect(BOARD_WIDTH, GROUND_HEIGHT),
      k.pos(0, GROUND_Y),
      k.anchor("topleft"),
      k.color(...GROUND_COLOR),
      k.z(0),
    ]);
    k.add([
      k.rect(BOARD_WIDTH, GROUND_LINE_HEIGHT),
      k.pos(0, GROUND_Y),
      k.anchor("topleft"),
      k.color(...GROUND_LINE_COLOR),
      k.z(1),
    ]);

    this.bird = k.add([
      k.sprite("zogez"),
      k.pos(BIRD_X, BOARD_HEIGHT / 2),
      k.anchor("center"),
      k.scale(BIRD_SPRITE_SCALE),
      k.rotate(0),
      k.z(2),
      { vel: 0 },
    ]);

    this.hud = k.add([
      k.text(this.hudText(), { size: HUD_TEXT_SIZE }),
      k.pos(BOARD_WIDTH / 2, BOARD_HEIGHT * 0.04),
      k.anchor("top"),
      k.color(...HUD_COLOR),
      k.opacity(0.85),
      k.z(3),
    ]);

    this.spawnPipe(FIRST_PIPE_X);
  }

  restart(): void {
    super.restart();
    this._k.destroyAll("pipe");
    this.pipes = [];
    this.lastGapY = null;
    this.started = false;
    this.spawnTimer = FIRST_SPAWN_DELAY;
    this.bird.pos.x = BIRD_X;
    this.bird.pos.y = BOARD_HEIGHT / 2;
    this.bird.vel = 0;
    this.bird.angle = 0;
    this.spawnPipe(FIRST_PIPE_X);
    this.hud.text = this.hudText();
  }

  // Gravity and pipes only kick in once the player has flapped once — like
  // the original Flappy Bird, so the run doesn't start ticking (and the
  // bird doesn't start falling) before the player has even reacted.
  protected press(): void {
    this.started = true;
    this.bird.vel = FLAP_VELOCITY;
  }

  protected update(): void {
    if (!this.started) return;
    const k = this._k;
    const dt = k.dt();

    this.bird.vel = Math.min(this.bird.vel + GRAVITY * dt, MAX_FALL_SPEED);
    this.bird.pos.y += this.bird.vel * dt;
    // The ceiling stops the bird rather than killing it — only the ground
    // and pipes do — matching the original Flappy Bird's feel.
    if (this.bird.pos.y < BIRD_HITBOX_RADIUS) {
      this.bird.pos.y = BIRD_HITBOX_RADIUS;
      this.bird.vel = Math.max(this.bird.vel, 0);
    }
    this.bird.angle = k.clamp(
      (this.bird.vel / MAX_FALL_SPEED) * MAX_TILT_DOWN,
      MAX_TILT_UP,
      MAX_TILT_DOWN,
    );

    if (this.bird.pos.y + BIRD_HITBOX_RADIUS >= GROUND_Y) {
      this.bird.pos.y = GROUND_Y - BIRD_HITBOX_RADIUS;
      this.endGame();
      return;
    }

    for (const pipe of this.pipes) {
      pipe.x -= PIPE_SPEED * dt;
      pipe.topShaft.pos.x = pipe.x;
      pipe.topCap.pos.x = pipe.x;
      pipe.bottomShaft.pos.x = pipe.x;
      pipe.bottomCap.pos.x = pipe.x;

      if (!pipe.passed && pipe.x + PIPE_CAP_WIDTH / 2 < BIRD_X) {
        pipe.passed = true;
        this.score++;
      }

      if (
        this.hitsRect(pipe.topShaft) ||
        this.hitsRect(pipe.topCap) ||
        this.hitsRect(pipe.bottomShaft) ||
        this.hitsRect(pipe.bottomCap)
      ) {
        this.endGame();
        return;
      }
    }

    while (this.pipes.length && this.pipes[0].x + PIPE_CAP_WIDTH < 0) {
      const gone = this.pipes.shift()!;
      gone.topShaft.destroy();
      gone.topCap.destroy();
      gone.bottomShaft.destroy();
      gone.bottomCap.destroy();
    }

    this.spawnTimer -= PIPE_SPEED * dt;
    if (this.spawnTimer <= 0) {
      this.spawnPipe(PIPE_SPAWN_X);
      this.spawnTimer += PIPE_SPACING;
    }

    this.hud.text = this.hudText();
  }

  private hudText() {
    return `Score: ${this.score}`;
  }

  // Circle (the bird) vs. axis-aligned rect overlap, using the rect's own
  // live width/height/pos so moving or newly spawned pipes stay accurate
  // without recomputing geometry separately for collision.
  private hitsRect(rect: PipeRect) {
    const dx = Math.max(
      Math.abs(this.bird.pos.x - rect.pos.x) - rect.width / 2,
      0,
    );
    const dy = Math.max(
      Math.abs(this.bird.pos.y - rect.pos.y) - rect.height / 2,
      0,
    );
    return dx * dx + dy * dy <= BIRD_HITBOX_RADIUS * BIRD_HITBOX_RADIUS;
  }

  private spawnPipe(x: number) {
    const k = this._k;
    const gapY =
      this.lastGapY === null
        ? k.rand(GAP_Y_MIN, GAP_Y_MAX)
        : k.rand(
            Math.max(GAP_Y_MIN, this.lastGapY - MAX_GAP_Y_STEP),
            Math.min(GAP_Y_MAX, this.lastGapY + MAX_GAP_Y_STEP),
          );
    this.lastGapY = gapY;
    const gapTop = gapY - PIPE_GAP / 2;
    const gapBottom = gapY + PIPE_GAP / 2;

    const topShaftHeight = Math.max(0, gapTop - PIPE_CAP_HEIGHT);
    const topShaft = k.add([
      k.rect(PIPE_SHAFT_WIDTH, topShaftHeight),
      k.pos(x, topShaftHeight / 2),
      k.anchor("center"),
      k.color(...PIPE_SHAFT_COLOR),
      k.z(1),
      "pipe",
    ]);
    const topCap = k.add([
      k.rect(PIPE_CAP_WIDTH, PIPE_CAP_HEIGHT),
      k.pos(x, gapTop - PIPE_CAP_HEIGHT / 2),
      k.anchor("center"),
      k.color(...PIPE_CAP_COLOR),
      k.z(1),
      "pipe",
    ]);

    const bottomShaftTop = gapBottom + PIPE_CAP_HEIGHT;
    const bottomShaftHeight = Math.max(0, GROUND_Y - bottomShaftTop);
    const bottomShaft = k.add([
      k.rect(PIPE_SHAFT_WIDTH, bottomShaftHeight),
      k.pos(x, bottomShaftTop + bottomShaftHeight / 2),
      k.anchor("center"),
      k.color(...PIPE_SHAFT_COLOR),
      k.z(1),
      "pipe",
    ]);
    const bottomCap = k.add([
      k.rect(PIPE_CAP_WIDTH, PIPE_CAP_HEIGHT),
      k.pos(x, gapBottom + PIPE_CAP_HEIGHT / 2),
      k.anchor("center"),
      k.color(...PIPE_CAP_COLOR),
      k.z(1),
      "pipe",
    ]);

    this.pipes.push({
      x,
      passed: false,
      topShaft,
      topCap,
      bottomShaft,
      bottomCap,
    });
  }
}
