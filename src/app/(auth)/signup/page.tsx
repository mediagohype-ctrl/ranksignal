import { Suspense } from "react";
import { isGoogleLoginConfigured } from "@/lib/auth/google-login";
import { SignupForm, SignupFormSkeleton } from "./signup-form";

export const metadata = { title: "Start your free trial" };
// The Google button depends on server env (GOOGLE_CLIENT_ID), so read it per request.
export const dynamic = "force-dynamic";

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupFormSkeleton />}>
      <SignupForm googleEnabled={isGoogleLoginConfigured()} />
    </Suspense>
  );
}
