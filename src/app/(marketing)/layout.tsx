import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BRAND, WHATSAPP_HELP_MESSAGE, brandWhatsappHref } from "@/lib/brand";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { WhatsAppFloat } from "@/components/marketing/whatsapp-float";
import { JsonLd } from "@/components/marketing/ui";
import { organizationLd, websiteLd } from "@/lib/seo/schema";
import { OG_IMAGE } from "@/lib/seo/metadata";

// Shared social metadata for marketing pages. Pages set their own via pageMetadata() (src/lib/seo/metadata.ts);
// the image is explicit because a page-level `openGraph` replaces this one and would drop the file-based image.
export const metadata: Metadata = {
  twitter: { card: "summary_large_image", title: BRAND.name, description: BRAND.description, images: [OG_IMAGE.url] },
  openGraph: { siteName: BRAND.name, locale: "en_IN", type: "website", images: [OG_IMAGE] },
};

// SPEED: this layout must not read cookies or headers. It used to call getSession() (cookies + a database query for
// signed-in visitors) to pick "Open app" / "Log in", which made EVERY marketing page render on the server for every
// visit. The header and footer now ask the browser (src/components/marketing/signed-in.tsx), so pages that do not
// read the query string are built once and served from cache, and rebuilt at most once an hour (so prices, the
// address and "switching on soon" labels follow the live settings).
export const revalidate = 3600;

export default function MarketingLayout({ children }: { children: ReactNode }) {
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
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      {/* Floating WhatsApp chat button on every public page (number: BRAND.whatsapp, +91 84477 88703). */}
      <WhatsAppFloat href={brandWhatsappHref(WHATSAPP_HELP_MESSAGE)} />
    </div>
  );
}
