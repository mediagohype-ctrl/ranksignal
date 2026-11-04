import { describe, expect, it } from "vitest";
import {
  buildTodo,
  gainOf,
  issueForAction,
  legacyTodoTarget,
  nextTodo,
  parseTodoId,
  recheckLine,
  sortTodo,
  splitTodo,
  timeLabel,
  todoHref,
  todoProgress,
  type TodoInput,
  type TodoItem,
} from "@/lib/tasks/todo";

const NOW = new Date("2026-11-04T10:00:00Z");
const item = (o: Partial<TodoItem> & { id: string }): TodoItem => ({
  kind: "issue",
  side: "website",
  title: o.id,
  impact: "medium",
  minutes: 60,
  points: 0,
  state: "open",
  ...o,
});

describe("sorting by gain ÷ effort", () => {
  it("puts the most points per minute first", () => {
    const sorted = sortTodo([
      item({ id: "slow-big", points: 10, minutes: 240 }), // 0.042 / min
      item({ id: "quick-small", points: 2, minutes: 15 }), // 0.133 / min
      item({ id: "mid", points: 5, minutes: 60 }), // 0.083 / min
    ]);
    expect(sorted.map((i) => i.id)).toEqual(["quick-small", "mid", "slow-big"]);
  });

  it("uses a priority floor for items without points, then priority, then title", () => {
    expect(gainOf({ points: 0, impact: "high" })).toBe(2);
    expect(gainOf({ points: 3, impact: "low" })).toBe(3);
    const sorted = sortTodo([
      item({ id: "low", impact: "low", minutes: 30 }), // 0.5 / 30
      item({ id: "high", impact: "high", minutes: 30 }), // 2 / 30
      item({ id: "same-b", impact: "medium", minutes: 30, points: 1 }), // 1 / 30
      item({ id: "same-a", impact: "medium", minutes: 30, points: 1 }), // tie → title
    ]);
    expect(sorted.map((i) => i.id)).toEqual(["high", "same-a", "same-b", "low"]);
  });
});

describe("buildTodo / progress", () => {
  const base: TodoInput = {
    issues: [
      { id: "seo-titles", title: "3 pages have bad headlines", impact: "high", effort: "quick" },
      { id: "seo-h1", title: "1 page has no heading", impact: "medium", effort: "quick" },
      { id: "brand-ai_knowledge", title: "AI assistants say wrong things", impact: "high", effort: "moderate" },
      { id: "aeo-readability", title: "Hard to read", impact: "low", effort: "moderate" },
    ],
    points: { "seo-titles": 6, "seo-h1": 2, "brand-ai_knowledge": 3 },
    stateTasks: [
      {
        id: "t1",
        todoKey: "seo-h1",
        status: "done",
        title: "Fix: 1 page has no heading",
        completedAt: "2026-11-01T00:00:00Z",
        updatedAt: "2026-11-01T00:00:00Z",
        recheck: { url: "https://x.in/", at: "2026-11-01T00:00:00Z", fixed: true },
      },
      { id: "t2", todoKey: "aeo-readability", status: "skipped", title: "Fix: Hard to read", completedAt: null, updatedAt: "2026-11-02T00:00:00Z" },
      { id: "t3", todoKey: "seo-canonical", status: "done", title: "Fix: Gone now", completedAt: "2026-10-20T00:00:00Z", updatedAt: "2026-10-20T00:00:00Z" },
      { id: "t4", todoKey: "seo-old", status: "done", title: "Fix: Long ago", completedAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
    ],
    offsite: [
      { id: "o1", name: "Justdial", status: "todo", updatedAt: "2026-11-01T00:00:00Z" },
      { id: "o2", name: "Sulekha", status: "live", updatedAt: "2026-11-02T00:00:00Z" },
      { id: "o3", name: "IndiaMART", status: "rejected", updatedAt: "2026-11-02T00:00:00Z" },
    ],
    tasks: [
      { id: "p1", title: "Ask for reviews", status: "in_progress", category: "offsite", priority: "high", completedAt: null },
      { id: "p2", title: "Update prices page", status: "backlog", category: "content", priority: "low", completedAt: null },
      { id: "p3", title: "Old cancelled thing", status: "cancelled", category: "content", priority: "low", completedAt: null },
    ],
    now: NOW,
  };

  it("merges problems, listings and tasks into one list with the right sides and states", () => {
    const items = buildTodo(base);
    const by = Object.fromEntries(items.map((i) => [i.id, i]));
    expect(by["seo-titles"]).toMatchObject({ side: "website", state: "open", points: 6, minutes: 15 });
    expect(by["seo-h1"]).toMatchObject({ state: "done", recheck: { fixed: true } });
    expect(by["brand-ai_knowledge"].side).toBe("outside");
    expect(by["aeo-readability"].state).toBe("skipped");
    expect(by["seo-canonical"]).toMatchObject({ state: "done", title: "Gone now" }); // fixed and gone: kept as done
    expect(by["seo-old"]).toBeUndefined(); // done too long ago
    expect(by["offsite-o1"]).toMatchObject({ side: "outside", state: "open", title: "Get listed on Justdial" });
    expect(by["offsite-o2"].state).toBe("done");
    expect(by["offsite-o3"].state).toBe("dismissed");
    expect(by["task-p1"]).toMatchObject({ side: "outside", state: "started", impact: "high" });
    expect(by["task-p2"]).toMatchObject({ side: "website", state: "open" });
    expect(by["task-p3"].state).toBe("dismissed");
  });

  it("counts progress as done of (open + started + done), ignoring skipped and not-for-me", () => {
    const items = buildTodo(base);
    // open: seo-titles, brand-ai_knowledge, offsite-o1, task-p2; started: task-p1; done: seo-h1, seo-canonical, offsite-o2
    expect(todoProgress(items)).toEqual({ done: 3, total: 8 });
    const lists = splitTodo(items);
    expect(lists.progress).toEqual({ done: 3, total: 8 });
    expect(lists.website.map((i) => i.id)).toEqual(["seo-titles", "task-p2"]);
    expect(lists.outside.map((i) => i.id).sort()).toEqual(["brand-ai_knowledge", "offsite-o1", "task-p1"].sort());
    expect(lists.hidden.map((i) => i.id).sort()).toEqual(["aeo-readability", "offsite-o3", "task-p3"].sort());
    expect(lists.done[0].id).toBe("offsite-o2"); // newest first
  });

  it("never lists a problem twice", () => {
    const items = buildTodo({ ...base, issues: [...base.issues, base.issues[0]] });
    expect(items.filter((i) => i.id === "seo-titles")).toHaveLength(1);
  });

  it("a skip on an off-site item only hides it while it is still to do", () => {
    const items = buildTodo({
      ...base,
      stateTasks: [{ id: "s", todoKey: "offsite-o1", status: "skipped", title: "x", completedAt: null, updatedAt: "2026-11-03T00:00:00Z" }],
    });
    expect(items.find((i) => i.id === "offsite-o1")!.state).toBe("skipped");
  });
});

describe("nextTodo", () => {
  it("opens the next open fix on the same side, then anywhere", () => {
    const items = [
      item({ id: "a", points: 9, minutes: 15 }),
      item({ id: "b", points: 3, minutes: 15 }),
      item({ id: "c", points: 1, minutes: 15, state: "done" }),
      item({ id: "o", side: "outside", points: 1, minutes: 30 }),
    ];
    expect(nextTodo(items, "a")?.id).toBe("b");
    expect(nextTodo(items, "b")?.id).toBe("o");
    expect(nextTodo(items, "c")?.id).toBe("a"); // from a done item: the first open one
    expect(nextTodo([item({ id: "only" })], "only")).toBeNull();
  });
});

describe("ids, links and old routes", () => {
  it("parses item ids", () => {
    expect(parseTodoId("seo-titles")).toEqual({ kind: "issue", issueId: "seo-titles" });
    expect(parseTodoId("finding-missing-lang")).toEqual({ kind: "issue", issueId: "finding-missing-lang" });
    expect(parseTodoId("offsite-abc")).toEqual({ kind: "offsite", offsiteId: "abc" });
    expect(parseTodoId("task-abc")).toEqual({ kind: "task", taskId: "abc" });
    expect(parseTodoId("action-abc")).toEqual({ kind: "action", actionId: "abc" });
    expect(parseTodoId("task-")).toBeNull();
    expect(parseTodoId("../etc")).toBeNull();
  });

  it("maps old To-do pages into the one list", () => {
    expect(legacyTodoTarget("audit", {})).toEqual({});
    expect(legacyTodoTarget("actions", {})).toEqual({});
    expect(legacyTodoTarget("actions", { id: "act1" })).toEqual({ item: "action-act1" });
    expect(legacyTodoTarget("actions", { focus: "act2" })).toEqual({ item: "action-act2" });
    expect(legacyTodoTarget("actions", { focus: "bad id!" })).toEqual({});
    expect(legacyTodoTarget("work", { fromAction: "act3" })).toEqual({ item: "action-act3" });
    expect(legacyTodoTarget("work", { task: ["t9", "t8"] })).toEqual({ item: "task-t9" });
    expect(legacyTodoTarget("offsite", { anything: "x" })).toEqual({ tab: "outside" });
    expect(todoHref("p1", legacyTodoTarget("actions", { id: "a" }))).toBe("/app/projects/p1/todo/action-a");
    expect(todoHref("p1", legacyTodoTarget("offsite", {}))).toBe("/app/projects/p1/todo?tab=outside");
    expect(todoHref("p1", legacyTodoTarget("audit", {}))).toBe("/app/projects/p1/todo");
  });

  it("matches a drafted change to its problem, preferring one on the same page", () => {
    const issues = [
      { id: "seo-titles", relatedActionType: "update_title", affectedUrls: ["https://x.in/a"] },
      { id: "brand-name_consistency", relatedActionType: "update_title", affectedUrls: ["https://x.in/b/"] },
      { id: "seo-meta_description", relatedActionType: "update_meta_description", affectedUrls: [] },
    ];
    expect(issueForAction({ type: "update_title", targetUrl: "https://x.in/b" }, issues)?.id).toBe("brand-name_consistency");
    expect(issueForAction({ type: "update_title", targetUrl: "https://x.in/zzz" }, issues)?.id).toBe("seo-titles");
    expect(issueForAction({ type: "update_meta_description", targetUrl: null }, issues)?.id).toBe("seo-meta_description");
    expect(issueForAction({ type: "robots_review", targetUrl: null }, issues)).toBeNull();
  });

  it("labels time and re-check results in plain words", () => {
    expect(timeLabel(15)).toBe("About 15 min");
    expect(timeLabel(60)).toBe("About 1 hour");
    expect(timeLabel(240)).toBe("Half a day or more");
    expect(recheckLine({ url: "u", at: "t", fixed: true })?.text).toBe("Fixed — we can see it.");
    expect(recheckLine({ url: "u", at: "t", fixed: false })?.text).toMatch(/^We can't see this change yet/);
    expect(recheckLine(null)).toBeNull();
  });
});
