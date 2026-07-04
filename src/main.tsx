import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "@/App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Wake the Supabase free-tier container once the browser is idle, so the
// warmup ping (and the supabase-js chunk it pulls in) doesn't compete with
// the initial page load for bandwidth/main-thread time. Falls back to a
// short timeout on browsers without requestIdleCallback (e.g. Safari).
function pingSupabaseWhenIdle() {
  void import("@/lib/supabase").then(({ pingSupabase }) => pingSupabase());
}

if ("requestIdleCallback" in window) {
  requestIdleCallback(pingSupabaseWhenIdle);
} else {
  setTimeout(pingSupabaseWhenIdle, 1);
}
