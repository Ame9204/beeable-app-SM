import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { LANGUAGES, NEEDS, saveProfile, type Language, type Need } from "../account";
import { Icon, NEED_ICON } from "../components/Icon";
import { ProfilePicker } from "../components/ProfilePicker";
import { useAccount } from "../hooks/useAccount";
import { useFocusHeading } from "../hooks/useFocusHeading";
import { useT, type TKey } from "../i18n";
import type { Profile } from "../types";

const STEPS: TKey[] = ["setup.step1", "setup.step2", "setup.step3"];

export function ProfileSetup() {
  const { account, profile, session, language: appLanguage } = useAccount();
  const navigate = useNavigate();
  const editing = profile !== null;
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile?.name ?? account?.name ?? "");
  const [language, setLanguage] = useState<Language>(profile?.language ?? appLanguage);
  // Show the setup screens in the language being picked, so the switch is visible straight away.
  const { t } = useT(language);
  const [mobility, setMobility] = useState<Profile>(profile?.mobility ?? "step_free");
  const [needs, setNeeds] = useState<Need[]>(profile?.needs ?? []);
  const heading = useFocusHeading(step);
  const last = step === STEPS.length - 1;

  function toggleNeed(n: Need) {
    setNeeds((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n]));
  }

  function finish() {
    saveProfile({ name: name.trim(), language, mobility, needs });
    navigate("/", { replace: true });
  }

  function next(e: FormEvent) {
    e.preventDefault();
    if (last) finish();
    else setStep((s) => s + 1);
  }

  return (
    <div className="onboard">
      <div className="onboard-top">
        {step > 0 ? (
          <button type="button" className="icon-button" onClick={() => setStep((s) => s - 1)} aria-label={t("setup.prev")}>
            <Icon name="arrowLeft" />
          </button>
        ) : editing ? (
          <button type="button" className="icon-button" onClick={() => navigate(-1)} aria-label={t("setup.cancel")}>
            <Icon name="x" />
          </button>
        ) : (
          <span />
        )}
        <span className="muted small-text">
          {t("setup.stepOf", { n: step + 1, total: STEPS.length })}
        </span>
      </div>

      <form className="onboard-body" onSubmit={next}>
        <ol className="stepper" aria-label={t("setup.progress")}>
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={i < step ? "done" : i === step ? "current" : undefined}
              aria-current={i === step ? "step" : undefined}
            >
              <span className="stepper-dot">{i < step ? <Icon name="check" size={16} /> : i + 1}</span>
              <span className="stepper-label">
                {t(label)}
                {i < step && <span className="visually-hidden">{t("setup.done")}</span>}
              </span>
            </li>
          ))}
        </ol>

        {step === 0 && (
          <>
            <h1 ref={heading} tabIndex={-1}>
              {editing
                ? t("setup.yourProfile")
                : session === "guest"
                  ? t("setup.guestHello")
                  : name
                    ? t("setup.helloName", { name: name.split(" ")[0] })
                    : t("setup.hello")}
            </h1>
            <p className="muted">{t("setup.lead")}</p>
            <div className="field">
              <label htmlFor="setup-name">
                {t("setup.nameLabel")} <span className="optional">{t("setup.optional")}</span>
              </label>
              <input id="setup-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
            </div>
            <fieldset className="choice-grid">
              <legend>
                <Icon name="globe" size={20} /> {t("setup.language")}
              </legend>
              {LANGUAGES.map((l) => (
                <label key={l.id} className="choice">
                  <input
                    type="radio"
                    name="language"
                    value={l.id}
                    checked={language === l.id}
                    onChange={() => setLanguage(l.id)}
                  />
                  <span className="choice-body">
                    <span lang={l.id}>{l.label}</span>
                    <span className="choice-check">
                      <Icon name="check" size={16} />
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
            <p className="hint">{t("setup.languageHint")}</p>
          </>
        )}

        {step === 1 && (
          <>
            <h1 ref={heading} tabIndex={-1}>
              {t("setup.moveTitle")}
            </h1>
            <p className="muted">{t("setup.moveLead")}</p>
            <ProfilePicker profile={mobility} onChange={setMobility} legend={t("setup.routeType")} lang={language} examples />
            <p className="hint">
              <Icon name="info" size={18} /> {t("setup.neverAccessible")}
            </p>
          </>
        )}

        {step === 2 && (
          <>
            <h1 ref={heading} tabIndex={-1}>
              {t("setup.elseTitle")}
            </h1>
            <p className="muted">{t("setup.elseLead")}</p>
            <fieldset className="need-list">
              <legend className="visually-hidden">{t("setup.needs")}</legend>
              {NEEDS.map((n) => (
                <label key={n} className="check-card">
                  <input type="checkbox" checked={needs.includes(n)} onChange={() => toggleNeed(n)} />
                  <span className="check-card-body">
                    <span className="value-icon">
                      <Icon name={NEED_ICON[n]} />
                    </span>
                    <span className="check-card-text">
                      <strong>{t(`need.${n}.label`)}</strong>
                      <span className="muted">{t(`need.${n}.hint`)}</span>
                    </span>
                    <span className="check-box" aria-hidden="true">
                      <Icon name="check" size={16} />
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          </>
        )}

        <div className="submit-bar onboard-actions">
          <button type="submit" className="primary big">
            {t(last ? (editing ? "setup.save" : "setup.start") : "setup.next")}
            {!last && <Icon name="chevronRight" />}
          </button>
        </div>
      </form>
    </div>
  );
}
