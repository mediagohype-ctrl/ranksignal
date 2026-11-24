// Header, footer, site-wide JSON-LD and the WhatsApp button around every public page. Shared by the English root
// layout (src/app/(marketing)/layout.tsx) and the Hindi one (src/app/(hindi)/layout.tsx).
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BRAND, WHATSAPP_HELP_MESSAGE, brandWhatsappHref } from "@/lib/brand";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { WhatsAppFloat } from "@/components/marketing/whatsapp-float";
import { JsonLd } from "@/components/marketing/ui";
import { organizationLd, websiteLd } from "@/lib/seo/schema";
import { OG_IMAGE } from "@/lib/seo/metadata";

/**
 * Shared social metadata for public pages. Pages set their own via pageMetadata() (src/lib/seo/metadata.ts); the
 * image is explicit because a page-level `openGraph` replaces this one and would drop the file-based image.
 */
export function marketingMetadata(locale: "en_IN" | "hi_IN"): Metadata {
  return {
    twitter: { card: "summary_large_image", title: BRAND.name, description: BRAND.description, images: [OG_IMAGE.url] },
    openGraph: { siteName: BRAND.name, locale, type: "website", images: [OG_IMAGE] },
  };
}

export function MarketingChrome({ children }: { children: ReactNode }) {
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
