import { Suspense } from "react";
import { isGoogleLoginConfigured } from "@/lib/auth/google-login";
import type { Metadata } from "next";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { SignupForm, SignupFormSkeleton } from "./signup-form";

// noindex,follow with a bare canonical, so /signup?plan=… variants are not indexed.
export const metadata: Metadata = staticPageMetadata("/signup");
// The Google button depends on server env (GOOGLE_CLIENT_ID), so read it per request.
export const dynamic = "force-dynamic";

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupFormSkeleton />}>
      <SignupForm googleEnabled={isGoogleLoginConfigured()} />
    </Suspense>
  );
}
