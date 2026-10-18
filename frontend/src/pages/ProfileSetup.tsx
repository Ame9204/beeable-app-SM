import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { LANGUAGES, NEEDS, saveProfile, type Language, type Need } from "../account";
import { Icon, NEED_ICON } from "../components/Icon";
import { ProfilePicker } from "../components/ProfilePicker";
import { useAccount } from "../hooks/useAccount";
import { useFocusHeading } from "../hooks/useFocusHeading";
import type { Profile } from "../types";

const STEPS = ["About you", "Getting around", "Anything else"] as const;

export function ProfileSetup() {
  const { account, profile, session } = useAccount();
  const navigate = useNavigate();
  const editing = profile !== null;
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile?.name ?? account?.name ?? "");
  const [language, setLanguage] = useState<Language>(profile?.language ?? "ms");
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
          <button type="button" className="icon-button" onClick={() => setStep((s) => s - 1)} aria-label="Previous step">
            <Icon name="arrowLeft" />
          </button>
        ) : editing ? (
          <button type="button" className="icon-button" onClick={() => navigate(-1)} aria-label="Cancel and go back">
            <Icon name="x" />
          </button>
        ) : (
          <span />
        )}
        <span className="muted small-text">
          Step {step + 1} of {STEPS.length}
        </span>
      </div>

      <form className="onboard-body" onSubmit={next}>
        <ol className="stepper" aria-label="Progress">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={i < step ? "done" : i === step ? "current" : undefined}
              aria-current={i === step ? "step" : undefined}
            >
              <span className="stepper-dot">{i < step ? <Icon name="check" size={16} /> : i + 1}</span>
              <span className="stepper-label">
                {label}
                {i < step && <span className="visually-hidden"> — done</span>}
              </span>
            </li>
          ))}
        </ol>

        {step === 0 && (
          <>
            <h1 ref={heading} tabIndex={-1}>
              {editing ? "Your profile" : session === "guest" ? "Let's set you up" : `Hi${name ? `, ${name.split(" ")[0]}` : ""}!`}
            </h1>
            <p className="muted">This helps BeeAble pick routes and talk to you in your language.</p>
            <div className="field">
              <label htmlFor="setup-name">
                What should we call you? <span className="optional">(optional)</span>
              </label>
              <input id="setup-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
            </div>
            <fieldset className="choice-grid">
              <legend>
                <Icon name="globe" size={20} /> Preferred language
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
            <p className="hint">Used as the default for voice reports. You can still type in any language.</p>
          </>
        )}

        {step === 1 && (
          <>
            <h1 ref={heading} tabIndex={-1}>
              How do you get around?
            </h1>
            <p className="muted">We'll use this for your routes. You can switch any time on the map.</p>
            <ProfilePicker profile={mobility} onChange={setMobility} legend="Route type" />
            <p className="hint">
              <Icon name="info" size={18} /> We never call a route "accessible". We show what's been checked and what hasn't.
            </p>
          </>
        )}

        {step === 2 && (
          <>
            <h1 ref={heading} tabIndex={-1}>
              Anything else we should know?
            </h1>
            <p className="muted">Optional. Pick any that apply.</p>
            <fieldset className="need-list">
              <legend className="visually-hidden">Needs</legend>
              {NEEDS.map((n) => (
                <label key={n.id} className="check-card">
                  <input type="checkbox" checked={needs.includes(n.id)} onChange={() => toggleNeed(n.id)} />
                  <span className="check-card-body">
                    <span className="value-icon">
                      <Icon name={NEED_ICON[n.id]} />
                    </span>
                    <span className="check-card-text">
                      <strong>{n.label}</strong>
                      <span className="muted">{n.hint}</span>
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
            {last ? (editing ? "Save profile" : "Start exploring") : "Next"}
            {!last && <Icon name="chevronRight" />}
          </button>
        </div>
      </form>
    </div>
  );
}
