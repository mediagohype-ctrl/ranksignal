// Tell Bing / Yandex / Seznam / Naver (IndexNow) that our public pages changed. Run after each deploy:
//   APP_URL=https://mywebrank.tech INDEXNOW_KEY=... npm run indexnow
// Optional args: specific paths (default: every public marketing URL), e.g. npm run indexnow -- /learn/what-is-geo
// The same submission is available to the SEO team in /admin/seo.
import { submitIndexNow } from "@/lib/seo/indexnow";

submitIndexNow({ paths: process.argv.slice(2) })
  .then((r) => {
    console.log(`IndexNow: HTTP ${r.status} — ${r.message}`);
    if (!r.ok) process.exit(1);
  })
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
