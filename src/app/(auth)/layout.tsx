import Link from "next/link";
import { BarChart3, CheckCircle2, Eye, ShieldCheck, Wrench } from "lucide-react";
import { BRAND } from "@/lib/brand";

const VALUES = [
  {
    icon: Eye,
    title: "See what AI says about you",
    body: "We ask AI assistants the questions your buyers ask and show whether your brand is mentioned, recommended or cited.",
  },
  {
    icon: Wrench,
    title: "Get plain-English fixes",
    body: "A clear report on what's holding your website back — what's wrong, why it matters and how to fix it.",
  },
  {
    icon: ShieldCheck,
    title: "Stay in control",
    body: "Nothing changes on your site without your OK. Every edit is logged and can be rolled back.",
  },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-bg lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Brand panel */}
      <aside className="bg-hero relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 opacity-[0.07]" />
        <Link href="/" className="relative flex items-center gap-2.5 text-h4 tracking-tight text-navy-fg">
          <span aria-hidden className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-fg shadow-md">
            <BarChart3 size={18} />
          </span>
          {BRAND.name}
        </Link>

        <div className="relative max-w-lg">
          <p className="eyebrow text-navy-fg/75">AI search visibility</p>
          <h2 className="mt-3 text-h1 text-balance text-navy-fg">Know how AI answers talk about your business.</h2>
          <ul className="mt-10 space-y-6">
            {VALUES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span
                  aria-hidden
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-navy-fg/15 bg-navy-fg/10 text-navy-fg"
                >
                  <Icon size={18} />
                </span>
                <div>
                  <div className="text-h4 text-navy-fg">{title}</div>
                  <p className="mt-1 text-small text-navy-fg/75">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative flex items-center gap-2 text-xs text-navy-fg/75">
          <CheckCircle2 size={14} aria-hidden />
          We measure and report. We never promise rankings or placements.
        </p>
      </aside>

      {/* Form side */}
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-5 py-5 sm:px-8 lg:hidden">
          <Link href="/" className="flex items-center gap-2 text-h4 tracking-tight text-fg">
            <span aria-hidden className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-fg">
              <BarChart3 size={16} />
            </span>
            {BRAND.name}
          </Link>
        </header>
        <main className="flex flex-1 items-center justify-center px-5 pb-12 pt-4 sm:px-8 lg:py-12">
          <div className="w-full max-w-md animate-fade-in">{children}</div>
        </main>
        <footer className="px-5 pb-6 text-center text-xs text-muted sm:px-8">
          © {new Date().getFullYear()} {BRAND.name} · Need help?{" "}
          <a href={`mailto:${BRAND.supportEmail}`} className="font-medium text-primary hover:underline">
            {BRAND.supportEmail}
          </a>
        </footer>
      </div>
    </div>
  );
}
