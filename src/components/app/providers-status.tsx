// Transparency about which AI engines our visibility checks use (shown as product names). Presentational only (server or client safe):
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
  "Answers can differ a little from what someone sees in the ChatGPT, Gemini or Claude apps, which personalise results and change often.";

const PRODUCTS: [RegExp, string][] = [
  [/openai|gpt|chatgpt|dataforseo/i, "ChatGPT"],
  [/anthropic|claude/i, "Claude"],
  [/gemini|google/i, "Gemini"],
  [/perplexity|sonar/i, "Perplexity"],
  [/x-ai|xai|grok/i, "Grok"],
  [/copilot|microsoft/i, "Copilot"],
];

/** Product name (ChatGPT, Gemini, Claude, Perplexity, Grok) from a provider label or id. Never shows model ids. */
export function engineName(labelOrId: string): string {
  const s = labelOrId.trim();
  if (s === SIMULATED_LABEL || /^simulated/i.test(s)) return "Sample answers (not real)";
  // OpenRouter ids look like "openrouter:openai/gpt-4o"; the vendor part names the product.
  const key = s.startsWith("openrouter:") ? s.slice("openrouter:".length) : s;
  for (const [re, name] of PRODUCTS) if (re.test(key)) return name;
  return "Other AI tool";
}

function engineNote(p: PublicProvider): string {
  const id = p.id.split(":")[0];
  if (p.simulated) {
    return p.active
      ? "No real AI tool is switched on, so checks use made-up sample answers. They are always labelled and never count as real results."
      : "Sample answers for demos. Switched off because real AI tools are on.";
  }
  const base: Record<string, string> = {
    openrouter: "Searches the web before answering, so it can link to real websites.",
    openai: "Searches the web before answering, so it can link to real websites.",
    gemini: "Uses Google Search before answering.",
    perplexity: "Always searches the web before answering.",
    dataforseo: "Collects real ChatGPT answers.",
  };
  return base[id] ?? "Asks this AI tool the same questions your customers ask.";
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
        title="AI tools we ask"
        description={
          realActive
            ? "Every AI check asks your questions to each AI tool below."
            : "No real AI tool is switched on right now."
        }
      />
      <CardBody className="space-y-4">
        {active.length === 0 ? (
          <p className="flex items-center gap-2 text-small text-fg-soft">
            <CircleSlash aria-hidden size={16} className="text-muted" />
            No AI tools are available, so AI checks can&apos;t run right now. Please try again later or contact us.
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
                {p.simulated ? " (only used when no real AI tool is on)" : p.configured && !p.enabled ? " (turned off)" : ""}
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
          <Badge key={n} tone={n === "Sample answers (not real)" ? "warning" : "primary"} size="sm" icon={<Bot />}>
            {n}
          </Badge>
        ))}
      </p>
      <p className="mt-1.5 text-xs text-muted">{API_LIMITATION}</p>
    </div>
  );
}
