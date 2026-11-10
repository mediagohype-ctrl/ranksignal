import { Zap } from "lucide-react";
import { db } from "@/lib/db";
import { requireAppProject, hasRole } from "@/lib/dashboard/server";
import { fmtDate } from "@/lib/dashboard/format";
import { keyFileUrl, MAX_URLS_PER_HOST_PER_DAY, siteOf } from "@/lib/indexnow-customer/core";
import { getOrCreateIndexNowSite } from "@/lib/indexnow-customer/service";
import { Badge, Card, CardBody, CardHeader, EmptyState, Notice, PageHeader, Table, TD, TH, THead, TR, type Tone } from "@/components/ui";
import { CopyBlock } from "../ai-bots/ingest-token";
import { ManualSubmit, TriggerToggles, VerifyButton } from "./indexnow-controls";

export const metadata = { title: "IndexNow" };

const TRIGGER: Record<string, string> = { fix_published: "Fix published", crawl_changes: "Changed pages", manual: "Sent by hand" };
const STATUS: Record<string, { label: string; tone: Tone }> = {
  queued: { label: "Waiting", tone: "info" },
  sent: { label: "Sent", tone: "success" },
  merged: { label: "Sent (combined)", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  skipped: { label: "Skipped", tone: "neutral" },
};

export default async function IndexNowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, project } = await requireAppProject(id);
  const scope = { organizationId: session.organizationId, projectId: project.id };
  const canManage = hasRole(session, "admin") && !session.readOnly;
  const canSend = hasRole(session, "member") && !session.readOnly;
  const origin = siteOf(project.websiteUrl)?.origin ?? null;

  // The key is created the first time an admin opens this page (read-only viewers never write).
  const site = canManage && origin ? await getOrCreateIndexNowSite(project) : await db.indexNowSite.findFirst({ where: scope });
  const submissions = await db.indexNowSubmission.findMany({ where: scope, orderBy: { createdAt: "desc" }, take: 30 });
  const fileUrl = site && origin ? keyFileUrl(origin, site.key) : null;
  const verified = !!site && site.status === "verified" && site.enabled;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Indexing"
        title="IndexNow"
        description="Tell Bing, Yandex, Seznam and Naver straight away when a page on your site changes, instead of waiting for them to notice. (Bing also feeds ChatGPT search and Copilot.)"
        icon={<Zap />}
        meta={
          site ? (
            verified ? (
              <Badge tone="success">On: key file verified {site.verifiedAt ? fmtDate(site.verifiedAt) : ""}</Badge>
            ) : site.status === "failed" ? (
              <Badge tone="danger">Off: key file check failed</Badge>
            ) : (
              <Badge tone="warning">Off: waiting for the key file</Badge>
            )
          ) : undefined
        }
      />

      {!origin ? (
        <Notice tone="warning">Your project&apos;s website address isn&apos;t valid. Fix it in settings first.</Notice>
      ) : !site ? (
        <EmptyState icon={<Zap />} title="IndexNow isn't set up yet." description="An admin on your team can set it up from this page." bordered />
      ) : (
        <>
          <Card>
            <CardHeader title="1. Put the key file on your site" description="This proves to search engines that the requests really come from the site's owner." />
            <CardBody className="space-y-4 text-small text-fg-soft">
              <p>
                Create a plain text file named <code className="break-all font-mono text-xs text-fg">{site.key}.txt</code> containing only
                the key below, and upload it to your site&apos;s top folder so it opens at:
              </p>
              <p className="break-all font-mono text-xs text-fg">{fileUrl}</p>
              <CopyBlock text={site.key} label="Copy key" />
              <details>
                <summary className="cursor-pointer font-medium text-fg">How to upload it</summary>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>cPanel / FTP: open File Manager, go to public_html (the folder with your home page) and upload the file there.</li>
                  <li>WordPress: upload with your host&apos;s file manager or FTP into the folder that holds wp-config.php. (The IndexNow plugin works too, but it uses its own key; use one or the other.)</li>
                  <li>Shopify, Wix, Webflow and similar: these platforms don&apos;t let you add files at the top level. Many already send IndexNow themselves.</li>
                  <li>Netlify, Vercel and static sites: put the file in the public (or static) folder and deploy.</li>
                </ul>
                <p className="mt-2">
                  We can&apos;t add this file through a connected CMS yet: none of our connectors can write files to your site&apos;s top folder,
                  and we never change your site without your approval.
                </p>
              </details>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="2. Check it and turn IndexNow on" />
            <CardBody className="space-y-3">
              {site.lastCheckError && !verified && <Notice tone="warning">{site.lastCheckError}</Notice>}
              {canManage ? <VerifyButton projectId={project.id} verified={verified} /> : <p className="text-small text-muted">Only admins can turn IndexNow on.</p>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="When we tell search engines" description={`Changed pages are combined into one request and never resent within 24 hours. Up to ${MAX_URLS_PER_HOST_PER_DAY.toLocaleString("en-IN")} pages a day for ${site.host}.`} />
            <CardBody className="space-y-5">
              {canManage ? (
                <TriggerToggles projectId={project.id} onFixPublished={site.onFixPublished} onCrawlChanges={site.onCrawlChanges} enabled={site.enabled} />
              ) : (
                <ul className="list-disc space-y-1 pl-5 text-small text-fg-soft">
                  <li>Fix published: {site.onFixPublished ? "on" : "off"}</li>
                  <li>Changed pages found by a website check: {site.onCrawlChanges ? "on" : "off"}</li>
                </ul>
              )}
              {verified && canSend && <ManualSubmit projectId={project.id} host={site.host} />}
            </CardBody>
          </Card>
        </>
      )}

      <Card>
        <CardHeader title="Recent submissions" />
        {submissions.length === 0 ? (
          <CardBody>
            <p className="text-small text-muted">Nothing sent yet. Once IndexNow is on, changed pages appear here.</p>
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>When</TH>
                  <TH>Why</TH>
                  <TH className="text-right">Pages</TH>
                  <TH>Result</TH>
                  <TH>Details</TH>
                </TR>
              </THead>
              <tbody>
                {submissions.map((s) => {
                  const st = STATUS[s.status] ?? { label: s.status, tone: "neutral" as Tone };
                  return (
                    <TR key={s.id}>
                      <TD className="whitespace-nowrap text-small">{fmtDate(s.sentAt ?? s.createdAt)}</TD>
                      <TD className="text-small">{TRIGGER[s.trigger] ?? s.trigger}</TD>
                      <TD className="text-right tabular-nums">{s.urlCount.toLocaleString("en-IN")}</TD>
                      <TD>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </TD>
                      <TD className="text-xs text-fg-soft">{s.message ?? ""}</TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
