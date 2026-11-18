// Small drawing pieces for the homepage (Nov 2026 redesign): score ring, AI-tool dot, found/missing badge.
// Server components, inline SVG, colours from the mk-* tokens in globals.css.
import clsx from "clsx";
import type { ReactNode } from "react";
import { Check, X } from "lucide-react";

export type EngineKey = "Google" | "ChatGPT" | "Gemini" | "Perplexity";

const DOT: Record<EngineKey, string> = {
  Google: "bg-mk-dot-google",
  ChatGPT: "bg-mk-dot-chatgpt",
  Gemini: "bg-mk-dot-gemini",
  Perplexity: "bg-mk-dot-perplexity",
};

/** Coloured dot that stands for a search or AI tool. */
export function EngineDot({ engine, className }: { engine: EngineKey; className?: string }) {
  return <span aria-hidden className={clsx("inline-block shrink-0 rounded-full", DOT[engine], className ?? "size-2.5")} />;
}

/** Score out of 100 drawn as a ring. `tone` picks the arc colour; the SVG scales with its CSS width. */
export function ScoreRing({
  score,
  tone = "orange",
  caption,
  label,
  className,
}: {
  score: number;
  tone?: "orange" | "good";
  caption?: string;
  label: string;
  className?: string;
}) {
  const r = 56;
  const c = 2 * Math.PI * r;
  const arc = Math.round((c * Math.max(0, Math.min(100, score))) / 100);
  return (
    <svg viewBox="0 0 136 136" role="img" aria-label={label} className={clsx("h-auto shrink-0", className)}>
      <circle cx="68" cy="68" r={r} fill="none" strokeWidth="14" className="stroke-mk-line" />
      <circle
        cx="68"
        cy="68"
        r={r}
        fill="none"
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={`${arc} ${Math.ceil(c)}`}
        transform="rotate(-90 68 68)"
        className={tone === "good" ? "stroke-mk-good-ring" : "stroke-mk-orange"}
      />
      <text x="68" y={caption ? 74 : 80} textAnchor="middle" className="fill-mk-ink font-display" fontSize={caption ? 40 : 42} fontWeight="700">
        {score}
      </text>
      {caption && (
        <text x="68" y="96" textAnchor="middle" fontSize="13" className="fill-mk-text-soft">
          {caption}
        </text>
      )}
    </svg>
  );
}

/** "Found" (green tick) or "Missing" (red cross). */
export function FoundBadge({ found }: { found: boolean }) {
  return found ? (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-mk-good">
      <Check aria-hidden size={14} strokeWidth={3} />
      Found
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-mk-bad">
      <X aria-hidden size={14} strokeWidth={3} />
      Missing
    </span>
  );
}

/** Small "Sample" tag so example data is never mistaken for a real customer. */
export function SampleNote({ children, onInk }: { children: ReactNode; onInk?: boolean }) {
  return <p className={clsx("text-center text-xs", onInk ? "text-mk-on-ink" : "text-mk-text-soft")}>{children}</p>;
}
