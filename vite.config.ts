import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { qrcode } from "vite-plugin-qrcode";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  base: "/retro-arcade/",
  plugins: [
    react(),
    // Dev-only: prints a scannable QR of the network URL on startup.
    qrcode(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Retro Arcade",
        short_name: "Retro Arcade",
        description:
          "Play classic retro-inspired arcade games directly in your browser.",
        theme_color: "#121226",
        background_color: "#080812",
        display: "standalone",
        start_url: "/retro-arcade/",
        scope: "/retro-arcade/",
        icons: [
          {
            src: "favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/setupTests.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
