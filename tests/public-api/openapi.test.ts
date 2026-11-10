// The OpenAPI spec lists exactly the v1 routes that exist, each GET-only and secured by the API key.
import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildOpenApiSpec } from "@/lib/public-api/openapi";

const V1 = resolve(__dirname, "../../src/app/api/v1");

function routePaths(dir: string, prefix = "/api/v1"): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (!statSync(p).isDirectory()) continue;
    const seg = name.replace(/^\[(.+)\]$/, "{$1}");
    const path = `${prefix}/${seg}`;
    if (readdirSync(p).includes("route.ts")) out.push(path);
    out.push(...routePaths(p, path));
  }
  return out;
}

describe("OpenAPI spec", () => {
  const spec = buildOpenApiSpec("https://example.test/");

  it("documents every v1 data route and nothing else", () => {
    const routes = routePaths(V1).filter((p) => p !== "/api/v1/openapi.json").sort();
    expect(Object.keys(spec.paths).sort()).toEqual(routes);
  });

  it("is read-only and uses the bearer key", () => {
    for (const [path, ops] of Object.entries(spec.paths)) {
      expect(Object.keys(ops), path).toEqual(["get"]);
      for (const code of ["200", "401", "404", "429"]) expect((ops as { get: { responses: Record<string, unknown> } }).get.responses[code], `${path} ${code}`).toBeTruthy();
    }
    expect(spec.security).toEqual([{ apiKey: [] }]);
    expect(spec.servers[0].url).toBe("https://example.test");
  });

  it("has unique operation ids and resolvable schema refs", () => {
    const ids = Object.values(spec.paths).map((o) => (o as { get: { operationId: string } }).get.operationId);
    expect(new Set(ids).size).toBe(ids.length);
    const json = JSON.stringify(spec);
    for (const m of json.matchAll(/"#\/components\/(schemas|responses)\/([A-Za-z]+)"/g)) {
      expect((spec.components as Record<string, Record<string, unknown>>)[m[1]][m[2]], m[0]).toBeTruthy();
    }
  });
});
