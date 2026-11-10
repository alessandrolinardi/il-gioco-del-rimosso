import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Su GitHub Pages l'app vive in /<nome-repo>/: la GitHub Action passa BASE_PATH.
  base: process.env.BASE_PATH ?? "/",
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      // Le icone e i link nell'<head> nascono da pwa-assets.config.ts.
      pwaAssets: { config: true, overrideManifestIcons: true, injectThemeColor: false },
      manifest: {
        name: "Il Gioco del Rimosso",
        short_name: "Rimosso",
        description:
          "Il gioco delle parole proibite della psicoanalisi: 100 carte su concetti, autori e meccanismi di difesa, con partita a squadre, regolamento e soluzioni commentate.",
        lang: "it",
        display: "standalone",
        background_color: "#e9ecf1",
        theme_color: "#40367f",
        categories: ["games", "education"],
      },
      workbox: {
        // Tutto in cache al primo avvio, font compresi: poi il gioco funziona offline.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        navigateFallback: "index.html",
      },
    }),
  ],
  test: {
    environment: "node",
  },
});
