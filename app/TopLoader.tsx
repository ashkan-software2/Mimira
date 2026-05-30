"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Lightweight, dependency-free top progress bar for client-side navigation.
 *
 * - Shows instantly when an internal link is clicked, so navigation *feels*
 *   responsive even while a slow page is rendering.
 * - Trickles forward, then completes the moment the new route finishes
 *   rendering (detected via a pathname/search change).
 * - Pure CSS animation + a single fixed-position element: negligible cost.
 */
export default function TopLoader() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const timers = useRef<number[]>([]);
  const firstRender = useRef(true);

  function clearTimers() {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }

  // Start the bar on internal-link clicks.
  useEffect(() => {
    function start() {
      clearTimers();
      setVisible(true);
      setProgress(8);
      timers.current.push(window.setTimeout(() => setProgress(45), 120));
      timers.current.push(window.setTimeout(() => setProgress(72), 380));
      timers.current.push(window.setTimeout(() => setProgress(88), 900));
      // Safety: never leave the bar stuck if a navigation is cancelled.
      timers.current.push(window.setTimeout(() => finish(), 12000));
    }

    function onClick(e: MouseEvent) {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      const target = anchor.getAttribute("target");
      if (!href || target === "_blank" || anchor.hasAttribute("download")) return;
      if (href.startsWith("#")) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // Same page (including same query) — nothing to load.
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }
      start();
    }

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finish() {
    clearTimers();
    setProgress(100);
    timers.current.push(window.setTimeout(() => setVisible(false), 220));
    timers.current.push(window.setTimeout(() => setProgress(0), 480));
  }

  // Complete the bar once the route actually changes.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      <style>{`
        .route-loader {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          z-index: 9999;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease;
        }
        .route-loader.is-active { opacity: 1; }
        .route-loader-bar {
          height: 100%;
          width: 0;
          background: var(--ai-accent, #0a7c7c);
          box-shadow: 0 0 8px rgba(10, 124, 124, 0.5);
          transition: width 0.2s ease;
        }
      `}</style>
      <div className={`route-loader${visible ? " is-active" : ""}`} aria-hidden="true">
        <div className="route-loader-bar" style={{ width: `${progress}%` }} />
      </div>
    </>
  );
}
