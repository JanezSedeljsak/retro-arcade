import { BaseGame, type GameOverHandler } from "@/games/base";

// Vertical flying game — a square board fits phones and desktops alike.
const BOARD_SIZE = 720;

export class WhirlybirdGame extends BaseGame {
  constructor(canvas: HTMLCanvasElement, onGameOver?: GameOverHandler) {
    super(canvas, onGameOver, { width: BOARD_SIZE, height: BOARD_SIZE });
  }

  protected update() {}
}
