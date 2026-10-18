"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getSupabase } from "@/lib/supabase/client";

/**
 * Google sign-in returns here with a one-time ?code=. The Supabase client swaps
 * it for a session as it starts up, so this only waits for that and moves on.
 */
export function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    getSupabase()
      .auth.getSession()
      .then(({ data }) => router.replace(data.session ? "/dashboard" : "/sign-in?error=google"));
  }, [router]);

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas text-[13px] text-muted">
      <p role="status">Signing you in…</p>
    </main>
  );
}
