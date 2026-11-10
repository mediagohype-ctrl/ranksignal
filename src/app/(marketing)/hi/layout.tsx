import type { ReactNode } from "react";
import { HtmlLang } from "@/components/marketing/hi/html-lang";

// Hindi pages. The root layout's <html lang="en"> is static for the whole site (reading the path there would make
// every page dynamic), so the Hindi content is wrapped in lang="hi" here and HtmlLang updates <html lang> in the
// browser. Search engines get the language from hreflang (metadata alternates + sitemap), og:locale hi_IN,
// WebPage.inLanguage "hi-IN" and the Devanagari text itself. The shared header and footer stay in English.
export default function HindiLayout({ children }: { children: ReactNode }) {
  return (
    <div lang="hi" className="contents">
      <HtmlLang lang="hi" />
      {children}
    </div>
  );
}
