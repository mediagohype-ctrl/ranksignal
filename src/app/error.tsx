"use client";
// Error boundary for every route below the root layout: friendly message + retry.
import { useEffect } from "react";
import { Home, RotateCcw } from "lucide-react";
import { Button, LinkButton } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Message only — never dump objects that might carry user data.
    console.error("[ui] page error", error.digest ?? error.message);
  }, [error]);

  return (
    <main id="main" className="flex min-h-[70vh] items-center justify-center bg-bg px-4 py-16">
      <div className="max-w-lg text-center">
        <p className="eyebrow">Something went wrong</p>
        <h1 className="mt-3 text-balance text-h1 text-fg">Sorry — this page didn&apos;t load</h1>
        <p className="mt-4 text-body text-fg-soft">
          It&apos;s probably a temporary problem on our side. Try again, and if it keeps happening, let us know.
        </p>
        {error.digest && <p className="mt-3 font-mono text-xs text-muted">Reference: {error.digest}</p>}
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button icon={<RotateCcw />} onClick={() => reset()}>
            Try again
          </Button>
          <LinkButton href="/" variant="secondary" icon={<Home />}>
            Go to homepage
          </LinkButton>
          <LinkButton href="/contact" variant="ghost">
            Contact support
          </LinkButton>
        </div>
      </div>
    </main>
  );
}
