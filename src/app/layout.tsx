import type { Metadata, Viewport } from "next";
import { BRAND } from "@/lib/brand";
import { OG_IMAGE } from "@/lib/seo/metadata";
import { Analytics } from "@/components/analytics";
import "./globals.css";

// Search console ownership tags (Google, Bing Webmaster Tools, Yandex), set per environment.
const verifyEnv = (name: string) => (process.env[name] ?? "").trim() || undefined;
const bingVerification = verifyEnv("BING_SITE_VERIFICATION");

export const metadata: Metadata = {
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

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

// Google Sans Flex is not in next/font's catalogue for this Next version, so it is loaded
// from Google Fonts directly. The CSS variable --font-sans (globals.css) points at it.
const FONT_HREF = "https://fonts.googleapis.com/css2?family=Google+Sans+Flex:opsz,wght@6..144,1..1000&display=swap";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
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
        <Analytics />
      </body>
    </html>
  );
}
