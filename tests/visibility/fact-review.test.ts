import { describe, expect, it } from "vitest";
import {
  factsToCheck, isReputationRisk, latestProbedRun, readFactReviews, sameFact, withConfirmedFact, withRejectedFact, wrongFactTaskDescription,
  wrongFactTaskTitle,
} from "@/lib/visibility/fact-review";

const empty = { confirmed: [], rejected: [] };

describe("Check these facts", () => {
  it("shows older 'inaccuracies' as not confirmed — never as wrong", () => {
    const m = { brandKnowledge: [{ provider: "openai", version: "bk-2", inaccuracies: ["Pubesto was founded by Gourav Gupta."] }] };
    expect(factsToCheck(m)).toEqual([{ engine: "openai", statement: "Pubesto was founded by Gourav Gupta.", status: "not_confirmed", risk: false }]);
  });

  it("reads bk-3 claims with their status, merges duplicates and skips sample data", () => {
    const m = {
      brandKnowledge: [
        { provider: "openai", claims: [{ claim: "Office in Okhla Phase II, New Delhi.", status: "not_confirmed" }, { claim: "Based in Mumbai.", status: "conflict" }] },
        { provider: "perplexity", claims: [{ claim: "Office in Okhla Phase II, New Delhi.", status: "conflict" }] },
        { provider: "simulated", claims: [{ claim: "x", status: "conflict" }] },
      ],
    };
    expect(factsToCheck(m).map((f) => [f.statement, f.status])).toEqual([
      ["Office in Okhla Phase II, New Delhi.", "conflict"],
      ["Based in Mumbai.", "conflict"],
    ]);
    expect(factsToCheck({ ...m, simulated: true })).toEqual([]);
  });

  it("drops statements the owner already confirmed or marked wrong", () => {
    const m = {
      brandKnowledge: [{ provider: "openai", claims: [{ claim: "Founded by Gourav Gupta.", status: "not_confirmed" }, { claim: "Open on Sundays.", status: "not_confirmed" }] }],
    };
    let r = withConfirmedFact(empty, "Founded by Gourav Gupta.");
    expect(factsToCheck(m, r).map((f) => f.statement)).toEqual(["Open on Sundays."]);
    r = withRejectedFact(r, { statement: "Open on Sundays.", correction: "Closed on Sundays", taskId: "t1" });
    expect(factsToCheck(m, r)).toEqual([]);
    // Changing your mind moves it between the lists.
    expect(withConfirmedFact(r, "Open on Sundays.").rejected).toEqual([]);
  });

  it("matches the same fact across small wording changes, but not a different fact", () => {
    expect(sameFact("Founded by Gourav Gupta.", "founded by gourav gupta")).toBe(true);
    expect(sameFact("Based in Pune.", "Based in Mumbai.")).toBe(false);
  });

  it("reads settings defensively", () => {
    expect(readFactReviews(null)).toEqual(empty);
    expect(readFactReviews({ confirmedFacts: ["  a  ", 3, ""], rejectedFacts: [{ statement: "b", taskId: "t" }, { nope: 1 }, "x"] })).toEqual({
      confirmed: ["a"],
      rejected: [{ statement: "b", taskId: "t" }],
    });
  });

  it("uses the NEWEST probed check, even when it found nothing", () => {
    const runs = [
      { id: "new", status: "running", metrics: null },
      { id: "nov15", status: "succeeded", metrics: { brandKnowledge: [{ provider: "perplexity", claims: [] }] } },
      { id: "oct29", status: "succeeded", metrics: { brandKnowledge: [{ provider: "openai", inaccuracies: ["old"] }] } },
    ];
    const p = latestProbedRun(runs);
    expect(p?.run.id).toBe("nov15");
    expect(p?.facts).toEqual([]);
  });

  it("builds the To-do task text", () => {
    expect(wrongFactTaskTitle("Founded in 1990")).toBe("Correct what AI says: Founded in 1990");
    expect(wrongFactTaskTitle("x".repeat(500)).length).toBe(200);
    const d = wrongFactTaskDescription({ statement: "Based in Mumbai", toolName: "ChatGPT", correction: "Pune" });
    expect(d).toContain("ChatGPT said: “Based in Mumbai”");
    expect(d).toContain("What is right: Pune");
  });
});

describe("reputation risks", () => {
  it.each([
    "Some users report complaints about delayed payments.",
    "There are payment disputes with freelancers.",
    "A few reviews call it a scam.",
    "The company faced a lawsuit in 2023.",
    "Allegations of fraud have been made.",
  ])("flags: %s", (s) => expect(isReputationRisk(s)).toBe(true));
  it.each(["Pubesto was founded by Gourav Gupta.", "Its office is in Okhla Phase II, New Delhi.", "It offers payment processing for publishers."])(
    "does not flag: %s",
    (s) => expect(isReputationRisk(s)).toBe(false),
  );
});
