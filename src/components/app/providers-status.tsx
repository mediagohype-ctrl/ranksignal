// Transparency about which AI engines our visibility checks use. Presentational only (server or client safe):
// pages pass in describeProviders() output (or GET /api/providers) or the labels stored on a run.
import { Bot, CircleSlash, FlaskConical, Info } from "lucide-react";
import { SIMULATED_LABEL } from "@/lib/providers/visibility/simulated";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui";

export interface PublicProvider {
  id: string;
  label: string;
  configured: boolean;
  enabled: boolean;
  active: boolean;
  simulated: boolean;
}

export const API_LIMITATION =
  "We ask through each company's developer API. Answers there can differ from what someone sees in the consumer apps (ChatGPT, Claude.ai, Gemini), which personalise results and change often.";

/** Plain-English engine name from a provider label (as stored on observations) or id. */
export function engineName(labelOrId: string): string {
  const s = labelOrId.trim();
  const style = /^(\w[\w ]*?)-style answer\b/i.exec(s);
  if (style && /openrouter/i.test(s)) return `${style[1]}-style via OpenRouter`;
  if (s.startsWith("openrouter:")) {
    const vendor = s.slice("openrouter:".length).split("/")[0];
    const v: Record<string, string> = { openai: "ChatGPT", anthropic: "Claude", google: "Gemini", perplexity: "Perplexity" };
    return `${v[vendor] ?? "AI"}-style via OpenRouter`;
  }
  if (s === SIMULATED_LABEL || s === "simulated") return "Simulated demo data";
  if (/^openai\b/i.test(s)) return "ChatGPT-style via OpenAI API";
  if (/^gemini\b/i.test(s)) return "Gemini via Google API";
  if (/^perplexity\b/i.test(s)) return "Perplexity via Sonar API";
  if (/^dataforseo\b/i.test(s)) return "ChatGPT results via DataForSEO";
  return s;
}

function engineNote(p: PublicProvider): string {
  const id = p.id.split(":")[0];
  if (p.simulated) {
    return p.active
      ? "No real AI engine is connected, so checks use made-up demo answers. They are always labelled and never count as real results."
      : "Demo answers for product tours. Switched off automatically because real AI engines are connected.";
  }
  const base: Record<string, string> = {
    openrouter: "Asks the model through OpenRouter with web search turned on, so answers can cite live websites.",
    openai: "Asks OpenAI's models directly with web search.",
    gemini: "Asks Google's Gemini with Google Search grounding.",
    perplexity: "Asks Perplexity's Sonar model, which always searches the web.",
    dataforseo: "Collects ChatGPT answers through the DataForSEO data service.",
  };
  return base[id] ?? "Asks this AI engine the same questions your customers ask.";
}

function statusBadge(p: PublicProvider) {
  if (p.active) return <Badge tone={p.simulated ? "warning" : "success"} variant="dot">Active</Badge>;
  if (p.configured && !p.enabled) return <Badge tone="neutral" variant="dot">Turned off</Badge>;
  return <Badge tone="neutral" variant="dot">Off</Badge>;
}

/** Card listing active engines (and, in a quieter line, the ones not in use). */
export function ProvidersStatus({ providers, className }: { providers: PublicProvider[]; className?: string }) {
  const active = providers.filter((p) => p.active);
  const inactive = providers.filter((p) => !p.active && !(p.simulated && !p.configured));
  const realActive = active.some((p) => !p.simulated);
  return (
    <Card className={className}>
      <CardHeader
        icon={<Bot />}
        title="AI engines we ask"
        description={
          realActive
            ? "Every check sends your questions to each active engine below."
            : "No real AI engine is connected right now."
        }
      />
      <CardBody className="space-y-4">
        {active.length === 0 ? (
          <p className="flex items-center gap-2 text-small text-fg-soft">
            <CircleSlash aria-hidden size={16} className="text-muted" />
            No AI engines are available, so AI visibility checks can&apos;t run at the moment.
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {active.map((p) => (
              <li key={p.id} className="rounded-xl bg-surface-2 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-small font-semibold text-fg">
                    {p.simulated ? <FlaskConical aria-hidden size={16} className="text-warning" /> : <Bot aria-hidden size={16} className="text-primary" />}
                    {engineName(p.label)}
                  </span>
                  {statusBadge(p)}
                </div>
                <p className="mt-1 text-xs text-muted">{engineNote(p)}</p>
              </li>
            ))}
          </ul>
        )}
        {inactive.length > 0 && (
          <p className="text-xs text-muted">
            Not in use:{" "}
            {inactive.map((p, i) => (
              <span key={p.id}>
                {i > 0 && ", "}
                {engineName(p.label)}
                {p.simulated ? " (only used when no real engine is connected)" : p.configured && !p.enabled ? " (turned off)" : ""}
              </span>
            ))}
            .
          </p>
        )}
        <p className="flex gap-2 text-xs text-muted">
          <Info aria-hidden size={14} className="mt-0.5 shrink-0" />
          {API_LIMITATION}
        </p>
      </CardBody>
    </Card>
  );
}

/** One-line "Measured with: …" for reports, from the platform labels stored on the run's answers. */
export function MeasuredWith({ labels, className }: { labels: string[]; className?: string }) {
  const names = [...new Set(labels.map(engineName))];
  if (names.length === 0) return null;
  return (
    <div className={className}>
      <p className="flex flex-wrap items-center gap-1.5 text-small text-fg-soft">
        <span className="font-medium text-fg">Measured with:</span>
        {names.map((n) => (
          <Badge key={n} tone={n === "Simulated demo data" ? "warning" : "primary"} size="sm" icon={<Bot />}>
            {n}
          </Badge>
        ))}
      </p>
      <p className="mt-1.5 text-xs text-muted">{API_LIMITATION}</p>
    </div>
  );
}
