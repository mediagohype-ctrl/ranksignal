// GitHub (pull requests) connector descriptor.
import { ConnectorConfigError, type ConnectorDescriptor } from "@/lib/connectors/catalog/types";
import {
  BRANCH_RE, GITHUB_CAPABILITIES, GitHubConnector, OWNER_RE, REPO_RE,
  type GitHubConfig, type GitHubPathRule, type GitHubSecrets,
} from "@/lib/connectors/github";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** "acme/site", "https://github.com/acme/site(.git)", "git@github.com:acme/site.git" → {owner, repo}. */
export function parseRepository(input: string): { owner: string; repo: string } | null {
  const s = input.trim().replace(/\.git$/i, "").replace(/\/+$/, "");
  const m = /^(?:https?:\/\/(?:www\.)?github\.com\/|git@github\.com:)?([^/\s]+)\/([^/\s]+)$/i.exec(s);
  if (!m || !OWNER_RE.test(m[1]) || !REPO_RE.test(m[2])) return null;
  return { owner: m[1], repo: m[2] };
}

/**
 * URL-to-file rules: JSON array [{urlPrefix, filePattern}] or the compact form
 * "/blog/ => content/blog/{slug}.md; /docs/ => docs/{path}.mdx".
 */
export function parsePathMap(input: unknown): GitHubPathRule[] | undefined {
  if (input === undefined || input === null || input === "") return undefined;
  let rules: unknown = input;
  if (typeof input === "string") {
    const t = input.trim();
    if (!t) return undefined;
    if (t.startsWith("[")) {
      try {
        rules = JSON.parse(t);
      } catch {
        throw new ConnectorConfigError("URL-to-file rules are not valid JSON.", "pathMap");
      }
    } else {
      rules = t.split(/[;\n]+/).map((r) => r.trim()).filter(Boolean).map((r) => {
        const [urlPrefix, filePattern] = r.split(/\s*=>\s*/);
        return { urlPrefix, filePattern };
      });
    }
  }
  if (!Array.isArray(rules) || rules.length > 20) throw new ConnectorConfigError("Add between 1 and 20 URL-to-file rules.", "pathMap");
  return rules.map((r) => {
    const urlPrefix = str((r as GitHubPathRule)?.urlPrefix);
    const filePattern = str((r as GitHubPathRule)?.filePattern);
    if (!urlPrefix.startsWith("/") || urlPrefix.length > 200) {
      throw new ConnectorConfigError(`Rule "${urlPrefix}" must start with "/", e.g. /blog/.`, "pathMap");
    }
    if (!filePattern || filePattern.length > 300 || filePattern.includes("..") || filePattern.startsWith("/") || !/\.(md|mdx|markdown)$/i.test(filePattern)) {
      throw new ConnectorConfigError(`File pattern "${filePattern}" must be a relative .md/.mdx path, e.g. content/blog/{slug}.md.`, "pathMap");
    }
    return { urlPrefix, filePattern };
  });
}

export const descriptor: ConnectorDescriptor<GitHubConfig, GitHubSecrets> = {
  id: "github",
  family: "Code repository",
  name: "GitHub (pull requests)",
  status: "available",
  description:
    "For sites built from a Git repository (Hugo, Jekyll, Astro, Next.js MDX…). Approved title, meta description and FAQ schema changes arrive as pull requests — nothing goes live until your team merges.",
  capabilities: GITHUB_CAPABILITIES,
  connectFields: [
    { key: "repository", label: "Repository", type: "text", placeholder: "acme/website", help: "The owner and name of your website's repository, e.g. acme/website (or paste its GitHub URL)." },
    { key: "token", label: "Fine-grained access token", type: "password", placeholder: "github_pat_…", help: "Scoped to this one repository with Contents and Pull requests set to Read and write. Stored encrypted and never shown again." },
    { key: "siteUrl", label: "Public website address", type: "url", required: false, placeholder: "https://www.example.com", help: "Used to match page URLs to files. Leave blank to use this project's website address." },
    { key: "baseBranch", label: "Base branch", type: "text", required: false, placeholder: "main", help: "Pull requests target this branch. Leave blank to use the repository's default branch." },
    { key: "contentRoot", label: "Site folder", type: "text", required: false, placeholder: "apps/site", help: "Only if the website lives in a sub-folder of the repository. We never change files outside it." },
    { key: "pathMap", label: "URL-to-file rules", type: "text", required: false, placeholder: "/blog/ => content/blog/{slug}.md", help: "Optional. Separate rules with “;”. Leave blank and we'll look for matching Markdown files in content/, src/content/, _posts/ and similar folders." },
  ],
  setupSteps: [
    "On GitHub, open Settings → Developer settings → Personal access tokens → Fine-grained tokens, and click “Generate new token”.",
    "Under Repository access choose “Only select repositories” and pick your website's repository.",
    "Under Repository permissions set Contents to “Read and write” and Pull requests to “Read and write”. Nothing else is needed.",
    "Choose an expiry date, generate the token and copy it (it starts with github_pat_).",
    "Paste the repository name and token here. We check the token can open pull requests, then store it encrypted.",
    "Each approved change arrives as a pull request with the reason and the approver. Review it, then merge — or close it to discard. We never merge for you.",
  ],
  validateConfig(input, context) {
    const parsed = parseRepository(str(input.repository) || (str(input.owner) && str(input.repo) ? `${str(input.owner)}/${str(input.repo)}` : ""));
    if (!parsed) throw new ConnectorConfigError("Enter the repository as owner/name, e.g. acme/website.", "repository");

    const token = str(input.token);
    if (!/^(github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,})$/.test(token) || token.length > 255) {
      throw new ConnectorConfigError("That doesn't look like a GitHub access token. Fine-grained tokens start with github_pat_.", "token");
    }

    const siteRaw = str(input.siteUrl) || str(context?.projectWebsiteUrl);
    let siteUrl: string;
    try {
      const u = new URL(siteRaw);
      if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("scheme");
      siteUrl = `${u.origin}${u.pathname.replace(/\/+$/, "")}`;
    } catch {
      throw new ConnectorConfigError("Enter your public website address, e.g. https://www.example.com.", "siteUrl");
    }

    const baseBranch = str(input.baseBranch) || undefined;
    if (baseBranch && !BRANCH_RE.test(baseBranch)) throw new ConnectorConfigError("That branch name isn't valid.", "baseBranch");

    const contentRoot = str(input.contentRoot).replace(/\\/g, "/").replace(/^\/+|\/+$/g, "") || undefined;
    if (contentRoot && (contentRoot.length > 200 || contentRoot.split("/").some((s) => !s || s === "." || s === "..") || !/^[\w./-]+$/.test(contentRoot))) {
      throw new ConnectorConfigError("The site folder must be a relative path inside the repository, e.g. apps/site.", "contentRoot");
    }

    const pathMap = parsePathMap(input.pathMap);
    const schemaFilePattern = str(input.schemaFilePattern) || undefined;
    if (schemaFilePattern && (schemaFilePattern.includes("..") || schemaFilePattern.startsWith("/") || !/\.(json|jsonld)$/i.test(schemaFilePattern))) {
      throw new ConnectorConfigError("The schema file pattern must be a relative .json path, e.g. data/schema/{slug}.json.", "schemaFilePattern");
    }

    const config: GitHubConfig = {
      owner: parsed.owner, repo: parsed.repo, siteUrl,
      ...(baseBranch ? { baseBranch } : {}),
      ...(contentRoot ? { contentRoot } : {}),
      ...(pathMap ? { pathMap } : {}),
      ...(schemaFilePattern ? { schemaFilePattern } : {}),
    };
    return { config, secrets: { token } };
  },
  create(config, secrets, context) {
    // `config` may be the stored Integration.config (extra keys such as `identity` are ignored);
    // the GitHubConnector constructor re-validates owner/repo/branch.
    const c = (config ?? {}) as Partial<GitHubConfig>;
    return new GitHubConnector(
      {
        owner: String(c.owner ?? ""), repo: String(c.repo ?? ""), siteUrl: String(c.siteUrl ?? ""),
        baseBranch: c.baseBranch, contentRoot: c.contentRoot, pathMap: Array.isArray(c.pathMap) ? c.pathMap : undefined,
        schemaKey: c.schemaKey, schemaFilePattern: c.schemaFilePattern,
      },
      { token: String((secrets as Partial<GitHubSecrets> | null)?.token ?? "") },
      { organizationId: context?.organizationId },
    );
  },
};
