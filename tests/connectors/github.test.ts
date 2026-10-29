import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SafeJsonOptions, SafeJsonResult } from "@/lib/net/safe-request";
import {
  GitHubConnector, branchFor, readFrontmatterKey, setFrontmatterKey, splitFrontmatter,
  type GitHubConfig,
} from "@/lib/connectors/github";
import { descriptor, parsePathMap, parseRepository } from "@/lib/connectors/catalog/github";
import { ConnectorConfigError } from "@/lib/connectors/catalog/types";
import { JobError } from "@/lib/types";
import { decryptSecret } from "@/lib/crypto";

// ---- mocks for the generic connect route test (the connector tests inject `request` directly)
const routeState = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  audits: [] as Record<string, unknown>[],
  repoPush: true,
}));
vi.mock("@/lib/db", () => ({
  db: {
    integration: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: "int_1", scopes: null, connectorVersion: "1", createdAt: new Date(), ...data };
        routeState.rows.push(row);
        return row;
      }),
      update: vi.fn(),
    },
    auditLog: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => void routeState.audits.push(data)) },
  },
}));
vi.mock("@/lib/api", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...orig,
    requireSession: vi.fn(async () => ({ userId: "u1", email: "a@b.c", organizationId: "org_1", role: "admin" })),
    requireProject: vi.fn(async () => ({ id: "p1", organizationId: "org_1", websiteUrl: "https://www.acme.test" })),
  };
});
vi.mock("@/lib/net/safe-request", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/net/safe-request")>();
  return {
    ...orig,
    safeRequestJson: vi.fn(async (url: string) => {
      expect(url).toBe("https://api.github.com/repos/acme/site");
      const data = { full_name: "acme/site", default_branch: "main", permissions: { push: routeState.repoPush } };
      return { status: 200, ok: true, data, body: JSON.stringify(data), url, headers: new Headers() };
    }),
  };
});

const TOKEN = "github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz";
const sha = (s: string) => createHash("sha1").update(s).digest("hex");

const BLOG = [
  "---",
  "title: Hello world",
  "description: 'Old description'",
  "date: 2026-01-01",
  "tags:",
  "  - news",
  "---",
  "",
  "# Hello",
  "Body text stays untouched.",
  "",
].join("\n");

interface Pull {
  number: number; html_url: string; state: "open" | "closed"; merged_at: string | null; body: string; title: string;
  head: { ref: string }; base: { ref: string };
}

/** In-memory GitHub REST API. */
function fakeGitHub(o: { push?: boolean; files?: Record<string, string>; rateLimited?: boolean } = {}) {
  const branches = new Map<string, Map<string, string>>();
  branches.set("main", new Map(Object.entries(o.files ?? {
    "content/blog/hello.md": BLOG,
    "content/about.md": "---\ntitle: About\n---\nAbout us\n",
    "_posts/2024-05-01-launch-day.md": "---\ntitle: Launch\nexcerpt: First post\n---\n",
    "src/pages/raw.md": "<div>No frontmatter here</div>\n",
    "src/pages/contact.astro": "<html></html>",
  })));
  const pulls: Pull[] = [];
  const calls: { method: string; path: string; json?: Record<string, unknown> }[] = [];
  const headSha = (b: string) => sha(JSON.stringify([...(branches.get(b) ?? new Map()).entries()]));

  const respond = (status: number, data: unknown, headers: Record<string, string> = {}): SafeJsonResult<unknown> => ({
    status, data, ok: status >= 200 && status < 300, body: JSON.stringify(data), url: "", headers: new Headers(headers),
  });

  const request = vi.fn(async (url: string, opts: SafeJsonOptions): Promise<SafeJsonResult<unknown>> => {
    const u = new URL(url);
    expect(u.host).toBe("api.github.com");
    expect(opts.allowedHosts).toEqual(["api.github.com"]);
    expect(opts.headers?.authorization).toBe(`Bearer ${TOKEN}`);
    expect(opts.headers?.["x-github-api-version"]).toBe("2022-11-28");
    expect(opts.headers?.["user-agent"]).toMatch(/GitHub-Connector/);
    const method = opts.method ?? "GET";
    const json = opts.json as Record<string, unknown> | undefined;
    const path = decodeURIComponent(u.pathname).replace(/^\/repos\/acme\/site/, "");
    calls.push({ method, path, json });
    if (o.rateLimited) return respond(403, { message: "API rate limit exceeded" }, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1893456000" });

    if (path === "" && method === "GET") {
      return respond(200, { full_name: "acme/site", default_branch: "main", archived: false, permissions: { push: o.push ?? true } });
    }
    let m: RegExpExecArray | null;
    if ((m = /^\/branches\/(.+)$/.exec(path))) return branches.has(m[1]) ? respond(200, { name: m[1] }) : respond(404, { message: "Not Found" });
    if ((m = /^\/git\/trees\/(.+)$/.exec(path))) {
      const b = branches.get(m[1]);
      return b ? respond(200, { tree: [...b.keys()].map((p) => ({ path: p, type: "blob" })) }) : respond(404, {});
    }
    if ((m = /^\/git\/ref\/heads\/(.+)$/.exec(path))) {
      return branches.has(m[1]) ? respond(200, { object: { sha: headSha(m[1]) } }) : respond(404, { message: "Not Found" });
    }
    if (path === "/git/refs" && method === "POST") {
      const name = String(json?.ref).replace("refs/heads/", "");
      if (branches.has(name)) return respond(422, { message: "Reference already exists" });
      const from = [...branches.keys()].find((b) => headSha(b) === json?.sha);
      branches.set(name, new Map(branches.get(from ?? "main")));
      return respond(201, { ref: json?.ref });
    }
    if ((m = /^\/git\/refs\/heads\/(.+)$/.exec(path)) && method === "DELETE") {
      branches.delete(m[1]);
      return respond(204, null);
    }
    if ((m = /^\/contents\/(.+)$/.exec(path))) {
      const file = m[1];
      if (method === "GET") {
        const b = branches.get(u.searchParams.get("ref") ?? "main");
        const text = b?.get(file);
        if (text === undefined) return respond(404, { message: "Not Found" });
        return respond(200, { type: "file", encoding: "base64", content: Buffer.from(text).toString("base64"), sha: sha(text), html_url: `https://github.com/acme/site/blob/x/${file}` });
      }
      if (method === "PUT") {
        const b = branches.get(String(json?.branch));
        if (!b) return respond(404, { message: "Branch not found" });
        const current = b.get(file);
        if (current !== undefined && json?.sha !== sha(current)) return respond(409, { message: `${file} does not match ${json?.sha}` });
        const text = Buffer.from(String(json?.content), "base64").toString("utf8");
        b.set(file, text);
        return respond(current === undefined ? 201 : 200, { content: { sha: sha(text) }, commit: { sha: "c0ffee" } });
      }
    }
    if (path === "/pulls" && method === "GET") {
      const head = u.searchParams.get("head");
      const list = head ? pulls.filter((p) => `acme:${p.head.ref}` === head) : [...pulls].reverse();
      return respond(200, list);
    }
    if (path === "/pulls" && method === "POST") {
      if (pulls.some((p) => p.head.ref === json?.head && p.state === "open")) return respond(422, { message: "A pull request already exists" });
      const n = pulls.length + 1;
      const pr: Pull = {
        number: n, html_url: `https://github.com/acme/site/pull/${n}`, state: "open", merged_at: null,
        title: String(json?.title), body: String(json?.body), head: { ref: String(json?.head) }, base: { ref: String(json?.base) },
      };
      pulls.push(pr);
      return respond(201, pr);
    }
    if ((m = /^\/pulls\/(\d+)$/.exec(path)) && method === "PATCH") {
      const pr = pulls.find((p) => p.number === Number(m![1]));
      if (!pr) return respond(404, {});
      pr.state = json?.state as "closed";
      return respond(200, pr);
    }
    if (/^\/issues\/\d+\/comments$/.test(path)) return respond(201, {});
    return respond(404, { message: `unhandled ${method} ${path}` });
  });

  /** Simulate the customer merging a PR. */
  const merge = (n: number) => {
    const pr = pulls.find((p) => p.number === n)!;
    branches.set(pr.base.ref, new Map(branches.get(pr.head.ref)));
    pr.state = "closed";
    pr.merged_at = "2026-10-29T10:00:00Z";
  };

  return { request, branches, pulls, calls, merge };
}

const CONFIG: GitHubConfig = {
  owner: "acme", repo: "site", siteUrl: "https://www.acme.test",
  pathMap: [{ urlPrefix: "/articles/", filePattern: "content/blog/{slug}.md" }],
};

function connector(gh: ReturnType<typeof fakeGitHub>, cfg: Partial<GitHubConfig> = {}) {
  return new GitHubConnector({ ...CONFIG, ...cfg }, { token: TOKEN }, {
    request: gh.request,
    loadChangeContext: async () => ({ rationale: "Description is missing the brand name.", evidence: ["Crawl 2026-10-20: description 15 chars"], approvedBy: "Priya @priya", approvedAt: "2026-10-28T00:00:00Z" }),
  });
}

const KEY = "exec:clxaction1234567890:abcdef0123456789";
const change = { field: "meta_description", before: "Old description", after: "Acme builds safe, fast websites for small businesses." };

describe("github descriptor / connect validation", () => {
  it("parses repository inputs", () => {
    expect(parseRepository("acme/site")).toEqual({ owner: "acme", repo: "site" });
    expect(parseRepository("https://github.com/acme/site.git")).toEqual({ owner: "acme", repo: "site" });
    expect(parseRepository("git@github.com:acme/site.git")).toEqual({ owner: "acme", repo: "site" });
    expect(parseRepository("acme/../x")).toBeNull();
    expect(parseRepository("not a repo")).toBeNull();
  });

  it("splits config and secrets, never putting the token in config", () => {
    const { config, secrets } = descriptor.validateConfig(
      { repository: "https://github.com/acme/site", token: TOKEN, pathMap: "/blog/ => content/blog/{slug}.md; /docs/ => docs/{path}.mdx" },
      { projectWebsiteUrl: "https://www.acme.test/" },
    );
    expect(config).toEqual({
      owner: "acme", repo: "site", siteUrl: "https://www.acme.test",
      pathMap: [{ urlPrefix: "/blog/", filePattern: "content/blog/{slug}.md" }, { urlPrefix: "/docs/", filePattern: "docs/{path}.mdx" }],
    });
    expect(secrets).toEqual({ token: TOKEN });
    expect(JSON.stringify(config)).not.toContain(TOKEN);
  });

  it("rejects invalid input with the offending field", () => {
    const bad = (input: Record<string, unknown>) => {
      try {
        descriptor.validateConfig({ repository: "acme/site", token: TOKEN, siteUrl: "https://acme.test", ...input });
      } catch (e) {
        expect(e).toBeInstanceOf(ConnectorConfigError);
        return (e as ConnectorConfigError).field;
      }
      return "no error";
    };
    expect(bad({ token: "hunter2" })).toBe("token");
    expect(bad({ repository: "acme" })).toBe("repository");
    expect(bad({ siteUrl: "ftp://x" })).toBe("siteUrl");
    expect(bad({ baseBranch: "bad..branch" })).toBe("baseBranch");
    expect(bad({ contentRoot: "../etc" })).toBe("contentRoot");
    expect(() => parsePathMap("/blog/ => ../../etc/passwd")).toThrow(ConnectorConfigError);
  });

  it("declares honest capabilities", () => {
    expect(descriptor.capabilities).toMatchObject({ createDraft: true, publish: false, updateMetadata: true, updateSchema: true, rollback: true, delete: false });
    expect(descriptor.capabilities.limitations.join(" ")).toMatch(/raw HTML\/JSX/);
  });
});

describe("github connector", () => {
  let gh: ReturnType<typeof fakeGitHub>;
  beforeEach(() => {
    gh = fakeGitHub();
  });

  it("testConnection requires push permission and returns owner/repo", async () => {
    expect(await connector(gh).testConnection()).toEqual({ ok: true, identity: "acme/site" });
    const ro = await connector(fakeGitHub({ push: false })).testConnection();
    expect(ro.ok).toBe(false);
    expect(ro.error).toMatch(/can't write/);
    const missing = await connector(gh, { baseBranch: "release" }).testConnection();
    expect(missing).toMatchObject({ ok: false });
  });

  it("maps page URLs to files via pathMap, conventions and slug search", async () => {
    const c = connector(gh);
    expect(await c.resolveResourceId("https://www.acme.test/articles/hello/")).toBe("content/blog/hello.md");
    expect(await c.resolveResourceId("https://acme.test/blog/hello")).toBe("content/blog/hello.md");
    expect(await c.resolveResourceId("https://www.acme.test/about/")).toBe("content/about.md");
    expect(await c.resolveResourceId("https://www.acme.test/2024/05/01/launch-day.html")).toBe("_posts/2024-05-01-launch-day.md");
    expect(await c.resolveResourceId("https://www.acme.test/contact/")).toBeNull();
    expect(await c.resolveResourceId("https://other-site.test/about/")).toBeNull();
    // Tree fetched once per run.
    expect(gh.calls.filter((x) => x.path.startsWith("/git/trees/"))).toHaveLength(1);
  });

  it("reads frontmatter fields; non-frontmatter files return null (manual fallback)", async () => {
    const c = connector(gh);
    const r = await c.getResource("content/blog/hello.md");
    expect(r).toMatchObject({ type: "markdown", version: sha(BLOG), fields: { title: "Hello world", meta_description: "Old description", description_key: "description" } });
    expect(await c.getResource("src/pages/raw.md")).toBeNull();
    expect(await c.getResource("src/pages/contact.astro")).toBeNull();
    expect(await c.getResource("../secrets.md")).toBeNull();
    expect((await c.getResource("_posts/2024-05-01-launch-day.md"))?.fields.meta_description).toBe("First post");
  });

  it("edits frontmatter on a ranksignal/ branch and opens a PR (base untouched)", async () => {
    const c = connector(gh);
    const before = (await c.getResource("content/blog/hello.md"))!;
    const res = await c.applyPatch("content/blog/hello.md", change, before.version, KEY);
    expect(res.ok).toBe(true);
    const branch = branchFor(KEY);
    expect(branch).toBe("ranksignal/1234567890-abcdef01");
    const edited = gh.branches.get(branch)!.get("content/blog/hello.md")!;
    expect(edited).toContain(`description: "${change.after}"`);
    expect(edited).toContain("title: Hello world\n");
    expect(edited).toContain("tags:\n  - news\n---\n\n# Hello\nBody text stays untouched.\n");
    expect(gh.branches.get("main")!.get("content/blog/hello.md")).toBe(BLOG);
    expect(res.newVersion).toBe(sha(edited));
    expect(res.detail).toMatchObject({ prUrl: "https://github.com/acme/site/pull/1", branch, merged: false });

    const pr = gh.pulls[0];
    expect(pr.base.ref).toBe("main");
    expect(pr.title).toMatch(/meta description/i);
    expect(pr.body).toContain("Old description");
    expect(pr.body).toContain(change.after);
    expect(pr.body).toContain("Description is missing the brand name.");
    expect(pr.body).toContain("Crawl 2026-10-20");
    expect(pr.body).toMatch(/Approved by Priya @​priya in RankSignal/); // mention neutralised
    expect(pr.body).toMatch(/never merge/i);
    expect(gh.calls.some((x) => /merge/.test(x.path))).toBe(false);

    expect(await c.validateResource("content/blog/hello.md", change)).toMatchObject({ status: "passed" });
  });

  it("refuses to write when the blob sha no longer matches (conflict)", async () => {
    const c = connector(gh);
    const res = await c.applyPatch("content/blog/hello.md", change, "0000000000000000000000000000000000000000", KEY);
    expect(res).toMatchObject({ ok: false, error: "conflict" });
    expect(gh.calls.filter((x) => x.method === "PUT" || x.method === "POST")).toHaveLength(0);
    expect(gh.branches.has(branchFor(KEY))).toBe(false);
  });

  it("maps a GitHub 409 on PUT to conflict and cleans up the branch", async () => {
    const c = connector(gh);
    const before = (await c.getResource("content/blog/hello.md"))!;
    // Someone edits main between our read and our write.
    const orig = gh.request.getMockImplementation()!;
    gh.request.mockImplementation(async (url, opts) => {
      if (opts.method === "PUT") return { status: 409, data: { message: "is at abc but expected def" }, ok: false, body: "", url, headers: new Headers() };
      return orig(url, opts);
    });
    const res = await c.applyPatch("content/blog/hello.md", change, before.version, KEY);
    expect(res).toMatchObject({ ok: false, error: "conflict" });
    expect(gh.branches.has(branchFor(KEY))).toBe(false);
    expect(gh.pulls).toHaveLength(0);
  });

  it("is idempotent: the same key reuses the existing PR", async () => {
    const before = (await connector(gh).getResource("content/blog/hello.md"))!;
    const first = await connector(gh).applyPatch("content/blog/hello.md", change, before.version, KEY);
    const second = await connector(gh).applyPatch("content/blog/hello.md", change, before.version, KEY);
    expect(second.ok).toBe(true);
    expect(second.detail).toMatchObject({ reused: true, prUrl: first.detail?.prUrl });
    expect(second.newVersion).toBe(first.newVersion);
    expect(gh.pulls).toHaveLength(1);
    expect(gh.calls.filter((x) => x.method === "PUT")).toHaveLength(1);
  });

  it("resumes a crashed attempt (branch committed, PR missing) without re-writing", async () => {
    const before = (await connector(gh).getResource("content/blog/hello.md"))!;
    const orig = gh.request.getMockImplementation()!;
    let failPr = true;
    gh.request.mockImplementation(async (url, opts) => {
      if (opts.method === "POST" && url.endsWith("/pulls") && failPr) {
        failPr = false;
        throw new JobError("network", "transient");
      }
      return orig(url, opts);
    });
    await expect(connector(gh).applyPatch("content/blog/hello.md", change, before.version, KEY)).rejects.toThrow();
    const res = await connector(gh).applyPatch("content/blog/hello.md", change, before.version, KEY);
    expect(res.ok).toBe(true);
    expect(gh.pulls).toHaveLength(1);
    expect(gh.calls.filter((x) => x.method === "PUT")).toHaveLength(1);
  });

  it("rollback closes an unmerged PR (fresh connector finds it by marker)", async () => {
    const before = (await connector(gh).getResource("content/blog/hello.md"))!;
    await connector(gh).applyPatch("content/blog/hello.md", change, before.version, KEY);
    const rb = await connector(gh).rollback("content/blog/hello.md", before);
    expect(rb).toMatchObject({ ok: true, detail: { closed: true, prNumber: 1 } });
    expect(gh.pulls[0].state).toBe("closed");
    expect(gh.pulls[0].merged_at).toBeNull();
    expect(gh.branches.get("main")!.get("content/blog/hello.md")).toBe(BLOG);
  });

  it("rollback of a merged PR opens a revert PR restoring the previous value", async () => {
    const before = (await connector(gh).getResource("content/blog/hello.md"))!;
    await connector(gh).applyPatch("content/blog/hello.md", change, before.version, KEY);
    gh.merge(1);
    const rb = await connector(gh).rollback("content/blog/hello.md", before);
    expect(rb.ok).toBe(true);
    expect(rb.detail).toMatchObject({ revertPrNumber: 2, merged: true });
    const revert = gh.pulls[1];
    expect(revert.head.ref).toBe("ranksignal/revert-1");
    expect(revert.title).toMatch(/Revert/);
    const restored = gh.branches.get("ranksignal/revert-1")!.get("content/blog/hello.md")!;
    expect(readFrontmatterKey(splitFrontmatter(restored)!.lines, "description")).toBe("Old description");
    // Idempotent.
    await connector(gh).rollback("content/blog/hello.md", before);
    expect(gh.pulls).toHaveLength(2);
  });

  it("writes FAQ JSON-LD as a frontmatter block and rejects invalid JSON", async () => {
    const c = connector(gh);
    const before = (await c.getResource("content/about.md"))!;
    const ld = JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: [{ "@type": "Question", name: "Who?", acceptedAnswer: { "@type": "Answer", text: "Acme." } }] });
    const bad = await c.applyPatch("content/about.md", { field: "schema", before: null, after: "{not json" }, before.version, "exec:a1:00ff");
    expect(bad).toMatchObject({ ok: false, error: "invalid_json_ld" });
    const res = await c.applyPatch("content/about.md", { field: "schema", before: null, after: ld }, before.version, "exec:a2:11ff");
    expect(res.ok).toBe(true);
    const text = gh.branches.get(branchFor("exec:a2:11ff"))!.get("content/about.md")!;
    expect(text).toMatch(/^---\ntitle: About\njsonld: \|-\n  \{\n/);
    expect(JSON.parse(readFrontmatterKey(splitFrontmatter(text)!.lines, "jsonld")!)).toEqual(JSON.parse(ld));
    expect(await c.validateResource("content/about.md", { field: "schema", before: null, after: ld })).toMatchObject({ status: "passed" });
  });

  it("writes JSON-LD to a separate file when schemaFilePattern is set", async () => {
    const c = connector(gh, { schemaFilePattern: "data/schema/{slug}.json" });
    const before = (await c.getResource("content/blog/hello.md"))!;
    const ld = '{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[]}';
    const res = await c.applyPatch("content/blog/hello.md", { field: "schema", before: null, after: ld }, before.version, "exec:a3:22ff");
    expect(res.ok).toBe(true);
    expect(res.detail?.filesChanged).toEqual(["data/schema/hello.json"]);
    expect(gh.branches.get(branchFor("exec:a3:22ff"))!.get("data/schema/hello.json")).toBe(`${ld}\n`);
  });

  it("refuses unsupported fields and unsafe paths", async () => {
    const c = connector(gh);
    expect(await c.applyPatch("content/blog/hello.md", { field: "content", before: null, after: "x" }, undefined, KEY)).toMatchObject({ ok: false, error: "unsupported_field" });
    expect(await c.applyPatch(".github/workflows/x.md", change, undefined, KEY)).toMatchObject({ ok: false, error: "invalid_path" });
    expect(await connector(gh, { contentRoot: "site" }).applyPatch("content/blog/hello.md", change, undefined, KEY)).toMatchObject({ ok: false, error: "invalid_path" });
  });

  it("surfaces GitHub rate limits as a clear transient error", async () => {
    const c = connector(fakeGitHub({ rateLimited: true }));
    const err = await c.getResource("content/blog/hello.md").catch((e) => e);
    expect(err).toBeInstanceOf(JobError);
    expect((err as JobError).errorClass).toBe("transient");
    expect((err as Error).message).toMatch(/rate limit/i);
    expect((await c.testConnection()).error).toMatch(/rate limit/i);
  });
});

describe("frontmatter helpers", () => {
  it("round-trips CRLF files and handles quoting / block scalars", () => {
    const text = "---\r\ntitle: \"Quoted \\\"x\\\"\"\r\nsummary: >\r\n  folded\r\n  line\r\n---\r\nbody\r\n";
    const fm = splitFrontmatter(text)!;
    expect(fm.eol).toBe("\r\n");
    expect(readFrontmatterKey(fm.lines, "title")).toBe('Quoted "x"');
    expect(readFrontmatterKey(fm.lines, "summary")).toBe("folded line");
    const lines = setFrontmatterKey(fm.lines, "summary", "new: value # not a comment");
    expect(readFrontmatterKey(lines, "summary")).toBe("new: value # not a comment");
    expect(splitFrontmatter("no frontmatter")).toBeNull();
  });
});

describe("generic connect route", () => {
  const call = async (body: Record<string, unknown>, provider = "github") => {
    const { POST } = await import("@/app/api/integrations/[id]/connect/route");
    const res = await POST(
      new Request(`http://localhost/api/integrations/${provider}/connect`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }),
      { params: Promise.resolve({ id: provider }) },
    );
    return { status: res.status, text: await res.text() };
  };
  beforeEach(() => {
    vi.stubEnv("CREDENTIALS_KEY", "ab".repeat(32));
    routeState.rows.length = 0;
    routeState.audits.length = 0;
    routeState.repoPush = true;
  });

  it("validates, tests, encrypts and stores — never returning or logging the token", async () => {
    const { status, text } = await call({ projectId: "p1", repository: "acme/site", token: TOKEN });
    expect(status).toBe(201);
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain("credentialEncrypted");
    const item = JSON.parse(text).item;
    expect(item).toMatchObject({ provider: "github", health: "healthy", connected: true, connectedBy: "u1" });
    expect(item.config).toMatchObject({ owner: "acme", repo: "site", siteUrl: "https://www.acme.test", identity: "acme/site" });
    expect(item.capabilities).toMatchObject({ publish: false, createDraft: true });

    const row = routeState.rows[0];
    expect(JSON.parse(decryptSecret(String(row.credentialEncrypted)))).toEqual({ token: TOKEN });
    expect(JSON.stringify(row.config)).not.toContain(TOKEN);
    expect(routeState.audits).toHaveLength(1);
    expect(JSON.stringify(routeState.audits[0])).not.toContain(TOKEN);
    expect(routeState.audits[0]).toMatchObject({ action: "integration.connected", resourceId: "int_1" });
  });

  it("rejects invalid config with the field name and stores nothing", async () => {
    const { status, text } = await call({ projectId: "p1", repository: "acme/site", token: "nope" });
    expect(status).toBe(400);
    expect(JSON.parse(text).error).toMatchObject({ code: "invalid_config", details: { field: "token" } });
    expect(routeState.rows).toHaveLength(0);
  });

  it("rejects tokens that cannot push", async () => {
    routeState.repoPush = false;
    const { status, text } = await call({ projectId: "p1", repository: "acme/site", token: TOKEN });
    expect(status).toBe(400);
    expect(JSON.parse(text).error.code).toBe("connection_failed");
    expect(text).not.toContain(TOKEN);
    expect(routeState.rows).toHaveLength(0);
  });

  it("404s unknown providers", async () => {
    const { status } = await call({ projectId: "p1" }, "nope");
    expect(status).toBe(404);
  });
});
