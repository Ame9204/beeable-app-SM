import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { LOCATION_MESSAGE, useLocation } from "../hooks/useLocation";
import { SPEECH_LANGS, useSpeechInput } from "../hooks/useSpeechInput";
import { pickPhoto } from "../nativeCamera";
import { isNative } from "../platform";
import type { Report } from "../types";
import { Icon } from "../components/Icon";

// Tap-to-add starters for the description. They only add text; the AI (then staff) decide the category.
const QUICK_PICKS = [
  { label: "Broken kerb", text: "Broken kerb." },
  { label: "Steps, no ramp", text: "Steps with no ramp." },
  { label: "Path blocked", text: "Something is blocking the path." },
  { label: "Broken paving", text: "Broken or uneven paving." },
  { label: "Steep slope", text: "Very steep slope." },
  { label: "No safe crossing", text: "No safe place to cross." },
];

function toggleSnippet(text: string, snippet: string): string {
  if (text.includes(snippet)) return text.replace(snippet, "").replace(/\s{2,}/g, " ").trim();
  return text.trim() ? `${text.trim()} ${snippet}` : snippet;
}

export function ReportPage() {
  const [created, setCreated] = useState<Report | null>(null);
  return (
    <div className="page">
      {created ? <Submitted report={created} onAnother={() => setCreated(null)} /> : <ReportForm onCreated={setCreated} />}
    </div>
  );
}

function ReportForm({ onCreated }: { onCreated: (r: Report) => void }) {
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const [lat, lng] = await location.locate(); // fresh fix for the report itself
      const { photo_url } = photo ? await api.uploadPhoto(photo) : { photo_url: null };
      onCreated(await api.createReport({ photo_url, text, lat, lng }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} aria-labelledby="report-heading" className="report">
      <header className="page-header">
        <h1 id="report-heading">Report a barrier</h1>
        <p>Spotted steps, a broken kerb or something blocking the path? Tell us and staff will check it.</p>
      </header>

      <ol className="stepper" aria-label="Progress">
        <StepDot n={1} label="Photo" done={photo !== null} optional />
        <StepDot n={2} label="Describe" done={text.trim().length > 0} />
        <StepDot n={3} label="Send" done={false} />
      </ol>

      <section className="card step" aria-labelledby="step-photo">
        <h2 id="step-photo">
          <span className="step-num" aria-hidden="true">1</span> Photo
        </h2>
        <PhotoPicker photo={photo} onPhoto={setPhoto} />
      </section>

      <section className="card step" aria-labelledby="step-describe">
        <h2 id="step-describe">
          <span className="step-num" aria-hidden="true">2</span> What's the problem?
        </h2>
        <QuickPicks text={text} setText={setText} />
        <Describe text={text} setText={setText} />
      </section>

      <section className="card step" aria-labelledby="step-location">
        <h2 id="step-location">
          <span className="step-num" aria-hidden="true">3</span> Location
        </h2>
        <div className="location-line">
          <span className="location-icon">
            <Icon name="pin" size={20} />
          </span>
          <p>
            {location.status === "idle"
              ? "We'll use your current location when you send. Stand near the problem if you can."
              : LOCATION_MESSAGE[location.status]}
          </p>
          {(location.status === "unavailable" || location.status === "off_campus") && (
            <button type="button" className="secondary small" onClick={() => location.locate()}>
              <Icon name="refresh" size={18} /> Try again
            </button>
          )}
        </div>
      </section>

      <div className="submit-bar">
        {error && (
          <p className="notice notice-error" role="alert">
            Could not send the report: {error}
          </p>
        )}
        <button type="submit" className="primary big" disabled={submitting}>
          {submitting ? (
            <>
              <span className="spinner" aria-hidden="true" /> Reading your report…
            </>
          ) : (
            "Send report"
          )}
        </button>
      </div>
    </form>
  );
}

function PhotoPicker({ photo, onPhoto }: { photo: File | null; onPhoto: (f: File | null) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!photo) return setPreview(null);
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  async function pick(source: "camera" | "gallery") {
    setError(null);
    try {
      const file = await pickPhoto(source);
      if (file) onPhoto(file);
    } catch {
      setError("Couldn't open the camera or gallery. Check the app's permissions in Settings.");
    }
  }

  if (preview) {
    return (
      <div className="photo-chosen">
        <img src={preview} alt="The photo you are about to send" />
        <button type="button" className="secondary" onClick={() => onPhoto(null)}>
          Change photo
        </button>
      </div>
    );
  }

  return (
    <>
      {isNative ? (
        <div className="photo-actions">
          <button type="button" className="dropzone" onClick={() => pick("camera")}>
            <span className="dropzone-icon">
              <Icon name="camera" size={34} />
            </span>
            Take a photo
          </button>
          <button type="button" className="secondary" onClick={() => pick("gallery")}>
            <Icon name="image" /> Choose from gallery
          </button>
        </div>
      ) : (
        <label className="dropzone">
          <span className="dropzone-icon">
            <Icon name="camera" size={34} />
          </span>
          Take or choose a photo
          <input
            className="visually-hidden"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => onPhoto(e.target.files?.[0] ?? null)}
          />
        </label>
      )}
      <p className="hint">Optional, but it helps staff a lot. Avoid faces and number plates.</p>
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

function Describe({ text, setText }: { text: string; setText: (fn: (prev: string) => string) => void }) {
  const [speechLang, setSpeechLang] = useState<string>(SPEECH_LANGS[0].code);
  const appendText = useCallback((t: string) => setText((prev) => (prev ? `${prev} ${t}` : t)), [setText]);
  const speech = useSpeechInput(appendText);

  return (
    <>
      <label htmlFor="desc" className="visually-hidden">
        Describe the problem
      </label>
      <textarea
        id="desc"
        value={text}
        onChange={(e) => setText(() => e.target.value)}
        rows={4}
        required
        placeholder="e.g. Kerb tepi jalan pecah, susah untuk kerusi roda"
      />
      <p className="hint">Bahasa Malaysia, English, 中文 or தமிழ் are all fine.</p>
      {speech.supported && (
        <div className="voice-row">
          <label htmlFor="speech-lang" className="visually-hidden">
            Language to speak in
          </label>
          <select id="speech-lang" value={speechLang} onChange={(e) => setSpeechLang(e.target.value)}>
            {SPEECH_LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={speech.listening ? "primary mic listening" : "secondary mic"}
            aria-pressed={speech.listening}
            onClick={() => (speech.listening ? speech.stop() : speech.start(speechLang))}
          >
            {speech.listening ? (
              <>
                <Icon name="stop" size={18} /> Listening… tap to stop
              </>
            ) : (
              <>
                <Icon name="mic" size={20} /> Speak
              </>
            )}
          </button>
        </div>
      )}
      {speech.error && (
        <p className="notice notice-error" role="alert">
          Voice input: {speech.error}
        </p>
      )}
    </>
  );
}

function Submitted({ report, onAnother }: { report: Report; onAnother: () => void }) {
  const fallback = report.ai_source === "fallback";
  const [copied, setCopied] = useState(false);

  async function copyRef() {
    try {
      await navigator.clipboard.writeText(report.reference_number);
      setCopied(true);
    } catch {
      /* clipboard blocked; the number is on screen anyway */
    }
  }

  return (
    <section className="submitted" aria-labelledby="sent-heading" aria-live="polite">
      <div className="success-mark">
        <Icon name="check" size={40} />
      </div>
      <h1 id="sent-heading">Thanks, your report is in</h1>
      <p className="ref">
        Your reference{" "}
        <button type="button" className="ref-chip" onClick={copyRef}>
          <strong>{report.reference_number}</strong> <Icon name="copy" size={16} />
          <span className="visually-hidden">Copy reference number</span>
        </button>
      </p>
      <p className="hint" role="status">
        {copied ? "Copied." : ""}
      </p>

      <ol className="timeline" aria-label="What happens next">
        <li className="done">
          <span className="tl-dot">
            <Icon name="check" size={16} />
          </span>
          <span>
            <strong>Sent</strong> — shown as <em>Unverified</em> on the map
          </span>
        </li>
        <li>
          <span className="tl-dot">2</span>
          <span>
            <strong>Staff check it</strong> and confirm or correct the details
          </span>
        </li>
        <li>
          <span className="tl-dot">3</span>
          <span>
            <strong>Fixed</strong> — routes update for everyone
          </span>
        </li>
      </ol>

      <div className="card ai-card">
        <h2>{fallback ? "Waiting for staff" : "What we think it is"}</h2>
        {fallback ? (
          <p>We couldn't categorise it automatically. Staff will review it.</p>
        ) : (
          <>
            <p className="ai-category">
              {report.ai.category.replaceAll("_", " ")}{" "}
              <span className={`pill pill-${report.ai.severity}`}>{report.ai.severity} severity</span>
            </p>
            <p>{report.ai.summary_en}</p>
            <p className="hint">
              <Icon name="info" size={16} /> This is an AI suggestion. Staff confirm or correct it.
            </p>
          </>
        )}
      </div>

      <div className="button-row">
        <Link to="/" className="button primary">
          <Icon name="map" /> See the map
        </Link>
        <button type="button" className="secondary" onClick={onAnother}>
          Report another
        </button>
      </div>
    </section>
  );
}

function StepDot({ n, label, done, optional = false }: { n: number; label: string; done: boolean; optional?: boolean }) {
  return (
    <li className={done ? "done" : undefined}>
      <span className="stepper-dot">{done ? <Icon name="check" size={16} /> : n}</span>
      <span>
        {label}
        {optional && <span className="visually-hidden"> (optional)</span>}
        {done && <span className="visually-hidden"> — done</span>}
      </span>
    </li>
  );
}

function QuickPicks({ text, setText }: { text: string; setText: (fn: (prev: string) => string) => void }) {
  return (
    <div className="quick-picks" role="group" aria-label="Quick add a common problem">
      {QUICK_PICKS.map((q) => {
        const added = text.includes(q.text);
        return (
          <button
            key={q.label}
            type="button"
            className="quick"
            aria-pressed={added}
            onClick={() => setText((prev) => toggleSnippet(prev, q.text))}
          >
            {added && <Icon name="check" size={16} />} {q.label}
          </button>
        );
      })}
    </div>
  );
}
