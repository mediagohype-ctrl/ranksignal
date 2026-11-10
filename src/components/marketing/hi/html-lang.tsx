"use client";
// The root layout renders <html lang="en"> for the whole site (it cannot see the route without making every page
// dynamic). Hindi pages wrap their content in <div lang="hi"> on the server and, after hydration, set the document
// language too, restoring it when the visitor navigates back to an English page.
import { useEffect } from "react";

export function HtmlLang({ lang }: { lang: string }) {
  useEffect(() => {
    const el = document.documentElement;
    const previous = el.lang;
    el.lang = lang;
    return () => {
      el.lang = previous || "en";
    };
  }, [lang]);
  return null;
}
