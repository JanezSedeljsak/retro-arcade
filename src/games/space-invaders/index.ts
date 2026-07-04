import type {
  GameObj,
  PosComp,
  AreaComp,
  ColorComp,
  Vec2,
  SpriteComp,
  TextComp,
} from "kaplay";

import { BaseGame, clamp, type GameOverHandler } from "@/games/base";

// assets
import playerImg from "@/assets/character.webp";
import alien1Img from "@/assets/alien1.webp";
import alien2Img from "@/assets/alien2.webp";
import alien3Img from "@/assets/alien3.webp";

const BOARD_SIZE = 720;

// =====================
// CONSTANTS
// =====================

const PLAYER_SIZE = BOARD_SIZE * 0.08;
const PLAYER_SPEED = BOARD_SIZE * 0.9;
// Pulls both horizontal movement bounds in from the board edges by this
// much, so the player stops short of the walls on either side.
const PLAYER_X_INSET = 30;

const BULLET_W = BOARD_SIZE * 0.01;
const BULLET_H = BOARD_SIZE * 0.02;
const BULLET_SPEED = BOARD_SIZE * 1.2;
// Ammo budget: at most this many shots inside any rolling window, so
// spraying empties the magazine and forces the player to aim.
const MAX_SHOTS_PER_WINDOW = 20;
const SHOT_WINDOW_SECONDS = 5;

const HUD_COLOR = [241, 234, 255] as const;
const HUD_TEXT_SIZE = BOARD_SIZE * 0.045;

const ALIEN_SPEED = BOARD_SIZE * 0.15;
// Smaller than before so the descent takes noticeably longer to reach the
// lose line — more flips (and more time to clear aliens) per row dropped.
const ALIEN_DROP = BOARD_SIZE * 0.03;
// Aliens drop on a wall flip, but at most once per this many seconds.
// The random spawn spread keeps some alien near a wall at all times, so
// uncapped flip-drops would reach the lose line within seconds; with the
// cap, even the lowest possible spawner needs 9 drops ≈ 54s to cross.
const ALIEN_DROP_COOLDOWN = 6;
// Aliens dropping past this line means they've reached the player — lose.
const ALIEN_LOSE_LINE_Y = BOARD_SIZE - PLAYER_SIZE * 2;

const ALIEN1_SCALE = 0.15;
const ALIEN2_SCALE = 0.15;
const ALIEN3_SCALE = 0.15;

type Player = GameObj<PosComp | SpriteComp | AreaComp>;

type Alien = GameObj<PosComp | AreaComp | ColorComp | SpriteComp> & {
  hp: number;
};

type Bullet = GameObj<PosComp | AreaComp | ColorComp> & {
  vel: Vec2;
};

type Hud = GameObj<PosComp | TextComp>;

export class SpaceInvadersGame extends BaseGame {
  private player!: Player;
  private hud!: Hud;
  private aliens: Alien[] = [];
  private bullets: Bullet[] = [];
  private dir = 1;
  /** performance.now() ms of recent shots, pruned to the rolling window. */
  private shotTimes: number[] = [];
  /** Only a full clear counts as a win — anything else scores 0. */
  private won = false;
  /** Seconds until the next wall flip is allowed to drop the aliens. */
  private dropCooldown = ALIEN_DROP_COOLDOWN;

  private elapsed = 0;
  private roundTime = 60;

  constructor(canvas: HTMLCanvasElement, onGameOver?: GameOverHandler) {
    super(canvas, onGameOver, {
      width: BOARD_SIZE,
      height: BOARD_SIZE,
    });

    const k = this._k;

    // =====================
    // SPRITES
    // =====================
    k.loadSprite("player", playerImg);

    k.loadSprite("alien1", alien1Img);
    k.loadSprite("alien2", alien2Img);
    k.loadSprite("alien3", alien3Img);

    // =====================
    // PLAYER (Žogez)
    // =====================
    this.player = k.add([
      k.sprite("player"),
      k.pos(BOARD_SIZE / 2, BOARD_SIZE * 0.9),
      k.anchor("center"),
      k.scale(PLAYER_SIZE / 128),
      k.area(),
    ]);

    this.hud = k.add([
      k.text(this.hudText(), { size: HUD_TEXT_SIZE }),
      k.pos(BOARD_SIZE / 2, BOARD_SIZE * 0.02),
      k.anchor("top"),
      k.color(...HUD_COLOR),
      k.opacity(0.85),
      k.z(3),
    ]);

    this.createAliens();
  }

  private ammoLeft() {
    const cutoff = performance.now() - SHOT_WINDOW_SECONDS * 1000;
    this.shotTimes = this.shotTimes.filter((t) => t > cutoff);
    return MAX_SHOTS_PER_WINDOW - this.shotTimes.length;
  }

  private hudText() {
    return `AMMO ${this.ammoLeft()}/${MAX_SHOTS_PER_WINDOW}  TIME ${Math.floor(this.elapsed)}`;
  }

  // =====================
  // INPUT
  // =====================

  protected moveLeft() {
    this.player.pos.x -= PLAYER_SPEED * this._k.dt();
  }

  protected moveRight() {
    this.player.pos.x += PLAYER_SPEED * this._k.dt();
  }

  protected press() {
    if (this.ammoLeft() <= 0) return;
    this.shotTimes.push(performance.now());

    const k = this._k;

    const bullet: Bullet = k.add([
      k.rect(BULLET_W, BULLET_H),
      k.pos(
        this.player.pos.x - PLAYER_X_INSET,
        this.player.pos.y - PLAYER_SIZE,
      ),
      k.anchor("center"),
      k.color(255, 255, 120),
      k.area(),
      {
        vel: k.vec2(0, -BULLET_SPEED),
      },
    ]) as Bullet;

    this.bullets.push(bullet);
  }

  // =====================
  // ALIENS (RANDOM + TIERS)
  // =====================

  private createAliens() {
    const k = this._k;

    const spawn = (sprite: string, hp: number, scale: number) => {
      const alien: Alien = k.add([
        k.sprite(sprite),
        k.pos(
          k.rand(BOARD_SIZE * 0.1, BOARD_SIZE * 0.9),
          k.rand(BOARD_SIZE * 0.1, BOARD_SIZE * 0.6),
        ),
        k.anchor("center"),
        k.scale(scale),
        k.area(),
      ]) as unknown as Alien;

      alien.hp = hp;
      this.aliens.push(alien);
    };

    // Scaled up alongside the bigger ammo budget (MAX_SHOTS_PER_WINDOW) so
    // there's still more to shoot at than bullets to spray.
    for (let i = 0; i < 3; i++) {
      spawn("alien1", 5, ALIEN1_SCALE);
    }

    for (let i = 0; i < 4; i++) {
      spawn("alien2", 3, ALIEN2_SCALE);
    }

    for (let i = 0; i < 6; i++) {
      spawn("alien3", 1, ALIEN3_SCALE);
    }
  }

  private updateAliens() {
    let flip = false;

    this.dropCooldown = Math.max(0, this.dropCooldown - this._k.dt());

    for (const a of this.aliens) {
      a.pos.x += this.dir * ALIEN_SPEED * this._k.dt();

      if (a.pos.x < 20 || a.pos.x > BOARD_SIZE - 20) {
        flip = true;
      }
    }

    if (flip) {
      this.dir *= -1;

      if (this.dropCooldown === 0) {
        this.dropCooldown = ALIEN_DROP_COOLDOWN;
        for (const a of this.aliens) a.pos.y += ALIEN_DROP;
      }
    }
  }

  private updateBullets() {
    for (const b of this.bullets) {
      b.pos.y += b.vel.y * this._k.dt();
    }

    for (const b of this.bullets) {
      for (const a of this.aliens) {
        const hit =
          b.pos.x < a.pos.x + 20 &&
          b.pos.x > a.pos.x - 20 &&
          b.pos.y < a.pos.y + 20 &&
          b.pos.y > a.pos.y - 20;

        if (hit) {
          a.hp--;

          b.destroy();
          this.bullets = this.bullets.filter((x) => x !== b);

          if (a.hp <= 0) {
            a.destroy();
            this.aliens = this.aliens.filter((x) => x !== a);
            // this.score += 10;
          }

          break;
        }
      }
    }
  }

  // =====================
  // TIMER
  // =====================

  private updateTimer() {
    this.elapsed = (performance.now() - this.startTime) / 1000;

    if (this.elapsed >= this.roundTime) {
      this.endGame();
    }
  }

  // =====================
  // GAME LOOP
  // =====================

  protected update() {
    this.player.pos.x = clamp(
      this.player.pos.x,
      PLAYER_SIZE / 2 + PLAYER_X_INSET,
      BOARD_SIZE - PLAYER_SIZE / 2 - PLAYER_X_INSET,
    );

    this.updateTimer();
    this.updateAliens();
    this.updateBullets();
    this.hud.text = this.hudText();

    // LOSE — an alien reaching the line freezes the run (update() stops
    // being called once gameOver is set) until the player restarts.
    for (const a of this.aliens) {
      if (a.pos.y > ALIEN_LOSE_LINE_Y) {
        this.endGame();
        return;
      }
    }

    // WIN
    if (this.aliens.length === 0) {
      this.won = true;
      this.endGame();
    }
  }

  calculateScore() {
    // Losing (aliens got through, or time ran out) is worth nothing.
    if (!this.won) return -100;
    // Faster clears score higher. Bonus time is excluded so firing extra
    // shots can't buy score; winning in overtime still beats any loss.
    const elapsedSeconds = (performance.now() - this.startTime) / 1000;
    return Math.max(-100, -Math.round(elapsedSeconds));
  }

  override restart(): void {
    super.restart();

    this.player.pos.x = BOARD_SIZE / 2;

    this.aliens.forEach((a) => a.destroy());
    this.bullets.forEach((b) => b.destroy());

    this.aliens = [];
    this.bullets = [];
    this.dir = 1;
    this.shotTimes = [];
    this.won = false;
    this.dropCooldown = ALIEN_DROP_COOLDOWN;
    this.elapsed = 0;

    this.createAliens();
    this.hud.text = this.hudText();
  }
}
