import { useEffect, useState } from "react";
import { App as NativeApp } from "@capacitor/app";
import { NavLink, Route, Routes } from "react-router-dom";
import { MOCK_FALLBACK_EVENT } from "./api";
import { USE_MOCKS } from "./config";
import { Insights } from "./pages/Insights";
import { NavigatePage } from "./pages/NavigatePage";
import { ReportPage } from "./pages/ReportPage";
import { isNative } from "./platform";

export function App() {
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

  return (
    <div className="app">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="topbar">
        <span className="brand">
          <span className="brand-mark" aria-hidden="true">⬢</span> BeeAble
        </span>
        <TabNav className="tabs-top" />
      </header>
      {offline && (
        <p className="offline-banner" role="status">
          Can't reach the BeeAble server, so you're seeing <strong>sample data</strong>. Reports you send now
          won't reach staff.
        </p>
      )}
      <main id="main">
        <Routes>
          <Route path="/" element={<NavigatePage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/insights" element={<Insights />} />
        </Routes>
      </main>
      <TabNav className="tabs-bottom" />
    </div>
  );
}

/** Same links twice: in the header on wide screens, as a bottom tab bar on phones (CSS decides). */
function TabNav({ className }: { className: string }) {
  return (
    <nav aria-label="Main" className={className}>
      <NavLink to="/" end>
        <span className="tab-icon" aria-hidden="true">🗺</span>
        <span>Navigate</span>
      </NavLink>
      <NavLink to="/report">
        <span className="tab-icon" aria-hidden="true">📷</span>
        <span>Report</span>
      </NavLink>
      {/* The Android app is the resident app; staff use /insights on the web. */}
      {!isNative && (
        <NavLink to="/insights">
          <span className="tab-icon" aria-hidden="true">📋</span>
          <span>Staff</span>
        </NavLink>
      )}
    </nav>
  );
}
