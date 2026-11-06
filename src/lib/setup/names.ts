// Client-safe text helpers for setup copy.

/** ["ChatGPT", "Gemini", "Claude"] → "ChatGPT, Gemini and Claude". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "AI assistants";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
