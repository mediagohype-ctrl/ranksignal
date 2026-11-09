import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BRAND } from "@/lib/brand";
import { getSession } from "@/lib/auth/session";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { JsonLd } from "@/components/marketing/ui";
import { organizationLd, websiteLd } from "@/lib/seo/schema";
import { OG_IMAGE } from "@/lib/seo/metadata";

// Shared social metadata for marketing pages. Pages set their own via pageMetadata() (src/lib/seo/metadata.ts);
// the image is explicit because a page-level `openGraph` replaces this one and would drop the file-based image.
export const metadata: Metadata = {
  twitter: { card: "summary_large_image", title: BRAND.name, description: BRAND.description, images: [OG_IMAGE.url] },
  openGraph: { siteName: BRAND.name, locale: "en_IN", type: "website", images: [OG_IMAGE] },
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
      {/* Sitewide entity graph: every marketing page tells Google and AI assistants who we are. */}
      <JsonLd data={[organizationLd(), websiteLd()]} />
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
