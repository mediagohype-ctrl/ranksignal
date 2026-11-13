"use client";
// Language switch for the marketing header and footer: links to the same page in the other language when a
// translation exists (src/components/marketing/hi/pairs.ts), else to the other language's home page.
//   variant "link"   — "हिन्दी" / "English" text link (footer, mobile menu)
//   variant "toggle" — compact "EN | हि" segmented switch, current language highlighted (desktop header)
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Languages } from "lucide-react";
import { switchTarget } from "./pairs";

export function LanguageSwitch({
  className,
  onClick,
  variant = "link",
}: {
  className?: string;
  onClick?: () => void;
  variant?: "link" | "toggle";
}) {
  const t = switchTarget(usePathname() ?? "/");
  const label = t.lang === "hi" ? "यह पेज हिन्दी में पढ़ें" : "Read this page in English";

  if (variant === "toggle") {
    // The page is in the language we are NOT switching to.
    const current = t.lang === "hi" ? "en" : "hi";
    const seg = "inline-flex h-7 min-w-9 items-center justify-center rounded-full px-2.5 text-xs font-semibold";
    return (
      <div role="group" aria-label="Language" className={clsx("inline-flex items-center rounded-full border border-border bg-surface p-0.5", className)}>
        {(["en", "hi"] as const).map((lang) =>
          lang === current ? (
            <span key={lang} aria-current="true" lang={lang} className={clsx(seg, "bg-fg text-bg")}>
              {lang === "en" ? "EN" : "हि"}
            </span>
          ) : (
            <Link
              key={lang}
              href={t.href}
              hrefLang={t.lang}
              lang={t.lang}
              onClick={onClick}
              aria-label={label}
              className={clsx(seg, "text-fg-soft hover:bg-surface-2 hover:text-fg")}
            >
              {lang === "en" ? "EN" : "हि"}
            </Link>
          ),
        )}
      </div>
    );
  }

  return (
    <Link
      href={t.href}
      hrefLang={t.lang}
      lang={t.lang}
      onClick={onClick}
      aria-label={label}
      className={clsx("inline-flex items-center gap-1.5 rounded-md py-1 font-medium text-fg-soft hover:text-fg", className)}
    >
      <Languages aria-hidden size={16} className="shrink-0" />
      {t.label}
    </Link>
  );
}
