import { Link, useNavigate } from "react-router-dom";
import { LANGUAGES, continueAsGuest, setLanguage } from "../account";
import { Icon, Logo, type IconName } from "../components/Icon";
import { useFocusHeading } from "../hooks/useFocusHeading";
import { useT, type TKey } from "../i18n";

const POINTS: { icon: IconName; title: TKey; text: TKey }[] = [
  { icon: "route", title: "landing.p1.title", text: "landing.p1.text" },
  { icon: "camera", title: "landing.p2.title", text: "landing.p2.text" },
  { icon: "check", title: "landing.p3.title", text: "landing.p3.text" },
];

export function Landing() {
  const heading = useFocusHeading();
  const navigate = useNavigate();
  const { t, lang } = useT();

  function guest() {
    continueAsGuest();
    navigate("/setup");
  }

  return (
    <div className="onboard landing">
      {/* No profile yet, so the language is picked here; the profile's choice takes over later. */}
      <div className="lang-switch" role="group" aria-label={t("landing.language")}>
        {LANGUAGES.map((l) => (
          <button
            key={l.id}
            type="button"
            lang={l.id}
            className={lang === l.id ? "lang-option active" : "lang-option"}
            aria-pressed={lang === l.id}
            onClick={() => setLanguage(l.id)}
          >
            {l.id === "ms" ? "BM" : "EN"}
            <span className="visually-hidden"> — {l.label}</span>
          </button>
        ))}
      </div>

      <div className="onboard-hero">
        <Logo size={64} />
        <p className="onboard-brand">BeeAble</p>
        <h1 ref={heading} tabIndex={-1}>
          {t("landing.heading")}
        </h1>
        <p className="onboard-lead">{t("landing.lead")}</p>
      </div>

      <div className="onboard-body">
        <ul className="value-list">
          {POINTS.map((p) => (
            <li key={p.title}>
              <span className="value-icon">
                <Icon name={p.icon} />
              </span>
              <span>
                <strong>{t(p.title)}</strong>
                <span className="muted">{t(p.text)}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="onboard-actions">
          <Link to="/register" className="button primary big">
            {t("landing.register")}
          </Link>
          <Link to="/login" className="button secondary big">
            {t("landing.login")}
          </Link>
          <button type="button" className="link-button" onClick={guest}>
            {t("landing.guest")}
          </button>
        </div>
        <p className="hint center">
          <Icon name="shield" size={18} /> {t("landing.privacy")}
        </p>
      </div>
    </div>
  );
}
