import { type ReactNode } from "react";
import { useLocation } from "react-router-dom";

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
          {isHome && (
            <div className="retro-laser">
              <div className="retro-laser-origin retro-laser-origin-top">
                <div className="retro-laser-layer retro-laser-layer-1" />
                <div className="retro-laser-layer retro-laser-layer-2" />
              </div>
              <div className="retro-laser-origin retro-laser-origin-bottom">
                <div className="retro-laser-layer retro-laser-layer-1" />
                <div className="retro-laser-layer retro-laser-layer-2" />
              </div>
            </div>
          )}
          <div className="retro-grid" />
          <div className="retro-content">{children}</div>
        </div>
      </div>
    </div>
  );
}
