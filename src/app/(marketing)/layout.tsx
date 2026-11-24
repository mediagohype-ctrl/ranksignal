// Root layout for the English public site (<html lang="en">). The Hindi pages have their own root layout with
// <html lang="hi"> in src/app/(hindi)/layout.tsx; see src/components/shell/root-shell.tsx.
import type { ReactNode } from "react";
import { RootShell, rootViewport, withRootMetadata } from "@/components/shell/root-shell";
import { MarketingChrome, marketingMetadata } from "@/components/marketing/marketing-chrome";

export const metadata = withRootMetadata(marketingMetadata("en_IN"));
export const viewport = rootViewport;

// SPEED: this layout must not read cookies or headers. It used to call getSession() (cookies + a database query for
// signed-in visitors) to pick "Open app" / "Log in", which made EVERY marketing page render on the server for every
// visit. The header and footer now ask the browser (src/components/marketing/signed-in.tsx), so pages that do not
// read the query string are built once and served from cache, and rebuilt at most once an hour (so prices, the
// address and "switching on soon" labels follow the live settings).
export const revalidate = 3600;

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <RootShell lang="en">
      <MarketingChrome>{children}</MarketingChrome>
    </RootShell>
  );
}
