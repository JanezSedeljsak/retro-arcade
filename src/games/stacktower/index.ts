import type {
  AnchorComp,
  ColorComp,
  FixedComp,
  GameObj,
  PosComp,
  RectComp,
  RotateComp,
  SpriteComp,
  TextComp,
} from "kaplay";
import characterSprite from "@/assets/character.webp";
import { BaseGame, type GameOverHandler } from "@/games/base";

// Square board — fits phones and desktops alike.
const BOARD_SIZE = 720;
const BLOCK_H = 24;
// Width of the base block and the first moving block — the seed the player
// trims down from. Wide enough to give a forgiving first few drops.
const START_W = 400;
// Floor for the trimmed block width, in world px. Without it a long run
// shrinks the block into a sub-pixel sliver that's invisible on screen but
// still in play.
const MIN_BLOCK_W = 3;

// Horizontal travel speed, in px/sec. Scales up with each successful drop
// so the run gets steadily harder.
const SPEED = 300;
const SPEED_INCREMENT = 15;

// Color palette — the hue cycles through the stack so every block reads
// as a distinct band. Kept in the 0..255 RGB range kaplay expects.
const SCORE_COLOR = [255, 120, 220] as const;
const GAME_OVER_COLOR = [255, 80, 120] as const;
const RESTART_COLOR = [255, 120, 220] as const;
const HUE_STEP = 15;
const HUE_BASE_R = 180;
const HUE_BASE_B = 255;
const HUE_B_AMPLITUDE = 120;

const SCORE_TEXT_SIZE = 32;
const GAME_OVER_TEXT_SIZE = 56;
const RESTART_TEXT_SIZE = 28;

// Camera: the topmost block is held at this fraction down the viewport, so
// the locked stack fills the lower ~70% as it climbs and the run can keep
// going far past the board's fixed height. The camera only pans up from the
// default center — never back down mid-run — and resets on restart.
const TOWER_TOP_SCREEN_FRACTION = 0.3;
const DEFAULT_CAM_X = BOARD_SIZE / 2;
const DEFAULT_CAM_Y = BOARD_SIZE / 2;

// Corner mascot: rendered at ~25% of the board height so it reads clearly
// in the corner, and rotates to face the top block's center.
const CHAR_SIZE = 0.25 * BOARD_SIZE;
const CHAR_MARGIN = 16;
// Constant clockwise offset added to the look-at angle, in degrees. The
// sprite art's "front" isn't aligned to +x, so this corrects the facing.
const CHAR_ROTATION_OFFSET = 100;

type BlockObj = GameObj<RectComp | PosComp | ColorComp>;
type TextObj = GameObj<TextComp | PosComp | ColorComp | FixedComp>;
// Fixed + rotate so it stays pinned to the viewport while spinning to face
// the (camera-transformed) top block.
type CharObj = GameObj<
  SpriteComp | PosComp | AnchorComp | FixedComp | RotateComp
>;

type Block = {
  x: number;
  y: number;
  w: number;
  obj: BlockObj;
};

export class StacktowerGame extends BaseGame {
  readonly controls = { joystick: false, press: true };

  private blocks: Block[] = [];
  private current!: Block;
  private dir = 1;
  private speed = SPEED;
  private scoreText!: TextObj;
  private char!: CharObj;

  constructor(canvas: HTMLCanvasElement, onGameOver?: GameOverHandler) {
    super(canvas, onGameOver, { width: BOARD_SIZE, height: BOARD_SIZE });
    this._k.loadSprite("character", characterSprite);
    this.resetGame();
  }

  restart(): void {
    super.restart();
    this._k.destroyAll("scene");
    this.resetGame();
  }

  protected update(): void {
    const step = this.dir * this.speed * this._k.dt();
    this.current.x += step;

    // Bounce off the side walls so the block stays on the board.
    if (this.current.x < 0) {
      this.current.x = 0;
      this.dir = 1;
    } else if (this.current.x + this.current.w > BOARD_SIZE) {
      this.current.x = BOARD_SIZE - this.current.w;
      this.dir = -1;
    }

    this.current.obj.pos.x = this.current.x;

    // Pan the camera up so the topmost block stays at TOWER_TOP_SCREEN_FRACTION
    // of the viewport. min() keeps the default framing while the tower is short
    // and only pans once the top would otherwise cross that line.
    const targetCamY =
      this.current.y + (0.5 - TOWER_TOP_SCREEN_FRACTION) * BOARD_SIZE;
    this._k.setCamPos(DEFAULT_CAM_X, Math.min(DEFAULT_CAM_Y, targetCamY));

    // The mascot is screen-space (fixed), the block is world-space, so convert
    // the block center through toScreen() before measuring the angle.
    const targetWorld = this._k.vec2(
      this.current.x + this.current.w / 2,
      this.current.y + BLOCK_H / 2,
    );
    const targetScreen = this._k.toScreen(targetWorld);
    const dx = targetScreen.x - this.char.pos.x;
    const dy = targetScreen.y - this.char.pos.y;
    // atan2 → degrees; assumes the sprite art faces right (0° = +x). Adding
    // CHAR_ROTATION_OFFSET spins it clockwise to match the sprite's actual
    // facing (positive angle = clockwise because screen y points down).
    this.char.angle =
      (Math.atan2(dy, dx) * 180) / Math.PI + CHAR_ROTATION_OFFSET;
  }

  protected press(): void {
    const last = this.blocks[this.blocks.length - 1];
    const curr = this.current;

    const left = Math.max(last.x, curr.x);
    const right = Math.min(last.x + last.w, curr.x + curr.w);
    const width = right - left;

    // No overlap with the block below — the tower topples.
    if (width <= 0) {
      this.endGame();
      this.showGameOver();
      return;
    }

    // Trim the dropped block down to the overlapping slice, but never below
    // MIN_BLOCK_W so the tower stays visible.
    curr.w = Math.max(width, MIN_BLOCK_W);
    curr.x = left;
    curr.obj.width = curr.w;
    curr.obj.pos.x = left;

    this.blocks.push(curr);

    this.score++;
    this.scoreText.text = String(this.score);

    this.speed += SPEED_INCREMENT;

    // Next block spawns one level higher and may approach from either side.
    const nextY = BOARD_SIZE - BLOCK_H * (this.blocks.length + 1);
    // Alternate sides per drop: score is even → next block enters from the
    // left moving right; odd → from the right moving left. The initial block
    // (score 0 before any drop) is spawned at the left in resetGame(), so
    // this keeps the alternation in sync with what the player just saw.
    const fromLeft = this.score % 2 === 0;
    const nextX = fromLeft ? 0 : BOARD_SIZE - curr.w;
    this.current = this.createBlock(nextX, nextY, curr.w);
    this.dir = fromLeft ? 1 : -1;
  }

  private resetGame(): void {
    // Everything we add gets this tag so restart() can wipe it all at once.
    const SCENE_TAG = "scene";
    this.blocks = [];
    this.dir = 1;
    this.speed = SPEED;
    this.score = 0;

    // Camera pans upward as the tower climbs; reset it to the board center.
    this._k.setCamPos(DEFAULT_CAM_X, DEFAULT_CAM_Y);

    // Score stays in the top-left corner of the screen, not the world.
    this.scoreText = this._k.add([
      this._k.text("0", { size: SCORE_TEXT_SIZE }),
      this._k.pos(20, 20),
      this._k.color(...SCORE_COLOR),
      this._k.fixed(),
      SCENE_TAG,
    ]);

    // Mascot pinned to the top-right corner of the viewport. fixed() keeps it
    // there as the camera pans up with the tower; anchor("center") makes the
    // rotate() angle spin around the sprite's middle.
    this.char = this._k.add([
      this._k.sprite("character", { height: CHAR_SIZE }),
      this._k.pos(
        BOARD_SIZE - CHAR_MARGIN - CHAR_SIZE / 2,
        CHAR_MARGIN + CHAR_SIZE / 2,
      ),
      this._k.anchor("center"),
      this._k.rotate(0),
      this._k.fixed(),
      SCENE_TAG,
    ]);

    const base = this.createBlock(
      BOARD_SIZE / 2 - START_W / 2,
      BOARD_SIZE - BLOCK_H,
      START_W,
    );
    this.blocks.push(base);

    this.current = this.createBlock(0, BOARD_SIZE - BLOCK_H * 2, START_W);
  }

  private createBlock(x: number, y: number, w: number): Block {
    // Hue shifts per stack height so each band is visually distinct.
    const hueShift = this.blocks.length * HUE_STEP;
    const obj = this._k.add([
      this._k.rect(w, BLOCK_H),
      this._k.pos(x, y),
      this._k.color(
        (HUE_BASE_R + hueShift) % 255,
        120,
        HUE_BASE_B - (hueShift % HUE_B_AMPLITUDE),
      ),
      // Block objects are tagged so they survive restart alongside the rest.
      "scene",
    ]);

    return { x, y, w, obj };
  }

  // Runs after endGame() so the score is reported before we freeze the run.
  private showGameOver(): void {
    // fixed() so the overlay centers on the viewport, not the (panned) world.
    this._k.add([
      this._k.text("GAME OVER", { size: GAME_OVER_TEXT_SIZE }),
      this._k.pos(BOARD_SIZE / 2, BOARD_SIZE / 2 - GAME_OVER_TEXT_SIZE),
      this._k.anchor("center"),
      this._k.color(...GAME_OVER_COLOR),
      this._k.fixed(),
      "scene",
    ]);

    this._k.add([
      this._k.text("Press R to restart", { size: RESTART_TEXT_SIZE }),
      this._k.pos(BOARD_SIZE / 2, BOARD_SIZE / 2 + RESTART_TEXT_SIZE),
      this._k.anchor("center"),
      this._k.color(...RESTART_COLOR),
      this._k.fixed(),
      "scene",
    ]);
  }
}
