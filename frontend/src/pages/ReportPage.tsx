import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { LOCATION_MESSAGE, useLocation } from "../hooks/useLocation";
import { SPEECH_LANGS, useSpeechInput } from "../hooks/useSpeechInput";
import { useAccount } from "../hooks/useAccount";
import { speechLangFor } from "../account";
import { takePhoto } from "../nativeCamera";
import { isNative } from "../platform";
import type { Analysis, Report } from "../types";
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
  const [photo, setPhotoState] = useState<File | null>(null);
  // Uploaded copy of `photo`, so analysing and sending don't upload twice.
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysedText, setAnalysedText] = useState("");
  const [analysing, setAnalysing] = useState(false);
  const [analyseError, setAnalyseError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();
  const hasText = text.trim().length > 0;
  // Text added after analysing means the AI should read it too, so the server re-analyses on send.
  const analysisStale = analysis !== null && text.trim() !== analysedText;

  function setPhoto(f: File | null) {
    setPhotoState(f);
    setPhotoUrl(null);
    setAnalysis(null);
    setAnalyseError(false);
  }

  async function ensureUploaded(): Promise<string | null> {
    if (!photo) return null;
    if (photoUrl) return photoUrl;
    const { photo_url } = await api.uploadPhoto(photo);
    setPhotoUrl(photo_url);
    return photo_url;
  }

  async function analyse() {
    setAnalysing(true);
    setAnalyseError(false);
    try {
      const [[lat, lng], url] = await Promise.all([location.locate(), ensureUploaded()]);
      const result = await api.analyse({ photo_url: url ?? "", text, lat, lng });
      setAnalysis(result);
      setAnalysedText(text.trim());
    } catch (err) {
      console.warn("[report] analyse failed", err);
      setAnalyseError(true);
    } finally {
      setAnalysing(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!photo && !hasText) {
      setError("Add a photo or a short description first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // fresh location fix for the report itself
      const [[lat, lng], photo_url] = await Promise.all([location.locate(), ensureUploaded()]);
      onCreated(await api.createReport({ photo_url, text, lat, lng, analysis_id: analysis?.analysis_id ?? null }));
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
        <p>Snap a photo of the steps, broken kerb or blocked path. Our AI describes it for you, and staff check it.</p>
      </header>

      <ol className="stepper" aria-label="Progress">
        <StepDot n={1} label="Photo" done={photo !== null} />
        <StepDot n={2} label="Details" done={analysis !== null || hasText} optional={photo !== null} />
        <StepDot n={3} label="Send" done={false} />
      </ol>

      <section className="card step" aria-labelledby="step-photo">
        <h2 id="step-photo">
          <span className="step-num" aria-hidden="true">1</span> Photo
        </h2>
        <PhotoPicker photo={photo} onPhoto={setPhoto} />
        {photo && (
          <div className="analyse" aria-live="polite">
            {analysis ? (
              <AnalysisCard analysis={analysis} stale={analysisStale} />
            ) : (
              <button type="button" className="primary big" onClick={analyse} disabled={analysing}>
                {analysing ? (
                  <>
                    <span className="spinner" aria-hidden="true" /> Looking at your photo…
                  </>
                ) : (
                  <>
                    <Icon name="sparkle" /> Analyse with AI
                  </>
                )}
              </button>
            )}
            {analyseError && (
              <p className="notice notice-warn" role="alert">
                The AI couldn't look at your photo right now. You can still send the report: staff will check the photo.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="card step" aria-labelledby="step-describe">
        <h2 id="step-describe">
          <span className="step-num" aria-hidden="true">2</span>{" "}
          {photo ? (
            <>
              Add details <span className="optional">(optional)</span>
            </>
          ) : (
            "What's the problem?"
          )}
        </h2>
        {photo && (
          <p className="hint step-hint">
            {analysis ? "Anything the AI missed? Add it here." : "Not needed with a photo, but it can help."}
          </p>
        )}
        <QuickPicks text={text} setText={setText} />
        <Describe text={text} setText={setText} required={!photo} />
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
        <button type="submit" className="primary big" disabled={submitting || analysing}>
          {submitting ? (
            <>
              <span className="spinner" aria-hidden="true" />{" "}
              {analysis && !analysisStale ? "Sending…" : "Reading your report…"}
            </>
          ) : (
            "Send report"
          )}
        </button>
      </div>
    </form>
  );
}

const CONFIDENCE_TEXT = { high: "AI is fairly sure", medium: "AI is somewhat sure", low: "AI is not sure" } as const;

/** What the AI thinks the photo shows. Always framed as a suggestion that staff will check. */
function AnalysisCard({ analysis, stale }: { analysis: Analysis; stale: boolean }) {
  const { ai, ai_source } = analysis;
  if (ai_source === "fallback") {
    return (
      <p className="notice notice-warn">
        We couldn't analyse the photo right now. Add a few words below if you can, or just send it. Staff will look at it.
      </p>
    );
  }
  return (
    <div className="ai-card ai-preview">
      <p className="ai-label">
        <Icon name="sparkle" size={18} /> AI suggestion{ai_source === "simulated" && " (sample, server offline)"}
      </p>
      {ai.is_accessibility_barrier ? (
        <p className="ai-category">
          {ai.category.replaceAll("_", " ")}{" "}
          <span className={`pill pill-${ai.severity}`}>{ai.severity} severity</span>
        </p>
      ) : (
        <p className="ai-category">Doesn't look like a barrier</p>
      )}
      <p>{ai.summary_en}</p>
      {ai.affects.length > 0 && (
        <p className="muted small-text">Affects: {ai.affects.map((a) => a.replaceAll("_", " ")).join(", ")}</p>
      )}
      <p className="muted small-text">{CONFIDENCE_TEXT[ai.confidence]}</p>
      {ai.privacy_flag && (
        <p className="hint">
          <Icon name="shield" size={16} /> It may show a face or number plate. Staff blur these before anyone else sees it.
        </p>
      )}
      {ai.possible_duplicate_of && (
        <p className="hint">
          <Icon name="info" size={16} /> Someone may have reported this already. Send it anyway: it helps staff prioritise.
        </p>
      )}
      {!ai.is_accessibility_barrier && (
        <p className="hint">
          <Icon name="info" size={16} /> If we got it wrong, say what the problem is below.
        </p>
      )}
      <p className="hint">
        <Icon name="info" size={16} />{" "}
        {stale ? "You added details, so the AI will read them too when you send." : "Staff confirm or correct this."}
      </p>
    </div>
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

  async function shoot() {
    setError(null);
    try {
      const file = await takePhoto();
      if (file) onPhoto(file);
    } catch {
      setError("Couldn't open the camera. Check the app's permissions in Settings.");
    }
  }

  if (preview) {
    return (
      <div className="photo-chosen">
        <img src={preview} alt="The photo you are about to send" />
        <button type="button" className="secondary" onClick={() => onPhoto(null)}>
          Retake photo
        </button>
      </div>
    );
  }

  return (
    <>
      {isNative ? (
        <button type="button" className="dropzone" onClick={shoot}>
          <span className="dropzone-icon">
            <Icon name="camera" size={34} />
          </span>
          Take a photo
        </button>
      ) : (
        <label className="dropzone">
          <span className="dropzone-icon">
            <Icon name="camera" size={34} />
          </span>
          Take a photo
          <input
            className="visually-hidden"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => onPhoto(e.target.files?.[0] ?? null)}
          />
        </label>
      )}
      <p className="hint">A photo is often enough: the AI can describe it for you. Avoid faces and number plates.</p>
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

function Describe({
  text,
  setText,
  required,
}: {
  text: string;
  setText: (fn: (prev: string) => string) => void;
  required: boolean;
}) {
  const { profile } = useAccount();
  const [speechLang, setSpeechLang] = useState<string>(speechLangFor(profile?.language) ?? SPEECH_LANGS[0].code);
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
        required={required}
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
