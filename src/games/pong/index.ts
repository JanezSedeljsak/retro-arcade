import kaplay from "kaplay";

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;

export function start(canvas: HTMLCanvasElement) {
  const k = kaplay({
    canvas,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    background: "#14091f",
    global: false,
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

  const paddleWidth = k.width() * 0.015;
  const paddleHeight = k.height() * 0.2;
  const paddleMargin = k.width() * 0.03;
  const paddleSpeed = k.height() * 0.9;

  const player = k.add([
    k.rect(paddleWidth, paddleHeight),
    k.pos(paddleMargin, k.height() / 2),
    k.anchor("center"),
    k.color(241, 234, 255),
    k.area(),
  ]);

  k.add([
    k.rect(paddleWidth, paddleHeight),
    k.pos(k.width() - paddleMargin, k.height() / 2),
    k.anchor("center"),
    k.color(241, 234, 255),
    k.area(),
  ]);

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

  return () => {
    k.quit();
  };
}
