// GitHub connector: proposes changes to Git-based sites (Hugo, Jekyll, Astro, Next MDX, ...) as pull
// requests. Nothing is ever merged by us — the PR is the draft and merging is the customer's call.
//
// Resources are repository file paths (e.g. "content/blog/hello.md"). Version = git blob sha.
// Writable: Markdown/MDX YAML frontmatter `title`, description (`description` | `meta_description` |
// `excerpt`, whichever the file uses), and FAQ/other JSON-LD as a frontmatter block (default key
// `jsonld`) or, when configured, as a separate JSON file. JSON-LD files (.json/.jsonld) can be
// edited directly. Files without YAML frontmatter (raw HTML/JSX) resolve to null → manual export.
//
// All calls go to api.github.com via safeRequest (SSRF-safe, host allow-listed). Never logs.
import { createHash } from "node:crypto";
import { BRAND } from "@/lib/brand";
import {
  JobError,
  type Connector, type ConnectorCapabilities, type ConnectorResource, type PatchResult, type ProposedChange,
} from "@/lib/types";
import { safeRequestJson, SafeRequestError, type SafeJsonOptions, type SafeJsonResult } from "@/lib/net/safe-request";
import { simpleDiff } from "@/lib/connectors/manual";

// ---------------------------------------------------------------- config

export interface GitHubPathRule {
  /** Public URL path prefix, e.g. "/blog/". */
  urlPrefix: string;
  /** Repo file pattern relative to contentRoot. {slug} = last URL segment, {path} = URL path after the prefix. */
  filePattern: string;
}

export interface GitHubConfig {
  owner: string;
  repo: string;
  /** Defaults to the repository's default branch. */
  baseBranch?: string;
  /** Optional path prefix (e.g. "site/" in a monorepo). Patterns are relative to it; nothing outside it is written. */
  contentRoot?: string;
  /** Public site URL used to map page URLs to files. */
  siteUrl: string;
  pathMap?: GitHubPathRule[];
  /** Frontmatter key for JSON-LD blocks (default "jsonld"). */
  schemaKey?: string;
  /** When set, JSON-LD is written to this file instead of frontmatter, e.g. "data/schema/{slug}.json". */
  schemaFilePattern?: string;
}

export interface GitHubSecrets {
  token: string;
}

export interface ChangeContext {
  actionType?: string;
  rationale?: string;
  evidence?: string[];
  approvedBy?: string | null;
  approvedAt?: Date | string | null;
}

type RequestFn = (url: string, opts: SafeJsonOptions) => Promise<SafeJsonResult<unknown>>;

export interface GitHubConnectorOptions {
  /** Test seam; defaults to safeRequestJson. */
  request?: RequestFn;
  /** Loads approval/rationale for the PR body. Defaults to a tenant-scoped DB lookup when organizationId is set. */
  loadChangeContext?: (actionId: string) => Promise<ChangeContext | null>;
  organizationId?: string;
  timeoutMs?: number;
}

// ---------------------------------------------------------------- constants

const API = "https://api.github.com";
const API_VERSION = "2022-11-28";
const USER_AGENT = `${BRAND.name.replace(/[^A-Za-z0-9.-]/g, "")}-GitHub-Connector/1.0`;
const MD_EXT = /\.(md|mdx|markdown)$/i;
const JSON_EXT = /\.(json|jsonld)$/i;
const DEFAULT_ROOTS = ["content/", "src/content/", "_posts/", "src/pages/", "src/posts/", "posts/", "blog/", "docs/", "pages/", "_pages/"];
const DESCRIPTION_KEYS = ["description", "meta_description", "excerpt"] as const;
export const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
export const REPO_RE = /^(?!\.{1,2}$)[A-Za-z0-9._-]{1,100}$/;
export const BRANCH_RE = /^(?!\/|.*\/\/|.*\.\.|.*@\{|.*\.lock$)[A-Za-z0-9._\/-]{1,200}$/;
const FIELD_LABEL: Record<string, string> = {
  title: "Page title",
  meta_description: "Meta description",
  description: "Meta description",
  excerpt: "Excerpt",
  schema: "Structured data (JSON-LD)",
};

export const GITHUB_CAPABILITIES: ConnectorCapabilities = {
  readPages: true,
  createDraft: true, // the pull request is the draft
  updateContent: false,
  updateMetadata: true,
  updateSchema: true, // frontmatter JSON-LD block or a JSON-LD file
  preview: true,
  publish: false, // we never merge — merging is the customer's decision
  revisionHistory: true,
  rollback: true, // closes the PR if unmerged; opens a revert PR if merged
  delete: false,
  resourceTypes: ["markdown", "jsonld"],
  limitations: [
    "Changes arrive as pull requests. Nothing goes live until someone on your team merges the PR and the site redeploys; we never merge.",
    "Only Markdown/MDX files with YAML frontmatter (---) are edited: title, description/meta_description/excerpt, and JSON-LD. Pages written as raw HTML/JSX/templates (and TOML +++ frontmatter) fall back to copy-ready manual instructions.",
    "JSON-LD in frontmatter (key \"jsonld\" by default) only appears on the page if your theme/layout outputs it in a <script type=\"application/ld+json\"> tag. Alternatively set a schema file pattern so it is written as a separate JSON file.",
    "Page URLs are matched to files by your URL-to-file rules, or by searching content/, src/content/, _posts/ and similar folders for a matching slug. Ambiguous matches fall back to manual instructions.",
    "Page body content, slugs/URLs, redirects and deletions are never changed.",
    "Rollback closes our pull request if it is still open; if it was merged, we open a revert pull request for you to merge.",
  ],
};

// ---------------------------------------------------------------- frontmatter helpers (exported for tests)

export interface Frontmatter {
  bom: string;
  eol: string;
  lines: string[];
  closeLine: string;
  body: string[];
}

export function splitFrontmatter(text: string): Frontmatter | null {
  const bom = text.startsWith("﻿") ? "﻿" : "";
  const src = bom ? text.slice(1) : text;
  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  const all = src.split(/\r?\n/);
  if (all[0]?.trimEnd() !== "---") return null;
  for (let i = 1; i < all.length; i++) {
    const t = all[i].trimEnd();
    if (t === "---" || t === "...") return { bom, eol, lines: all.slice(1, i), closeLine: all[i], body: all.slice(i + 1) };
  }
  return null;
}

export function joinFrontmatter(fm: Frontmatter): string {
  return fm.bom + ["---", ...fm.lines, fm.closeLine, ...fm.body].join(fm.eol);
}

const isIndented = (l: string) => /^[ \t]+\S/.test(l);
const keyLine = (key: string) => new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:(.*)$`);

/** [start, end) line range of a top-level key including its continuation lines; null when absent. */
function keyRange(lines: string[], key: string): [number, number] | null {
  const re = keyLine(key);
  const start = lines.findIndex((l) => re.test(l));
  if (start === -1) return null;
  let end = start + 1;
  for (let i = start + 1; i < lines.length; i++) {
    if (isIndented(lines[i])) end = i + 1;
    else if (lines[i].trim() === "") continue;
    else break;
  }
  return [start, end];
}

/** Read a top-level scalar (plain, quoted or block scalar). Returns null when absent, empty or non-scalar. */
export function readFrontmatterKey(lines: string[], key: string): string | null {
  const range = keyRange(lines, key);
  if (!range) return null;
  const [start, end] = range;
  const first = (keyLine(key).exec(lines[start])?.[1] ?? "").trim();
  const cont = lines.slice(start + 1, end);
  if (/^[|>][-+0-9]*\s*(#.*)?$/.test(first)) {
    const nonBlank = cont.filter((l) => l.trim());
    const indent = Math.min(...nonBlank.map((l) => l.length - l.trimStart().length));
    const stripped = cont.map((l) => (l.trim() ? l.slice(indent) : ""));
    while (stripped.length && stripped[stripped.length - 1] === "") stripped.pop();
    return first.startsWith(">") ? stripped.join("\n").replace(/([^\n])\n(?=[^\n])/g, "$1 ") : stripped.join("\n");
  }
  if (first === "") {
    // Nested mapping / sequence → not a scalar we manage.
    return null;
  }
  const joined = [first, ...cont.map((l) => l.trim())].join(" ").trim();
  if (joined.startsWith('"')) {
    try {
      return JSON.parse(joined) as string;
    } catch {
      return joined.replace(/^"|"$/g, "");
    }
  }
  if (joined.startsWith("'")) return joined.replace(/^'|'$/g, "").replace(/''/g, "'");
  const plain = joined.replace(/\s+#.*$/, "").trim();
  if (plain === "~" || plain === "null") return null;
  return plain;
}

/** Set (or with null, remove) a top-level key. Scalars are written as YAML double-quoted strings. */
export function setFrontmatterKey(lines: string[], key: string, value: string | null, style: "scalar" | "block" = "scalar"): string[] {
  const range = keyRange(lines, key);
  let replacement: string[] = [];
  if (value !== null) {
    replacement = style === "block"
      ? [`${key}: |-`, ...value.split(/\r?\n/).map((l) => (l ? `  ${l}` : ""))]
      : [`${key}: ${JSON.stringify(value)}`];
  }
  if (!range) return value === null ? lines : [...lines, ...replacement];
  return [...lines.slice(0, range[0]), ...replacement, ...lines.slice(range[1])];
}

// ---------------------------------------------------------------- misc helpers

const norm = (v: string | null | undefined) => (v ?? "").replace(/\s+/g, " ").trim();
const enc = (s: string) => encodeURIComponent(s);
const encPath = (p: string) => p.split("/").map(enc).join("/");
const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

function jsonEq(a: string | null | undefined, b: string | null | undefined): boolean {
  try {
    return JSON.stringify(JSON.parse(a ?? "")) === JSON.stringify(JSON.parse(b ?? ""));
  } catch {
    return norm(a) === norm(b);
  }
}

function fieldEq(field: string, a: string | null | undefined, b: string | null | undefined) {
  return field === "schema" ? jsonEq(a, b) : norm(a) === norm(b);
}

/** Neutralise @mentions / HTML in untrusted text placed into a PR body. */
function mdSafe(s: string): string {
  return s.replace(/@/g, "@​").replace(/</g, "&lt;");
}

function fence(s: string, lang = ""): string {
  const longest = Math.max(2, ...(s.match(/`+/g) ?? []).map((m) => m.length));
  const f = "`".repeat(longest + 1);
  return `${f}${lang}\n${s}\n${f}`;
}

/** Branch name for an execution idempotency key ("exec:<actionId>:<draftHash>"). */
export function branchFor(idempotencyKey: string): string {
  const m = /^exec:([^:]+):([0-9a-f]+)/i.exec(idempotencyKey);
  const short = m
    ? `${m[1].slice(-10)}-${m[2].slice(0, 8)}`
    : createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 16);
  return `ranksignal/${short.replace(/[^A-Za-z0-9-]/g, "").toLowerCase()}`;
}

export function actionIdFromKey(idempotencyKey: string): string | null {
  return /^exec:([^:]+):/.exec(idempotencyKey)?.[1] ?? null;
}

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 80) || "draft";
}

function marker(o: { path: string; field: string; baseSha?: string | null }) {
  return `<!-- ranksignal path=${o.path} field=${o.field} base-sha=${o.baseSha ?? "none"} -->`;
}

function parseMarker(body: string | null | undefined): { path: string; field: string; baseSha: string } | null {
  const m = /<!-- ranksignal path=(\S+) field=(\S+) base-sha=(\S+) -->/.exec(body ?? "");
  return m ? { path: m[1], field: m[2], baseSha: m[3] } : null;
}

// ---------------------------------------------------------------- GitHub API shapes

interface GhRepo {
  full_name?: string;
  default_branch?: string;
  archived?: boolean;
  permissions?: { push?: boolean; admin?: boolean };
}
interface GhFile {
  type?: string;
  encoding?: string;
  content?: string;
  sha: string;
  size?: number;
  html_url?: string;
}
interface GhPull {
  number: number;
  html_url: string;
  state: "open" | "closed";
  merged_at?: string | null;
  body?: string | null;
  head: { ref: string; sha?: string };
  base: { ref: string };
}
interface FileRead {
  path: string;
  text: string;
  sha: string;
  htmlUrl?: string;
}
interface PlannedEdit {
  path: string;
  /** null = delete the file. */
  content: string | null;
  /** Current blob sha of `path` (omitted for new files). */
  sha?: string;
  unchanged: boolean;
}

// ---------------------------------------------------------------- connector

export class GitHubConnector implements Connector {
  id = "github";
  private request: RequestFn;
  private timeoutMs: number;
  private repoPath: string;
  private root: string;
  private repoMeta: GhRepo | null = null;
  private trees = new Map<string, string[]>();
  private urlByPath = new Map<string, string>();
  private prByPath = new Map<string, { pr: GhPull; field: string }>();

  constructor(private cfg: GitHubConfig, private secrets: GitHubSecrets, private opts: GitHubConnectorOptions = {}) {
    if (!OWNER_RE.test(cfg.owner ?? "") || !REPO_RE.test(cfg.repo ?? "")) throw new Error("Invalid GitHub owner/repo");
    if (cfg.baseBranch && !BRANCH_RE.test(cfg.baseBranch)) throw new Error("Invalid base branch name");
    if (!secrets?.token) throw new Error("GitHub token missing");
    this.request = opts.request ?? ((url, o) => safeRequestJson(url, o));
    this.timeoutMs = opts.timeoutMs ?? 20_000;
    this.repoPath = `/repos/${enc(cfg.owner)}/${enc(cfg.repo)}`;
    this.root = normalizeRoot(cfg.contentRoot);
  }

  getCapabilities() {
    return GITHUB_CAPABILITIES;
  }

  // ---- HTTP

  private async gh<T>(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: string, json?: unknown): Promise<{ status: number; data: T | null }> {
    let res: SafeJsonResult<unknown>;
    try {
      res = await this.request(`${API}${path}`, {
        method,
        json,
        timeoutMs: this.timeoutMs,
        maxBytes: 25 * 1024 * 1024,
        allowedHosts: ["api.github.com"],
        headers: {
          authorization: `Bearer ${this.secrets.token}`,
          accept: "application/vnd.github+json",
          "x-github-api-version": API_VERSION,
          "user-agent": USER_AGENT,
        },
      });
    } catch (e) {
      if (e instanceof SafeRequestError) throw new JobError(`GitHub request failed (${e.code})`, e.permanent ? "permanent" : "transient");
      throw e;
    }
    const msg = String((res.data as { message?: string } | null)?.message ?? "");
    if ((res.status === 403 || res.status === 429) && (res.headers.get("x-ratelimit-remaining") === "0" || res.headers.has("retry-after") || /rate limit/i.test(msg))) {
      const reset = Number(res.headers.get("x-ratelimit-reset"));
      const retryAfter = Number(res.headers.get("retry-after"));
      const when = Number.isFinite(reset) && reset > 0
        ? ` until ${new Date(reset * 1000).toISOString().slice(11, 16)} UTC`
        : Number.isFinite(retryAfter) && retryAfter > 0 ? ` for ${retryAfter}s` : "";
      throw new JobError(`GitHub API rate limit reached — paused${when}. The change will be retried.`, "transient");
    }
    if (res.status === 401) throw new JobError("GitHub rejected the access token (expired or revoked). Reconnect GitHub with a new token.", "permanent");
    if (res.status >= 500) throw new JobError(`GitHub API error (HTTP ${res.status})`, "transient");
    return { status: res.status, data: res.data as T | null };
  }

  private async getRepo(): Promise<GhRepo> {
    if (this.repoMeta) return this.repoMeta;
    const { status, data } = await this.gh<GhRepo>("GET", this.repoPath);
    if (status === 404) throw new JobError("GitHub repository not found, or the token cannot access it.", "permanent");
    if (status === 403) throw new JobError("The GitHub token lacks permission for this repository.", "permanent");
    if (status !== 200 || !data) throw new JobError(`GitHub repository lookup failed (HTTP ${status})`, "permanent");
    this.repoMeta = data;
    return data;
  }

  private async baseBranch(): Promise<string> {
    if (this.cfg.baseBranch) return this.cfg.baseBranch;
    const repo = await this.getRepo();
    return repo.default_branch || "main";
  }

  private async getTree(branch: string): Promise<string[]> {
    const cached = this.trees.get(branch);
    if (cached) return cached;
    const { status, data } = await this.gh<{ tree?: { path: string; type: string }[] }>(
      "GET", `${this.repoPath}/git/trees/${encPath(branch)}?recursive=1`,
    );
    if (status !== 200) throw new JobError(`Could not list repository files (HTTP ${status})`, "permanent");
    const files = (data?.tree ?? []).filter((t) => t.type === "blob").map((t) => t.path);
    this.trees.set(branch, files);
    return files;
  }

  private async refSha(branch: string): Promise<string | null> {
    const { status, data } = await this.gh<{ object?: { sha?: string } }>("GET", `${this.repoPath}/git/ref/heads/${encPath(branch)}`);
    if (status === 404) return null;
    if (status !== 200) throw new JobError(`Could not read branch ${branch} (HTTP ${status})`, "permanent");
    return data?.object?.sha ?? null;
  }

  private async readFile(path: string, ref: string): Promise<FileRead | null> {
    const { status, data } = await this.gh<GhFile | GhFile[]>("GET", `${this.repoPath}/contents/${encPath(path)}?ref=${enc(ref)}`);
    if (status === 404) return null;
    if (status !== 200 || !data) throw new JobError(`Could not read ${path} (HTTP ${status})`, "permanent");
    if (Array.isArray(data) || data.type !== "file") return null;
    if (data.encoding !== "base64" || typeof data.content !== "string") {
      throw new JobError(`${path} is too large to edit through the GitHub contents API`, "permanent");
    }
    return { path, text: Buffer.from(data.content, "base64").toString("utf8"), sha: data.sha, htmlUrl: data.html_url };
  }

  private async findPrByBranch(branch: string): Promise<GhPull | null> {
    const { status, data } = await this.gh<GhPull[]>(
      "GET", `${this.repoPath}/pulls?state=all&per_page=10&head=${enc(`${this.cfg.owner}:${branch}`)}`,
    );
    if (status !== 200 || !Array.isArray(data)) return null;
    return data.find((p) => p.head?.ref === branch) ?? null;
  }

  /** Newest ranksignal PR whose marker matches the file (and base sha / field when given). */
  private async findPrByMarker(path: string, o: { baseSha?: string; field?: string } = {}): Promise<{ pr: GhPull; field: string } | null> {
    const { status, data } = await this.gh<GhPull[]>("GET", `${this.repoPath}/pulls?state=all&per_page=50&sort=updated&direction=desc`);
    if (status !== 200 || !Array.isArray(data)) return null;
    for (const pr of data) {
      if (!pr.head?.ref?.startsWith("ranksignal/") || pr.head.ref.startsWith("ranksignal/revert-")) continue;
      const m = parseMarker(pr.body);
      if (!m || m.path !== path) continue;
      if (o.baseSha && m.baseSha !== o.baseSha) continue;
      if (o.field && m.field !== o.field) continue;
      return { pr, field: m.field };
    }
    return null;
  }

  // ---- paths

  /** Validate a repo path we may read/write. Returns null when unsafe. */
  private checkPath(p: string): string | null {
    if (!p || p.length > 400 || /[\\\0]/.test(p) || p.startsWith("/")) return null;
    const segs = p.split("/");
    if (segs.some((s) => s === "" || s === "." || s === ".." || s === ".git" || s === ".github")) return null;
    if (this.root && !p.startsWith(this.root)) return null;
    if (!MD_EXT.test(p) && !JSON_EXT.test(p)) return null;
    return p;
  }

  /** Map a public page URL to a repo file. null when it cannot be mapped unambiguously. */
  async resolveResourceId(url: string): Promise<string | null> {
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      return null;
    }
    let pathname = u.pathname;
    if (this.cfg.siteUrl) {
      try {
        const site = new URL(this.cfg.siteUrl);
        const host = (h: string) => h.toLowerCase().replace(/^www\./, "");
        if (host(site.hostname) !== host(u.hostname)) return null;
        const basePath = site.pathname.replace(/\/+$/, "");
        if (basePath && pathname.startsWith(basePath)) pathname = pathname.slice(basePath.length) || "/";
      } catch {
        /* ignore malformed siteUrl; map by path only */
      }
    }
    try {
      pathname = decodeURIComponent(pathname);
    } catch {
      return null;
    }
    pathname = pathname.replace(/\/index\.html?$/i, "/").replace(/\.html?$/i, "");
    const segs = pathname.split("/").filter(Boolean);
    const full = segs.join("/");
    const slug = segs[segs.length - 1] ?? "";

    const files = await this.getTree(await this.baseBranch());
    const exists = new Set(files);
    const found = (p: string) => {
      const safe = this.checkPath(p);
      if (safe && exists.has(safe)) {
        this.urlByPath.set(safe, url);
        return safe;
      }
      return null;
    };

    // 1. Explicit rules (longest prefix first).
    const rules = [...(this.cfg.pathMap ?? [])].sort((a, b) => b.urlPrefix.length - a.urlPrefix.length);
    for (const rule of rules) {
      const prefix = `/${rule.urlPrefix.replace(/^\/+|\/+$/g, "")}/`.replace(/^\/\/$/, "/");
      if (!`/${full}/`.startsWith(prefix) && `/${full}` !== prefix.replace(/\/$/, "")) continue;
      const rest = `/${full}/`.slice(prefix.length).replace(/\/+$/, "");
      const restSlug = rest.split("/").filter(Boolean).pop() ?? "index";
      const candidate = this.root + rule.filePattern.replace(/^\/+/, "").replace(/\{slug\}/g, restSlug).replace(/\{path\}/g, rest || "index");
      const hit = found(candidate);
      if (hit) return hit;
    }

    // 2. Conventional exact locations.
    const stems = full ? [full, `${full}/index`, `${full}/_index`] : ["index", "_index"];
    for (const base of [...DEFAULT_ROOTS, ""]) {
      for (const stem of stems) {
        for (const ext of [".md", ".mdx", ".markdown"]) {
          const hit = found(`${this.root}${base}${stem}${ext}`);
          if (hit) return hit;
        }
      }
    }
    if (!slug) return null;

    // 3. Unique slug match under content roots (Jekyll date prefixes stripped).
    const candidates = files.filter((f) => {
      if (!MD_EXT.test(f) || !f.startsWith(this.root)) return false;
      const rel = f.slice(this.root.length);
      if (!DEFAULT_ROOTS.some((r) => rel.startsWith(r))) return false;
      const parts = rel.split("/");
      const name = parts[parts.length - 1].replace(MD_EXT, "").replace(/^\d{4}-\d{2}-\d{2}-/, "");
      if (name === slug) return true;
      return (name === "index" || name === "_index") && parts[parts.length - 2] === slug;
    });
    let pick = candidates;
    if (pick.length > 1) pick = candidates.filter((f) => segs.slice(0, -1).every((s) => f.split("/").includes(s)));
    if (pick.length === 1) return found(pick[0]);
    return null; // none or ambiguous → manual instructions
  }

  // ---- reading

  private toResource(file: FileRead): ConnectorResource | null {
    const url = this.urlByPath.get(file.path) ?? file.htmlUrl ?? "";
    if (JSON_EXT.test(file.path)) {
      return { id: file.path, type: "jsonld", url, version: file.sha, fields: { schema: file.text, path: file.path } };
    }
    const fm = splitFrontmatter(file.text);
    if (!fm) return null; // raw HTML/JSX/TOML → manual fallback
    const descKey = DESCRIPTION_KEYS.find((k) => keyRange(fm.lines, k)) ?? "description";
    const title = readFrontmatterKey(fm.lines, "title");
    return {
      id: file.path,
      type: "markdown",
      url,
      title: title ?? undefined,
      version: file.sha,
      fields: {
        title,
        meta_description: readFrontmatterKey(fm.lines, descKey),
        description_key: descKey,
        excerpt: readFrontmatterKey(fm.lines, "excerpt"),
        schema: this.cfg.schemaFilePattern ? null : readFrontmatterKey(fm.lines, this.schemaKey()),
        path: file.path,
      },
    };
  }

  private schemaKey() {
    const k = this.cfg.schemaKey?.trim();
    return k && /^[A-Za-z_][\w-]*$/.test(k) ? k : "jsonld";
  }

  private schemaPathFor(resourcePath: string): string | null {
    if (!this.cfg.schemaFilePattern) return null;
    const rel = resourcePath.slice(this.root.length).replace(MD_EXT, "");
    const parts = rel.split("/");
    let slug = parts[parts.length - 1];
    if ((slug === "index" || slug === "_index") && parts.length > 1) slug = parts[parts.length - 2];
    slug = slug.replace(/^\d{4}-\d{2}-\d{2}-/, "");
    return this.checkPath(this.root + this.cfg.schemaFilePattern.replace(/^\/+/, "").replace(/\{slug\}/g, slug).replace(/\{path\}/g, rel));
  }

  private async resourceAt(path: string, ref: string): Promise<ConnectorResource | null> {
    const file = await this.readFile(path, ref);
    if (!file) return null;
    const r = this.toResource(file);
    if (r && r.type === "markdown" && this.cfg.schemaFilePattern) {
      const sp = this.schemaPathFor(path);
      if (sp) r.fields.schema = (await this.readFile(sp, ref))?.text ?? null;
    }
    return r;
  }

  async testConnection() {
    try {
      const { status, data } = await this.gh<GhRepo>("GET", this.repoPath);
      if (status === 404) return { ok: false, error: "Repository not found, or the token can't see it. Check the owner/repo name and that the token was given access to this repository." };
      if (status === 403) return { ok: false, error: "The token doesn't have permission to read this repository." };
      if (status !== 200 || !data) return { ok: false, error: `GitHub returned HTTP ${status}` };
      if (data.archived) return { ok: false, error: "This repository is archived (read-only) on GitHub." };
      if (!data.permissions?.push) {
        return { ok: false, error: "The token can read this repository but can't write to it. Give it Contents: Read and write and Pull requests: Read and write." };
      }
      this.repoMeta = data;
      if (this.cfg.baseBranch) {
        const b = await this.gh("GET", `${this.repoPath}/branches/${encPath(this.cfg.baseBranch)}`);
        if (b.status === 404) return { ok: false, error: `Branch "${this.cfg.baseBranch}" doesn't exist in this repository.` };
      }
      return { ok: true, identity: data.full_name ?? `${this.cfg.owner}/${this.cfg.repo}` };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Could not reach GitHub" };
    }
  }

  async listResources(cursor?: string) {
    const offset = Math.max(0, Number(cursor) || 0);
    const files = (await this.getTree(await this.baseBranch())).filter((f) => {
      if (!MD_EXT.test(f) || !f.startsWith(this.root)) return false;
      const rel = f.slice(this.root.length);
      return DEFAULT_ROOTS.some((r) => rel.startsWith(r)) || (this.cfg.pathMap ?? []).some((r) => rel.startsWith(r.filePattern.split("{")[0]));
    });
    const page = files.slice(offset, offset + 100);
    const items: ConnectorResource[] = page.map((p) => ({
      id: p, type: "markdown", url: this.urlByPath.get(p) ?? "", title: p.split("/").pop()?.replace(MD_EXT, ""), fields: { path: p },
    }));
    return { items, nextCursor: offset + 100 < files.length ? String(offset + 100) : undefined };
  }

  async getResource(resourceId: string): Promise<ConnectorResource | null> {
    const path = this.checkPath(resourceId);
    if (!path) return null;
    return this.resourceAt(path, await this.baseBranch());
  }

  // ---- writing

  /** Plan writing `value` into `field` of the resource file (or its schema file). */
  private async planEdit(file: FileRead, field: string, value: string | null, ref: string): Promise<PlannedEdit | { error: string }> {
    if (field === "description") field = "meta_description";
    if (field === "schema" && value !== null) {
      try {
        JSON.parse(value);
      } catch {
        return { error: "invalid_json_ld" };
      }
    }
    if (JSON_EXT.test(file.path)) {
      if (field !== "schema") return { error: "unsupported_field" };
      if (value === null) return { path: file.path, content: null, sha: file.sha, unchanged: false };
      const content = value.endsWith("\n") ? value : `${value}\n`;
      return { path: file.path, content, sha: file.sha, unchanged: jsonEq(file.text, value) };
    }
    const fm = splitFrontmatter(file.text);
    if (!fm) return { error: "no_frontmatter" };
    if (field === "schema" && this.cfg.schemaFilePattern) {
      const sp = this.schemaPathFor(file.path);
      if (!sp) return { error: "invalid_schema_path" };
      const existing = await this.readFile(sp, ref);
      if (value === null) return { path: sp, content: null, sha: existing?.sha, unchanged: !existing };
      const content = value.endsWith("\n") ? value : `${value}\n`;
      return { path: sp, content, sha: existing?.sha, unchanged: !!existing && jsonEq(existing.text, value) };
    }
    let key: string;
    let style: "scalar" | "block" = "scalar";
    switch (field) {
      case "title":
      case "excerpt":
        key = field;
        break;
      case "meta_description":
        key = DESCRIPTION_KEYS.find((k) => keyRange(fm.lines, k)) ?? "description";
        break;
      case "schema":
        key = this.schemaKey();
        style = "block";
        if (value !== null) value = JSON.stringify(JSON.parse(value), null, 2);
        break;
      default:
        return { error: "unsupported_field" };
    }
    const current = readFrontmatterKey(fm.lines, key);
    if (value === null ? !keyRange(fm.lines, key) : fieldEq(field, current, value)) {
      return { path: file.path, content: file.text, sha: file.sha, unchanged: true };
    }
    const lines = setFrontmatterKey(fm.lines, key, value, style);
    return { path: file.path, content: joinFrontmatter({ ...fm, lines }), sha: file.sha, unchanged: false };
  }

  private async putEdit(edit: PlannedEdit, branch: string, message: string): Promise<{ ok: true; blobSha?: string } | { ok: false; error: string }> {
    const target = `${this.repoPath}/contents/${encPath(edit.path)}`;
    const res = edit.content === null
      ? await this.gh<{ content?: { sha?: string } }>("DELETE", target, { message, sha: edit.sha, branch })
      : await this.gh<{ content?: { sha?: string } }>("PUT", target, { message, content: b64(edit.content), branch, ...(edit.sha ? { sha: edit.sha } : {}) });
    if (res.status === 200 || res.status === 201) return { ok: true, blobSha: res.data?.content?.sha ?? undefined };
    const msg = String((res.data as { message?: string } | null)?.message ?? "");
    if (res.status === 409 || (res.status === 422 && /sha/i.test(msg))) return { ok: false, error: "conflict" };
    if (res.status === 403) return { ok: false, error: "permission_denied" };
    return { ok: false, error: `write_failed_http_${res.status}` };
  }

  private async createBranch(branch: string, fromBranch: string): Promise<"created" | "exists" | "base_missing"> {
    const baseSha = await this.refSha(fromBranch);
    if (!baseSha) return "base_missing";
    const r = await this.gh("POST", `${this.repoPath}/git/refs`, { ref: `refs/heads/${branch}`, sha: baseSha });
    if (r.status === 201) return "created";
    if (r.status === 422) return "exists";
    throw new JobError(`Could not create branch ${branch} (HTTP ${r.status})`, r.status === 403 ? "permanent" : "transient");
  }

  private async openPr(o: { branch: string; base: string; title: string; body: string }): Promise<GhPull | { error: string }> {
    const r = await this.gh<GhPull>("POST", `${this.repoPath}/pulls`, {
      title: o.title, head: o.branch, base: o.base, body: o.body, maintainer_can_modify: true,
    });
    if (r.status === 201 && r.data) return r.data;
    if (r.status === 422) {
      const existing = await this.findPrByBranch(o.branch);
      if (existing) return existing;
    }
    return { error: `pull_request_failed_http_${r.status}` };
  }

  private async changeContext(idempotencyKey: string): Promise<ChangeContext | null> {
    const actionId = actionIdFromKey(idempotencyKey);
    if (!actionId) return null;
    try {
      if (this.opts.loadChangeContext) return await this.opts.loadChangeContext(actionId);
      if (!this.opts.organizationId) return null;
      return await loadChangeContextFromDb(actionId, this.opts.organizationId);
    } catch {
      return null; // the PR body degrades to a generic description
    }
  }

  private prText(o: { path: string; field: string; before: string | null; after: string | null; baseSha: string; ctx: ChangeContext | null; pageUrl?: string; revertOf?: GhPull }) {
    const label = FIELD_LABEL[o.field] ?? o.field;
    const where = o.pageUrl ? (() => { try { return new URL(o.pageUrl).pathname; } catch { return o.path; } })() : o.path;
    const title = o.revertOf
      ? `Revert ${label.toLowerCase()} change on ${where} (#${o.revertOf.number})`
      : `${BRAND.name}: update ${label.toLowerCase()} on ${where}`;
    const lang = o.field === "schema" ? "json" : "";
    const approved = o.ctx?.approvedBy
      ? `Approved by ${mdSafe(o.ctx.approvedBy)} in ${BRAND.name}${o.ctx.approvedAt ? ` on ${new Date(o.ctx.approvedAt).toISOString().slice(0, 10)}` : ""}.`
      : `Approved in ${BRAND.name} (approval of the exact draft is required before a pull request is opened).`;
    const lines = [
      o.revertOf
        ? `This reverts the ${label.toLowerCase()} change from #${o.revertOf.number}, restoring the previous value.`
        : `${BRAND.name} proposes this change. **Nothing goes live until you merge this pull request** — we never merge it for you.`,
      "",
      "## What changed",
      `- File: \`${o.path}\``,
      o.pageUrl ? `- Page: ${mdSafe(o.pageUrl)}` : "",
      `- Field: **${label}**`,
      "",
      "**Before**",
      fence(o.before ?? "(empty)", lang),
      "",
      "**After**",
      fence(o.after ?? "(removed)", lang),
    ];
    if (!o.revertOf) {
      lines.push("", "## Why", o.ctx?.rationale ? mdSafe(o.ctx.rationale) : "Recommended by the site audit.");
      if (o.ctx?.evidence?.length) lines.push("", "## Evidence", ...o.ctx.evidence.map((e) => `- ${mdSafe(e)}`));
      lines.push("", "## Approval", approved);
      if (o.field === "schema" && !this.cfg.schemaFilePattern) {
        lines.push("", `> Note: the JSON-LD is stored in the \`${this.schemaKey()}\` frontmatter key. Make sure your layout prints it inside a \`<script type="application/ld+json">\` tag.`);
      }
    }
    lines.push("", "Closing this pull request without merging discards the change.", "", marker({ path: o.path, field: o.field, baseSha: o.baseSha }));
    return { title: title.slice(0, 250), body: lines.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n") };
  }

  async createDraft(resourceType: string, content: Record<string, string>): Promise<PatchResult> {
    const title = content.title?.trim();
    if (!title) return { ok: false, error: "title_required" };
    const slug = slugify(content.slug ?? title);
    const rule = this.cfg.pathMap?.find((r) => r.filePattern.includes("{slug}"));
    const rel = content.path ?? (rule ? rule.filePattern.replace(/\{slug\}/g, slug).replace(/\{path\}/g, slug) : `content/posts/${slug}.md`);
    const path = this.checkPath(rel.startsWith(this.root) ? rel : this.root + rel.replace(/^\/+/, ""));
    if (!path || !MD_EXT.test(path)) return { ok: false, error: "invalid_path" };
    const base = await this.baseBranch();
    const branch = `ranksignal/draft-${slug.slice(0, 40)}`;
    const existingPr = await this.findPrByBranch(branch);
    if (existingPr) return { ok: true, detail: { prUrl: existingPr.html_url, prNumber: existingPr.number, branch, resourceId: path, reused: true } };
    if (await this.readFile(path, base)) return { ok: false, error: "already_exists", detail: { path } };
    const desc = content.description ?? content.excerpt ?? "";
    let fmLines = setFrontmatterKey([], "title", title);
    if (desc) fmLines = setFrontmatterKey(fmLines, "description", desc);
    fmLines.push("draft: true");
    const text = `---\n${fmLines.join("\n")}\n---\n\n${content.content ?? ""}\n`;
    const made = await this.createBranch(branch, base);
    if (made === "base_missing") return { ok: false, error: "base_branch_not_found" };
    const put = await this.putEdit({ path, content: text, unchanged: false }, branch, `${BRAND.name}: add draft "${title.slice(0, 60)}"`);
    if (!put.ok && made !== "exists") return { ok: false, error: put.error };
    const pr = await this.openPr({
      branch, base,
      title: `${BRAND.name}: new draft (${resourceType}) "${title.slice(0, 80)}"`,
      body: `${BRAND.name} prepared a new draft at \`${path}\` with \`draft: true\`. Nothing goes live until you merge — we never merge for you.\n\n${marker({ path, field: "draft", baseSha: null })}`,
    });
    if ("error" in pr) return { ok: false, error: pr.error };
    return { ok: true, newVersion: put.ok ? put.blobSha : undefined, detail: { prUrl: pr.html_url, prNumber: pr.number, branch, resourceId: path, status: "draft" } };
  }

  async proposePatch(resourceId: string, change: ProposedChange) {
    const fallback = { preview: change.after, diff: simpleDiff(change.before, change.after) };
    const path = this.checkPath(resourceId);
    if (!path) return fallback;
    try {
      const base = await this.baseBranch();
      const file = await this.readFile(path, base);
      if (!file) return fallback;
      const edit = await this.planEdit(file, change.field, change.after, base);
      if ("error" in edit || edit.content === null) return fallback;
      const before = edit.path === path ? file.text : (await this.readFile(edit.path, base))?.text ?? "";
      return { preview: `${edit.path}\n\n${edit.content}`, diff: simpleDiff(before, edit.content) };
    } catch {
      return fallback;
    }
  }

  async applyPatch(resourceId: string, change: ProposedChange, expectedVersion: string | undefined, idempotencyKey: string): Promise<PatchResult> {
    const path = this.checkPath(resourceId);
    if (!path) return { ok: false, error: "invalid_path", detail: { resourceId } };
    const field = change.field === "description" ? "meta_description" : change.field;
    if (!["title", "meta_description", "excerpt", "schema"].includes(field)) {
      return { ok: false, error: "unsupported_field", detail: { field: change.field } };
    }
    const base = await this.baseBranch();
    const branch = branchFor(idempotencyKey);

    // 1. Idempotency: a PR for this exact approved draft already exists → return it.
    const existing = await this.findPrByBranch(branch);
    if (existing) {
      if (existing.state === "closed" && !existing.merged_at) {
        return { ok: false, error: "pull_request_closed", detail: { prUrl: existing.html_url, prNumber: existing.number, branch } };
      }
      this.prByPath.set(path, { pr: existing, field });
      const onBranch = existing.state === "open" ? await this.readFile(path, branch) : null;
      return {
        ok: true,
        newVersion: onBranch?.sha,
        detail: { prUrl: existing.html_url, prNumber: existing.number, branch, path, reused: true, merged: Boolean(existing.merged_at), idempotencyKey },
      };
    }

    // 2. Plan the edit — on the branch if a crashed attempt already created it, else on the base.
    const branchExists = (await this.refSha(branch)) !== null;
    const ref = branchExists ? branch : base;
    const file = await this.readFile(path, ref);
    if (!file) return { ok: false, error: "not_found", detail: { path, ref } };
    const edit = await this.planEdit(file, field, change.after, ref);
    if ("error" in edit) return { ok: false, error: edit.error, detail: { path } };
    if (!branchExists && edit.unchanged) {
      return { ok: true, newVersion: file.sha, detail: { alreadyApplied: true, path, idempotencyKey } };
    }

    // 3. Conflict check (blob sha) + commit to the PR branch.
    const ctx = await this.changeContext(idempotencyKey);
    let blobSha: string | undefined;
    if (!edit.unchanged) {
      if (expectedVersion && file.sha !== expectedVersion) {
        return { ok: false, error: "conflict", detail: { expectedVersion, currentVersion: file.sha, path } };
      }
      if (!branchExists) {
        const made = await this.createBranch(branch, base);
        if (made === "base_missing") return { ok: false, error: "base_branch_not_found", detail: { base } };
      }
      const label = FIELD_LABEL[field] ?? field;
      const put = await this.putEdit(edit, branch, `${BRAND.name}: update ${label.toLowerCase()} in ${path}${ctx?.approvedBy ? `\n\nApproved by ${ctx.approvedBy} in ${BRAND.name}.` : ""}`);
      if (!put.ok) {
        if (!branchExists) await this.gh("DELETE", `${this.repoPath}/git/refs/heads/${encPath(branch)}`).catch(() => undefined);
        return { ok: false, error: put.error, detail: { path, expectedVersion } };
      }
      blobSha = put.blobSha;
    }

    // 4. Open the pull request (never merged by us).
    // On a resumed run `file` is the branch copy (already edited), so use the recorded before value.
    const before = branchExists ? change.before : (this.toResource(file)?.fields[field] ?? change.before);
    const text = this.prText({ path, field, before: before ?? null, after: change.after, baseSha: expectedVersion ?? file.sha, ctx, pageUrl: this.urlByPath.get(path) });
    const pr = await this.openPr({ branch, base, ...text });
    if ("error" in pr) return { ok: false, error: pr.error, detail: { branch, path } };
    this.prByPath.set(path, { pr, field });
    const newVersion = edit.path === path ? (blobSha ?? (await this.readFile(path, branch))?.sha) : file.sha;
    return {
      ok: true,
      newVersion,
      detail: { prUrl: pr.html_url, prNumber: pr.number, branch, path, filesChanged: [edit.path], merged: false, idempotencyKey },
    };
  }

  async validateResource(resourceId: string, change: ProposedChange) {
    const path = this.checkPath(resourceId);
    if (!path) return { status: "failed" as const, detail: "Invalid repository path" };
    const field = change.field === "description" ? "meta_description" : change.field;
    const known = this.prByPath.get(path) ?? (await this.findPrByMarker(path, { field }));
    const base = await this.baseBranch();
    const ref = known && known.pr.state === "open" ? known.pr.head.ref : base;
    const r = await this.resourceAt(path, ref);
    if (!r) return { status: "failed" as const, detail: `${path} could not be read on ${ref}` };
    if (!fieldEq(field, r.fields[field], change.after)) {
      return { status: "failed" as const, detail: `${FIELD_LABEL[field] ?? field} in ${path} on ${ref} does not match the approved draft` };
    }
    if (known && known.pr.state === "open") {
      return { status: "passed" as const, detail: `Pull request #${known.pr.number} contains the approved ${(FIELD_LABEL[field] ?? field).toLowerCase()}. It goes live when your team merges it and the site redeploys: ${known.pr.html_url}` };
    }
    return { status: "passed" as const, detail: `${FIELD_LABEL[field] ?? field} in ${path} on ${ref} matches the approved draft` };
  }

  async rollback(resourceId: string, beforeState: ConnectorResource): Promise<PatchResult> {
    const path = this.checkPath(resourceId);
    if (!path) return { ok: false, error: "invalid_path" };
    const base = await this.baseBranch();
    const known = this.prByPath.get(path) ?? (await this.findPrByMarker(path, { baseSha: beforeState.version }));
    if (!known) {
      const cur = await this.readFile(path, base);
      if (cur && beforeState.version && cur.sha === beforeState.version) {
        return { ok: true, newVersion: cur.sha, detail: { nothingToRestore: true } };
      }
      return { ok: false, error: "pull_request_not_found" };
    }
    const { pr, field } = known;

    if (pr.state === "open") {
      const r = await this.gh("PATCH", `${this.repoPath}/pulls/${pr.number}`, { state: "closed" });
      if (r.status !== 200) return { ok: false, error: `close_failed_http_${r.status}`, detail: { prUrl: pr.html_url } };
      await this.gh("POST", `${this.repoPath}/issues/${pr.number}/comments`, {
        body: `Closed by ${BRAND.name}: the change was rolled back before merging. Nothing on the site was changed.`,
      }).catch(() => undefined);
      return { ok: true, newVersion: beforeState.version, detail: { closed: true, prUrl: pr.html_url, prNumber: pr.number } };
    }
    if (!pr.merged_at) return { ok: true, newVersion: beforeState.version, detail: { alreadyClosed: true, prUrl: pr.html_url } };

    // Merged → open a revert PR restoring only the field we changed.
    const branch = `ranksignal/revert-${pr.number}`;
    const existingRevert = await this.findPrByBranch(branch);
    if (existingRevert && (existingRevert.state === "open" || existingRevert.merged_at)) {
      return { ok: true, detail: { revertPrUrl: existingRevert.html_url, revertPrNumber: existingRevert.number, reused: true } };
    }
    const branchExists = (await this.refSha(branch)) !== null;
    const ref = branchExists ? branch : base;
    const file = await this.readFile(path, ref);
    if (!file) return { ok: false, error: "not_found" };
    const restore = beforeState.fields[field] ?? null;
    const edit = await this.planEdit(file, field, restore, ref);
    if ("error" in edit) return { ok: false, error: edit.error };
    if (edit.unchanged && !branchExists) return { ok: true, newVersion: file.sha, detail: { nothingToRestore: true, prUrl: pr.html_url } };
    if (!edit.unchanged) {
      if (!branchExists && (await this.createBranch(branch, base)) === "base_missing") return { ok: false, error: "base_branch_not_found" };
      const put = await this.putEdit(edit, branch, `Revert ${(FIELD_LABEL[field] ?? field).toLowerCase()} change from #${pr.number}`);
      if (!put.ok) return { ok: false, error: put.error };
    }
    const current = this.toResource(file)?.fields[field] ?? null;
    const text = this.prText({ path, field, before: current, after: restore, baseSha: file.sha, ctx: null, revertOf: pr });
    const revert = await this.openPr({ branch, base, ...text });
    if ("error" in revert) return { ok: false, error: revert.error };
    return { ok: true, detail: { revertPrUrl: revert.html_url, revertPrNumber: revert.number, originalPrUrl: pr.html_url, merged: true } };
  }

  async disconnect() {
    // Fine-grained tokens are revoked by the customer in GitHub settings; we only delete our encrypted copy.
  }
}

function normalizeRoot(root: string | undefined): string {
  const r = (root ?? "").trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!r) return "";
  if (r.split("/").some((s) => s === ".." || s === "." || s === "")) throw new Error("Invalid contentRoot");
  return `${r}/`;
}

/** Tenant-scoped lookup of the action + approval used for PR descriptions. */
async function loadChangeContextFromDb(actionId: string, organizationId: string): Promise<ChangeContext | null> {
  const { db } = await import("@/lib/db");
  const action = await db.action.findFirst({ where: { id: actionId, organizationId }, select: { type: true, rationale: true, evidenceRefs: true } });
  if (!action) return null;
  const approval = await db.approval.findFirst({
    where: { actionId, organizationId, decision: "approved" },
    orderBy: { decidedAt: "desc" },
    select: { approverId: true, decidedAt: true },
  });
  const approver = approval?.approverId
    ? await db.user.findUnique({ where: { id: approval.approverId }, select: { name: true, email: true } })
    : null;
  return {
    actionType: action.type,
    rationale: action.rationale,
    evidence: summariseEvidence(action.evidenceRefs),
    approvedBy: approver?.name || approver?.email || null,
    approvedAt: approval?.decidedAt ?? null,
  };
}

export function summariseEvidence(refs: unknown): string[] {
  const list = Array.isArray(refs) ? refs : refs && typeof refs === "object" ? [refs] : [];
  return list.slice(0, 5).map((r) => {
    if (typeof r === "string") return r.slice(0, 200);
    if (r && typeof r === "object") {
      return Object.entries(r as Record<string, unknown>)
        .filter(([, v]) => ["string", "number", "boolean"].includes(typeof v))
        .slice(0, 4)
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join(", ")
        .slice(0, 200);
    }
    return String(r).slice(0, 200);
  }).filter(Boolean);
}
