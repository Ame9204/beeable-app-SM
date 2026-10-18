import { useEffect, useState, type ReactNode } from "react";
import { App as NativeApp } from "@capacitor/app";
import { Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { MOCK_FALLBACK_EVENT } from "./api";
import { USE_MOCKS } from "./config";
import { AuthPage } from "./pages/AuthPage";
import { Insights } from "./pages/Insights";
import { Landing } from "./pages/Landing";
import { NavigatePage } from "./pages/NavigatePage";
import { ProfileSetup } from "./pages/ProfileSetup";
import { ReportPage } from "./pages/ReportPage";
import { isNative } from "./platform";
import { AccountMenu } from "./components/AccountMenu";
import { Icon, Logo, type IconName } from "./components/Icon";
import { useAccount } from "./hooks/useAccount";

// Full-screen onboarding screens: no header or tab bar.
const ONBOARDING_PATHS = ["/welcome", "/login", "/register", "/setup"];

export function App() {
  const { pathname } = useLocation();
  const [offline, setOffline] = useState(USE_MOCKS);
  useEffect(() => {
    const onFallback = () => setOffline(true);
    window.addEventListener(MOCK_FALLBACK_EVENT, onFallback);
    return () => window.removeEventListener(MOCK_FALLBACK_EVENT, onFallback);
  }, []);

  useEffect(() => {
    if (!isNative) return;
    // Android back button: go back in the app, and only close it from the first screen.
    const handle = NativeApp.addListener("backButton", ({ canGoBack }) =>
      canGoBack ? window.history.back() : NativeApp.exitApp(),
    );
    return () => {
      handle.then((h) => h.remove());
    };
  }, []);

  if (ONBOARDING_PATHS.includes(pathname)) {
    return (
      <main id="main" className="onboard-shell">
        <Routes>
          <Route path="/welcome" element={<Landing />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/setup" element={<RequireSession><ProfileSetup /></RequireSession>} />
        </Routes>
      </main>
    );
  }

  return (
    <div className="app">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="topbar">
        <span className="brand">
          <Logo /> BeeAble
        </span>
        <div className="topbar-end">
          <TabNav className="tabs-top" />
          <AccountMenu />
        </div>
      </header>
      {offline && (
        <p className="offline-banner" role="status">
          <Icon name="alert" size={20} /> <span>Can't reach the BeeAble server, so you're seeing <strong>sample data</strong>. Reports you send now
          won't reach staff.</span>
        </p>
      )}
      <main id="main">
        <Routes>
          <Route path="/" element={<RequireOnboarding><NavigatePage /></RequireOnboarding>} />
          <Route path="/report" element={<RequireOnboarding><ReportPage /></RequireOnboarding>} />
          <Route path="/insights" element={<Insights />} />
        </Routes>
      </main>
      <TabNav className="tabs-bottom" />
    </div>
  );
}

/** Resident screens: first launch goes through landing → (account) → profile. Staff /insights is never gated. */
function RequireOnboarding({ children }: { children: ReactNode }) {
  const { state } = useAccount();
  if (state === "landing") return <Navigate to="/welcome" replace />;
  if (state === "profile") return <Navigate to="/setup" replace />;
  return children;
}

function RequireSession({ children }: { children: ReactNode }) {
  const { session, state } = useAccount();
  if (!session && state !== "done") return <Navigate to="/welcome" replace />;
  return children;
}

// The Android app is the resident app; staff use /insights on the web.
const TABS: { to: string; label: string; icon: IconName; staff?: boolean }[] = [
  { to: "/", label: "Navigate", icon: "map" },
  { to: "/report", label: "Report", icon: "camera" },
  { to: "/insights", label: "Staff", icon: "clipboard", staff: true },
];

/** Same links twice: in the header on wide screens, as a bottom tab bar on phones (CSS decides). */
function TabNav({ className }: { className: string }) {
  return (
    <nav aria-label="Main" className={className}>
      {TABS.filter((t) => !(t.staff && isNative)).map((t) => (
        <NavLink key={t.to} to={t.to} end={t.to === "/"}>
          <span className="tab-icon">
            <Icon name={t.icon} />
          </span>
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
