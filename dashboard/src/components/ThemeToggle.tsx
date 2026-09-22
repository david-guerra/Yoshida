"use client";

import { useEffect, useSyncExternalStore } from "react";

function subscribe(listener: () => void) {
  window.addEventListener("yoshida-theme", listener);
  return () => window.removeEventListener("yoshida-theme", listener);
}
function applyTheme(theme: string) {
  document.documentElement.dataset.theme = theme;
  window.dispatchEvent(new Event("yoshida-theme"));
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, () => document.documentElement.dataset.theme || "dark", () => "dark");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("yoshida.theme");
      if (saved === "light" || saved === "dark") applyTheme(saved);
    } catch { /* The current theme works when storage is unavailable. */ }
  }, []);
  return <button type="button" className="theme-toggle" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    onClick={() => {
      const next = theme === "dark" ? "light" : "dark";
      applyTheme(next);
      try { localStorage.setItem("yoshida.theme", next); } catch { /* Optional persistence. */ }
    }}><span aria-hidden="true">{theme === "dark" ? "☼" : "☾"}</span> {theme === "dark" ? "Light" : "Dark"} mode</button>;
}
