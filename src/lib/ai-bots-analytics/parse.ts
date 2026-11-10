// Access-log line parsing (pure). Supports Apache/Nginx "combined" (and "common" + user agent missing → skipped) and
// JSON lines (Cloudflare Logpush HTTP requests, Nginx/Caddy JSON, generic {ip, path, status, user_agent, time}).
// Query strings are dropped on purpose: they can carry personal data or secrets and we never store them.

export interface LogHit {
  /** Client IP (used only in memory for range verification; never stored). */
  ip: string | null;
  /** UTC day, YYYY-MM-DD. */
  date: string;
  path: string;
  status: number;
  userAgent: string;
}

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const MAX_PATH = 300;

const COMBINED =
  /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"((?:[^"\\]|\\.)*)"\s+(\d{3})\s+\S+(?:\s+"(?:[^"\\]|\\.)*"\s+"((?:[^"\\]|\\.)*)")?/;

/** "10/Oct/2026:13:55:36 +0530" → Date (UTC instant). */
export function parseClfTime(s: string): Date | null {
  const m = /^(\d{1,2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})(?:\s+([+-])(\d{2})(\d{2}))?$/.exec(s.trim());
  if (!m) return null;
  const mon = MONTHS[m[2].toLowerCase()];
  if (mon === undefined) return null;
  let t = Date.UTC(Number(m[3]), mon, Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6]));
  if (m[7]) {
    const off = (Number(m[8]) * 60 + Number(m[9])) * 60_000;
    t += m[7] === "+" ? -off : off;
  }
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Any timestamp shape seen in JSON logs: ISO string, unix s/ms/µs/ns number or numeric string. */
export function parseAnyTime(v: unknown): Date | null {
  if (typeof v === "number" || (typeof v === "string" && /^\d{9,20}(\.\d+)?$/.test(v))) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return null;
    const ms = n > 1e17 ? n / 1e6 : n > 1e14 ? n / 1e3 : n > 1e11 ? n : n * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === "string" && v) {
    const clf = parseClfTime(v);
    if (clf) return clf;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Request target → path without query/fragment, or null when it isn't a path. */
export function normalizePath(target: string | null | undefined): string | null {
  if (!target) return null;
  let p = target.trim();
  if (/^https?:\/\//i.test(p)) {
    try {
      p = new URL(p).pathname;
    } catch {
      return null;
    }
  }
  p = p.split(/[?#]/)[0];
  if (!p.startsWith("/")) return null;
  p = p.replace(/[\u0000-\u001f\u007f]/g, "");
  return p.length > MAX_PATH ? p.slice(0, MAX_PATH) : p;
}

const unescapeClf = (s: string) => s.replace(/\\(["\\])/g, "$1").replace(/\\x([0-9a-fA-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));

function parseCombined(line: string): LogHit | null {
  const m = COMBINED.exec(line);
  if (!m || m[5] === undefined) return null; // no user agent → can't attribute
  const time = parseClfTime(m[2]);
  if (!time) return null;
  const request = unescapeClf(m[3]).split(" ");
  const path = normalizePath(request.length >= 2 ? request[1] : request[0]);
  if (!path) return null;
  return { ip: m[1] === "-" ? null : m[1], date: dayKey(time), path, status: Number(m[4]), userAgent: unescapeClf(m[5]) };
}

type Json = Record<string, unknown>;
const pick = (o: Json, keys: string[]): unknown => {
  for (const k of keys) {
    if (o[k] !== undefined && o[k] !== null && o[k] !== "") return o[k];
  }
  return undefined;
};

const JSON_KEYS = {
  ip: ["ClientIP", "client_ip", "clientIp", "ip", "remote_addr", "remoteAddr", "remote_ip"],
  path: ["ClientRequestURI", "ClientRequestPath", "path", "uri", "request_uri", "requestUri", "url", "request_path"],
  status: ["EdgeResponseStatus", "OriginResponseStatus", "status", "statusCode", "status_code", "response_status"],
  ua: ["ClientRequestUserAgent", "user_agent", "userAgent", "http_user_agent", "ua", "useragent"],
  time: ["EdgeStartTimestamp", "time", "timestamp", "@timestamp", "time_local", "time_iso8601", "ts", "date"],
};

/** A JSON object (already parsed) → hit. Exported for the ingest endpoint. */
export function hitFromObject(o: unknown, now = new Date()): LogHit | null {
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  let obj = o as Json;
  // Caddy nests request fields: { request: { remote_ip, uri, headers: { "User-Agent": [...] } }, status, ts }
  const req = obj.request && typeof obj.request === "object" ? (obj.request as Json) : null;
  if (req) {
    const headers = (req.headers && typeof req.headers === "object" ? req.headers : {}) as Json;
    const uaH = headers["User-Agent"] ?? headers["user-agent"];
    obj = { ...req, ...obj, ua: Array.isArray(uaH) ? uaH[0] : uaH };
  }
  const ua = pick(obj, JSON_KEYS.ua);
  const status = Number(pick(obj, JSON_KEYS.status));
  const path = normalizePath(String(pick(obj, JSON_KEYS.path) ?? ""));
  if (typeof ua !== "string" || !ua || !path || !Number.isInteger(status) || status < 100 || status > 599) return null;
  const rawTime = pick(obj, JSON_KEYS.time);
  const time = rawTime === undefined ? now : parseAnyTime(rawTime);
  if (!time) return null;
  const ip = pick(obj, JSON_KEYS.ip);
  return { ip: typeof ip === "string" ? ip : null, date: dayKey(time), path, status, userAgent: ua.slice(0, 1000) };
}

/** One log line (combined or JSON) → hit, or null when the line isn't a recognisable request. */
export function parseLogLine(line: string): LogHit | null {
  const s = line.trim();
  if (!s) return null;
  if (s.startsWith("{")) {
    try {
      return hitFromObject(JSON.parse(s));
    } catch {
      return null;
    }
  }
  return parseCombined(s);
}
