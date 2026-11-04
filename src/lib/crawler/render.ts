// Optional headless-browser rendering for JavaScript-only site detection (./js-site.ts).
// Neither playwright nor puppeteer is a dependency today: they are loaded with a runtime dynamic import and, when
// absent (or CRAWLER_RENDER=0), renderWords() returns null and the detection uses the HTML heuristic instead.
// Rendering is bounded: at most a few pages, a hard timeout, and images/fonts/media are never downloaded.
import * as cheerio from "cheerio";
import { assertPublicUrl } from "@/lib/crawler/safe-fetch";
import { countWords } from "@/lib/crawler/extract";

const RENDER_TIMEOUT_MS = 20_000;

type BrowserLike = { newPage(): Promise<PageLike>; close(): Promise<void> };
type PageLike = {
  goto(url: string, o: Record<string, unknown>): Promise<unknown>;
  content(): Promise<string>;
  close(): Promise<void>;
  route?: (pattern: string, fn: (route: { request(): { resourceType(): string }; abort(): Promise<void>; continue(): Promise<void> }) => unknown) => Promise<void>;
};

// Variable specifiers keep bundlers and tsc from resolving modules that may not be installed.
const importOptional = async (name: string): Promise<Record<string, unknown> | null> => {
  try {
    return (await import(/* webpackIgnore: true */ name)) as Record<string, unknown>;
  } catch {
    return null;
  }
};

async function launch(): Promise<{ browser: BrowserLike; idle: string } | null> {
  if (process.env.CRAWLER_RENDER === "0") return null;
  const pw = await importOptional("playwright");
  const chromium = (pw?.chromium ?? (pw?.default as Record<string, unknown> | undefined)?.chromium) as { launch(o: unknown): Promise<BrowserLike> } | undefined;
  if (chromium) {
    try {
      return { browser: await chromium.launch({ headless: true }), idle: "networkidle" };
    } catch {
      /* browser binary missing */
    }
  }
  const pp = await importOptional("puppeteer");
  const puppeteer = (pp?.launch ? pp : pp?.default) as { launch(o: unknown): Promise<BrowserLike> } | undefined;
  if (puppeteer?.launch) {
    try {
      return { browser: await puppeteer.launch({ headless: true }), idle: "networkidle0" };
    } catch {
      /* browser binary missing */
    }
  }
  return null;
}

export function visibleWords(html: string): number {
  const $ = cheerio.load(html);
  $("script, style, noscript, template, svg, iframe, head").remove();
  return countWords(($("body").length ? $("body").text() : $.root().text()).replace(/\s+/g, " ").trim());
}

/** Rendered visible word count per URL, or null when no headless browser is available. */
export async function renderWords(urls: string[]): Promise<Map<string, number> | null> {
  if (!urls.length) return null;
  const launched = await launch();
  if (!launched) return null;
  const { browser, idle } = launched;
  const out = new Map<string, number>();
  try {
    for (const url of urls.slice(0, 3)) {
      try {
        await assertPublicUrl(url);
        const page = await browser.newPage();
        try {
          await page.route?.("**/*", (r) => (["image", "font", "media"].includes(r.request().resourceType()) ? r.abort() : r.continue()));
          await page.goto(url, { waitUntil: idle, timeout: RENDER_TIMEOUT_MS });
          out.set(url, visibleWords(await page.content()));
        } finally {
          await page.close().catch(() => undefined);
        }
      } catch {
        /* one page failing to render is not evidence either way */
      }
    }
  } finally {
    await browser.close().catch(() => undefined);
  }
  return out.size ? out : null;
}
