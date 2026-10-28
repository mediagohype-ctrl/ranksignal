import Link from "next/link";
import clsx from "clsx";
import { BRAND } from "@/lib/brand";
import { LogoLockup } from "@/components/brand/logo";

export function Logo({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  return (
    <Link href="/" className={clsx("inline-flex items-center rounded-lg", className)} aria-label={`${BRAND.name} home`}>
      <LogoLockup size={size} />
    </Link>
  );
}
