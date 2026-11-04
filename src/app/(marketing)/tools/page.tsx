import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bot, FileText, MessageCircleQuestion, ScanSearch } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { IconTile, PageHero } from "@/components/marketing/ui";

const TITLE = "Free tools to get found on Google and AI";
const DESCRIPTION = "Free, no-sign-up tools for small businesses: check if AI can name you, make FAQ code for Google and AI, and make an AI guide file (llms.txt).";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tools" },
  openGraph: { title: `${TITLE} · ${BRAND.name}`, description: DESCRIPTION, url: "/tools", siteName: BRAND.name, type: "website" },
};

const TOOLS = [
  { href: "/tools/ai-mention-checker", icon: <Bot />, title: "AI mention checker", body: "Can ChatGPT and other AI tools read your website well enough to name you?" },
  { href: "/tools/faq-markup-maker", icon: <MessageCircleQuestion />, title: "FAQ code maker", body: "Turn your customers' questions into info for Google and AI." },
  { href: "/tools/ai-guide-file-maker", icon: <FileText />, title: "AI guide file maker", body: "Tell AI tools who you are and which pages matter (llms.txt)." },
  { href: "/free-check", icon: <ScanSearch />, title: "Free website check", body: "Your score out of 100 and the top things to fix, in 30 seconds." },
];

export default function ToolsPage() {
  return (
    <>
      <PageHero eyebrow="Free tools" title="Free tools to get found on Google and AI" intro={<p>Simple, free and no sign-up. Made for small business owners.</p>} />
      <section className="bg-bg py-12 sm:py-16">
        <ul className="container-marketing grid gap-6 sm:grid-cols-2">
          {TOOLS.map((t) => (
            <li key={t.href}>
              <Link href={t.href} className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-6 transition hover:border-primary">
                <IconTile>{t.icon}</IconTile>
                <h2 className="mt-4 text-h4 text-fg">{t.title}</h2>
                <p className="mt-2 flex-1 text-small text-muted">{t.body}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-small font-medium text-primary">
                  Open tool <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
