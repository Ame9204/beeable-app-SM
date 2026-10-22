import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  // The destination list is built by the backend tools into ../data/processed/places.json and bundled here.
  server: { fs: { allow: [".", "../data/processed"] } },
  plugins: [
    react(),
    VitePWA({
      // The Android app ships its files locally; a service worker there only causes stale builds.
      disable: mode === "android",
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "apple-touch-icon.png", "logo.png"],
      manifest: {
        name: "BeeAble",
        short_name: "BeeAble",
        description: "Step-free and easy-walking routes, and barrier reporting for your township.",
        theme_color: "#FFFBF0",
        background_color: "#FFFBF0",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            // cache viewed OSM tiles so the precinct map survives patchy signal
            urlPattern: /^https:\/\/tile\.openstreetmap\.org\/.*/,
            handler: "CacheFirst",
            options: {
              cacheName: "osm-tiles",
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 14 },
            },
          },
        ],
      },
    }),
  ],
}));
