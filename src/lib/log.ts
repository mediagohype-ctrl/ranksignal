// Structured logging (round 5 contract): one JSON object per line on stdout/stderr, which Render's log
// stream and most log drains parse directly. Keys that look like secrets are redacted recursively.
// Usage: log.info("queue.claimed", { runId, kind }); log.error("api.unhandled", { err }).
type Level = "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const SECRET_KEY = /secret|token|password|key|authorization/i;
const MAX_DEPTH = 5;
const MAX_STRING = 4000;

function serializeError(e: Error, depth: number): Record<string, unknown> {
  const out: Record<string, unknown> = { class: e.constructor?.name ?? "Error", message: e.message };
  if (e.stack) out.stack = e.stack.split("\n").slice(0, 15).join("\n");
  const extra = e as unknown as Record<string, unknown>;
  for (const k of ["code", "errorClass", "status"]) if (extra[k] !== undefined) out[k] = redact(extra[k], depth + 1);
  return out;
}

/** Exported for tests. Redacts secret-looking keys, truncates long strings, serializes Errors, avoids cycles. */
export function redact(v: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (v === null || v === undefined) return v;
  if (typeof v === "string") return v.length > MAX_STRING ? `${v.slice(0, MAX_STRING)}…` : v;
  if (typeof v === "bigint") return v.toString();
  if (typeof v !== "object") return v;
  if (v instanceof Date) return v.toISOString();
  if (v instanceof Error) return serializeError(v, depth);
  if (depth >= MAX_DEPTH) return "[depth]";
  if (seen.has(v)) return "[circular]";
  seen.add(v);
  if (Array.isArray(v)) return v.slice(0, 50).map((x) => redact(x, depth + 1, seen));
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    out[k] = SECRET_KEY.test(k) ? "[redacted]" : redact(val, depth + 1, seen);
  }
  return out;
}

function write(level: Level, event: string, fields?: Fields) {
  const line: Record<string, unknown> = { ts: new Date().toISOString(), level, event };
  if (fields) Object.assign(line, redact(fields) as Record<string, unknown>);
  let text: string;
  try {
    text = JSON.stringify(line);
  } catch {
    text = JSON.stringify({ ts: line.ts, level, event, note: "unserializable fields" });
  }
  if (level === "error") console.error(text);
  else if (level === "warn") console.warn(text);
  else console.log(text);
}

export const log = {
  info: (event: string, fields?: Fields) => write("info", event, fields),
  warn: (event: string, fields?: Fields) => write("warn", event, fields),
  error: (event: string, fields?: Fields) => write("error", event, fields),
};
