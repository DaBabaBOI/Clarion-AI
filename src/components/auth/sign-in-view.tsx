"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CODE_LENGTH, CodeInput } from "../code-input";
import { LogoMark } from "../icons";
import { Button, Field, cx, inputClass } from "../ui";

// Sign in and Join a class share one card (Figma note 3), so new and
// returning students never hunt for a second screen. Authentication is not
// connected yet: both paths open the demo.

const FEATURES = ["Every deadline across every class", "An AI helper that knows your own work", "Points your teacher verifies"];

export function SignInView() {
  const router = useRouter();
  const [tab, setTab] = useState<"sign-in" | "join">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const enter = () => router.push("/dashboard");

  const joinWithCode = () => {
    if (code.length < CODE_LENGTH) {
      setError("Class codes have six characters.");
      return;
    }
    enter();
  };

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
            {tab === "sign-in" ? "Sign in to pick up where you left off." : "Use the code your teacher gave you."}
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
            <form
              className="mt-[22px] flex flex-col"
              onSubmit={(e) => {
                e.preventDefault();
                enter();
              }}
            >
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
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setError("Password reset arrives with school sign-in.")}
                  className="text-[13px] font-semibold text-brand hover:underline underline-offset-2"
                >
                  Forgot password?
                </button>
              </div>
              <Button type="submit" full className="mt-5 py-3.5 text-[14px]">
                Sign in
              </Button>
            </form>
          ) : null}

          {tab === "sign-in" && (
            <div className="mt-6 flex items-center gap-3.5">
              <span className="h-px flex-1 bg-line" />
              <span className="text-[12.5px] text-faint">or join a new class</span>
              <span className="h-px flex-1 bg-line" />
            </div>
          )}

          <form
            className={cx("flex flex-col gap-4", tab === "sign-in" ? "mt-5" : "mt-[22px]")}
            onSubmit={(e) => {
              e.preventDefault();
              joinWithCode();
            }}
          >
            <CodeInput
              value={code}
              onChange={(v) => {
                setCode(v);
                setError(null);
              }}
            />
            {tab === "join" && (
              <Field label="School email" htmlFor="join-email">
                <input id="join-email" type="email" autoComplete="email" className={inputClass} placeholder="you@school.edu" />
              </Field>
            )}
            <Button type="submit" variant={tab === "join" ? "primary" : "secondary"} full className="py-[13px] text-[14px]">
              Join class
            </Button>
          </form>

          {error && (
            <p role="alert" className="mt-3 text-[12.5px] font-semibold text-amber">
              {error}
            </p>
          )}
          <p className="mt-6 rounded-control bg-canvas px-3 py-2.5 text-[12px] leading-[18px] text-muted">
            Demo mode: school sign-in is not connected yet, so any email opens the demo.
          </p>
        </div>
      </section>
    </div>
  );
}
