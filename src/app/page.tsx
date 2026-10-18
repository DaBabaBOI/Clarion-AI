import { redirect } from "next/navigation";

// The app starts at sign in, which sends anyone already signed in on to the dashboard.
export default function Home() {
  redirect("/sign-in");
}
