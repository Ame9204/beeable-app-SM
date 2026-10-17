import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    VitePWA({
      // The Android app ships its files locally; a service worker there only causes stale builds.
      disable: mode === "android",
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "BeeAble",
        short_name: "BeeAble",
        description: "Step-free and easy-walking routes, and barrier reporting for your township.",
        theme_color: "#1f3a5f",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [{ src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
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
