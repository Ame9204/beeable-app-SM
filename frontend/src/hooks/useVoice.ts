import { useCallback, useEffect, useState } from "react";

const MUTE_KEY = "beeable.voiceMuted";
const supported = typeof window !== "undefined" && "speechSynthesis" in window;

/** Spoken directions with the device's built-in voice. Mute is remembered on this device. */
export function useVoice() {
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      return false;
    }
  });

  const say = useCallback(
    (text: string) => {
      if (!supported || muted) return;
      window.speechSynthesis.cancel(); // newest instruction wins
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-GB";
      u.rate = 1;
      window.speechSynthesis.speak(u);
    },
    [muted],
  );

  function toggle() {
    setMuted((m) => {
      try {
        localStorage.setItem(MUTE_KEY, m ? "0" : "1");
      } catch {
        /* not essential */
      }
      if (!m && supported) window.speechSynthesis.cancel();
      return !m;
    });
  }

  useEffect(() => () => {
    if (supported) window.speechSynthesis.cancel();
  }, []);

  return { say, muted, toggle, supported };
}
