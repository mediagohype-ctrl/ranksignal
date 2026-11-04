import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BRAND } from "@/lib/brand";
import { getSession } from "@/lib/auth/session";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

// Shared social metadata for marketing pages; the image comes from src/app/opengraph-image.tsx.
export const metadata: Metadata = {
  twitter: { card: "summary_large_image", title: BRAND.name, description: BRAND.tagline },
  openGraph: { siteName: BRAND.name, locale: "en_IN", type: "website" },
};

/** Signed-in visitors see "Open app" instead of "Log in" / "Start free". Never fails the page. */
async function isSignedIn(): Promise<boolean> {
  try {
    return (await getSession()) !== null;
  } catch {
    return false;
  }
}

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const signedIn = await isSignedIn();
  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:text-small focus:font-medium focus:shadow-lg"
      >
        Skip to content
      </a>
      <SiteHeader signedIn={signedIn} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
