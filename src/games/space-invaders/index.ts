import type {
  GameObj,
  PosComp,
  AreaComp,
  ColorComp,
  Vec2,
  SpriteComp,
} from "kaplay";

import { BaseGame, type GameOverHandler } from "@/games/base";

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

const BULLET_W = BOARD_SIZE * 0.01;
const BULLET_H = BOARD_SIZE * 0.02;
const BULLET_SPEED = BOARD_SIZE * 1.2;

const ALIEN_SPEED = BOARD_SIZE * 0.15;
const ALIEN_DROP = BOARD_SIZE * 0.05;

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

export class SpaceInvadersGame extends BaseGame {
  private player!: Player;
  private aliens: Alien[] = [];
  private bullets: Bullet[] = [];
  private dir = 1;
  private bulletsShot = 0;
  private bonusTime = 0;

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

    this.createAliens();
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
    const k = this._k;
    this.bulletsShot++;

    if (this.bulletsShot % 5 === 0) {
      this.bonusTime += 2;
    }

    const bullet: Bullet = k.add([
      k.rect(BULLET_W, BULLET_H),
      k.pos(this.player.pos.x - 30, this.player.pos.y - PLAYER_SIZE),
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

    for (let i = 0; i < 3; i++) {
      spawn("alien1", 5, ALIEN1_SCALE);
    }

    for (let i = 0; i < 5; i++) {
      spawn("alien2", 3, ALIEN2_SCALE);
    }

    for (let i = 0; i < 6; i++) {
      spawn("alien3", 1, ALIEN3_SCALE);
    }
  }

  private updateAliens() {
    let flip = false;

    for (const a of this.aliens) {
      a.pos.x += this.dir * ALIEN_SPEED * this._k.dt();

      if (a.pos.x < 20 || a.pos.x > BOARD_SIZE - 20) {
        flip = true;
      }
    }

    if (flip) {
      this.dir *= -1;
      for (const a of this.aliens) a.pos.y += ALIEN_DROP;
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
    const maxTime = this.roundTime + this.bonusTime;

    if (this.elapsed >= maxTime) {
      this.endGame();
    }
  }

  // =====================
  // GAME LOOP
  // =====================

  protected update() {
    this.player.pos.x = Math.max(
      PLAYER_SIZE / 2,
      Math.min(BOARD_SIZE - PLAYER_SIZE / 2, this.player.pos.x),
    );

    this.updateTimer();
    this.updateAliens();
    this.updateBullets();

    // LOSE
    for (const a of this.aliens) {
      if (a.pos.y > BOARD_SIZE - PLAYER_SIZE * 2) {
        this.endGame();
        return;
      }
    }

    // WIN
    if (this.aliens.length === 0) {
      this.endGame();
    }
  }

  calculateScore() {
    const elapsedSeconds = (performance.now() - this.startTime) / 1000;

    return Math.round(elapsedSeconds);
  }

  override restart(): void {
    super.restart();

    this.player.pos.x = BOARD_SIZE / 2;

    this.aliens.forEach((a) => a.destroy());
    this.bullets.forEach((b) => b.destroy());

    this.aliens = [];
    this.bullets = [];
    this.dir = 1;

    this.createAliens();
  }
}
