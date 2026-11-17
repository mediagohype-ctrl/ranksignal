// In-app help page (the same three options as the Help button in the top bar). Reached from /app/help.
import { BookOpen, LifeBuoy, Mail, MessageCircle } from "lucide-react";
import { requireAppSession } from "@/lib/dashboard/server";
import { BRAND, WHATSAPP_HELP_MESSAGE, brandWhatsappHref } from "@/lib/brand";
import { HELP_GUIDE_HREF } from "@/components/app/nav";
import { Card, CardBody, LinkButton, PageHeader } from "@/components/ui";

export const metadata = { title: "Help" };

export default async function HelpPage() {
  await requireAppSession();
  const options = [
    {
      icon: <MessageCircle />,
      title: "Chat on WhatsApp",
      text: "The quickest way to reach us. Your message is ready-typed — just press send.",
      href: brandWhatsappHref(WHATSAPP_HELP_MESSAGE),
      label: "Open WhatsApp",
    },
    {
      icon: <BookOpen />,
      title: "Getting started guide",
      text: "How to check your website, read your numbers and work through your To-do list.",
      href: HELP_GUIDE_HREF,
      label: "Read the guide",
    },
    {
      icon: <Mail />,
      title: "Email support",
      text: `Write to ${BRAND.supportEmail}. Tell us your website address and what you were trying to do.`,
      href: `mailto:${BRAND.supportEmail}`,
      label: "Send an email",
    },
  ];
  return (
    <>
      <PageHeader icon={<LifeBuoy />} title="Help" description="Stuck, or not sure what to do next? Ask us." />
      <ul className="grid gap-6 md:grid-cols-3">
        {options.map((o) => (
          <Card as="li" key={o.title}>
            <CardBody className="flex h-full flex-col gap-3">
              <span aria-hidden className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg [&_svg]:size-5">
                {o.icon}
              </span>
              <h2 className="text-h4 text-fg">{o.title}</h2>
              <p className="text-small text-fg-soft">{o.text}</p>
              <div className="mt-auto pt-2">
                {/* external = plain <a> (new tab for web links; mail links open the mail app). */}
                <LinkButton href={o.href} variant="secondary" size="sm" external>
                  {o.label}
                </LinkButton>
              </div>
            </CardBody>
          </Card>
        ))}
      </ul>
    </>
  );
}
