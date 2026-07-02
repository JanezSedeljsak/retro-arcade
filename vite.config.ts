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
        // Tab icon is favicon.ico (linked in index.html); the manifest
        // wants real PNG sizes for install/home-screen icons.
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
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
