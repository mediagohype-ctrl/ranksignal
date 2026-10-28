// GET /api/admin/search?q= — typeahead across organizations, users, projects and leads.
import { handler, json } from "@/lib/api";
import { requireStaffApi } from "@/lib/admin/guard";
import { adminSearch } from "@/lib/admin/search";

export const GET = handler(async (req: Request) => {
  await requireStaffApi();
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return json({ items: await adminSearch(q, 5) });
});
