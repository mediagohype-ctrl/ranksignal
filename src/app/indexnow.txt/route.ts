// GET /indexnow.txt — IndexNow ownership key (https://www.indexnow.org). Bing, Yandex, Seznam and Naver
// use it to accept instant "this URL changed" pings; Bing's index also feeds ChatGPT search and Copilot.
// Submissions pass keyLocation={APP_URL}/indexnow.txt — see src/lib/seo/indexnow.ts.
import { indexNowKey } from "@/lib/seo/indexnow";

export const dynamic = "force-dynamic";

export function GET() {
  const key = indexNowKey();
  if (!key) return new Response("Not found", { status: 404 });
  return new Response(key, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
}
