import { describe, it, expect } from "vitest";
import { games } from "./registry";

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
});
