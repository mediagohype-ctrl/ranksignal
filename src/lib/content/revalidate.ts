// Blog posts are pre-rendered (src/app/(marketing)/blog/[slug]/page.tsx). After any change in the admin editor,
// drop the cached copies so the live site shows it at once: every post page (covers renamed or unpublished
// slugs and the "related" lists) and the /blog listing. The sitemap, RSS and llms.txt are generated per request.
import { revalidatePath } from "next/cache";

export function refreshBlogPages(): void {
  try {
    revalidatePath("/blog/[slug]", "page");
    revalidatePath("/blog");
  } catch (e) {
    console.warn("[blog] could not refresh cached pages", (e as Error)?.name ?? "error");
  }
}
