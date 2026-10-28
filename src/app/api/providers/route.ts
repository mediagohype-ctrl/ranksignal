import { handler, json, requireSession } from "@/lib/api";
import { describeProviders } from "@/lib/providers/visibility/registry";

export const dynamic = "force-dynamic";

/** GET /api/providers → { item: { mode, providers[] } }. Which AI engines visibility checks use. No secrets, no env var names. */
export const GET = handler(async () => {
  await requireSession("viewer");
  const { providers, mode } = await describeProviders();
  return json(
    {
      item: {
        mode,
        providers: providers.map((p) => ({
          id: p.id,
          label: p.label,
          configured: p.configured,
          enabled: p.enabled,
          active: p.active,
          simulated: p.simulated,
        })),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
});
