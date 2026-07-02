import { BaseGame, type GameOverHandler } from "@/games/base";

// Alien waves march downward — a square board fits the formation better than 16:9.
const BOARD_SIZE = 720;

export class SpaceInvadersGame extends BaseGame {
  constructor(canvas: HTMLCanvasElement, onGameOver?: GameOverHandler) {
    super(canvas, onGameOver, { width: BOARD_SIZE, height: BOARD_SIZE });
  }

  protected update() {}
}
