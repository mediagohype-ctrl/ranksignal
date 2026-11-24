// Root layout for the Hindi pages (/hi/…): <html lang="hi"> in the server HTML, so Google and screen readers know
// the page language without running JavaScript. URLs are unchanged (route groups don't appear in the address).
// The shared header and footer stay in English; og:locale is hi_IN.
import type { ReactNode } from "react";
import { RootShell, rootViewport, withRootMetadata } from "@/components/shell/root-shell";
import { MarketingChrome, marketingMetadata } from "@/components/marketing/marketing-chrome";

export const metadata = withRootMetadata(marketingMetadata("hi_IN"));
export const viewport = rootViewport;
export const revalidate = 3600;

export default function HindiRootLayout({ children }: { children: ReactNode }) {
  return (
    <RootShell lang="hi">
      <MarketingChrome>{children}</MarketingChrome>
    </RootShell>
  );
}
