import type { Metadata } from "next";
import type { ReactNode } from "react";
import { staticPageMetadata } from "@/lib/seo/metadata";

// The page is a client component, so its metadata (noindex,follow + bare canonical) lives here.
export const metadata: Metadata = staticPageMetadata("/forgot-password");

export default function ForgotPasswordLayout({ children }: { children: ReactNode }) {
  return children;
}
