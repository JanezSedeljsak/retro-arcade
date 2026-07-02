import type {
  AnchorComp,
  AreaComp,
  ColorComp,
  GameObj,
  OpacityComp,
  PosComp,
  RectComp,
  RotateComp,
  ScaleComp,
  SpriteComp,
  TextComp,
  Vec2,
} from "kaplay";
import ballSprite from "@/assets/character.webp";
import {
  BaseGame,
  GAME_WIDTH,
  GAME_HEIGHT,
  type GameOverHandler,
} from "@/games/base";

const WINNING_SCORE = 5;

// Paddles — sizes and speeds relative to the board so tweaking one
// constant rescales the whole game.
const PADDLE_WIDTH = GAME_WIDTH * 0.015;
const PADDLE_HEIGHT = GAME_HEIGHT * 0.2;
const PADDLE_MARGIN = GAME_WIDTH * 0.03;
const PADDLE_SPEED = GAME_HEIGHT * 0.9;
const BOT_SPEED = PADDLE_SPEED * 0.7;
// The bot only chases the ball once it's this far from the paddle center.
const BOT_DEADZONE = PADDLE_HEIGHT * 0.1;

// Ball
const BALL_RADIUS = GAME_WIDTH * 0.045;
const BALL_BASE_SPEED = GAME_WIDTH * 0.75;
const BALL_SPEED_INCREASE = 1.05;
const BALL_SPIN = 360; // degrees per second
// The 180px sprite scaled to the same rendered size as the old 640px one.
const BALL_SPRITE_SCALE = (BALL_RADIUS * 2) / 225;
const SERVE_ANGLE = 0.3; // radians; serve direction varies within ±this
const MAX_BOUNCE_ANGLE = 0.6; // radians; hit at a paddle's very edge

// Board
const GOAL_WIDTH = GAME_WIDTH * 0.01;
const SCORE_TEXT_SIZE = GAME_HEIGHT * 0.06;
const SCORE_TEXT_Y = GAME_HEIGHT * 0.05;

const GOAL_COLOR = [255, 120, 220] as const;
const FOREGROUND_COLOR = [241, 234, 255] as const;

type Paddle = GameObj<RectComp | PosComp | AnchorComp | ColorComp | AreaComp>;
type Ball = GameObj<
  SpriteComp | PosComp | AnchorComp | AreaComp | ScaleComp | RotateComp
> & { vel: Vec2 };
type ScoreText = GameObj<
  TextComp | PosComp | AnchorComp | ColorComp | OpacityComp
>;

export class PongGame extends BaseGame {
  private player: Paddle;
  private bot: Paddle;
  private ball: Ball;
  private scoreText: ScoreText;
  private playerScore = 0;
  private botScore = 0;

  constructor(canvas: HTMLCanvasElement, onGameOver?: GameOverHandler) {
    super(canvas, onGameOver);
    const k = this._k;

    k.loadSprite("ball", ballSprite);

    // Full-height goal strips on both sides.
    k.add([
      k.rect(GOAL_WIDTH, GAME_HEIGHT),
      k.pos(0, 0),
      k.color(...GOAL_COLOR),
    ]);
    k.add([
      k.rect(GOAL_WIDTH, GAME_HEIGHT),
      k.pos(GAME_WIDTH - GOAL_WIDTH, 0),
      k.color(...GOAL_COLOR),
    ]);

    this.player = k.add([
      k.rect(PADDLE_WIDTH, PADDLE_HEIGHT),
      k.pos(PADDLE_MARGIN, GAME_HEIGHT / 2),
      k.anchor("center"),
      k.color(...FOREGROUND_COLOR),
      k.area(),
    ]);

    this.bot = k.add([
      k.rect(PADDLE_WIDTH, PADDLE_HEIGHT),
      k.pos(GAME_WIDTH - PADDLE_MARGIN, GAME_HEIGHT / 2),
      k.anchor("center"),
      k.color(...FOREGROUND_COLOR),
      k.area(),
    ]);

    this.ball = k.add([
      k.sprite("ball"),
      k.pos(GAME_WIDTH / 2, GAME_HEIGHT / 2),
      k.anchor("center"),
      k.area(),
      k.scale(BALL_SPRITE_SCALE),
      k.rotate(0),
      {
        vel: k.vec2(0, 0),
      },
    ]);

    this.scoreText = k.add([
      k.text(`${this.playerScore} : ${this.botScore}`, {
        size: SCORE_TEXT_SIZE,
      }),
      k.pos(GAME_WIDTH / 2, SCORE_TEXT_Y),
      k.anchor("top"),
      k.color(...FOREGROUND_COLOR),
      k.opacity(0.6),
    ]);

    this.serveBall(k.choose([-1, 1]));

    k.onKeyDown("w", () => {
      this.player.pos.y = Math.max(
        PADDLE_HEIGHT / 2,
        this.player.pos.y - PADDLE_SPEED * k.dt(),
      );
    });

    k.onKeyDown("s", () => {
      this.player.pos.y = Math.min(
        GAME_HEIGHT - PADDLE_HEIGHT / 2,
        this.player.pos.y + PADDLE_SPEED * k.dt(),
      );
    });
  }

  restart() {
    super.restart();
    this.playerScore = 0;
    this.botScore = 0;
    this.updateScoreText();
    this.player.pos.y = GAME_HEIGHT / 2;
    this.bot.pos.y = GAME_HEIGHT / 2;
    this.serveBall(this._k.choose([-1, 1]));
  }

  // Score is the time (in seconds) it took the player to reach the winning
  // score, negated so that a faster win yields a larger (better) value.
  // Rounded because the scores table stores score as an integer.
  calculateScore() {
    const elapsedSeconds = (Date.now() - this.startTime) / 1000;
    return -Math.round(elapsedSeconds);
  }

  protected update() {
    const k = this._k;
    const { ball, bot } = this;

    // Bot follows the ball's y position.
    const diff = ball.pos.y - bot.pos.y;
    if (Math.abs(diff) > BOT_DEADZONE) {
      const step = Math.min(Math.abs(diff), BOT_SPEED * k.dt());
      bot.pos.y += Math.sign(diff) * step;
    }
    bot.pos.y = Math.min(
      GAME_HEIGHT - PADDLE_HEIGHT / 2,
      Math.max(PADDLE_HEIGHT / 2, bot.pos.y),
    );

    ball.pos.x += ball.vel.x * k.dt();
    ball.pos.y += ball.vel.y * k.dt();
    ball.angle += BALL_SPIN * k.dt();

    if (ball.pos.y - BALL_RADIUS <= 0 && ball.vel.y < 0) {
      ball.pos.y = BALL_RADIUS;
      ball.vel.y *= -1;
    } else if (ball.pos.y + BALL_RADIUS >= GAME_HEIGHT && ball.vel.y > 0) {
      ball.pos.y = GAME_HEIGHT - BALL_RADIUS;
      ball.vel.y *= -1;
    }

    this.bounceOffPaddle(this.player, -1);
    this.bounceOffPaddle(this.bot, 1);

    // A goal counts as soon as the ball touches the left or right side.
    if (ball.pos.x - BALL_RADIUS <= GOAL_WIDTH && ball.vel.x < 0) {
      this.botScore++;
      this.updateScoreText();
      this.serveBall(1);
    } else if (
      ball.pos.x + BALL_RADIUS >= GAME_WIDTH - GOAL_WIDTH &&
      ball.vel.x > 0
    ) {
      this.playerScore++;
      this.updateScoreText();
      if (this.playerScore >= WINNING_SCORE) {
        this.endGame();
      } else {
        this.serveBall(-1);
      }
    }
  }

  private updateScoreText() {
    this.scoreText.text = `${this.playerScore} : ${this.botScore}`;
  }

  private serveBall(direction: number) {
    const k = this._k;
    this.ball.pos.x = GAME_WIDTH / 2;
    this.ball.pos.y = GAME_HEIGHT / 2;
    const angle = k.rand(-SERVE_ANGLE, SERVE_ANGLE);
    this.ball.vel = k
      .vec2(Math.cos(angle) * direction, Math.sin(angle))
      .scale(BALL_BASE_SPEED);
  }

  private bounceOffPaddle(paddle: Paddle, direction: number) {
    const { ball } = this;
    const withinX =
      direction < 0
        ? ball.pos.x - BALL_RADIUS <= paddle.pos.x + PADDLE_WIDTH / 2
        : ball.pos.x + BALL_RADIUS >= paddle.pos.x - PADDLE_WIDTH / 2;
    const withinY =
      Math.abs(ball.pos.y - paddle.pos.y) <= PADDLE_HEIGHT / 2 + BALL_RADIUS;
    const movingTowards = Math.sign(ball.vel.x) === direction;

    if (withinX && withinY && movingTowards) {
      const offset = (ball.pos.y - paddle.pos.y) / (PADDLE_HEIGHT / 2);
      const speed = ball.vel.len() * BALL_SPEED_INCREASE;
      const angle = offset * MAX_BOUNCE_ANGLE;
      ball.vel = this._k
        .vec2(-direction * Math.cos(angle), Math.sin(angle))
        .scale(speed);
      ball.pos.x = paddle.pos.x - direction * (PADDLE_WIDTH / 2 + BALL_RADIUS);
    }
  }
}
