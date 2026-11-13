// Free tool usage log: every run of the free check and the free public tools is stored as a ToolUse row (admin
// "Free tool usage" page) and the team gets an alert email. Best-effort throughout: logging or emailing never
// slows down or fails the visitor's request.
//
// How it works: a route wraps its body in withToolUsage(tool, fn). That opens a per-request scope
// (AsyncLocalStorage) that the route and the AI layer fill in (setToolUsage / addToolAiCost); when the response is
// ready the row is written in the background and, when worth it, an alert email goes to the support inbox
// (EMAIL_BCC copies the rest of the team, src/lib/email/send.ts).
import { AsyncLocalStorage } from "node:async_hooks";
import { HttpError } from "@/lib/api";
import { clientIp } from "@/lib/auth/rate-limit";
import { db } from "@/lib/db";
import { hashIp } from "@/lib/admin/leads";

export const TOOL_LABELS: Record<string, string> = {
  "free-check": "Free website check",
  "meta-tag-checker": "Meta tag checker",
  "heading-checker": "Heading checker",
  "schema-checker": "Schema checker",
  "sitemap-checker": "Sitemap checker",
  "robots-txt-tester": "Robots.txt tester",
  "broken-link-checker": "Broken link checker",
  "ai-crawler-checker": "AI crawler checker",
  "seo-title-generator": "SEO title generator (AI)",
  "meta-description-generator": "Meta description generator (AI)",
  "faq-generator": "FAQ generator (AI)",
};
export const toolLabel = (tool: string) => TOOL_LABELS[tool] ?? tool;

export interface ToolUsageScope {
  tool: string;
  url: string | null;
  input: string | null;
  score: number | null;
  leadId: string | null;
  aiCostMicros: number;
  aiModel: string | null;
}

const store = new AsyncLocalStorage<ToolUsageScope>();

/** Fill in details of the current run (no-op outside withToolUsage). */
export function setToolUsage(patch: Partial<Omit<ToolUsageScope, "tool" | "aiCostMicros">>): void {
  const s = store.getStore();
  if (s) Object.assign(s, patch);
}

/** Add AI spend to the current run (called by the AI layer; no-op outside withToolUsage). */
export function addToolAiCost(costMicros: number, model?: string | null): void {
  const s = store.getStore();
  if (!s) return;
  if (Number.isFinite(costMicros) && costMicros > 0) s.aiCostMicros += Math.round(costMicros);
  if (model) s.aiModel = model;
}

/* ------------------------------------------------------------------------------------------------ visitor */

export interface VisitorInfo {
  device: string | null;
  browser: string | null;
  country: string | null;
  language: string | null;
  referrer: string | null;
}

/** Rough device + browser from the user agent (good enough for a sales alert; no fingerprinting). */
export function parseUserAgent(ua: string | null | undefined): { device: string | null; browser: string | null } {
  if (!ua) return { device: null, browser: null };
  const bot = /bot|crawler|spider|curl|wget|python|headless|httpclient|axios|node-fetch/i.test(ua);
  const device = bot
    ? "Bot / script"
    : /iPad|Tablet/i.test(ua)
      ? "Tablet"
      : /Mobi|Android|iPhone/i.test(ua)
        ? "Mobile"
        : "Desktop";
  const os = /Windows/i.test(ua)
    ? "Windows"
    : /iPhone|iPad|iOS/i.test(ua)
      ? "iPhone/iPad"
      : /Android/i.test(ua)
        ? "Android"
        : /Mac OS X|Macintosh/i.test(ua)
          ? "Mac"
          : /Linux/i.test(ua)
            ? "Linux"
            : null;
  const name = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /SamsungBrowser/.test(ua)
        ? "Samsung Internet"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Firefox\//.test(ua)
            ? "Firefox"
            : /Safari\//.test(ua)
              ? "Safari"
              : null;
  return { device: os && !bot ? `${device} (${os})` : device, browser: name };
}

export function visitorInfo(req: Request): VisitorInfo {
  const h = req.headers;
  const { device, browser } = parseUserAgent(h.get("user-agent"));
  const country = h.get("cf-ipcountry") ?? h.get("x-vercel-ip-country") ?? h.get("x-country-code") ?? null;
  const language = h.get("accept-language")?.split(",")[0]?.trim().slice(0, 20) || null;
  let referrer: string | null = null;
  const ref = h.get("referer");
  if (ref) {
    try {
      const u = new URL(ref);
      referrer = `${u.host}${u.pathname}`.slice(0, 300);
    } catch {
      /* ignore */
    }
  }
  return { device, browser, country: country && country !== "XX" ? country.slice(0, 8) : null, language, referrer };
}

/* ------------------------------------------------------------------------------------------------ alerts */

/** TOOL_ALERT_EMAILS: "all" (default) = free checks + tools, "free_check" = free checks only, "off" = none. */
export function alertMode(v = process.env.TOOL_ALERT_EMAILS): "all" | "free_check" | "off" {
  const m = v?.trim().toLowerCase();
  return m === "off" || m === "free_check" ? m : "all";
}

/**
 * Should this run email the team? Only successful runs, never bots. Free checks always alert (they are already
 * capped at 30/hour). Other tools alert once per visitor per tool per hour, so 20 runs of one tool = one email.
 */
export function shouldAlert(
  run: { tool: string; ok: boolean; device: string | null },
  ctx: { mode: ReturnType<typeof alertMode>; recentSameVisitor: boolean },
): boolean {
  if (!run.ok || ctx.mode === "off" || run.device === "Bot / script") return false;
  if (run.tool === "free-check") return true;
  return ctx.mode === "all" && !ctx.recentSameVisitor;
}

/* ------------------------------------------------------------------------------------------------ recording */

async function signedInUser(): Promise<{ id: string; email: string | null } | null> {
  try {
    const { getSession } = await import("@/lib/auth/session");
    const s = await getSession();
    if (!s?.userId) return null;
    const u = await db.user.findUnique({ where: { id: s.userId }, select: { id: true, email: true } });
    return u ? { id: u.id, email: u.email } : null;
  } catch {
    return null;
  }
}

async function recordToolUse(
  scope: ToolUsageScope,
  result: { status: number; errorCode: string | null; durationMs: number },
  req: Request,
  user: { id: string; email: string | null } | null,
): Promise<void> {
  try {
    const visitor = visitorInfo(req);
    const ipHash = hashIp(clientIp(req));
    const ok = result.status < 400;
    const mode = alertMode();
    const recentSameVisitor =
      scope.tool !== "free-check" && ipHash
        ? (await db.toolUse.count({
            where: { tool: scope.tool, ipHash, alerted: true, createdAt: { gte: new Date(Date.now() - 60 * 60_000) } },
          })) > 0
        : false;
    const alert = shouldAlert({ tool: scope.tool, ok, device: visitor.device }, { mode, recentSameVisitor });
    const row = await db.toolUse.create({
      data: {
        tool: scope.tool,
        url: scope.url?.slice(0, 2048) ?? null,
        input: scope.input?.slice(0, 300) ?? null,
        ok,
        status: result.status,
        errorCode: result.errorCode?.slice(0, 60) ?? null,
        score: scope.score,
        aiCostMicros: scope.aiCostMicros,
        aiModel: scope.aiModel,
        durationMs: result.durationMs,
        ipHash,
        userId: user?.id ?? null,
        userEmail: user?.email ?? null,
        leadId: scope.leadId,
        ...visitor,
        alerted: alert,
      },
    });
    if (alert) {
      const { sendToolAlert } = await import("./tool-alert");
      await sendToolAlert(row);
    }
  } catch (e) {
    console.warn("[tool-usage] could not record", (e as Error)?.name ?? "error");
  }
}

/** Errors we don't log at all: typos and spam that never reached the tool. */
const SKIP_CODES = new Set(["invalid_url", "missing_source", "validation_error", "captcha_failed", "rate_limited"]);

/**
 * Wrap a public tool route: runs `fn` inside a usage scope, then logs the run (and maybe alerts the team) in the
 * background. Use inside handler(): `handler(withToolUsage("meta-tag-checker", async (req) => { ... }))`.
 */
export function withToolUsage(tool: string, fn: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    const scope: ToolUsageScope = { tool, url: null, input: null, score: null, leadId: null, aiCostMicros: 0, aiModel: null };
    const started = Date.now();
    // Read the session now, while the request context (cookies) is still available.
    const userPromise = signedInUser();
    let status = 500;
    let errorCode: string | null = "internal_error";
    try {
      const res = await store.run(scope, () => fn(req));
      status = res.status;
      errorCode = res.status < 400 ? null : "error";
      return res;
    } catch (e) {
      if (e instanceof HttpError) {
        status = e.status;
        errorCode = e.code;
      } else if ((e as Error)?.name === "ZodError") {
        status = 400;
        errorCode = "validation_error";
      }
      throw e;
    } finally {
      if (!errorCode || !SKIP_CODES.has(errorCode)) {
        const durationMs = Date.now() - started;
        void userPromise.then((user) => recordToolUse(scope, { status, errorCode, durationMs }, req, user));
      }
    }
  };
}

/** The visitor left their email on a free check: save it on the usage row and tell the team (hot lead). */
export async function noteToolUseEmail(leadId: string, email: string): Promise<void> {
  try {
    const row = await db.toolUse.findFirst({ where: { leadId }, orderBy: { createdAt: "desc" } });
    if (!row) return;
    const updated = await db.toolUse.update({ where: { id: row.id }, data: { email } });
    if (alertMode() === "off") return;
    const { sendToolAlert } = await import("./tool-alert");
    await sendToolAlert(updated, { emailLeft: true });
  } catch (e) {
    console.warn("[tool-usage] could not note email", (e as Error)?.name ?? "error");
  }
}
