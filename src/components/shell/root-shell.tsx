// The <html> document every root layout renders. The site has several root layouts (Next.js route groups), so the
// English pages can say <html lang="en"> and the Hindi pages <html lang="hi"> in the server HTML — search engines
// and screen readers read the page language from there:
//   src/app/(marketing)/layout.tsx, (auth)/layout.tsx, app/layout.tsx, admin/layout.tsx, r/layout.tsx → lang "en"
//   src/app/(hindi)/layout.tsx → lang "hi"
// Moving between the two languages is a full page load, which is fine for a language switch.
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { BRAND } from "@/lib/brand";
import { OG_IMAGE } from "@/lib/seo/metadata";
import { Analytics } from "@/components/analytics";
import { AttributionCapture } from "@/components/attribution-capture";
import "@/app/globals.css";

// Search console ownership tags (Google, Bing Webmaster Tools, Yandex), set per environment.
const verifyEnv = (name: string) => (process.env[name] ?? "").trim() || undefined;
const bingVerification = verifyEnv("BING_SITE_VERIFICATION");

/** Site-wide metadata. Each root layout exports this (merged with its own additions). */
export const rootMetadata: Metadata = {
  metadataBase: new URL(BRAND.appUrl),
  // Keyword first, brand last; pages keep the full title within 60 characters (src/lib/seo/metadata.ts).
  title: { default: `SEO, AEO & GEO Platform for AI Visibility · ${BRAND.name}`, template: `%s · ${BRAND.name}` },
  description: BRAND.description,
  applicationName: BRAND.name,
  creator: BRAND.name,
  publisher: BRAND.name,
  category: "technology",
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: { title: BRAND.name, description: BRAND.description, siteName: BRAND.name, type: "website", locale: "en_IN", images: [OG_IMAGE] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large", "max-video-preview": -1 } },
  verification: {
    google: verifyEnv("GOOGLE_SITE_VERIFICATION"),
    yandex: verifyEnv("YANDEX_SITE_VERIFICATION"),
    ...(bingVerification ? { other: { "msvalidate.01": bingVerification } } : {}),
  },
};

/** Root metadata plus a layout's own fields (openGraph is merged, not replaced). */
export function withRootMetadata(extra: Metadata = {}): Metadata {
  return {
    ...rootMetadata,
    ...extra,
    openGraph: { ...(rootMetadata.openGraph ?? {}), ...(extra.openGraph ?? {}) } as Metadata["openGraph"],
  };
}

export const rootViewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

// Google Sans Flex is not in next/font's catalogue for this Next version, so it is loaded
// from Google Fonts directly. The CSS variable --font-sans (globals.css) points at it.
const FONT_HREF = "https://fonts.googleapis.com/css2?family=Google+Sans+Flex:wght@400..800&display=swap";

export function RootShell({ lang, children }: { lang: "en" | "hi"; children: ReactNode }) {
  return (
    <html lang={lang}>
      {/* eslint-disable-next-line @next/next/no-head-element -- App Router root layouts render <head> directly. */}
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONT_HREF} />
        {/* Points AI tools at our plain-text summary (set inline: per-page `alternates` would replace it). */}
        <link rel="alternate" type="text/plain" href="/llms.txt" title="llms.txt" />
      </head>
      {/* suppressHydrationWarning: browser extensions (e.g. ColorZilla's cz-shortcut-listen) add attributes
          to <body> before React hydrates. This only silences attribute mismatches on <body> itself. */}
      <body className="min-h-screen bg-bg font-sans text-fg antialiased" suppressHydrationWarning>
        {children}
        <AttributionCapture />
        <Analytics />
      </body>
    </html>
  );
}
