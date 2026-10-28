import { handler, json, requireSession } from "@/lib/api";
import { CONNECTOR_CATALOG } from "@/lib/connectors/registry";

export const GET = handler(async () => {
  await requireSession("viewer");
  return json({ items: CONNECTOR_CATALOG });
});
