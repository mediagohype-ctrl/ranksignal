// Guards the server/client boundary: a server file (no "use client") may render components from a client module,
// but must not CALL a plain function exported from one — Next.js throws at runtime ("Attempted to call X() from
// the server"), and `next build` does not catch it. (Regression: /admin/content/new called emptyPost().)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const SRC = join(ROOT, "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const isClient = (code: string) => /^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/.test(code);

function resolveAlias(spec: string): string | null {
  if (!spec.startsWith("@/")) return null;
  const base = join(SRC, spec.slice(2));
  for (const c of [`${base}.tsx`, `${base}.ts`, join(base, "index.tsx"), join(base, "index.ts")]) {
    try {
      if (statSync(c).isFile()) return c;
    } catch {
      /* try next */
    }
  }
  return null;
}

describe("server/client boundary", () => {
  it("server files only import components and types from 'use client' modules", () => {
    const problems: string[] = [];
    for (const file of walk(SRC)) {
      const code = readFileSync(file, "utf8");
      if (isClient(code)) continue;
      for (const m of code.matchAll(/import\s+(type\s+)?\{([^}]+)\}\s+from\s+["']([^"']+)["']/g)) {
        if (m[1]) continue; // `import type { … }`
        const target = resolveAlias(m[3]);
        if (!target || !isClient(readFileSync(target, "utf8"))) continue;
        for (const raw of m[2].split(",")) {
          const name = raw.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0];
          if (!name || raw.trim().startsWith("type ")) continue;
          // Components are PascalCase; anything else (functions, constants) can't be used from the server.
          if (!/^[A-Z]/.test(name)) problems.push(`${file.slice(ROOT.length + 1)} imports "${name}" from client module ${m[3]}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
