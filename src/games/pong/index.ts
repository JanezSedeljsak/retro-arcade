import kaplay from "kaplay";
import ballSprite from "@/assets/character.png";

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;

const WINNING_SCORE = 5;

export function start(
  canvas: HTMLCanvasElement,
  onGameOver?: (score: number) => void,
) {
  const k = kaplay({
    canvas,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    global: false,
    background: [0, 0, 0, 0],
  });

  k.loadSprite("ball", ballSprite);

  // kaplay overwrites canvas.style on init, so apply our sizing after.
  // width/height stay "auto" so the canvas keeps its intrinsic 16:9 ratio
  // (from the width/height above) while maxWidth/maxHeight scale it down.
  canvas.style.width = "auto";
  canvas.style.height = "auto";
  canvas.style.maxWidth = "100%";
  canvas.style.maxHeight = "100%";
  canvas.style.border = "min(0.6vmin, 4px) solid rgba(255, 120, 220, 0.6)";
  canvas.style.borderRadius = "min(1vmin, 8px)";

  const paddleWidth = k.width() * 0.015;
  const paddleHeight = k.height() * 0.2;
  const paddleMargin = k.width() * 0.03;
  const paddleSpeed = k.height() * 0.9;
  const botSpeed = paddleSpeed * 0.78;

  const ballRadius = k.width() * 0.045;
  const ballBaseSpeed = k.width() * 0.75;
  const ballSpeedIncrease = 1.05;

  const player = k.add([
    k.rect(paddleWidth, paddleHeight),
    k.pos(paddleMargin, k.height() / 2),
    k.anchor("center"),
    k.color(241, 234, 255),
    k.area(),
  ]);

  const bot = k.add([
    k.rect(paddleWidth, paddleHeight),
    k.pos(k.width() - paddleMargin, k.height() / 2),
    k.anchor("center"),
    k.color(241, 234, 255),
    k.area(),
  ]);

  const ball = k.add([
    k.sprite("ball"),
    k.pos(k.width() / 2, k.height() / 2),
    k.anchor("center"),
    k.area(),
    k.scale((ballRadius * 2) / 800),
    k.rotate(0),
    {
      vel: k.vec2(0, 0),
    },
  ]);

  const startTime = Date.now();
  let playerScore = 0;
  let gameOver = false;

  const scoreText = k.add([
    k.text(`${playerScore}`, { size: k.height() * 0.06 }),
    k.pos(k.width() / 2, k.height() * 0.05),
    k.anchor("top"),
    k.color(241, 234, 255),
    k.opacity(0.6),
  ]);

  // Score is the time (in seconds) it took the player to reach the winning
  // score, negated so that a faster win yields a larger (better) value.
  // Rounded because the scores table stores score as an integer.
  function calculateScore() {
    const elapsedSeconds = (Date.now() - startTime) / 1000;
    return -Math.round(elapsedSeconds);
  }

  function endGame() {
    gameOver = true;
    onGameOver?.(calculateScore());
  }

  function serveBall(direction: number) {
    ball.pos.x = k.width() / 2;
    ball.pos.y = k.height() / 2;
    const angle = k.rand(-0.3, 0.3);
    ball.vel = k
      .vec2(Math.cos(angle) * direction, Math.sin(angle))
      .scale(ballBaseSpeed);
  }

  serveBall(k.choose([-1, 1]));

  k.onKeyDown("w", () => {
    player.pos.y = Math.max(
      paddleHeight / 2,
      player.pos.y - paddleSpeed * k.dt(),
    );
  });

  k.onKeyDown("s", () => {
    player.pos.y = Math.min(
      k.height() - paddleHeight / 2,
      player.pos.y + paddleSpeed * k.dt(),
    );
  });

  k.onUpdate(() => {
    if (gameOver) return;

    // Bot follows the ball's y position.
    const deadzone = paddleHeight * 0.1;
    const diff = ball.pos.y - bot.pos.y;
    if (Math.abs(diff) > deadzone) {
      const step = Math.min(Math.abs(diff), botSpeed * k.dt());
      bot.pos.y += Math.sign(diff) * step;
    }
    bot.pos.y = Math.min(
      k.height() - paddleHeight / 2,
      Math.max(paddleHeight / 2, bot.pos.y),
    );

    ball.pos.x += ball.vel.x * k.dt();
    ball.pos.y += ball.vel.y * k.dt();
    ball.angle += 360 * k.dt();

    if (ball.pos.y - ballRadius <= 0 && ball.vel.y < 0) {
      ball.pos.y = ballRadius;
      ball.vel.y *= -1;
    } else if (ball.pos.y + ballRadius >= k.height() && ball.vel.y > 0) {
      ball.pos.y = k.height() - ballRadius;
      ball.vel.y *= -1;
    }

    function bounceOffPaddle(paddle: typeof player, direction: number) {
      const withinX =
        direction < 0
          ? ball.pos.x - ballRadius <= paddle.pos.x + paddleWidth / 2
          : ball.pos.x + ballRadius >= paddle.pos.x - paddleWidth / 2;
      const withinY =
        Math.abs(ball.pos.y - paddle.pos.y) <= paddleHeight / 2 + ballRadius;
      const movingTowards = Math.sign(ball.vel.x) === direction;

      if (withinX && withinY && movingTowards) {
        const offset = (ball.pos.y - paddle.pos.y) / (paddleHeight / 2);
        const speed = ball.vel.len() * ballSpeedIncrease;
        const angle = offset * 0.6;
        ball.vel = k
          .vec2(-direction * Math.cos(angle), Math.sin(angle))
          .scale(speed);
        ball.pos.x = paddle.pos.x - direction * (paddleWidth / 2 + ballRadius);
      }
    }

    bounceOffPaddle(player, -1);
    bounceOffPaddle(bot, 1);

    if (ball.pos.x < -ballRadius * 2) {
      serveBall(1);
    } else if (ball.pos.x > k.width() + ballRadius * 2) {
      playerScore++;
      scoreText.text = `${playerScore}`;
      if (playerScore >= WINNING_SCORE) {
        endGame();
      } else {
        serveBall(-1);
      }
    }
  });

  return () => {
    k.quit();
  };
}
