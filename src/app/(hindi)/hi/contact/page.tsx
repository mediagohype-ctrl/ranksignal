import type { Metadata } from "next";
import { Building2, LifeBuoy, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui";
import { BRAND, hasBookingCalendar } from "@/lib/brand";
import { IconTile, JsonLd, PageHero } from "@/components/marketing/ui";
import { ContactForm } from "@/components/marketing/contact-form";
import { BookCallButton, ContactCard, contactWhatsappHref } from "@/components/marketing/contact-card";
import { REPLY_TIME } from "@/components/marketing/contact-copy";
import { hiWebPageLd } from "@/components/marketing/hi/seo";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { siteUrl } from "@/lib/seo/schema";

export const metadata: Metadata = staticPageMetadata("/hi/contact");

const REASONS = [
  { icon: <MessageSquare />, title: "शुरू करने से पहले सवाल", body: "पक्का नहीं कि रिपोर्ट में क्या आता है या कौन-सा प्लान ठीक रहेगा? बेझिझक पूछिए।" },
  { icon: <Building2 />, title: "कस्टम प्लान", body: "कई वेबसाइटें, ब्रांड या शहर हैं, या अपने लोगो वाली रिपोर्ट चाहिए? मोटे तौर पर बताइए कितनी।" },
  { icon: <LifeBuoy />, title: "अकाउंट में मदद", body: "पहले से ग्राहक हैं? अपने बिज़नेस का नाम लिखें, ताकि हम जल्दी मदद कर सकें।" },
];

// Same structure as /contact, in Hindi: the form labels, the contact card and the reply-time line are all Hindi.
export default async function HindiContactPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const topic = Array.isArray(sp.topic) ? sp.topic[0] : sp.topic;
  const isServices = topic === "services";
  const isCustom = topic === "custom";
  const calendar = hasBookingCalendar();
  const base = siteUrl();
  return (
    <>
      <JsonLd data={hiWebPageLd("/hi/contact", { type: "ContactPage", name: `${BRAND.name} से संपर्क करें`, base, extra: { mainEntity: { "@id": `${base}/#organization` } } })} />
      <PageHero
        eyebrow={isServices ? "आप कर दीजिए" : isCustom ? "कस्टम प्लान" : "संपर्क"}
        title={isServices ? "30 मिनट की फ्री कॉल बुक करें" : isCustom ? "कस्टम प्लान के बारे में बात करें" : "असली इंसान से बात करें।"}
        intro={
          isServices ? (
            <p>
              {calendar
                ? "समय चुनिए, या नीचे मैसेज भेजिए। हम साथ बैठकर आपकी वेबसाइट और AI के जवाब देखेंगे।"
                : "नीचे अपने बिज़नेस के बारे में बताइए, हम समय तय करेंगे। हम साथ बैठकर आपकी वेबसाइट और AI के जवाब देखेंगे।"}{" "}
              {REPLY_TIME.hi}
            </p>
          ) : isCustom ? (
            <p>कई वेबसाइटों, ब्रांड या शहरों के लिए, अलग टीम या आपके लोगो वाली रिपोर्ट। {REPLY_TIME.hi}</p>
          ) : (
            <p>प्लान, शुरुआत या अपनी रिपोर्ट के बारे में सवाल है? {REPLY_TIME.hi}</p>
          )
        }
      >
        {calendar && <BookCallButton lang="hi" onDark />}
      </PageHero>
      <section aria-label="संपर्क फ़ॉर्म" className="bg-bg py-14 sm:py-20">
        <div className="container-marketing grid grid-cols-1 gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-14">
          <Card variant="elevated" padding="lg" className="relative">
            <ContactForm
              supportEmail={BRAND.supportEmail}
              topic={isServices ? "services" : isCustom ? "custom" : undefined}
              lang="hi"
              whatsappHref={contactWhatsappHref("hi")}
              callViaForm={!calendar}
            />
          </Card>
          <aside aria-label="हमसे बात करने के और तरीके" className="space-y-8">
            <ContactCard lang="hi" />
            <ul className="space-y-6">
              {REASONS.map((r) => (
                <li key={r.title} className="flex gap-4">
                  <IconTile className="size-10">{r.icon}</IconTile>
                  <div>
                    <h2 className="text-body font-semibold text-fg">{r.title}</h2>
                    <p className="mt-1 text-small leading-relaxed text-muted">{r.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>
    </>
  );
}
