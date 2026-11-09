import { Suspense } from "react";
import { isGoogleLoginConfigured } from "@/lib/auth/google-login";
import type { Metadata } from "next";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { LoginForm, LoginFormSkeleton } from "./login-form";

// noindex,follow with a bare canonical, so /login?next=… variants are not indexed.
export const metadata: Metadata = staticPageMetadata("/login");
// The Google button depends on server env (GOOGLE_CLIENT_ID), so read it per request.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFormSkeleton />}>
      <LoginForm googleEnabled={isGoogleLoginConfigured()} />
    </Suspense>
  );
}
