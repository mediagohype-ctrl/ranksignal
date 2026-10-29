// GET: places worth considering — third-party domains AI already cites (latest real check) where the client isn't
// tracked yet, plus the curated starter list. Suggestions only; no outcome is guaranteed.
import { handler, json, requireProject, requireSession } from "@/lib/api";
import { getOffsiteSuggestions } from "@/lib/offsite";

export const GET = handler(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const s = await requireSession("viewer");
  const { id } = await params;
  const project = await requireProject(s, id);
  return json({ item: await getOffsiteSuggestions(s, project.id) });
});
