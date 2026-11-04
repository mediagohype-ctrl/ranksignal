// Growth messages, run from the 5-minute scheduler tick (src/lib/jobs/scheduler.ts). Every sender is idempotent
// (SentMessage kind+key), so running often is safe; the hourly gate only saves database work.
//   every tick in India sending hours (9:00–21:00 IST): WhatsApp "score went up", competitor alerts
//   hourly in sending hours: trial nudges (+ staff "trial ends in 2 days")
//   Mondays in sending hours: fix of the week email, WhatsApp "N fixes waiting"
import { runTrialNudges } from "./nudges";
import { runFixOfWeek } from "./fix-of-week";
import { runCompetitorAlerts } from "./competitors";
import { runFixesWaitingWhatsApp, runScoreUpWhatsApp } from "./whatsapp-updates";
import { isSendingHour, isWeeklySendDay } from "./periods";

const HOUR_MS = 60 * 60 * 1000;
const g = globalThis as unknown as { __growthTick?: { hourlyAt: number; weeklyAt: number } };
const state = (g.__growthTick ??= { hourlyAt: 0, weeklyAt: 0 });

async function step(name: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    console.error(`[growth] ${name} failed:`, e instanceof Error ? e.message : e);
  }
}

export async function runGrowthTick(now = new Date()): Promise<void> {
  if (process.env.GROWTH_MESSAGES_DISABLED === "true" || !isSendingHour(now)) return;
  await step("score-up", () => runScoreUpWhatsApp(now));
  await step("competitor-alerts", () => runCompetitorAlerts(now));
  if (now.getTime() - state.hourlyAt >= HOUR_MS) {
    state.hourlyAt = now.getTime();
    await step("trial-nudges", () => runTrialNudges(now));
  }
  // Weekly senders batch (25 orgs per pass), so on Monday they run every 15 minutes until everyone is done.
  if (isWeeklySendDay(now) && now.getTime() - state.weeklyAt >= 15 * 60_000) {
    state.weeklyAt = now.getTime();
    await step("fix-of-week", () => runFixOfWeek(now));
    await step("fixes-waiting", () => runFixesWaitingWhatsApp(now));
  }
}
