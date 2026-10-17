import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Google sign-in returns here with a one-time code, which becomes a session cookie.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/dashboard`);
  }
  return NextResponse.redirect(`${origin}/sign-in?error=google`);
}
