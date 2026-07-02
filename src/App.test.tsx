import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "@/App";

describe("App", () => {
  it("renders without crashing", () => {
    render(<App />);
    expect(
      screen.getByText((_, element) => {
        return (
          element?.tagName.toLowerCase() === "h1" &&
          element.textContent === "Retr Arcade"
        );
      }),
    ).toBeInTheDocument();
  });
});
