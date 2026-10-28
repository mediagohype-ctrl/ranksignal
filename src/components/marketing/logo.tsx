import Link from "next/link";
import clsx from "clsx";
import { BRAND } from "@/lib/brand";

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={clsx("inline-flex items-center gap-2.5 rounded-lg text-fg", className)}
      aria-label={`${BRAND.name} home`}
    >
      <span
        aria-hidden
        className="inline-flex size-8 items-center justify-center rounded-lg bg-primary text-small font-bold text-primary-fg shadow-sm"
      >
        {BRAND.name.charAt(0)}
      </span>
      <span className="text-h4 tracking-[-0.02em]">{BRAND.name}</span>
    </Link>
  );
}
