import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MIN_PASSWORD, getSnapshot, hasAccount, logIn, register } from "../account";
import { Icon } from "../components/Icon";
import { useFocusHeading } from "../hooks/useFocusHeading";
import { useT } from "../i18n";

type Mode = "login" | "register";
type Errors = Partial<Record<"name" | "email" | "password" | "form", string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthPage({ mode }: { mode: Mode }) {
  const heading = useFocusHeading(mode);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const isRegister = mode === "register";
  const { t } = useT();

  function validate(): Errors {
    const e: Errors = {};
    if (isRegister && !name.trim()) e.name = t("auth.errName");
    if (!EMAIL_RE.test(email.trim())) e.email = t("auth.errEmail");
    if (password.length < MIN_PASSWORD) e.password = t("auth.errPassword", { n: MIN_PASSWORD });
    return e;
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      document.getElementById(`auth-${Object.keys(e)[0]}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      if (isRegister) {
        await register(name, email, password);
        navigate("/setup", { replace: true });
      } else {
        const err = await logIn(email, password);
        if (err) {
          setErrors({
            form: t(err === "no_account" ? "auth.errNoAccount" : "auth.errWrong"),
          });
          return;
        }
        navigate(getSnapshot().profile ? "/" : "/setup", { replace: true });
      }
    } finally {
      setBusy(false);
    }
  }

  const describedBy = (field: keyof Errors) => (errors[field] ? `auth-${field}-error` : undefined);

  return (
    <div className="onboard">
      <div className="onboard-top">
        <Link to="/welcome" className="button icon-button" aria-label={t("auth.back")}>
          <Icon name="arrowLeft" />
        </Link>
      </div>
      <div className="onboard-body">
        <h1 ref={heading} tabIndex={-1}>
          {t(isRegister ? "auth.registerTitle" : "auth.loginTitle")}
        </h1>
        <p className="muted">
          {t(isRegister ? "auth.registerLead" : "auth.loginLead")}
        </p>

        {isRegister && hasAccount() && (
          <p className="notice notice-warn">
            {t("auth.replaceWarning")} <Link to="/login">{t("auth.loginInstead")}</Link>
          </p>
        )}

        <form className="form" onSubmit={submit} noValidate>
          {errors.form && (
            <p className="notice notice-error" role="alert">
              {errors.form}
            </p>
          )}

          {isRegister && (
            <div className="field">
              <label htmlFor="auth-name">{t("auth.name")}</label>
              <input
                id="auth-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                aria-invalid={!!errors.name}
                aria-describedby={describedBy("name")}
              />
              <FieldError id="auth-name-error" text={errors.name} />
            </div>
          )}

          <div className="field">
            <label htmlFor="auth-email">{t("auth.email")}</label>
            <input
              id="auth-email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete={isRegister ? "email" : "username"}
              aria-invalid={!!errors.email}
              aria-describedby={describedBy("email")}
            />
            <FieldError id="auth-email-error" text={errors.email} />
          </div>

          <div className="field">
            <label htmlFor="auth-password">{t("auth.password")}</label>
            <div className="password-row">
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isRegister ? "new-password" : "current-password"}
                aria-invalid={!!errors.password}
                aria-describedby={[describedBy("password"), isRegister ? "auth-password-hint" : undefined]
                  .filter(Boolean)
                  .join(" ") || undefined}
              />
              <button
                type="button"
                className="icon-button reveal"
                onClick={() => setShowPassword((s) => !s)}
                aria-pressed={showPassword}
                aria-label={t(showPassword ? "auth.hide" : "auth.show")}
              >
                {/* The icon shows the current state: crossed eye while the password is hidden. */}
                <Icon name={showPassword ? "eye" : "eyeOff"} />
              </button>
            </div>
            {isRegister && (
              <p id="auth-password-hint" className="hint">
                {t("auth.passwordHint", { n: MIN_PASSWORD })}
              </p>
            )}
            <FieldError id="auth-password-error" text={errors.password} />
          </div>

          <button type="submit" className="primary big" disabled={busy}>
            {busy && <span className="spinner" aria-hidden="true" />}
            {t(isRegister ? "auth.createAccount" : "auth.logIn")}
          </button>
        </form>

        <p className="center switch-mode">
          {isRegister ? (
            <>
              {t("auth.haveAccount")} <Link to="/login">{t("auth.logIn")}</Link>
            </>
          ) : (
            <>
              {t("auth.newHere")} <Link to="/register">{t("landing.register")}</Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function FieldError({ id, text }: { id: string; text?: string }) {
  if (!text) return null;
  return (
    <p id={id} className="field-error">
      <Icon name="alert" size={18} /> {text}
    </p>
  );
}
