// The one place that knows whether we run inside the Android app or a browser.
import { Capacitor } from "@capacitor/core";

export const isNative = Capacitor.isNativePlatform();
