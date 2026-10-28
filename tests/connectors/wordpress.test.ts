import { describe, expect, it } from "vitest";
import { WordPressConnector, YOAST_META_KEY } from "@/lib/connectors/wordpress";

function fakeWp() {
  const post = {
    id: 7, link: "https://wp.example/about/", slug: "about", status: "publish", modified_gmt: "2026-10-01T00:00:00",
    title: { raw: "About us" }, excerpt: { raw: "" }, content: { raw: "<p>Hi</p>" },
    meta: { [YOAST_META_KEY]: "" } as Record<string, string>, yoast_head_json: { description: "" },
  };
  const calls: { method: string; url: string; body?: Record<string, unknown> }[] = [];
  const asserted: string[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const method = init.method ?? "GET";
    const body = init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    calls.push({ method, url, body });
    expect(String((init.headers as Record<string, string>).Authorization)).toMatch(/^Basic /);
    if (method === "POST" && body) {
      if (typeof body.title === "string") post.title = { raw: body.title };
      if (body.meta) Object.assign(post.meta, body.meta);
      post.modified_gmt = "2026-10-02T00:00:00";
    }
    return new Response(JSON.stringify(post), { status: 200 });
  }) as unknown as typeof fetch;
  const c = new WordPressConnector({
    siteUrl: "https://wp.example/", username: "u", applicationPassword: "app pass",
    fetchImpl, assertUrl: async (u) => void asserted.push(u),
  });
  return { c, post, calls, asserted };
}

describe("wordpress connector", () => {
  it("reads resources with modified_gmt as version and SSRF-checks every request", async () => {
    const { c, asserted } = fakeWp();
    const r = await c.getResource("pages:7");
    expect(r?.version).toBe("2026-10-01T00:00:00");
    expect(r?.fields.title).toBe("About us");
    expect(asserted[0]).toBe("https://wp.example/wp-json/wp/v2/pages/7?context=edit");
  });

  it("refuses to write on version conflict", async () => {
    const { c, calls } = fakeWp();
    const r = await c.applyPatch("pages:7", { field: "title", before: "About us", after: "About Acme" }, "1999-01-01T00:00:00", "k");
    expect(r).toMatchObject({ ok: false, error: "conflict" });
    expect(calls.filter((x) => x.method === "POST")).toHaveLength(0);
  });

  it("applies, validates and rolls back", async () => {
    const { c } = fakeWp();
    const before = (await c.getResource("pages:7"))!;
    const change = { field: "title", before: "About us", after: "About Acme" };
    const r = await c.applyPatch("pages:7", change, before.version, "k");
    expect(r.ok).toBe(true);
    expect((await c.validateResource("pages:7", change)).status).toBe("passed");
    const rb = await c.rollback("pages:7", before);
    expect(rb.ok).toBe(true);
    expect((await c.getResource("pages:7"))?.fields.title).toBe("About us");
  });

  it("writes meta description through registered Yoast meta", async () => {
    const { c, calls } = fakeWp();
    const before = (await c.getResource("pages:7"))!;
    const r = await c.applyPatch("pages:7", { field: "meta_description", before: null, after: "About Acme widgets." }, before.version, "k");
    expect(r.ok).toBe(true);
    expect(calls.find((x) => x.method === "POST")?.body).toEqual({ meta: { [YOAST_META_KEY]: "About Acme widgets." } });
  });

  it("does not write unsupported fields such as slug", async () => {
    const { c } = fakeWp();
    expect((await c.applyPatch("pages:7", { field: "slug", before: "about", after: "x" }, undefined, "k")).ok).toBe(false);
  });

  it("rejects malformed resource ids", async () => {
    const { c } = fakeWp();
    await expect(c.getResource("users:1")).rejects.toThrow();
  });
});
