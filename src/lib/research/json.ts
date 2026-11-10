// Tiny JSON guards for parsing DataForSEO payloads. Same behaviour as the helpers in src/lib/dataforseo/client.ts, but
// without its server-only imports (db, budget), so the pure research modules can also be used in client components.
type Json = Record<string, unknown>;
export const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
export const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
