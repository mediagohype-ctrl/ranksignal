import { MapPin } from "lucide-react";
import { requireAppProject, hasRole } from "@/lib/dashboard/server";
import { asRecord } from "@/lib/dashboard/format";
import { getBusinessProfileView } from "@/lib/business-profile/service";
import { BusinessProfileMonitor } from "@/components/app/business-profile/business-profile-monitor";
import { EmptyState, Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "Google Business Profile" };
export const dynamic = "force-dynamic";

export default async function BusinessProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, project } = await requireAppProject(id);
  const view = await getBusinessProfileView(session.organizationId, project.id, project.websiteUrl);
  const facts = asRecord<unknown>(project.facts);
  const name = typeof facts.name === "string" && facts.name ? facts.name : project.name;
  const city = typeof facts.city === "string" ? facts.city : "";
  const suggestedQuery = [name, city].filter(Boolean).join(" ").slice(0, 200);
  const writable = !session.readOnly;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Local"
        icon={<MapPin />}
        title="Google Business Profile"
        description="How your business looks on Google Maps and in local search: rating, reviews, missing details, and whether it matches your website."
      />
      {!view.configured && !view.profile ? (
        <EmptyState
          bordered
          picture="search"
          title="Business Profile monitoring isn't switched on yet."
          description="The site owner needs to add a Google Places API key (GOOGLE_PLACES_API_KEY) on the server. Nothing else is needed from you."
        />
      ) : (
        <>
          {!view.configured && (
            <Notice tone="warning">Monitoring is paused on this server (no Google Places API key), so the details below may be out of date.</Notice>
          )}
          <BusinessProfileMonitor
            projectId={project.id}
            initial={view}
            canPick={writable && hasRole(session, "admin") && view.configured}
            canRefresh={writable && hasRole(session, "member") && view.configured}
            suggestedQuery={suggestedQuery}
          />
        </>
      )}
      <Notice tone="neutral" title="What this can and can't do">
        We read the public Google Maps view of your listing (Google Places API), so we can watch your rating, review count, the newest few
        reviews and missing details. Replying to reviews, seeing every review, and Google&apos;s own views/calls statistics need the official
        Business Profile API, which requires Google&apos;s approval — that&apos;s planned for later. We never change your listing.
      </Notice>
    </div>
  );
}
