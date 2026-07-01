import { type ReactNode } from "react";

type LayoutProps = {
  children: ReactNode;
};

export function Layout({ children }: LayoutProps) {
  return (
    <div className="retro-layout">
      <div className="retro-bezel">
        <div className="retro-screen">
          <div className="retro-glow" />
          <div className="retro-grid" />
          <div className="retro-content">{children}</div>
        </div>
      </div>
    </div>
  );
}
