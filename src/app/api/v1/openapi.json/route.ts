// GET /api/v1/openapi.json — OpenAPI 3.1 description of the public API. Public (no key needed).
import { buildOpenApiSpec } from "@/lib/public-api/openapi";

export const dynamic = "force-dynamic"; // server URL comes from APP_URL at runtime

export function GET() {
  return new Response(JSON.stringify(buildOpenApiSpec(), null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
