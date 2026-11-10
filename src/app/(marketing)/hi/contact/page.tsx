import type { Metadata } from "next";
import { Building2, Mail, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui";
import { BRAND } from "@/lib/brand";
import { IconTile, JsonLd, PageHero } from "@/components/marketing/ui";
import { ContactForm } from "@/components/marketing/contact-form";
import { EnglishNote } from "@/components/marketing/hi/hi-ui";
import { hiWebPageLd } from "@/components/marketing/hi/seo";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { siteUrl } from "@/lib/seo/schema";

export const metadata: Metadata = staticPageMetadata("/hi/contact");

const REASONS = [
  { icon: <Building2 />, title: "एजेंसी प्लान", body: "कई क्लाइंट साइटें संभालते हैं? मोटे तौर पर बताइए कितनी, और हम सही लिमिट सुझाएँगे।" },
  { icon: <MessageSquare />, title: "शुरू करने से पहले सवाल", body: "पक्का नहीं कि रिपोर्ट में क्या आता है या मंज़ूरी कैसे काम करती है? बेझिझक पूछिए।" },
  { icon: <Mail />, title: "सपोर्ट", body: "पहले से ग्राहक हैं? अपने वर्कस्पेस का नाम लिखें, ताकि हम जल्दी मदद कर सकें।" },
];

export default async function HindiContactPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const topic = Array.isArray(sp.topic) ? sp.topic[0] : sp.topic;
  const isServices = topic === "services";
  const base = siteUrl();
  return (
    <>
      <JsonLd data={hiWebPageLd("/hi/contact", { type: "ContactPage", name: `${BRAND.name} से संपर्क करें`, base, extra: { mainEntity: { "@id": `${base}/#organization` } } })} />
      <PageHero
        eyebrow={isServices ? "हमारी सेवा" : "संपर्क"}
        title={isServices ? "फ्री स्ट्रैटेजी कॉल बुक करें" : "हमसे बात करें"}
        intro={
          isServices ? (
            <p>अपने बिज़नेस के बारे में बताइए। हम 30 मिनट की फ्री कॉल रखेंगे और साथ बैठकर आपकी साइट और AI के जवाब देखेंगे।</p>
          ) : (
            <p>एजेंसी प्लान, शुरुआत या अपनी रिपोर्ट के बारे में सवाल है? हमें मैसेज भेजिए, हमारी टीम का कोई असली व्यक्ति जवाब देगा।</p>
          )
        }
      />
      <section aria-label="संपर्क फ़ॉर्म" className="bg-bg py-14 sm:py-20">
        <div className="container-marketing grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-14">
          <div>
            <Card variant="elevated" padding="lg" className="relative">
              <div lang="en">
                <ContactForm supportEmail={BRAND.supportEmail} topic={isServices ? "services" : undefined} />
              </div>
            </Card>
            <EnglishNote>
              फ़ॉर्म के लेबल अभी अंग्रेज़ी में हैं, पर आप अपना मैसेज हिन्दी में लिख सकते हैं। हम आम तौर पर एक कामकाजी दिन में जवाब देते हैं।
            </EnglishNote>
          </div>
          <aside aria-label="हम कैसे मदद कर सकते हैं" className="space-y-6">
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
            <p className="rounded-xl bg-surface-2 px-4 py-3 text-small text-fg-soft">
              ईमेल करना पसंद है? लिखें{" "}
              <a href={`mailto:${BRAND.supportEmail}`} className="font-medium text-primary underline-offset-4 hover:underline">
                {BRAND.supportEmail}
              </a>{" "}
              पर।
            </p>
          </aside>
        </div>
      </section>
    </>
  );
}
