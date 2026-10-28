// Small word-level diff (LCS over whitespace-preserving tokens) for before/after previews.
export type DiffOp = "equal" | "add" | "remove";
export interface DiffSegment {
  op: DiffOp;
  text: string;
}

/** Split into words and whitespace runs so joining the tokens reproduces the input exactly. */
export function tokenize(s: string): string[] {
  return s.match(/\s+|[^\s]+/g) ?? [];
}

const MAX_CELLS = 250_000; // guard against huge inputs (O(n*m) table)

export function diffWords(before: string | null | undefined, after: string | null | undefined): DiffSegment[] {
  const a = tokenize(before ?? "");
  const b = tokenize(after ?? "");
  if (a.length === 0 && b.length === 0) return [];
  if (a.length * b.length > MAX_CELLS) {
    return merge([
      ...(a.length ? [{ op: "remove" as const, text: a.join("") }] : []),
      ...(b.length ? [{ op: "add" as const, text: b.join("") }] : []),
    ]);
  }
  const n = a.length;
  const m = b.length;
  // lcs[i][j] = LCS length of a[i:], b[j:]
  const lcs: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ op: "equal", text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ op: "remove", text: a[i++] });
    } else {
      out.push({ op: "add", text: b[j++] });
    }
  }
  while (i < n) out.push({ op: "remove", text: a[i++] });
  while (j < m) out.push({ op: "add", text: b[j++] });
  return merge(out);
}

function merge(segs: DiffSegment[]): DiffSegment[] {
  const out: DiffSegment[] = [];
  for (const s of segs) {
    const last = out[out.length - 1];
    if (last && last.op === s.op) last.text += s.text;
    else out.push({ ...s });
  }
  return out;
}

/** Text of one side reconstructed from segments (useful for tests/sanity checks). */
export function sideText(segs: DiffSegment[], side: "before" | "after"): string {
  return segs.filter((s) => s.op === "equal" || s.op === (side === "before" ? "remove" : "add")).map((s) => s.text).join("");
}
