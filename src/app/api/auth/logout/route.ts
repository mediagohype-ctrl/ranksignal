import { handler, json } from "@/lib/api";
import { clearSessionCookie } from "@/lib/auth/session";

export const POST = handler(async () => {
  await clearSessionCookie();
  return json({ ok: true });
});
