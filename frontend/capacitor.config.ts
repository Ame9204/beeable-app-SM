import type { CapacitorConfig } from "@capacitor/cli";

// Set CAP_LIVE_URL (e.g. http://192.168.1.20:5173) to load the dev server on the phone over Wi-Fi.
const liveUrl = process.env.CAP_LIVE_URL;

const config: CapacitorConfig = {
  appId: "com.beeable.app",
  appName: "BeeAble",
  webDir: "dist",
  // OSM's tile policy asks apps to identify themselves.
  appendUserAgent: "BeeAble/0.1 (UiTM Kedah pilot)",
  server: liveUrl ? { url: liveUrl, cleartext: true } : undefined,
};

export default config;
