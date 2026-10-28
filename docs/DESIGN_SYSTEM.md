# Design system

This is the single source of truth for how pages look. Page agents: follow it literally.
Primitives live in `src/components/ui/*` (import from `@/components/ui`). Tokens live in `src/app/globals.css`.

## 1. Rules (do / don't)

**Do**
- Import everything from `@/components/ui`. Use a primitive before writing your own markup.
- Use token utilities only: `bg-surface`, `text-muted`, `border-border`, `text-primary`, `bg-score-good-soft`…
- Use the type classes (`text-display`, `text-h1`…`text-caption`) for headings and text sizes.
- Give every icon-only button an `aria-label`. Pass icons through `icon` props (they get `aria-hidden`).
- Label simulated data with `<SimulatedDataBanner />`. Write in plain English for a small-business owner.
- Use `tabular-nums` for numbers in tables and stats.

**Don't**
- No hex/rgb colours, no `text-gray-*`, `bg-white`, `bg-slate-*`, `text-black` in pages. (Dark mode breaks.)
- No other `font-family`. Google Sans Flex is global. Code can use `font-mono`.
- No `shadow-2xl`/custom shadows. Use `shadow-xs|sm|md|lg|xl|card|card-hover`.
- Don't put text in `text-accent-bright` (decorative only, fails contrast).
- Don't nest Cards inside Cards. Use `bg-surface-2` blocks or `Divider` inside a card.
- Don't promise rankings/outcomes in copy.

## 2. Tokens

All tokens have light and dark values (dark via `prefers-color-scheme`). Utility = `bg-*`, `text-*`, `border-*`, `ring-*`, `stroke-*`, `fill-*`.

| Group | Tokens |
|---|---|
| Surfaces | `bg` (page), `surface` (cards), `surface-2` (subtle fill, table head, hover), `surface-3` (stronger fill), `border`, `border-strong`, `overlay` |
| Text | `fg` (primary text), `fg-soft` (body text in cards), `muted` (secondary; AA on all surfaces) |
| Brand | `primary` / `primary-hover` / `primary-fg` / `primary-soft` / `primary-soft-fg` (indigo); `accent` / `accent-hover` / `accent-fg` / `accent-soft` (teal); `accent-bright` (decorative); `navy`, `navy-2`, `navy-fg` (hero bands) |
| Semantic | `success`, `warning`, `danger` (+ `danger-hover`, `danger-fg`), `info`, each with `-soft` |
| Severity | `sev-critical`, `sev-high`, `sev-medium`, `sev-low`, `sev-info`, each with `-soft` |
| Risk class | `risk-a` (green), `risk-b` (blue), `risk-c` (amber), `risk-d` (red), each with `-soft` |
| Score bands | `score-good` (≥80), `score-ok` (50–79), `score-poor` (<50), `score-none` (not measured), each with `-soft`; `score-track` (ring/meter track) |
| Charts | `chart-1`…`chart-5`, `chart-muted`, `chart-grid`. In recharts use `stroke="var(--chart-1)"`, `fill="var(--chart-2)"`, grid `stroke="var(--chart-grid)"`, axis ticks `fill: "var(--muted)"` |
| Diff | `diff-add`, `diff-remove` |
| Focus | `ring` (global `:focus-visible` outline is already applied; use `focus-ring` utility for custom elements) |

Pattern for tinted chips/boxes: `bg-{x}-soft text-{x}` (AA verified both themes). Text on solid fills: `bg-primary text-primary-fg`, `bg-accent text-accent-fg`, `bg-danger text-danger-fg`.

Score helpers (TS): `scoreBand(score) → "good"|"ok"|"poor"|"none"`, `gradeFromScore(score)` (A≥90, B≥80, C≥65, D≥50, F) — prefer the report's own `grade`; `SCORE_BAND_CLASS[band].text|bg|soft|stroke|label`.

**Radius:** `rounded-md` (inputs inner bits), `rounded-lg` (buttons, inputs), `rounded-xl` (notices, small panels), `rounded-2xl` (cards, dialogs), `rounded-full` (badges, chips, avatars).
**Shadows:** cards `shadow-card` (hover `shadow-card-hover`), popovers/toasts `shadow-lg`, dialogs `shadow-xl`.
**Motion:** `animate-fade-in`, `animate-pop-in`, `skeleton`. All animation is disabled under `prefers-reduced-motion`.

## 3. Typography

Font: **Google Sans Flex** (variable, weights 1–1000, optical sizing auto), loaded in `src/app/layout.tsx`, exposed as `--font-sans` / `font-sans`. Each class sets size + line-height + tracking + weight:

| Class | Use | Size / weight |
|---|---|---|
| `text-display` | Marketing hero H1 only | 40→68px fluid, 650, −0.035em |
| `text-h1` | Page title (PageHeader) | 30→40px fluid, 640 |
| `text-h2` | Marketing section titles, report hero titles | 24→30px fluid, 620 |
| `text-h3` | App section headings (SectionHeading md) | 20px, 600 |
| `text-h4` | Card titles, issue titles | 17px, 600 |
| `text-lead` | Marketing intro paragraphs | 19px, 400 |
| `text-body` | Default reading text | 15px, 400 |
| `text-small` | Dense UI text, tables, card body | 14px, 400 |
| `text-caption` | Labels, table headers, metadata (often `uppercase tracking-[0.06em] text-muted`) | 12px, 500 |
| `eyebrow` | Small uppercase primary label above titles | 12px, 600 |

Override weight with `font-medium`/`font-semibold` when needed. Helpers: `text-gradient` (primary→teal headline accent), `text-balance` for headings.

## 4. Spacing rhythm & layout

- **App page** (inside `src/app/app/**`): the app shell gives the outer frame. Content wrapper: `container-page py-8` (max-w-7xl, 16/24/32px gutters) if the shell doesn't already pad. Order: `PageHeader` (has `mb-8`) → sections separated by `space-y-8` (or `gap-8`). Inside a section: `SectionHeading` (md) then a grid `grid gap-4 sm:grid-cols-2 lg:grid-cols-4` for Stats, `grid gap-6 lg:grid-cols-2` for cards.
- **Card padding:** `CardHeader`/`CardBody` give `px-5 py-4` (`sm:px-6`). Standalone padded card: `<Card padding="md">` (p-5/p-6). Stat tiles are p-5. Inner gaps `space-y-4`.
- **Marketing section:** `<section className="py-20 sm:py-24"><div className="container-marketing">` (max-w-6xl). `SectionHeading size="lg" align="center"` then content grid `grid gap-6 md:grid-cols-3`. Hero: `bg-hero` band (navy gradient, light text: use `text-navy-fg`, `text-navy-fg/75` for secondary) with `text-display`, CTA `LinkButton size="lg"`. Alternate sections with `bg-surface` / `bg-bg` and optional `bg-grid` decoration.
- **Forms:** `space-y-5` between Fields; actions row `flex justify-end gap-2 pt-2`. Auth cards: `Card variant="elevated" padding="lg" className="w-full max-w-md"`.
- **Report page:** hero card with `ScoreRing size="lg"` + headline + executive summary → pillar grid `grid gap-6 md:grid-cols-2` of `PillarCard` → "Quick wins" → issue list `space-y-4` of `IssueCard collapsible` → limitations `Notice tone="neutral"`.

## 5. Primitives (code examples)

```tsx
import {
  Button, LinkButton, Card, CardHeader, CardBody, CardFooter, PageHeader, Badge, StatusBadge, SeverityBadge, RiskBadge,
  Stat, Meter, Table, THead, TH, TR, TD, Tabs, TabPanel, EmptyState, Spinner, LoadingBlock, Skeleton, SkeletonText, SkeletonCard,
  Field, Input, Textarea, Select, Dialog, useToast, Notice, Callout, SimulatedDataBanner, ScoreRing, GradeBadge,
  PillarCard, IssueCard, CheckList, ImpactChip, EffortChip, ProgressSteps, SectionHeading, KeyValueList, Avatar, Tooltip, Divider,
} from "@/components/ui";
import { Plus, Play, Trash2, Globe } from "lucide-react";
```

### Button / LinkButton / buttonClass
Variants: `primary` (default), `secondary`, `outline`, `ghost`, `danger`, `accent`, `link`. Sizes: `xs`, `sm`, `md` (default), `lg`, `icon`, `icon-sm`.
Props: `loading`, `loadingText`, `icon`, `iconRight`, `fullWidth`, plus all `<button>` props.
```tsx
<Button icon={<Play />} loading={busy} loadingText="Starting…" onClick={run}>Run audit</Button>
<Button variant="secondary" size="sm">Cancel</Button>
<Button variant="ghost" size="icon" aria-label="Delete prompt"><Trash2 /></Button>
<LinkButton href="/app/projects/new" icon={<Plus />}>New project</LinkButton>
<LinkButton href="https://example.com" external variant="link">Docs</LinkButton>
<label className={buttonClass("secondary", "sm")}>Upload<input type="file" hidden /></label>
```

### Card
`variant`: `default` | `elevated` | `outlined` | `interactive` (hover lift, for clickable cards) | `subtle` (surface-2 fill) | `brand` (navy gradient; use light text). `padding`: `none` (default) | `sm` | `md` | `lg`. `as`: div/section/article/li/aside.
```tsx
<Card>
  <CardHeader title="Crawl coverage" description="Pages we could read" icon={<Globe />} actions={<Button size="sm" variant="secondary">Recrawl</Button>} />
  <CardBody>…</CardBody>
  <CardFooter><Button size="sm">Save</Button></CardFooter>
</Card>
<Card variant="interactive" padding="md" as="article">…</Card>
```
`CardHeader` also takes `eyebrow`, `divider={false}`.

### PageHeader / Breadcrumbs
```tsx
<PageHeader
  breadcrumbs={[{ label: "Projects", href: "/app" }, { label: project.name, href: `/app/projects/${id}` }, { label: "Report" }]}
  eyebrow="Site report"
  title="How visible is Acme?"
  description="Scores from your latest crawl and AI answer checks."
  meta={<><StatusBadge status="succeeded" /><span>Updated 2 hours ago</span></>}
  actions={<Button variant="secondary">Export PDF</Button>}
/>
```

### SectionHeading
```tsx
<SectionHeading title="Quick wins" description="High-impact fixes that take under an hour." actions={<LinkButton href="#" variant="ghost" size="sm">View all</LinkButton>} />
<SectionHeading size="lg" align="center" eyebrow="How it works" title="From audit to measurable change" description="…" />
```

### Badge family
`Badge` `tone`: neutral|primary|accent|success|warning|danger|info; `variant`: soft (default)|solid|outline|dot; `size`: sm|md; `icon`.
```tsx
<Badge tone="accent" icon={<Zap />}>Quick win</Badge>
<Badge tone="success" variant="dot">Connected</Badge>
<StatusBadge status="running" />   {/* pulsing dot for live states */}
<SeverityBadge severity="high" />
<RiskBadge riskClass="C" />          {/* letter disc + label; tooltip explains class; compact => letter only */}
```

### Stat
Props: `label`, `value`, `hint`, `footer`, `delta` (number), `deltaLabel`, `invertDelta`, `icon`, `sparkline` (ReactNode ~96×32), `size` sm|md|lg.
```tsx
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
  <Stat label="Mention rate" value="38%" delta={6} deltaLabel="vs last run" icon={<MessageSquare />} />
  <Stat label="Errors" value={12} delta={-4} invertDelta hint="Across 120 pages" sparkline={<MySparkline />} />
</div>
```

### Meter
`tone`: `usage` (default: teal→amber 75%→red 90%), `score` (band colours), or `primary|accent|success|warning|danger`. `size` xs|sm|md, `showValue`.
```tsx
<Meter value={used} max={limit} label="Credits used" showValue />
<Meter value={72} max={100} label="SEO score" tone="score" size="md" />
```

### Table
Props on `Table`: `caption` (sr-only, required for a11y), `stickyHeader`, `zebra`, `density` comfortable|compact, `maxHeight` (enables vertical scroll), `framed` (own border when not in a Card). `TH`/`TD`: `align`, `TD numeric`.
```tsx
<Card>
  <Table caption="Crawled pages" stickyHeader zebra maxHeight="32rem">
    <THead><tr><TH>URL</TH><TH align="right">Status</TH></tr></THead>
    <tbody>{rows.map(r => <TR key={r.id}><TD className="font-medium text-fg">{r.url}</TD><TD numeric>{r.status}</TD></TR>)}</tbody>
  </Table>
</Card>
```

### Tabs
`TabItem`: `{ id, label, count?, icon?, disabled? }`. `variant`: underline (default) | pills.
```tsx
const [tab, setTab] = useState("issues");
<Tabs label="Report sections" tabs={[{ id: "issues", label: "Issues", count: 14 }, { id: "checks", label: "Checks" }]} value={tab} onChange={setTab} variant="pills" />
<TabPanel value={tab}>…</TabPanel>
```

### EmptyState
Props: `title`, `description`, `icon`, `action`, `secondaryAction`, `size` sm|md|lg, `bordered`.
```tsx
<EmptyState icon={<Search />} title="No crawl yet" description="Run your first crawl to see how your site looks to search engines and AI." action={<Button icon={<Play />}>Start crawl</Button>} bordered />
```

### Spinner / LoadingBlock / Skeleton
```tsx
<Spinner label="Saving…" />
<LoadingBlock label="Loading report…" />
<Skeleton className="h-8 w-40" />  <SkeletonText lines={4} />  <SkeletonCard label="Loading pillars…" />
```
Use `SkeletonCard` grids in `loading.tsx` files.

### Inputs
`Input`/`Select` take `invalid`, `inputSize` sm|md|lg. `Textarea` takes `invalid`. `Field`: `label`, `htmlFor`, `hint`, `error`, `required`, `optional`, `labelAside`. Link the hint/error: `aria-describedby={fieldDescribedBy(id, { hint, error })}`.
```tsx
<Field label="Website" htmlFor="url" hint="Your home page, e.g. https://acme.com" error={err} required>
  <Input id="url" type="url" required invalid={!!err} aria-describedby={fieldDescribedBy("url", { hint: true, error: err })} />
</Field>
<Field label="Plan" htmlFor="plan"><Select id="plan"><option>Starter</option></Select></Field>
```

### Dialog
Props: `open`, `onClose`, `title`, `description`, `footer`, `size` sm|md|lg|xl, `icon`, `tone` default|danger|warning.
```tsx
<Dialog open={open} onClose={() => setOpen(false)} title="Roll back this change?" description="We'll restore the previous version." icon={<RotateCcw />} tone="warning"
  footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="danger" loading={busy} onClick={confirm}>Roll back</Button></>}>
  …optional body…
</Dialog>
```

### Toast
`ToastProvider` is mounted in the app layout. `const toast = useToast(); toast("Saved", "success")` — tones `success|error|info|warning`.

### Notice / Callout / SimulatedDataBanner
`tone`: info|warning|danger|success|neutral|tip. Props: `title`, `icon` (or `false`), `actions`.
```tsx
<Notice tone="tip" title="Quick win">Add a short description to your 12 most visited pages.</Notice>
<Callout tone="neutral" title="About these numbers">Based on 40 AI answers; small samples move a lot.</Callout>
<SimulatedDataBanner />
```

### ScoreRing / GradeBadge
`ScoreRing`: `score` (0–100 or null → "Not measured"), `grade` (default from score; `null` hides), `size` sm (48px, no grade) | md (88px) | lg (140px), `label` (accessible name — always set, e.g. "SEO score"), `caption`, `showGrade`.
```tsx
<ScoreRing score={report.overall.score} grade={report.overall.grade} size="lg" label="Overall score" caption="Overall" />
<GradeBadge grade="B" label="SEO grade" size="sm" />
```

### PillarCard
Prop names match `PillarScore`, so spread works. Extra: `icon`, `href`, `linkLabel`, `maxChecks` (default 5; failing first; 0 hides).
```tsx
<div className="grid gap-6 md:grid-cols-2">
  {report.pillars.map(p => <PillarCard key={p.pillar} {...p} href={`#pillar-${p.pillar}`} />)}
</div>
```
Building blocks: `<CheckList checks={p.checks} dense? />`, `<CheckStatusIcon status="warn" />`.

### IssueCard
Prop names match `ReportIssue`, so spread works. Extra: `pillarLabel`, `quickWin`, `actions`, `collapsible` (native `<details>`; works in server components), `defaultOpen`.
```tsx
{report.issues.map((i, n) => (
  <IssueCard key={i.id} {...i} pillarLabel={labels[i.pillar]} quickWin={report.quickWins.includes(i.id)} collapsible defaultOpen={n < 3}
    actions={i.relatedActionType && <LinkButton href={`/app/projects/${id}/actions`} size="sm" variant="secondary">Draft this fix</LinkButton>} />
))}
```
Chips alone: `<ImpactChip impact="high" />`, `<EffortChip effort="quick" />`.

### ProgressSteps
`steps: { id, label, description?, status: "pending"|"active"|"done"|"error"|"skipped" }[]`, `orientation` vertical|horizontal, `label`.
```tsx
<ProgressSteps label="Audit progress" orientation="horizontal" steps={[
  { id: "crawl", label: "Read your pages", description: "42 of 120", status: "active" },
  { id: "audit", label: "Check for problems", status: "pending" },
  { id: "measure", label: "Ask AI assistants", status: "pending" },
]} />
```

### KeyValueList (alias KeyValue)
`items: { label, value, hint? }[]`, `layout` rows (default) | stacked | grid, `columns` 2|3|4.
```tsx
<KeyValueList items={[{ label: "Pages crawled", value: 120 }, { label: "Last run", value: "Oct 28" }]} />
<KeyValueList layout="grid" columns={3} items={…} />
```

### Avatar
```tsx
<Avatar name="Priya Shah" size="sm" />   {/* initials + deterministic colour; src optional */}
```

### Tooltip (CSS-only)
Trigger must be focusable; the tip is wired via `aria-describedby`. Keep text short.
```tsx
<Tooltip content="Share of AI answers that mention you"><Button variant="ghost" size="icon-sm" aria-label="What is mention rate?"><Info /></Button></Tooltip>
<Tooltip content="Class C = needs approval" focusable><RiskBadge riskClass="C" /></Tooltip>
```

### Divider
```tsx
<Divider />  <Divider label="or" />  <Divider orientation="vertical" />
```

## 6. Utilities in globals.css
`container-page` (max-w-7xl + gutters), `container-marketing` (max-w-6xl + gutters), `eyebrow`, `focus-ring`, `bg-hero` (navy gradient band, sets light text), `bg-grid` (subtle grid backdrop), `text-gradient`, `skeleton`, `no-print` (hidden when printing).

## 7. Accessibility checklist
- All text/surface token pairs meet WCAG AA in both themes (verified). Focus is visible everywhere via `:focus-visible` outline in `--ring`.
- Every `Table` gets a `caption`; every `ScoreRing`/`Meter` gets a `label`; icon-only buttons get `aria-label`.
- Use real headings in order: PageHeader = h1, SectionHeading = h2 (use `as="h3"` when nested), CardHeader = h2 (fine inside sections; content inside cards uses h3).
- Don't rely on colour alone: status icons, chip labels and grade letters already carry text.
