import { useEffect, useState } from "react";
import { App as NativeApp } from "@capacitor/app";
import { NavLink, Route, Routes } from "react-router-dom";
import { MOCK_FALLBACK_EVENT } from "./api";
import { USE_MOCKS } from "./config";
import { Insights } from "./pages/Insights";
import { ResidentApp } from "./pages/ResidentApp";
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
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="topbar">
        <span className="brand">BeeAble</span>
        <nav aria-label="Main">
          <NavLink to="/" end>
            Navigate
          </NavLink>
          {/* The Android app is the resident app; staff use /insights on the web. */}
          {!isNative && <NavLink to="/insights">Insights (staff)</NavLink>}
        </nav>
      </header>
      {offline && (
        <p className="offline-banner" role="status">
          Can't reach the BeeAble server, so you're seeing <strong>sample data</strong>. Reports you send now
          won't reach staff.
        </p>
      )}
      <main id="main">
        <Routes>
          <Route path="/" element={<ResidentApp />} />
          <Route path="/insights" element={<Insights />} />
        </Routes>
      </main>
    </>
  );
}
