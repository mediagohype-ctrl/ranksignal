import type { Metadata } from "next";
import { Link2Off } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { EmptyState, LinkButton } from "@/components/ui";

export const metadata: Metadata = {
  title: "Report link not available",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Invalid, expired or revoked share links all land here — we never reveal which. */
export default function SharedReportNotFound() {
  return (
    <main className="container-page flex min-h-screen items-center justify-center py-16">
      <EmptyState
        size="lg"
        icon={<Link2Off />}
        title="This report link isn't available"
        description="The link may have been turned off or replaced by the person who shared it. Ask them for a new link."
        action={<LinkButton href="/free-check">Check your own website for free</LinkButton>}
        secondaryAction={
          <LinkButton href="/" variant="ghost">
            About {BRAND.name}
          </LinkButton>
        }
        bordered
      />
    </main>
  );
}
