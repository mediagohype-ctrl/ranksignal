// "Is this visitor signed in?" for the public website's header and footer ("Open app" instead of "Log in").
// The marketing pages are served from cache, so they cannot read the session cookie while rendering; the browser
// asks this instead. Always 200 with { signedIn }, never cached, and no database query for visitors without a cookie.
import { json } from "@/lib/api";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  let signedIn = false;
  try {
    signedIn = (await getSession()) !== null;
  } catch {
    signedIn = false;
  }
  return json({ signedIn }, { headers: { "Cache-Control": "private, no-store" } });
}
