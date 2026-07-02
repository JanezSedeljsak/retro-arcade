import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "@/App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Wake the Supabase free-tier container as soon as the app opens. The
// dynamic import keeps supabase-js out of the initial bundle (it loads
// alongside/after the app shell instead of blocking it).
void import("@/lib/supabase").then(({ pingSupabase }) => pingSupabase());
