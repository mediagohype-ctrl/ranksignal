// MCP tool definitions (names, descriptions, JSON Schemas). No I/O, so the public docs page can list them.
// The handlers live in ./mcp.ts.

export const TOOL_NAMES = ["list_projects", "get_report", "list_issues", "get_visibility", "get_scores"] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

const PROJECT_ID_SCHEMA = { type: "string", description: "Project id from list_projects" };
const CURSOR_SCHEMA = { type: "string", description: "nextCursor from the previous call, to get the next page" };
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

export const MCP_TOOLS: { name: ToolName; title: string; description: string; inputSchema: Record<string, unknown>; annotations: typeof READ_ONLY }[] = [
  {
    name: "list_projects",
    title: "List projects",
    description: "List the websites (projects) in this MyWebRank workspace with their latest overall and pillar scores.",
    inputSchema: { type: "object", properties: { cursor: CURSOR_SCHEMA, limit: { type: "integer", minimum: 1, maximum: 100 } }, additionalProperties: false },
    annotations: READ_ONLY,
  },
  {
    name: "get_report",
    title: "Get latest report",
    description: "The latest SEO/AEO/GEO report for a project: overall score, pillar scores and checks, issues with fixes, AI visibility summary and plain-English summary.",
    inputSchema: { type: "object", properties: { project_id: PROJECT_ID_SCHEMA }, required: ["project_id"], additionalProperties: false },
    annotations: READ_ONLY,
  },
  {
    name: "list_issues",
    title: "List issues",
    description: "Issues found on the website in the latest check, highest impact first, each with what is wrong, why it matters and how to fix it.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: PROJECT_ID_SCHEMA,
        pillar: { type: "string", enum: ["seo", "aeo", "geo", "brand"] },
        impact: { type: "string", enum: ["high", "medium", "low"] },
        cursor: CURSOR_SCHEMA,
        limit: { type: "integer", minimum: 1, maximum: 100 },
      },
      required: ["project_id"],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
  },
  {
    name: "get_visibility",
    title: "Get AI visibility",
    description: "How often AI assistants (ChatGPT, Gemini, Perplexity, Claude…) named, cited or recommended the business in the latest AI check, per question and per assistant.",
    inputSchema: { type: "object", properties: { project_id: PROJECT_ID_SCHEMA }, required: ["project_id"], additionalProperties: false },
    annotations: READ_ONLY,
  },
  {
    name: "get_scores",
    title: "Get score history",
    description: "Score history for a project, newest first: overall and pillar scores, open issues and AI rates after each check.",
    inputSchema: {
      type: "object",
      properties: { project_id: PROJECT_ID_SCHEMA, kind: { type: "string", enum: ["crawl", "visibility"] }, cursor: CURSOR_SCHEMA, limit: { type: "integer", minimum: 1, maximum: 500 } },
      required: ["project_id"],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
  },
];
