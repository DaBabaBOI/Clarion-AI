import { redirect } from "next/navigation";

// Until auth is wired to Supabase, the entry point goes straight to sign in.
export default function Home() {
  redirect("/sign-in");
}
