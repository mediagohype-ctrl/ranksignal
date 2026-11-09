import Link from "next/link";
import { requireStaffPage } from "@/lib/admin/guard";
import { siteBase } from "@/lib/free-check/site-seo";
import { PageHeader } from "@/components/ui";
import { PostEditor, emptyPost } from "@/components/admin/post-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "New post" };

export default async function NewPost() {
  const staff = await requireStaffPage("content.write");
  return (
    <div className="space-y-6">
      <PageHeader
        title="New post"
        description="Fill the boxes top to bottom — the score on the right shows what's missing for Google and AI."
        breadcrumbs={[{ label: "Blog & content", href: "/admin/content" }, { label: "New post" }]}
      />
      <PostEditor initial={emptyPost(staff.user.name?.trim() || staff.user.email.split("@")[0])} canPublish={staff.can("content.publish")} siteUrl={siteBase()} />
      <p className="text-xs text-muted">
        Tip: check the <Link href="/admin/seo?tab=keywords" className="text-primary hover:underline">keyword list</Link> for phrases that still have no page.
      </p>
    </div>
  );
}
