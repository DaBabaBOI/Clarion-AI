"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { auth } from "@/lib/store";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { CODE_LENGTH, CodeInput } from "../code-input";
import { LogoMark } from "../icons";
import { Button, Field, cx, inputClass } from "../ui";

// Sign in and Join a class share one card (Figma note 3), so new and
// returning students never hunt for a second screen.

const FEATURES = ["Every deadline across every class", "An AI helper that knows your own work", "Points your teacher verifies"];

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/** True when Google sign-in is switched on in Supabase (so the button never leads to an error page). */
function useGoogleEnabled() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
      .then((r) => (r.ok ? r.json() : null))
      .then((settings) => setEnabled(Boolean(settings?.external?.google)))
      .catch(() => setEnabled(false));
  }, []);
  return enabled;
}

export function SignInView() {
  const router = useRouter();
  const params = useSearchParams();
  const googleEnabled = useGoogleEnabled();
  const [tab, setTab] = useState<"sign-in" | "join">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("error") ? "Google sign-in did not finish. Try again, or use your email and password." : null,
  );

  // Already signed in: go straight to the dashboard.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    getSupabase()
      .auth.getSession()
      .then(({ data }) => data.session && router.replace("/dashboard"));
  }, [router]);

  const signIn = async (joinCode?: string) => {
    if (!isSupabaseConfigured) {
      setError("School sign-in is not set up on this copy of Clarion. Explore the demo instead.");
      return;
    }
    setBusy(true);
    setError(null);
    const message = await auth.signIn(email, password);
    if (message) {
      setBusy(false);
      setError(message);
      return;
    }
    if (joinCode) auth.rememberJoinCode(joinCode);
    router.push("/dashboard");
  };

  const google = async (joinCode?: string) => {
    setError(null);
    if (joinCode) auth.rememberJoinCode(joinCode);
    const message = await auth.signInWithGoogle();
    if (message) setError(message);
  };

  const credentials = (
    <>
      <Field label="School email" htmlFor="email">
        <input
          id="email"
          type="email"
          autoComplete="email"
          className={inputClass}
          placeholder="prithu@dpsiedge.edu.in"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </Field>
      <div className="mt-4">
        <Field label="Password" htmlFor="password">
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className={inputClass}
            placeholder="••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
      </div>
    </>
  );

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <section className="flex flex-col justify-center bg-soft-gradient px-6 py-10 sm:px-16 lg:w-[620px] lg:shrink-0 lg:py-16">
        <div className="flex items-center gap-3">
          <LogoMark size={40} />
          <span className="text-[24px] font-bold">Clarion</span>
        </div>
        <h1 className="mt-8 max-w-[470px] text-[32px] leading-[40px] font-bold sm:text-[40px] sm:leading-[50px] lg:mt-11">
          Everything for school, in one place.
        </h1>
        <p className="mt-[18px] max-w-[440px] text-[15px] leading-6 text-muted">
          Tasks, deadlines, your AI study helper, class discussions and rewards, behind one login.
        </p>
        <ul className="mt-[34px] hidden flex-col gap-3.5 sm:flex">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-center gap-3 text-[14.5px]">
              <span className="size-5 shrink-0 rounded-full bg-brand-gradient" aria-hidden="true" />
              {f}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-1 items-center justify-center bg-white px-6 py-10">
        <div className="w-full max-w-[396px]">
          <h2 className="text-[32px] font-bold">{tab === "sign-in" ? "Welcome back" : "Join your class"}</h2>
          <p className="mt-2 text-[14.5px] text-muted">
            {tab === "sign-in" ? "Sign in to pick up where you left off." : "Enter the code your teacher gave you, then sign in."}
          </p>

          <div role="tablist" aria-label="Sign in or join" className="mt-[26px] flex gap-1 rounded-[12px] bg-canvas p-1">
            {(
              [
                ["sign-in", "Sign in"],
                ["join", "Join a class"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => {
                  setTab(value);
                  setError(null);
                }}
                className={cx(
                  "flex-1 rounded-[9px] py-[9px] text-[13.5px] font-semibold transition",
                  tab === value ? "bg-white text-ink shadow-tab" : "text-muted hover:text-ink",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "sign-in" ? (
            <>
              <form
                className="mt-[22px] flex flex-col"
                onSubmit={(e) => {
                  e.preventDefault();
                  void signIn();
                }}
              >
                {credentials}
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setError("Ask your school admin to reset your password for now. Self-service reset is coming.")}
                    className="text-[13px] font-semibold text-brand hover:underline underline-offset-2"
                  >
                    Forgot password?
                  </button>
                </div>
                <Button type="submit" full disabled={busy} className="mt-5 py-3.5 text-[14px]">
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
                {googleEnabled && (
                  <Button variant="secondary" full className="mt-2.5 py-3 text-[14px]" onClick={() => void google()}>
                    <GoogleMark />
                    Continue with Google
                  </Button>
                )}
              </form>

              <div className="mt-6 flex items-center gap-3.5">
                <span className="h-px flex-1 bg-line" />
                <span className="text-[12.5px] text-faint">or join a new class</span>
                <span className="h-px flex-1 bg-line" />
              </div>
              <form
                className="mt-5 flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (code.length < CODE_LENGTH) {
                    setError("Class codes have six characters.");
                    return;
                  }
                  setTab("join");
                  setError(null);
                }}
              >
                <CodeInput
                  value={code}
                  onChange={(v) => {
                    setCode(v);
                    setError(null);
                  }}
                />
                <Button type="submit" variant="secondary" full className="py-[13px] text-[14px]">
                  Join class
                </Button>
              </form>
            </>
          ) : (
            <form
              className="mt-[22px] flex flex-col"
              onSubmit={(e) => {
                e.preventDefault();
                if (code.length < CODE_LENGTH) {
                  setError("Class codes have six characters.");
                  return;
                }
                void signIn(code);
              }}
            >
              <CodeInput
                value={code}
                onChange={(v) => {
                  setCode(v);
                  setError(null);
                }}
              />
              <div className="mt-5">{credentials}</div>
              <Button type="submit" full disabled={busy} className="mt-5 py-3.5 text-[14px]">
                {busy ? "Signing in…" : "Sign in and join"}
              </Button>
              {googleEnabled && (
                <Button
                  variant="secondary"
                  full
                  className="mt-2.5 py-3 text-[14px]"
                  onClick={() => (code.length < CODE_LENGTH ? setError("Class codes have six characters.") : void google(code))}
                >
                  <GoogleMark />
                  Join with Google
                </Button>
              )}
            </form>
          )}

          {error && (
            <p role="alert" className="mt-3 text-[12.5px] font-semibold text-amber">
              {error}
            </p>
          )}

          <div className="mt-6 flex items-center justify-between gap-3 rounded-control bg-canvas px-3.5 py-3">
            <p className="text-[12px] leading-[18px] text-muted">No account yet? Try Clarion with sample classes.</p>
            <button
              type="button"
              onClick={() => {
                auth.startDemo();
                router.push("/dashboard");
              }}
              className="shrink-0 text-[12.5px] font-semibold text-brand hover:underline underline-offset-2"
            >
              Explore the demo
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
