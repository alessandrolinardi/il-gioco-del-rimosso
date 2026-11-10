import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

// Icone generate a ogni build da public/icon.svg (favicon, 64/192/512 px, maskable, Apple).
const background = "#1b2130";

export default defineConfig({
  headLinkOptions: { preset: "2023" },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0.15, resizeOptions: { background } },
    apple: { ...minimal2023Preset.apple, padding: 0.2, resizeOptions: { background } },
  },
  images: ["public/icon.svg"],
});
