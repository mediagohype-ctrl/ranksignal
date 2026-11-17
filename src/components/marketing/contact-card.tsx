// Contact card for /contact and /hi/contact: WhatsApp (with a ready-typed message), email and the office address.
// Server component. The address comes from BRAND_ADDRESS_* and is shown only when it is set. There is deliberately
// no phone number and there are no opening hours (owner decision: none published).
import { Mail, MapPin, MessageCircle } from "lucide-react";
import { BRAND, WHATSAPP_HELP_MESSAGE, bookCallHref, brandAddressLine, brandWhatsappHref, hasBookingCalendar, hasBrandAddress } from "@/lib/brand";
import { REPLY_TIME, type ContactLang } from "./contact-copy";

const COPY = {
  en: {
    title: "Reach us directly",
    whatsapp: "Chat on WhatsApp",
    whatsappNote: "Opens WhatsApp with a message ready to send.",
    email: "Email",
    office: "Office",
    newTab: "(opens in a new tab)",
    call: "Book a free 30-minute call",
    callNote: "Pick a time that suits you. We look at your website and AI answers together.",
  },
  hi: {
    title: "सीधे हमसे बात करें",
    whatsapp: "WhatsApp पर बात करें",
    whatsappNote: "WhatsApp खुलेगा, मैसेज पहले से लिखा होगा।",
    email: "ईमेल",
    office: "ऑफ़िस",
    newTab: "(नए टैब में खुलता है)",
    call: "30 मिनट की फ्री कॉल बुक करें",
    callNote: "अपनी सुविधा का समय चुनें। हम साथ बैठकर आपकी वेबसाइट और AI के जवाब देखेंगे।",
  },
} as const;

/** Hindi version of the ready-typed WhatsApp message. */
export const WHATSAPP_HELP_MESSAGE_HI = "नमस्ते, मैंने MyWebRank पर अपनी वेबसाइट चेक की है और मुझे मदद चाहिए।";

/** WhatsApp link for the contact pages (also passed to the form for its "sent" screen). */
export function contactWhatsappHref(lang: ContactLang = "en"): string {
  return brandWhatsappHref(lang === "hi" ? WHATSAPP_HELP_MESSAGE_HI : WHATSAPP_HELP_MESSAGE);
}

/**
 * "Book a free 30-minute call" — a prominent button that opens the calendar in a new tab. Renders nothing until
 * BRAND_BOOKING_URL is set; until then the contact form is the way to ask for a call (and says so).
 */
export function BookCallButton({ lang = "en", onDark = false }: { lang?: ContactLang; onDark?: boolean }) {
  if (!hasBookingCalendar()) return null;
  const t = COPY[lang];
  return (
    <div>
      <a
        href={bookCallHref()}
        target="_blank"
        rel="noopener noreferrer"
        className={
          "inline-flex h-14 items-center justify-center rounded-full px-7 text-[1rem] font-semibold shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 " +
          (onDark ? "bg-bg text-fg hover:bg-surface-3 focus-visible:outline-bg" : "bg-primary text-primary-fg hover:bg-primary-hover focus-visible:outline-primary")
        }
      >
        {t.call}
        <span className="sr-only"> {t.newTab}</span>
      </a>
      <p className={"mt-3 max-w-md text-small " + (onDark ? "text-navy-fg/75" : "text-muted")}>{t.callNote}</p>
    </div>
  );
}

export function ContactCard({ lang = "en", className }: { lang?: ContactLang; className?: string }) {
  const t = COPY[lang];
  const whatsapp = contactWhatsappHref(lang);
  const address = hasBrandAddress() ? brandAddressLine() : "";
  const linkCls = "font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg";
  return (
    <div className={"rounded-2xl border border-border bg-surface p-6 shadow-card " + (className ?? "")}>
      <h2 className="text-h4 text-fg">{t.title}</h2>
      <p className="mt-2 text-small font-medium text-fg-soft">{REPLY_TIME[lang]}</p>
      <ul className="mt-5 space-y-4 text-small">
        <li className="flex gap-3">
          <MessageCircle aria-hidden size={18} className="mt-0.5 shrink-0 text-success" />
          <div>
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={linkCls}>
              {t.whatsapp}
              <span className="sr-only"> {t.newTab}</span>
            </a>
            <p className="mt-0.5 text-muted">{t.whatsappNote}</p>
          </div>
        </li>
        <li className="flex gap-3">
          <Mail aria-hidden size={18} className="mt-0.5 shrink-0 text-primary" />
          <div>
            <p className="text-muted">{t.email}</p>
            <a href={`mailto:${BRAND.supportEmail}`} lang="en" className={linkCls}>
              {BRAND.supportEmail}
            </a>
          </div>
        </li>
        {address && (
          <li className="flex gap-3">
            <MapPin aria-hidden size={18} className="mt-0.5 shrink-0 text-primary" />
            <div>
              <p className="text-muted">{t.office}</p>
              <address lang="en" className="not-italic text-fg">
                {address}
              </address>
            </div>
          </li>
        )}
      </ul>
    </div>
  );
}
