// Health check for Render: 200 when the app can reach the database, 503 otherwise. No tenant data.
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: "database_unreachable" }, { status: 503 });
  }
}
