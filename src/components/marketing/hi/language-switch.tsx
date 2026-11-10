"use client";
// "हिन्दी / English" switch for the marketing header and footer: links to the same page in the other language
// when a translation exists (src/components/marketing/hi/pairs.ts), else to the other language's home page.
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Languages } from "lucide-react";
import { switchTarget } from "./pairs";

export function LanguageSwitch({ className, onClick }: { className?: string; onClick?: () => void }) {
  const t = switchTarget(usePathname() ?? "/");
  return (
    <Link
      href={t.href}
      hrefLang={t.lang}
      lang={t.lang}
      onClick={onClick}
      aria-label={t.lang === "hi" ? "यह पेज हिन्दी में पढ़ें" : "Read this page in English"}
      className={clsx("inline-flex items-center gap-1.5 rounded-md py-1 font-medium text-fg-soft hover:text-fg", className)}
    >
      <Languages aria-hidden size={16} className="shrink-0" />
      {t.label}
    </Link>
  );
}
