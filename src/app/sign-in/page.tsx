import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInView } from "@/components/auth/sign-in-view";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  // The view reads ?error= from the URL, which is request data.
  return (
    <Suspense>
      <SignInView />
    </Suspense>
  );
}
