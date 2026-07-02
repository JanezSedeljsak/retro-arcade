import { type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import "./Layout.css";

type LayoutProps = {
  children: ReactNode;
};

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <div className="retro-layout">
      <div className="retro-bezel">
        <div className="retro-screen">
          <div className="retro-glow" />
          {isHome && <div className="retro-laser" />}
          <div className="retro-grid" />
          <div className="retro-content">{children}</div>
        </div>
      </div>
    </div>
  );
}
