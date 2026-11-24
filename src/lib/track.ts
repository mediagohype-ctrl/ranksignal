// Browser funnel events, sent to both GA4 (gtag) and the Meta pixel (fbq). Never throws; a blocked tracker is a no-op.
// GA4 names are snake_case (mark check_started, check_completed, whatsapp_lead, trial_started and call_booked as
// key events in GA4 Admin → Events). Meta gets a standard event where one exists, else a custom one.
//
// | Moment                      | GA4             | Meta                 |
// | Website typed, button tapped| check_started   | StartCheck (custom)  |
// | Score shown                 | check_completed | ViewContent          |
// | Check failed                | check_failed    | —                    |
// | WhatsApp number saved       | whatsapp_lead   | Lead (+ CAPI, same id)|
// | Trial started               | trial_started   | StartTrial           |
// | Book a call clicked         | call_booked     | Schedule             |

type Params = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

const META_STANDARD = new Set(["ViewContent", "Lead", "StartTrial", "Schedule", "CompleteRegistration", "Contact"]);

export function track(event: string, params: Params = {}, meta?: { name: string; eventId?: string }): void {
  if (typeof window === "undefined") return;
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined));
  try {
    window.gtag?.("event", event, clean);
  } catch {
    /* ignore */
  }
  if (!meta) return;
  try {
    const opts = meta.eventId ? { eventID: meta.eventId } : undefined;
    window.fbq?.(META_STANDARD.has(meta.name) ? "track" : "trackCustom", meta.name, clean, opts);
  } catch {
    /* ignore */
  }
}

/** Once per browser session per key (e.g. one check_completed per lead), so re-renders and reloads don't double count. */
export function trackOnce(key: string, event: string, params: Params = {}, meta?: { name: string; eventId?: string }): void {
  try {
    const k = `mwr.tracked.${key}`;
    if (window.sessionStorage.getItem(k)) return;
    window.sessionStorage.setItem(k, "1");
  } catch {
    /* storage blocked: send anyway */
  }
  track(event, params, meta);
}
