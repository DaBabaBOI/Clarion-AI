"use client";

import { useSyncExternalStore, type CSSProperties } from "react";

// Opening animation from the Figma "Loading 00–16" frames: the C draws in
// from its lower end, the play triangle pops, the wordmark rises, then the
// whole screen fades. Shown once per browser session. The server always
// renders it so the first paint is the splash, not a flash of skeletons; the
// browser drops it straight away when it has already played this session.

const SESSION_KEY = "clarion-splash-seen";

function shouldShow(): boolean {
  try {
    if (window.sessionStorage.getItem(SESSION_KEY)) return false;
    window.sessionStorage.setItem(SESSION_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

let decided: boolean | null = null;
const decide = () => (decided ??= shouldShow());

export function Splash() {
  const show = useSyncExternalStore(
    () => () => {},
    decide,
    () => true,
  );
  if (!show) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[100] grid place-items-center bg-white"
      style={{ animation: "clarion-fade-out 320ms ease-in 1650ms forwards" }}
    >
      <div className="flex flex-col items-center gap-7">
        <svg width="132" height="132" viewBox="0 0 96 96" fill="none">
          <defs>
            <linearGradient id="splash-gradient" x1="48" y1="0" x2="48" y2="96" gradientUnits="userSpaceOnUse">
              <stop stopColor="#6D5DFB" />
              <stop offset="1" stopColor="#3B82F6" />
            </linearGradient>
          </defs>
          {/* Same geometry as the logo: centre 48,48, radius 40.8, 14.4 thick, round caps. */}
          <path
            d="M80.48 72.69 A40.8 40.8 0 1 1 80.48 23.31"
            stroke="url(#splash-gradient)"
            strokeWidth="14.4"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1 1"
            style={
              {
                "--arc-length": 1,
                strokeDashoffset: 1,
                animation: "clarion-draw 780ms cubic-bezier(0.65, 0, 0.35, 1) 120ms forwards",
              } as CSSProperties
            }
          />
          <path
            d="M48 48L71.04 33.6V62.4L48 48Z"
            fill="white"
            stroke="#3B82F6"
            strokeWidth="2.6"
            strokeLinejoin="round"
            style={{
              transformOrigin: "60px 48px",
              opacity: 0,
              animation: "clarion-pop 360ms ease-out 880ms forwards",
            }}
          />
        </svg>
        <span
          className="text-brand-gradient text-[46px] font-bold leading-none"
          style={{ opacity: 0, animation: "clarion-rise 420ms ease-out 1050ms forwards" }}
        >
          Clarion
        </span>
      </div>
    </div>
  );
}
