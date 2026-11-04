import { Suspense } from "react";
import { isGoogleLoginConfigured } from "@/lib/auth/google-login";
import { LoginForm, LoginFormSkeleton } from "./login-form";

export const metadata = { title: "Sign in" };
// The Google button depends on server env (GOOGLE_CLIENT_ID), so read it per request.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFormSkeleton />}>
      <LoginForm googleEnabled={isGoogleLoginConfigured()} />
    </Suspense>
  );
}
