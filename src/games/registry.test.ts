import { describe, it, expect } from "vitest";
import { games } from "./registry";

const gameModules = import.meta.glob<{
  start: (c: HTMLCanvasElement) => () => void;
}>("./*/index.ts");

describe("games registry", () => {
  it("has at least one game", () => {
    expect(games.length).toBeGreaterThan(0);
  });

  it("every game has non-empty id, title, and description", () => {
    for (const game of games) {
      expect(game.id.trim()).not.toBe("");
      expect(game.title.trim()).not.toBe("");
      expect(game.description.trim()).not.toBe("");
    }
  });

  it("all game ids are unique", () => {
    const ids = games.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all game ids are kebab-case", () => {
    for (const game of games) {
      expect(game.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("every game has an index.ts exporting a start(canvas) function", async () => {
    for (const game of games) {
      const key = `./${game.id}/index.ts`;
      const loader = gameModules[key];
      expect(loader, `missing src/games/${game.id}/index.ts`).toBeDefined();

      const mod = await loader();
      expect(
        typeof mod.start,
        `src/games/${game.id}/index.ts must export a "start" function`,
      ).toBe("function");
      expect(
        mod.start.length,
        `src/games/${game.id}'s start must take exactly one argument (the canvas)`,
      ).toBe(1);
    }
  });
});
