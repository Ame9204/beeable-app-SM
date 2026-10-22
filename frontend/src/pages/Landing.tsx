import { Link, useNavigate } from "react-router-dom";
import { continueAsGuest } from "../account";
import { Icon, Logo, type IconName } from "../components/Icon";
import { useFocusHeading } from "../hooks/useFocusHeading";

const POINTS: { icon: IconName; title: string; text: string }[] = [
  { icon: "route", title: "Routes that fit you", text: "Step-free or easy walking, with a plain reason for every turn." },
  { icon: "camera", title: "Report a barrier in seconds", text: "Snap a photo, speak in BM, English, 中文 or தமிழ்." },
  { icon: "check", title: "AI checks, staff fix", text: "Fixed barriers update everyone's routes straight away." },
];

export function Landing() {
  const heading = useFocusHeading();
  const navigate = useNavigate();

  function guest() {
    continueAsGuest();
    navigate("/setup");
  }

  return (
    <div className="onboard landing">
      <div className="onboard-hero">
        <Logo size={64} />
        <p className="onboard-brand">BeeAble</p>
        <h1 ref={heading} tabIndex={-1}>
          Get around campus without the guesswork
        </h1>
        <p className="onboard-lead">Walking routes shaped by how you move, and a quick way to flag what's in the way.</p>
      </div>

      <div className="onboard-body">
        <ul className="value-list">
          {POINTS.map((p) => (
            <li key={p.title}>
              <span className="value-icon">
                <Icon name={p.icon} />
              </span>
              <span>
                <strong>{p.title}</strong>
                <span className="muted">{p.text}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="onboard-actions">
          <Link to="/register" className="button primary big">
            Create an account
          </Link>
          <Link to="/login" className="button secondary big">
            Log in
          </Link>
          <button type="button" className="link-button" onClick={guest}>
            Continue without an account
          </button>
        </div>
        <p className="hint center">
          <Icon name="shield" size={18} /> Your details stay on this phone. Reports are always anonymous.
        </p>
      </div>
    </div>
  );
}
