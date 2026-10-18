import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MIN_PASSWORD, getSnapshot, hasAccount, logIn, register } from "../account";
import { Icon } from "../components/Icon";
import { useFocusHeading } from "../hooks/useFocusHeading";

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

  function validate(): Errors {
    const e: Errors = {};
    if (isRegister && !name.trim()) e.name = "Enter your name.";
    if (!EMAIL_RE.test(email.trim())) e.email = "Enter an email address like name@example.com.";
    if (password.length < MIN_PASSWORD) e.password = `Use at least ${MIN_PASSWORD} characters.`;
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
            form:
              err === "no_account"
                ? "There's no account on this phone yet. Create one, or continue without an account."
                : "That email and password don't match the account on this phone.",
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
        <Link to="/welcome" className="button icon-button" aria-label="Back">
          <Icon name="arrowLeft" />
        </Link>
      </div>
      <div className="onboard-body">
        <h1 ref={heading} tabIndex={-1}>
          {isRegister ? "Create your account" : "Welcome back"}
        </h1>
        <p className="muted">
          {isRegister
            ? "It's saved on this phone only, so the app remembers how you get around."
            : "Log in with the account you made on this phone."}
        </p>

        {isRegister && hasAccount() && (
          <p className="notice notice-warn">
            This phone already has an account. Creating a new one replaces it.{" "}
            <Link to="/login">Log in instead</Link>
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
              <label htmlFor="auth-name">Your name</label>
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
            <label htmlFor="auth-email">Email</label>
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
            <label htmlFor="auth-password">Password</label>
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
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <Icon name={showPassword ? "eyeOff" : "eye"} />
              </button>
            </div>
            {isRegister && (
              <p id="auth-password-hint" className="hint">
                At least {MIN_PASSWORD} characters.
              </p>
            )}
            <FieldError id="auth-password-error" text={errors.password} />
          </div>

          <button type="submit" className="primary big" disabled={busy}>
            {busy && <span className="spinner" aria-hidden="true" />}
            {isRegister ? "Create account" : "Log in"}
          </button>
        </form>

        <p className="center switch-mode">
          {isRegister ? (
            <>
              Already have an account? <Link to="/login">Log in</Link>
            </>
          ) : (
            <>
              New here? <Link to="/register">Create an account</Link>
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
