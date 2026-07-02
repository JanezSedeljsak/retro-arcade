import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Layout } from "@/components/Layout";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Layout>
        <p>content</p>
      </Layout>
    </MemoryRouter>,
  );
}

describe("Layout", () => {
  it("renders its children", () => {
    renderAt("/");
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("shows the laser sweep on the home route", () => {
    const { container } = renderAt("/");
    expect(container.querySelector(".retro-laser")).not.toBeNull();
  });

  it("hides the laser sweep on other routes", () => {
    const { container } = renderAt("/games/pong");
    expect(container.querySelector(".retro-laser")).toBeNull();
  });
});
