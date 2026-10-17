import { useCallback, useRef, useState } from "react";

// Minimal typing for the Web Speech API (Chrome/Edge/Android ship it as webkitSpeechRecognition).
interface Recognition {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => Recognition;

const Ctor: RecognitionCtor | undefined =
  (window as unknown as { SpeechRecognition?: RecognitionCtor }).SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition;

export const SPEECH_LANGS = [
  { code: "ms-MY", label: "Bahasa Malaysia" },
  { code: "en-MY", label: "English" },
  { code: "cmn-Hans-CN", label: "中文" },
  { code: "ta-IN", label: "தமிழ்" },
] as const;

/** One-shot dictation; calls onText with the final transcript. */
export function useSpeechInput(onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);

  const start = useCallback(
    (lang: string) => {
      if (!Ctor) return;
      setError(null);
      const r = new Ctor();
      r.lang = lang;
      r.interimResults = false;
      r.onresult = (e) => onText(e.results[0][0].transcript);
      r.onerror = (e) => setError(e.error === "not-allowed" ? "Microphone permission was denied." : e.error);
      r.onend = () => setListening(false);
      rec.current = r;
      r.start();
      setListening(true);
    },
    [onText],
  );

  const stop = useCallback(() => rec.current?.stop(), []);

  return { supported: Boolean(Ctor), listening, error, start, stop };
}
