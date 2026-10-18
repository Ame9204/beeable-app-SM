import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { logOut } from "../account";
import { useAccount } from "../hooks/useAccount";
import { Icon } from "./Icon";

/** Header button with the user's initial; opens a small menu (edit profile, log out). */
export function AccountMenu() {
  const { profile, session } = useAccount();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        wrap.current?.querySelector<HTMLButtonElement>(".avatar")?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!session) return null;
  const name = profile?.name || (session === "guest" ? "Guest" : "You");

  function doLogOut() {
    setOpen(false);
    logOut();
    navigate("/welcome", { replace: true });
  }

  return (
    <div className="account" ref={wrap}>
      <button
        type="button"
        className="avatar"
        aria-expanded={open}
        aria-controls="account-menu"
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">{profile?.name ? profile.name.trim()[0].toUpperCase() : <Icon name="user" size={20} />}</span>
        <span className="visually-hidden">Account: {name}</span>
      </button>
      {open && (
        <div id="account-menu" className="account-menu card">
          <p className="account-name">
            <strong>{name}</strong>
            <span className="muted small-text">{session === "guest" ? "No account · on this phone" : "Saved on this phone"}</span>
          </p>
          <Link to="/setup" className="menu-item" onClick={() => setOpen(false)}>
            <Icon name="user" /> Edit profile
          </Link>
          <button type="button" className="menu-item" onClick={doLogOut}>
            <Icon name="logout" /> {session === "guest" ? "Leave guest mode" : "Log out"}
          </button>
        </div>
      )}
    </div>
  );
}
