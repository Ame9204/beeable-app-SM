import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { MapView } from "../components/MapView";
import { RouteLegend } from "../components/RouteLegend";
import { DESTINATIONS, PROFILES } from "../config";
import { LOCATION_MESSAGE, useLocation } from "../hooks/useLocation";
import { useReports } from "../hooks/useReports";
import { useRoute } from "../hooks/useRoute";
import { SPEECH_LANGS, useSpeechInput } from "../hooks/useSpeechInput";
import { pickPhoto } from "../nativeCamera";
import { isNative } from "../platform";
import type { Profile, Report } from "../types";

type Locator = ReturnType<typeof useLocation>;

export function ResidentApp() {
  const [profile, setProfile] = useState<Profile>("step_free");
  const [destId, setDestId] = useState<string>("");
  const dest = DESTINATIONS.find((d) => d.id === destId);
  const to: [number, number] | null = dest ? [dest.lat, dest.lng] : null;
  const location = useLocation();
  const { route, loading, error, version } = useRoute(location.position, to, profile);
  const { reports, refresh } = useReports();

  function chooseDestination(id: string) {
    setDestId(id);
    // Ask for location the first time it's needed, not on app start.
    if (id && location.status !== "ok") location.locate();
  }

  return (
    <div className="layout">
      <section className="panel" aria-labelledby="nav-heading">
        <h1 id="nav-heading">Plan a walk</h1>

        <fieldset>
          <legend>Your walking profile</legend>
          {PROFILES.map((p) => (
            <label key={p.id} className="choice">
              <input
                type="radio"
                name="profile"
                value={p.id}
                checked={profile === p.id}
                onChange={() => setProfile(p.id)}
              />
              <span>
                <strong>{p.label}</strong> — {p.hint}
              </span>
            </label>
          ))}
        </fieldset>

        <label htmlFor="dest">Where to?</label>
        <select id="dest" value={destId} onChange={(e) => chooseDestination(e.target.value)}>
          <option value="">Choose a destination</option>
          {DESTINATIONS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <div aria-live="polite">
          {destId && location.status !== "idle" && <p className="muted">{LOCATION_MESSAGE[location.status]}</p>}
          {loading && <p>Finding a route…</p>}
          {error && <p role="alert">Could not load a route: {error}</p>}
          {route && !loading && (
            <>
              {/* Never call a route "accessible" — see CLAUDE.md */}
              <p className="summary">
                No known barriers for your profile on the BeeAble route.{" "}
                {Math.round(route.surveyed_share * 100)}% of it has been surveyed.
              </p>
              <details open>
                <summary>Why this route?</summary>
                <ul>
                  {route.explanation.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </details>
            </>
          )}
        </div>

        <RouteLegend />
        <ReportForm onCreated={refresh} location={location} />
      </section>

      <MapView
        route={route}
        reports={reports}
        origin={location.position}
        destination={to}
        routeKey={String(version)}
      />
    </div>
  );
}

function ReportForm({ onCreated, location }: { onCreated: () => void; location: Locator }) {
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [speechLang, setSpeechLang] = useState<string>(SPEECH_LANGS[0].code);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Report | null>(null);
  const appendText = useCallback((t: string) => setText((prev) => (prev ? `${prev} ${t}` : t)), []);
  const speech = useSpeechInput(appendText);

  useEffect(() => {
    if (!photo) return setPreview(null);
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const [lat, lng] = await location.locate(); // fresh fix for the report itself
      const { photo_url } = photo ? await api.uploadPhoto(photo) : { photo_url: null };
      const report = await api.createReport({ photo_url, text, lat, lng });
      setCreated(report);
      setText("");
      setPhoto(null);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} aria-labelledby="report-heading" className="report-form">
      <h2 id="report-heading">Report a barrier</h2>
      {isNative ? (
        <NativePhotoButtons onPhoto={setPhoto} />
      ) : (
        <>
          <label htmlFor="photo">Photo</label>
          <input
            id="photo"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          />
        </>
      )}
      {preview && <img src={preview} alt="Preview of the photo you are about to send" className="photo-preview" />}

      <label htmlFor="desc">What's the problem? (BM, English, 中文, தமிழ்)</label>
      <textarea id="desc" value={text} onChange={(e) => setText(e.target.value)} rows={3} required />

      {speech.supported && (
        <div className="voice">
          <label htmlFor="speech-lang">Speak in</label>
          <select id="speech-lang" value={speechLang} onChange={(e) => setSpeechLang(e.target.value)}>
            {SPEECH_LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="secondary"
            aria-pressed={speech.listening}
            onClick={() => (speech.listening ? speech.stop() : speech.start(speechLang))}
          >
            {speech.listening ? "■ Stop listening" : "🎤 Speak instead of typing"}
          </button>
          {speech.error && <p role="alert">Voice input: {speech.error}</p>}
        </div>
      )}

      <button type="submit" disabled={submitting}>
        {submitting ? "Reading your report…" : "Send report"}
      </button>
      <div aria-live="polite">
        {submitting && location.status !== "idle" && <p className="muted">{LOCATION_MESSAGE[location.status]}</p>}
        {error && <p role="alert">Could not send the report: {error}</p>}
        {created && <Ticket report={created} />}
      </div>
    </form>
  );
}

function NativePhotoButtons({ onPhoto }: { onPhoto: (f: File) => void }) {
  const [error, setError] = useState<string | null>(null);
  async function pick(source: "camera" | "gallery") {
    setError(null);
    try {
      const file = await pickPhoto(source);
      if (file) onPhoto(file);
    } catch {
      setError("Couldn't open the camera or gallery. Check the app's permissions in Settings.");
    }
  }
  return (
    <fieldset className="photo-buttons">
      <legend>Photo</legend>
      <button type="button" onClick={() => pick("camera")}>
        📷 Take photo
      </button>
      <button type="button" className="secondary" onClick={() => pick("gallery")}>
        🖼 Choose from gallery
      </button>
      {error && <p role="alert">{error}</p>}
    </fieldset>
  );
}

function Ticket({ report }: { report: Report }) {
  const fallback = report.ai_source === "fallback";
  return (
    <div className="ticket">
      <p>
        Thank you. Reference <strong>{report.reference_number}</strong>. Status: <strong>Unverified</strong> until
        staff check it.
      </p>
      {fallback ? (
        <p>We couldn't categorise it automatically — staff will review it.</p>
      ) : (
        <p>
          Suggested: <strong>{report.ai.category.replaceAll("_", " ")}</strong> ({report.ai.severity} severity).{" "}
          {report.ai.summary_en}
        </p>
      )}
    </div>
  );
}
