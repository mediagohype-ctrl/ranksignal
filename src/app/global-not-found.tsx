// 404 for addresses that match no page at all. The site has several root layouts (English and Hindi), so the
// unmatched-URL page renders its own <html> (Next.js `experimental.globalNotFound`, enabled in next.config.ts).
import { NotFoundView, notFoundMetadata } from "@/components/shell/not-found-view";
import { RootShell } from "@/components/shell/root-shell";

export const metadata = notFoundMetadata;

export default function GlobalNotFound() {
  return (
    <RootShell lang="en">
      <NotFoundView />
    </RootShell>
  );
}
