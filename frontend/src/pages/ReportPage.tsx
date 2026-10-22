import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { CATEGORIES } from "../config";
import { useLocation } from "../hooks/useLocation";
import { useT, type TKey } from "../i18n";
import { takePhoto } from "../nativeCamera";
import { isNative } from "../platform";
import type { AISuggestion, Analysis, Report } from "../types";
import { Icon } from "../components/Icon";

// Tap-to-add starters for the description, in the app language. They only add text; the AI decides the category.
const QUICK_PICKS = ["kerb", "steps", "blocked", "paving", "slope", "crossing"] as const;

function toggleSnippet(text: string, snippet: string): string {
  if (text.includes(snippet)) return text.replace(snippet, "").replace(/\s{2,}/g, " ").trim();
  return text.trim() ? `${text.trim()} ${snippet}` : snippet;
}

/** "High kerb" / "Kerb tinggi"; categories the app doesn't know are shown as the AI sent them. */
function useCategoryLabel() {
  const { t } = useT();
  return (id: string) => (CATEGORIES.some((c) => c.id === id) ? t(`cat.${id}` as TKey) : id.replaceAll("_", " "));
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
  const { t } = useT();
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
      setError(t("report.needPhotoOrText"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // fresh location fix for the report itself
      const [[lat, lng], photo_url] = await Promise.all([location.locate(), ensureUploaded()]);
      onCreated(await api.createReport({ photo_url, text, lat, lng, analysis_id: analysis?.analysis_id ?? null }));
    } catch (err) {
      setError(t("report.couldNotSend", { error: err instanceof Error ? err.message : t("report.wentWrong") }));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} aria-labelledby="report-heading" className="report">
      <header className="page-header">
        <h1 id="report-heading">{t("report.title")}</h1>
        <p>{t("report.lead")}</p>
      </header>

      <ol className="stepper" aria-label={t("setup.progress")}>
        <StepDot n={1} label={t("report.stepPhoto")} done={photo !== null} />
        <StepDot n={2} label={t("report.stepDetails")} done={analysis !== null || hasText} optional={photo !== null} />
        <StepDot n={3} label={t("report.stepSend")} done={false} />
      </ol>

      <section className="card step" aria-labelledby="step-photo">
        <h2 id="step-photo">
          <span className="step-num" aria-hidden="true">1</span> {t("report.stepPhoto")}
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
                    <span className="spinner" aria-hidden="true" /> {t("report.analysing")}
                  </>
                ) : (
                  <>
                    <Icon name="sparkle" /> {t("report.analyse")}
                  </>
                )}
              </button>
            )}
            {analyseError && (
              <p className="notice notice-warn" role="alert">
                {t("report.analyseFailed")}
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
              {t("report.addDetails")} <span className="optional">{t("setup.optional")}</span>
            </>
          ) : (
            t("report.whatsProblem")
          )}
        </h2>
        {photo && <p className="hint step-hint">{t(analysis ? "report.missed" : "report.notNeeded")}</p>}
        <QuickPicks text={text} setText={setText} />
        <Describe text={text} setText={setText} required={!photo} />
      </section>

      <section className="card step" aria-labelledby="step-location">
        <h2 id="step-location">
          <span className="step-num" aria-hidden="true">3</span> {t("report.stepLocation")}
        </h2>
        <div className="location-line">
          <span className="location-icon">
            <Icon name="pin" size={20} />
          </span>
          <p>{location.status === "idle" ? t("report.locationIdle") : t(`loc.${location.status}`)}</p>
          {(location.status === "unavailable" || location.status === "off_campus") && (
            <button type="button" className="secondary small" onClick={() => location.locate()}>
              <Icon name="refresh" size={18} /> {t("nav.tryAgain")}
            </button>
          )}
        </div>
      </section>

      <div className="submit-bar">
        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="primary big" disabled={submitting || analysing}>
          {submitting ? (
            <>
              <span className="spinner" aria-hidden="true" />{" "}
              {t(analysis && !analysisStale ? "report.sending" : "report.reading")}
            </>
          ) : (
            t("report.send")
          )}
        </button>
      </div>
    </form>
  );
}

/** Category + severity line for an AI answer. */
function CategoryLine({ ai }: { ai: AISuggestion }) {
  const { t } = useT();
  const label = useCategoryLabel();
  return (
    <p className="ai-category">
      {label(ai.category)} <span className={`pill pill-${ai.severity}`}>{t("report.severity", { s: t(`sev.${ai.severity}`) })}</span>
    </p>
  );
}

/** The AI's summary is written in English; say so when the app is in Malay. */
function Summary({ text }: { text: string }) {
  const { t, lang } = useT();
  return (
    <p>
      {lang === "ms" && <span className="muted small-text summary-note">{t("report.summaryEnglish")} </span>}
      <span lang="en">{text}</span>
    </p>
  );
}

/** What the AI thinks the photo shows, before sending. */
function AnalysisCard({ analysis, stale }: { analysis: Analysis; stale: boolean }) {
  const { t } = useT();
  const { ai, ai_source } = analysis;
  if (ai_source === "fallback") {
    return <p className="notice notice-warn">{t("report.aiFallback")}</p>;
  }
  const barrier = ai.is_accessibility_barrier && ai.category !== "not_a_barrier";
  return (
    <div className="ai-card ai-preview">
      <p className="ai-label">
        <Icon name="sparkle" size={18} /> {t("report.aiSuggestion")}
        {ai_source === "simulated" && t("report.sampleOffline")}
      </p>
      {barrier ? <CategoryLine ai={ai} /> : <p className="ai-category">{t("report.notBarrier")}</p>}
      <Summary text={ai.summary_en} />
      {ai.affects.length > 0 && (
        <p className="muted small-text">
          {t("report.affects", { list: ai.affects.map((a) => t(`affect.${a}` as TKey)).join(", ") })}
        </p>
      )}
      <p className="muted small-text">{t(`report.conf.${ai.confidence}`)}</p>
      {ai.privacy_flag && (
        <p className="hint">
          <Icon name="shield" size={16} /> {t("report.privacy")}
        </p>
      )}
      {ai.possible_duplicate_of && (
        <p className="hint">
          <Icon name="info" size={16} /> {t("report.duplicate")}
        </p>
      )}
      {!barrier && (
        <p className="hint">
          <Icon name="info" size={16} /> {t("report.gotWrong")} {!stale && t("report.willAutoReject")}
        </p>
      )}
      <p className="hint">
        <Icon name="info" size={16} /> {t(stale ? "report.stale" : "report.willConfirm")}
      </p>
    </div>
  );
}

function PhotoPicker({ photo, onPhoto }: { photo: File | null; onPhoto: (f: File | null) => void }) {
  const { t } = useT();
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
      setError(t("report.cameraError"));
    }
  }

  if (preview) {
    return (
      <div className="photo-chosen">
        <img src={preview} alt={t("report.previewAlt")} />
        <button type="button" className="secondary" onClick={() => onPhoto(null)}>
          {t("report.retake")}
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
          {t("report.take")}
        </button>
      ) : (
        <label className="dropzone">
          <span className="dropzone-icon">
            <Icon name="camera" size={34} />
          </span>
          {t("report.take")}
          <input
            className="visually-hidden"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => onPhoto(e.target.files?.[0] ?? null)}
          />
        </label>
      )}
      <p className="hint">{t("report.photoHint")}</p>
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
  const { t } = useT();
  return (
    <>
      <label htmlFor="desc" className="visually-hidden">
        {t("report.describe")}
      </label>
      <textarea
        id="desc"
        value={text}
        onChange={(e) => setText(() => e.target.value)}
        rows={4}
        required={required}
        placeholder={t("report.placeholder")}
      />
      <p className="hint">{t("report.langHint")}</p>
    </>
  );
}

function Submitted({ report, onAnother }: { report: Report; onAnother: () => void }) {
  const { t } = useT();
  const fallback = report.ai_source === "fallback";
  const confirmed = report.status === "verified";
  const autoRejected = report.status === "rejected" && report.rejected_by === "ai";
  const [copied, setCopied] = useState(false);

  async function copyRef() {
    try {
      await navigator.clipboard.writeText(report.reference_number);
      setCopied(true);
    } catch {
      /* clipboard blocked; the number is on screen anyway */
    }
  }

  const first = confirmed
    ? { strong: t("sent.sentConfirmed"), rest: t("sent.confirmedRest") }
    : { strong: t("sent.sent"), rest: t(autoRejected ? "sent.rejectedRest" : "sent.unverifiedRest") };
  const second = confirmed
    ? { strong: t("sent.staffFix"), rest: t("sent.staffFixRest") }
    : autoRejected
      ? { strong: t("sent.staffReopen"), rest: t("sent.staffReopenRest") }
      : { strong: t("sent.staffCheck"), rest: t("sent.staffCheckRest") };

  return (
    <section className="submitted" aria-labelledby="sent-heading" aria-live="polite">
      <div className="success-mark">
        <Icon name="check" size={40} />
      </div>
      <h1 id="sent-heading">{t("sent.thanks")}</h1>
      <p className="ref">
        {t("sent.yourRef")}{" "}
        <button type="button" className="ref-chip" onClick={copyRef}>
          <strong>{report.reference_number}</strong> <Icon name="copy" size={16} />
          <span className="visually-hidden">{t("sent.copyRef")}</span>
        </button>
      </p>
      <p className="hint" role="status">
        {copied ? t("sent.copied") : ""}
      </p>

      <ol className="timeline" aria-label={t("sent.next")}>
        <li className="done">
          <span className="tl-dot">
            <Icon name="check" size={16} />
          </span>
          <span>
            <strong>{first.strong}</strong>
            {first.rest}
          </span>
        </li>
        <li>
          <span className="tl-dot">2</span>
          <span>
            <strong>{second.strong}</strong>
            {second.rest}
          </span>
        </li>
        {!autoRejected && (
          <li>
            <span className="tl-dot">3</span>
            <span>
              <strong>{t("sent.fixed")}</strong>
              {t("sent.fixedRest")}
            </span>
          </li>
        )}
      </ol>

      <div className="card ai-card">
        <h2>{t(fallback ? "sent.waiting" : "sent.whatWeThink")}</h2>
        {fallback ? (
          <p>{t("sent.couldntCategorise")}</p>
        ) : (
          <>
            {autoRejected ? <p className="ai-category">{t("report.notBarrier")}</p> : <CategoryLine ai={report.ai} />}
            <Summary text={report.ai.summary_en} />
            <p className="hint">
              <Icon name="info" size={16} />{" "}
              {t(confirmed ? "sent.aiConfirmed" : autoRejected ? "sent.aiRejected" : "sent.aiSuggestion")}
            </p>
          </>
        )}
      </div>

      <div className="button-row">
        <Link to="/" className="button primary">
          <Icon name="map" /> {t("sent.seeMap")}
        </Link>
        <button type="button" className="secondary" onClick={onAnother}>
          {t("sent.another")}
        </button>
      </div>
    </section>
  );
}

function StepDot({ n, label, done, optional = false }: { n: number; label: string; done: boolean; optional?: boolean }) {
  const { t } = useT();
  return (
    <li className={done ? "done" : undefined}>
      <span className="stepper-dot">{done ? <Icon name="check" size={16} /> : n}</span>
      <span>
        {label}
        {optional && <span className="visually-hidden">{t("report.optionalSr")}</span>}
        {done && <span className="visually-hidden">{t("setup.done")}</span>}
      </span>
    </li>
  );
}

function QuickPicks({ text, setText }: { text: string; setText: (fn: (prev: string) => string) => void }) {
  const { t } = useT();
  return (
    <div className="quick-picks" role="group" aria-label={t("report.quickGroup")}>
      {QUICK_PICKS.map((q) => {
        const snippet = t(`quick.${q}.text`);
        const added = text.includes(snippet);
        return (
          <button
            key={q}
            type="button"
            className="quick"
            aria-pressed={added}
            onClick={() => setText((prev) => toggleSnippet(prev, snippet))}
          >
            {added && <Icon name="check" size={16} />} {t(`quick.${q}.label`)}
          </button>
        );
      })}
    </div>
  );
}
