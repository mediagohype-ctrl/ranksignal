// Is the paid Google-data partner (DataForSEO) switched on? Pure (env only, no database), so marketing pages can use it
// to label the rank tracker, keyword research, competitors and backlinks as live or "switching on soon".
export function dfsConfigured(): boolean {
  return Boolean(process.env.DATAFORSEO_LOGIN?.trim() && process.env.DATAFORSEO_PASSWORD?.trim());
}

/** Backlink data also needs DataForSEO's separate Backlinks subscription. */
export function backlinksEnabled(): boolean {
  return dfsConfigured() && process.env.DATAFORSEO_BACKLINKS_ENABLED?.trim() === "true";
}
