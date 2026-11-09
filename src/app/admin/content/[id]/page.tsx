import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/admin/guard";
import { faqsOf } from "@/lib/content/posts";
import { siteBase } from "@/lib/free-check/site-seo";
import { PageHeader } from "@/components/ui";
import { PostEditor } from "@/components/admin/post-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit post" };

export default async function EditPost({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffPage("content.view");
  const { id } = await params;
  const p = await db.blogPost.findUnique({ where: { id } });
  if (!p) notFound();
  const faqs = faqsOf(p);
  return (
    <div className="space-y-6">
      <PageHeader title={p.title} breadcrumbs={[{ label: "Blog & content", href: "/admin/content" }, { label: "Edit" }]} />
      <PostEditor
        siteUrl={siteBase()}
        canPublish={staff.can("content.publish")}
        canWrite={staff.can("content.write")}
        initial={{
          id: p.id,
          slug: p.slug,
          title: p.title,
          metaTitle: p.metaTitle ?? "",
          description: p.description,
          answer: p.answer,
          body: p.body,
          keyPoints: p.keyPoints.length ? p.keyPoints : ["", "", ""],
          faqs: faqs.length ? faqs : [{ q: "", a: "" }],
          keywords: p.keywords,
          category: p.category,
          coverImageUrl: p.coverImageUrl ?? "",
          authorName: p.authorName,
          noindex: p.noindex,
          status: p.status,
          slugLocked: !!p.publishedAt,
        }}
      />
    </div>
  );
}
