import { BaseGame, type GameOverHandler } from "@/games/base";

// The tower grows upward — a square board reads better than 16:9.
const BOARD_SIZE = 720;

export class StacktowerGame extends BaseGame {
  constructor(canvas: HTMLCanvasElement, onGameOver?: GameOverHandler) {
    super(canvas, onGameOver, { width: BOARD_SIZE, height: BOARD_SIZE });
  }

  protected update() {}
}
