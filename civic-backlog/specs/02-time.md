# Time family spec — diagrams.sh

Library: `@agent-clis/diagrams` v0.2.0. Specs only (no renderer code).
Match existing gantt/timeline/quadrant: `type`, `title`, `theme`, then type-specific fields.
First customer: [The Vigo Ledger](https://vigoledger.org) (Terre Haute / Vigo County), Vol. I No. 1, masthead Friday 2026-08-28. Dates below are from that edition. **Do not invent dates.** Uncertainties are flagged.

Extension point (same as gantt): add to `DiagramType` / `AnyDiagramSpec` in `src/types.ts`, branch parse/validate/render, add `src/diagrams/<type>/{layout,tree,pptx}.ts`.

A later demo of these types must be a **YAML layout render** (real date-axis geometry via `parseISODate` + `positionOnAxis`), not a static CSS mock. This file is still the spec — no renderer, no `time.html`.

---

## Verdict

**Do not rebuild `timeline` or `gantt` from scratch.** Spec-level fixes are enough.

| Type | Action | Keep | Change |
| --- | --- | --- | --- |
| `timeline` | FIX | `TimelineSpec` / `events[]`; cards ~220×70 | Date parse (not `localeCompare`); proportional spacing (not even `cardGap`); validate parseable ISO |
| `gantt` | FIX | `GanttSpec` / `tasks[]`; bars already parse `Date` and space by day; groups, deps, progress | Header year/FY (not `getMonth()+1/getDate()`); `scale` (not locked ~8px/day); `kind: milestone`; `open: true` ranges |
| `weekstrip` | NEW | — | One edition as a real-date strip (replaces numbered list 01–78) |
| `entity-timeline` | NEW | — | One project/person across bodies and editions |
| `calendar-heatmap` | NEW | — | Meeting / highlight density by day |
| `sparkline` | NEW | — | Tiny unlabeled series. Money owns full `line` |

Time owns **real date axes** family-wide. Money `line` (`money-family-spec.md` §3.12) uses **ordinal period labels** (`"This year"` / `"Next year"`) and does **not** date-parse. Sparkline is not a miniature `LineSpec`.

---

## 1. Shared time fields

Locked chrome: [00-editorial-chrome.md](./00-editorial-chrome.md). **Import `CivicBase`. Do not invent caption/source/legend names.**

```ts
import type { CivicBase } from './editorial';
// CivicBase already has: title, theme,
//   caption?: string
//   source?: SourceRef | SourceRef[]     // { label, href? } — not `sources`, not root href
//   legend?: Legend                      // true | false | LegendItem[] | LegendSpec
//   stat?: StatSpec; stats?: StatSpec[]
//   annotations?: Annotation[]           // kind: callout | peak | range | label  — no `callouts`
//   unit?: Unit | UnitFormat
//   alt?: string
//   dataTable?: DataTable
//   footnote?: string
```

Every time spec **extends `CivicBase`**. Do not redeclare those fields. Rejects: `kpi`, `bigNumber`, `callouts`, `credit`, `altText`, `dek`, `gov:` icons. Civic icons use the existing `icon` field with prefix `civic:`.

Time-only additions sit on the family type, not on chrome:

```ts
export interface TimeSpecBase extends CivicBase {
  now?: string;             // optional ISO "today" marker; omit on static newspaper graphics
}
```

Rules:

- Full charts (`timeline`, `gantt`, `weekstrip`, `entity-timeline`, `calendar-heatmap`) should carry `caption` + `source` (Ledger publish rule: caption required, source.href required). A graphic that cannot cite the tape does not belong on a record.
- `sparkline` may omit `caption` (it is inline). `alt` is required in spirit: the numbers *are* the alt. Sparkline still `extends CivicBase`.
- `unit` is chrome. Sparkline uses it for an optional end value via Money's `formatUnit`. Do not fork a second compact-currency helper. Do not narrow the chrome `Unit` type here.
- `legend` is required in practice when color encodes meaning (weekstrip tags, multi-lane colors). `legend: true` auto-from-series is legal. High-contrast theme is not a substitute for a key.
- Time annotations: `kind: 'range'` for a shaded span (zoning rewrite, Aug 4–25 cluster), `kind: 'label'` / `'peak'` for a dated mark, `kind: 'callout'` for a moment (`at.x` is an ISO date). There is no `callouts` field.
- `theme` stays `string | ThemeConfig`. Optional `theme.time?: TimeTheme` (same pattern as `theme.gantt` / `theme.money`).
- `now` default **omit**. Vol. I No. 1 is a static newspaper graphic.

```ts
export interface TimeTheme {
  axisColor: string;
  axisFontSize: number;
  tickFontSize: number;
  cardWidth: number;            // default 220
  cardHeight: number;           // default 70
  cardGap: number;              // min gap between cards, NOT between dots
  connectorLength: number;      // default 40
  dotSize: number;              // default 14
  fyTickColor: string;
  nowColor: string;
  openRangeFade: string;        // faded continuation for open: true
  heatmapRamp: string[];        // calendar-heatmap, light → dark
}
```

Today `tree.ts` and `pptx.ts` hardcode 220×70 and ignore theme. If `theme.time.cardWidth` / `cardHeight` exist, layout, tree, and pptx must all honor them.

---

## 2. Shared date contract

One helper, all six types. Do not leave a second `new Date(s)` / `localeCompare` path in layout.

### Authoring

- Civil dates as ISO `YYYY-MM-DD` (no timezone). Ledger meeting dates are civic calendar days, not UTC instants.
- `YYYY-MM` allowed as **first of month** for back-compat with `test/fixtures/timeline-basic.yaml` (`"2020-01"`).
- Optional `YYYY-MM-DDTHH:mm` **only** when time-of-day is the story (special Wednesday 5pm).
- Reject locale-only strings (`"July ninth"`, `"6/11/26"`). Validate names the field.

### Shared helper

```ts
/**
 * Parse an author date. Accepts:
 *   YYYY-MM-DD          civil day, timezone-free
 *   YYYY-MM             first of month (timeline-basic.yaml back-compat)
 *   YYYY-MM-DDTHH:mm    only when time-of-day is the story
 * Civil dates are not UTC midnight. Treat as a calendar day in the
 * Ledger's local civic calendar (America/Indiana/Indianapolis).
 * On failure, return a validate error that names `field`
 * (e.g. `events[1].date`).
 */
export function parseISODate(value: string, field: string): Date;

/**
 * Position along an axis of `length` px. Single-instant span (tMin === tMax)
 * must NOT collapse to zero-width — pad the axis so a one-event timeline
 * still draws a date line.
 */
export function positionOnAxis(
  t: number,
  tMin: number,
  tMax: number,
  length: number,
): number; // (t - tMin) / (tMax - tMin) * length, with pad when tMin === tMax
```

- Sort and position by timestamp (`getTime()`). **NEVER** `localeCompare`. **NEVER** even-index spacing for calendar data (sparkline without `dates` is the one exception).
- Display labels: `"Jun 11"` when the span stays in one year; include the year when the span crosses a year (`"Mar 5, 2026"` … `"Jan 2027"`). Do not invent an end year to force the year onto the label.
- `now?:` optional ISO. Default omit.

### Fiscal year (library default, not a Ledger claim)

The Ledger **never** says "fiscal year", "FY", "calendar year", "January 1", or "July 1". It says "this year" / "next year".

Indiana **local** budgets look calendar-year (fall adoption for the following Jan–Dec year). Default `fyStartMonth: 1` is a **library default**, labeled as such — **not a Ledger claim**. State of Indiana FY is Jul 1 (`fyStartMonth: 7`).

- `fyStartMonth === 1`: `FY2026` is 2026-01-01 … 2026-12-31.
- `fyStartMonth === 7`: `FY27` is Jul 2026 – Jun 2027 (the year the FY *ends*). Document this; do not guess `FY2026` for a July start.

### Open ranges

A gantt task may set `open: true` and **omit `end`** when the record has no calendar end. Draw a faded continuation. **Do not invent an end date.**

The zoning rewrite is the proof: announced 2026-05-07 as "about 18 months" / "roughly an 18-month process". There is **no calendar end**. Do not write November 2027.

### Proportional spacing (the actual timeline bug)

Current timeline: `[...events].sort((a, b) => a.date.localeCompare(b.date))` then `dotY = padding + titleOffset + 30 + i * stepY` with `stepY = cardHeight + cardGap`. Even spacing, ignores deltas. Horizontal is the same (`stepX = cardWidth + cardGap`).

**Fix:** dots (and gantt bar edges, weekstrip ticks, entity-timeline dots, heatmap cells, sparkline-with-dates) sit at true time. Cards / labels may stagger when they would overlap (`minGap`), but **dots never re-space evenly**. Same-day events stack; do not jitter the date.

Visual test: N 12th Apr 2 → Apr 9 is **7 days**. Wheel tax Jun 11 → Jul 9 is **28 days**. The 7-day gap must render **~4× tighter** than the 28-day gap. Even steps fail this test.

---

## 3. Current library (v0.2.0)

Quote, then diffs live on the type sections.

```ts
export interface GanttTask {
  id: string; label: string; start: string; end: string;
  color?: string; group?: string; dependencies?: string[]; progress?: number;
}
export interface GanttSpec { type: 'gantt'; title?: string; theme?: string | ThemeConfig; tasks: GanttTask[]; }
export interface TimelineEvent {
  date: string; label: string; description?: string;
  icon?: string; iconDataUri?: string; color?: string;
}
export interface TimelineSpec {
  type: 'timeline'; title?: string; theme?: string | ThemeConfig;
  direction?: Direction; events: TimelineEvent[];
}
```

**Timeline layout today** (`src/diagrams/timeline/layout.ts`):

- Sort: `a.date.localeCompare(b.date)` — string, not `Date`.
- Vertical: `cardHeight = 70`, `stepY = cardHeight + cardGap`, `dotY = padding + titleOffset + 30 + i * stepY` — even spacing.
- Horizontal: `stepX = cardWidth + cardGap` — even.
- Defaults: `cardWidth` 220, `cardGap` 24, `connectorLength` 40, `dotSize` 14, `cardHeight` hardcoded 70.
- `tree.ts` and `pptx.ts` hardcode 220×70, ignoring theme.
- `validateTimeline`: requires `date` and `label` strings; does **not** parse dates; does not reject `"July ninth"`.
- Fixture `test/fixtures/timeline-basic.yaml` uses `"2020-01"` (`YYYY-MM`). That must keep parsing (first of month).

**Gantt layout today** (`src/diagrams/gantt/layout.ts`):

- **Does** parse `new Date(t.start/end)` for bar x/width (range is real). Keep that; route it through `parseISODate`.
- `chartWidth = Math.max(400, totalDays * 8)` — ~8px/day. An 18-month rewrite is ~4320px. Unusable in a newspaper column.
- Header: `` `${date.getMonth() + 1}/${date.getDate()}` `` — no year, no FY boundary. ~12 ticks (`labelInterval = Math.ceil(totalDays / 12)`).
- Min bar 4px. Label width 160.
- `validateGantt`: requires start **and** end, `start < end` (milestones with `start === end` **fail**; open ranges without `end` **fail**). Date parse already checked. Groups, dependencies, progress already exist. No `kind`, no `open`, no `fyStartMonth`, no `scale`.
- Fixture `test/fixtures/gantt-basic.yaml`: ISO dates, groups, progress, deps.

`examples/basic.ts` is flow-only. `test/parse.test.ts` does not cover timeline or gantt.

---

## 4. Choosing a type

| Story | Type | Not |
| --- | --- | --- |
| A handful of dated **cards** on one story, real axis | `timeline` | weekstrip (too many); gantt (those are ranges) |
| One entity, many bodies / editions | `entity-timeline` | single-lane timeline (works for one body); gantt (not a duration) |
| Edition overview (78 moments, clustered August) | `weekstrip` | timeline × 78 cards; gantt of ticks |
| Durations, FY ticks, construction windows, ordinance calendar | `gantt` | timeline of 18-month bars; weekstrip of 78 ticks |
| Density grid (meetings / highlights by day) | `calendar-heatmap` | weekstrip (that's a 6-month strip, not a month grid) |
| Tiny unlabeled trend, inline or in a table cell | `sparkline` | Money `line` (axes, title, periods, legend) |
| Full trend with axes and named series | Money `line` | sparkline; Time does not grow a second line chart |

Do not use gantt for 78 moment ticks. Do not use timeline for 18-month bars. Do not use sparkline for two ordinal 911 points.

---

## 5. Types

`DiagramType` gains `'weekstrip' | 'entity-timeline' | 'calendar-heatmap' | 'sparkline'`. `timeline` and `gantt` stay; their specs grow fields.

Each full-chart spec below extends `TimeSpecBase` (`CivicBase` + `now`). Discriminant is `type`.

---

### 5.1 `timeline` — FIX

Use when a handful of dated events on **one story** should sit on a real date axis as cards. Wheel tax Jun 11 → Jul 9. N 12th Apr 2 → Apr 9. Not for 78-item edition overviews (`weekstrip`) and not for ranges (`gantt`).

Ledger proofs (Vol. I No. 1):

- **2026-06-11** City Council: first reading of GO 6-2026. **No motion, no vote.** Held over / returns 2026-07-09. Flagged · Unverified. Highlight language is held over; URL slug says "tabled."
- **2026-07-09** City Council: **adopted** GO 6-2026 (city wheel tax, matched to existing county rate, as amended) and companion GO 7-2026, both **unanimous voice vote**. City says it replaces, not stacks on, the county tax.
- Contrast: **2026-04-02** City Council held Special Ordinance 3, 2026 (3317 N 12th) — APC hadn't met → **2026-04-09** passed on a **voice vote**, R1→C2, 3317 N 12th + 1205 Fort Harrison. **Not 8-0** (that tally was synthesized; highlight corrected 2026-08-28). Seven days, not twenty-eight.

YAML (primary proof — wheel tax):

```yaml
type: timeline
title: "Terre Haute wheel tax"
direction: LR
caption: "Council held General Ordinance 6, 2026 over on June 11 with no motion, then adopted it July 9 as a replacement, not an add-on, by unanimous voice vote."
source:
  label: "City Council, Jun 11 and Jul 9"
  href: "https://www.vigoledger.org/h/2026-07-09-terre-haute-city-council-wheel-tax-adopted"
alt: "2026-06-11: GO 6-2026 held over, no motion. 2026-07-09: adopted unanimous voice vote, replaces rather than stacks on the county tax."

events:
  - id: held
    date: "2026-06-11"
    label: "Held over, no motion"
    body: "City Council"
    href: "https://www.vigoledger.org/h/2026-06-11-terre-haute-city-council-wheel-tax-tabled"
    description: "First reading of General Ordinance 6, 2026. No motion, no vote. Returns July 9."
  - id: adopted
    date: "2026-07-09"
    label: "Adopted GO 6-2026"
    body: "City Council"
    href: "https://www.vigoledger.org/h/2026-07-09-terre-haute-city-council-wheel-tax-adopted"
    description: "Unanimous voice vote. City says it replaces, not stacks on, the county tax."
```

Second proof — N 12th, 7-day gap vs wheel-tax 28-day must be visible (~×4). Even steps fail.

```yaml
type: timeline
title: "3317 North 12th Street rezoning"
direction: LR
caption: "Council held the rezoning April 2 because APC hadn't met. A week later both lots passed R1 to C2 on a voice vote — not 8-0."
source:
  label: "City Council, Apr 2 and Apr 9 (corrected Aug 28)"
  href: "https://www.vigoledger.org/h/2026-04-09-terre-haute-city-council-north-12th-street-rezoning"
alt: "2026-04-02: held, APC had not met. 2026-04-09: 3317 N 12th and 1205 Fort Harrison rezoned R1 to C2, voice vote. Highlight corrected 2026-08-28; 8-0 was synthesized."

events:
  - id: held
    date: "2026-04-02"
    label: "Held — APC hadn't met"
    body: "City Council"
    href: "https://www.vigoledger.org/h/2026-04-02-terre-haute-city-council-north-12th-street-rezoning-held"
    description: "Special Ordinance 3, 2026. No vote. Petitioner's attorney absent."
  - id: passed
    date: "2026-04-09"
    label: "Passed voice vote, R1→C2"
    body: "City Council"
    href: "https://www.vigoledger.org/h/2026-04-09-terre-haute-city-council-north-12th-street-rezoning"
    description: "3317 N 12th and 1205 Fort Harrison. Not 8-0; corrected 2026-08-28."
```

#### TypeScript DIFF against current `TimelineSpec`

Removed: nothing. Cards stay ~220×70.

```ts
export interface TimelineEvent {
  id?: string;                  // ADD
  date: string;                 // KEEP — now must parse via parseISODate (YYYY-MM-DD, or YYYY-MM first-of-month)
  label: string;                // KEEP
  body?: string;                // ADD — "City Council" / "Budget committee"
  description?: string;         // KEEP
  href?: string;                // ADD — tape / highlight
  icon?: string;                // KEEP
  iconDataUri?: string;         // KEEP
  color?: string;               // KEEP
}

export interface TimelineSpec extends TimeSpecBase {
  type: 'timeline';
  direction?: Direction;        // KEEP TB | LR
  events: TimelineEvent[];      // KEEP
}
```

**Layout.**

- `parseISODate` each `event.date`. Sort by `getTime()`. Never `localeCompare`.
- Place each **dot** at `positionOnAxis(t, tMin, tMax, axisLength)`.
- Cards ~220×70, `cardGap` 24, connector 40, `dotSize` 14 — keep.
- `minGap`: if two cards would overlap (Apr 2 vs Apr 9 on a short axis), stagger or stack the **cards**. Dots stay on true time. Never re-space dots evenly.
- Same-day events: stack cards; do not jitter x/y of the date.
- Axis ticks at actual months (and years if the span crosses), not at event indices. Display `"Jun 11"` / `"Jul 9"` in a single-year span.
- Single-event: still draw an axis with pad (`positionOnAxis` when `tMin === tMax`). Do not collapse to a zero-width chart.
- `direction: TB` — axis vertical, cards off to the side. `LR` — axis horizontal. Same proportion rule on both.
- `tree.ts` / `pptx.ts`: stop hardcoding 220×70 independently of layout.

**Validate.**

- `events.length >= 1`.
- Each `date` parseable via `parseISODate`; reject `"July ninth"`. Error names the field (`events[1].date`).
- Each `label` present (non-empty string).
- `direction` if set is `TB` | `LR` only.
- `href` if set is a URI string (don't fetch).

---

### 5.2 `gantt` — FIX

Use when the story is **duration**: zoning rewrite ~18 months, sewer construction horizon, ordinance calendar. Milestones are points on that calendar, not stub bars. Bars already parse `Date` and space by day — keep that. The breaks are the header, the 8px/day lock, and validate requiring `start < end`.

Ledger proofs (Vol. I No. 1):

- **2026-03-05** City Council: HB1001 requires an updated zoning code **by end of 2026** *or* show the update is underway. Informational; no vote. Flagged · Unverified.
- **2026-05-07** City Council: full rewrite **~18 months** announced, not voted. **No calendar end.** Do not write Nov 2027. `open: true`.
- **2026-07-09** City Council: sewer ~$100M over the next several years; Locust St disruption before 2030; 10% rate increase in 2030 + $3/mo stormwater. No vote. Rate ordinance **expected** intro Aug 6 — **not in this edition** (eight other city-council items that day). Expected final Sep 3 is **future** relative to the edition. Milestone only if labeled expected/unconfirmed.
- **2026-07-09** wheel tax adopted (milestone).

YAML — zoning rewrite as an **open** range, HB1001 as a milestone, sewer as an open/horizon bar, wheel-tax adopted as a point:

```yaml
type: gantt
title: "Zoning rewrite and sewer horizon"
fyStartMonth: 1          # library default (Indiana local looks calendar-year). Not a Ledger claim.
scale: auto
caption: "The zoning rewrite was announced May 7 as about 18 months, with no calendar end. HB1001 was stated March 5. Sewer construction was described July 9 as the next several years; a rate ordinance expected August 6 did not appear in this edition."
source:
  label: "City Council, Mar 5 / May 7 / Jul 9"
  href: "https://www.vigoledger.org/h/2026-05-07-terre-haute-city-council-chapter-10-zoning-rewrite"
alt: "HB1001 informational 2026-03-05. Zoning rewrite announced 2026-05-07, open-ended (about 18 months, no end date). Sewer construction announced 2026-07-09, open-ended. Wheel tax adopted 2026-07-09. Expected sewer-rate intro 2026-08-06 unconfirmed in this edition; expected final 2026-09-03 is future."
legend:
  items:
    - { label: "Range", symbol: bar }
    - { label: "Milestone", symbol: diamond }
    - { label: "Open / no end date", symbol: bar }

tasks:
  - id: hb1001
    label: "HB1001 clock stated"
    kind: milestone
    group: zoning
    start: "2026-03-05"
    href: "https://www.vigoledger.org/h/2026-03-05-terre-haute-city-council-zoning-code-update-hb1001"
  - id: zoning
    label: "Zoning code rewrite (about 18 months)"
    kind: range
    group: zoning
    start: "2026-05-07"
    open: true                 # no calendar end — do not invent one
    href: "https://www.vigoledger.org/h/2026-05-07-terre-haute-city-council-chapter-10-zoning-rewrite"
  - id: sewer-build
    label: "Sewer construction (next several years)"
    kind: range
    group: sewer
    start: "2026-07-09"        # announced; disruption window has no start date either
    open: true                 # "before 2030" / "several years" is not an end date
    href: "https://www.vigoledger.org/h/2026-07-09-terre-haute-city-council-sewer-stormwater-rate-plan"
  - id: wheel-tax-adopted
    label: "Wheel tax adopted"
    kind: milestone
    group: city-council
    start: "2026-07-09"
    href: "https://www.vigoledger.org/h/2026-07-09-terre-haute-city-council-wheel-tax-adopted"
  - id: sewer-rates-intro
    label: "Rate ordinance intro (expected, unconfirmed)"
    kind: milestone
    group: sewer
    start: "2026-08-06"        # expected on Jul 9; no sewer-rate highlight that day
  - id: sewer-rates-final
    label: "Rate ordinance final (expected, future)"
    kind: milestone
    group: sewer
    start: "2026-09-03"        # named on Jul 9; future relative to the edition
```

The 10% hike in 2030 is a Money `delta` (`unit: percent`), not a reason to stretch this gantt to 2030. Auto scale must fit a newspaper column (~600–1200px). An 18-month *open* bar is a faded continuation on that same axis — not 4320px of 8px days, and not a fake November 2027 cap.

#### TypeScript DIFF against current `GanttSpec` / `GanttTask`

```ts
export interface GanttTask {
  id: string;                   // KEEP
  label: string;                // KEEP
  start: string;                // KEEP — parseISODate
  end?: string;                 // CHANGE: optional when kind is 'milestone' OR open: true
  kind?: 'range' | 'milestone'; // ADD, default 'range'
  open?: boolean;               // ADD: omit end; draw faded continuation. Default false
  href?: string;                // ADD — tape / highlight
  color?: string;               // KEEP
  group?: string;               // KEEP
  dependencies?: string[];      // KEEP
  progress?: number;            // KEEP 0–100
}

export interface GanttSpec extends TimeSpecBase {
  type: 'gantt';
  fyStartMonth?: number;        // ADD 1–12, default 1 (library default, not a Ledger claim)
  scale?: 'auto' | 'day' | 'week' | 'month' | 'quarter'; // ADD; default 'auto'
  tasks: GanttTask[];           // KEEP
}
```

**Layout.**

- Parse `start` / `end` with `parseISODate`. Bar x/width already use real dates — keep that; delete the `* 8` px/day lock.
- `scale: auto` picks `day | week | month | quarter` so `chartWidth` stays **~600–1200px**. An 18-month rewrite → month or quarter, ~800–1000px. Do **not** emit a 4320px chart.
- Header, two rows when span > ~90 days: year (or FY) on top, months below. When the span is weeks, day ticks are OK. Stop rendering `` `${month+1}/${date}` `` as the only header.
- FY tick at each `fyStartMonth` boundary. Default 1 → label `FY2026` as a library label, not a Ledger quote. `fyStartMonth: 7` → `FY27` for Jul 2026–Jun 2027.
- Groups remain row bands. Progress fill remains. Min bar 4px stays for short *closed* ranges, not for milestones.
- Milestone: draw a **diamond / point**, not a 4px stub bar. If a milestone has the same `group` as a range, overlay on that row; else it owns a row. Missing `end` on a milestone is `start`.
- `open: true`: start is a bar edge; the other edge fades off the chart (or to a labeled horizon). No invented `end`.
- `now` if set: a vertical marker on the shared date axis.

**Validate.**

- `tasks.length >= 1`. Unique `id`s. Dependency refs exist.
- `kind` default `'range'`.
- **range + not open:** `start` and `end` required, parseable, `start < end` (keep current).
- **range + `open: true`:** `start` required parseable; `end` must be **absent**. Reject an authored `end` plus `open: true` (pick one).
- **milestone:** `start` required parseable; `end` optional; if `end` is present it **must equal** `start`. Do **not** reject `start === end`. Missing `end` on a milestone is valid.
- `progress` if set is 0–100.
- `fyStartMonth` if set is 1–12.
- `scale` if set is the enum.
- `now` if set is parseable ISO.

---

### 5.3 `weekstrip` — NEW

One edition as a date strip. Replaces numbered list 01–78 as a chart.

Use when the story is "what this edition looks like in time" — 78 highlights, 2026-03-05 through 2026-08-25, 35 before August, 43 Aug 4–25. Not a gantt (no ranges). Not a timeline (no 220px cards × 78). YAML is the **count table**, not 78 labeled cards.

Ledger proofs:

- Homepage unique `/h/` slugs: **78** highlights. Masthead copy collides ("78 moments from this week's record" vs "6 months indexed"); the count itself is 78.
- By date (complete, do not invent extra days): 03-05:6, 03-12:2, 04-02:3, 04-09:5, 05-07:2, 05-14:2, 06-04:3, 06-11:2, 07-09:10, 08-04:12, 08-06:8, 08-11:1, 08-12:9, 08-13:7, 08-18:4, 08-24:1, 08-25:1.

YAML (census of days, not 78 cards):

```yaml
type: weekstrip
title: "Vol. I No. 1 in time"
from: "2026-03-05"
to: "2026-08-25"
colorBy: none
caption: "Seventy-eight highlights, March 5 through August 25. Thirty-five land before August; forty-three pile up August 4–25."
source:
  label: "The Vigo Ledger, Vol. I No. 1"
  href: "https://www.vigoledger.org/"
alt: "78 highlights 2026-03-05 to 2026-08-25. 35 before August, 43 Aug 4–25. Peak days: Aug 4 (12), Jul 9 (10), Aug 12 (9), Aug 6 (8), Aug 13 (7)."

marks:
  - { date: "2026-03-05", count: 6,  label: "City Council (HB1001 among them)" }
  - { date: "2026-03-12", count: 2 }
  - { date: "2026-04-02", count: 3,  label: "N 12th held" }
  - { date: "2026-04-09", count: 5,  label: "N 12th passed; TIF report" }
  - { date: "2026-05-07", count: 2,  label: "Zoning rewrite announced" }
  - { date: "2026-05-14", count: 2 }
  - { date: "2026-06-04", count: 3 }
  - { date: "2026-06-11", count: 2,  label: "Wheel tax held over" }
  - { date: "2026-07-09", count: 10, label: "Wheel tax adopted; sewer plan; Holly briefing" }
  - { date: "2026-08-04", count: 12, label: "Commissioners + County Sunshine" }
  - { date: "2026-08-06", count: 8,  label: "City Council" }
  - { date: "2026-08-11", count: 1,  label: "County Council (commissioners regular cancelled)" }
  - { date: "2026-08-12", count: 9,  label: "Budget committee; inferred Wed 5pm" }
  - { date: "2026-08-13", count: 7,  label: "Budget committee" }
  - { date: "2026-08-18", count: 4,  label: "Commissioners" }
  - { date: "2026-08-24", count: 1 }
  - { date: "2026-08-25", count: 1,  label: "Commissioners" }
```

Counts sum to 78. Same-day size-by-count; do **not** spread 12 Aug-4 marks along x.

```ts
export interface WeekstripMark {
  date: string;                 // ISO date (datetime only if time-of-day is the story)
  label?: string;               // most marks are unlabeled ticks; label standouts only
  tag?: string;                 // optional; Ledger uses MONEY / RULES / PROPERTY / DEFERRAL / FRICTION / FLAGGED
  href?: string;
  count?: number;               // same-day stack; default 1
}

export interface WeekstripSpec extends TimeSpecBase {
  type: 'weekstrip';
  from: string;                 // edition window start
  to: string;                   // edition window end
  marks: WeekstripMark[];
  colorBy?: 'tag' | 'none';     // default 'none' unless any mark has tag
}
```

**Layout.** One horizontal strip, proportional. `from` → `to` is a real date axis (`parseISODate` + `positionOnAxis`). Marks are ticks/dots at true dates. Same-day: size-by-`count` (or stack); do **not** spread along x. Sparse spring vs dense August is the whole point. Height ~80–120px plus caption. Optional month labels. No cards.

**Validate.**

- `from` / `to` parseable, `from < to`.
- `marks.length >= 1`. Each `date` parseable.
- Each `mark.date` inside `[from, to]`, or **warn** (clipped extract). Unparseable is an error.
- `count` if set is `>= 1`.
- `colorBy` enum. If `colorBy: tag`, `legend` should be present.

---

### 5.4 `entity-timeline` — NEW

One project or person composing across bodies and editions. The About page already promises these:

> "Drafting the meeting record, the highlights, and the entity timelines."

Public `/t/` threads are the current stand-in (`/t/wheel-tax-2026`, `/t/ord-3-2026`, `/t/chapter-10-zoning-rewrite`, `/t/long-term-control-plan`, `/t/appropriation-12-2026`). They are not labeled "entity timeline" on the page.

Partial overlap with `timeline`: a single lane of dated events is a fixed timeline. Distinct type because Ledger entities cross **bodies**.

Ledger proofs:

- **Susie's Place:** 2026-08-04 County Sunshine — $15,000 **ASK**, presented, **no vote**. 2026-08-06 City Council Appropriation 12-2026 — $45,000 casino revenue, **passed voice**. Do not draw the county ask as adopted.
- **Project Holly:** 2026-07-09 City Council EDC briefing (no vote; $30–50M equipment / 25–35 jobs — company figures not finalized). 2026-08-04 Commissioners: $8–10M real + $40–50M personal, partial real-property abatement, **final decision is City Council, not decided**. Figures **differ** across meetings — caption must not pick one number as fact. Do **not** invent a city vote.
- **Sheriff (short third):** 2026-08-12 budget committee held off → 2026-08-13 deferred again, **no return date**. Same body twice; later editions may add County Council.

YAML — Susie's Place (two lanes):

```yaml
type: entity-timeline
title: "Susie's Place"
unit: usd
entity:
  name: "Susie's Place"
  kind: project
caption: "County heard a $15,000 ask on August 4 and took no vote. City Council approved $45,000 from casino revenue two days later."
source:
  label: "County Sunshine, Aug 4; City Council, Aug 6"
  href: "https://www.vigoledger.org/t/appropriation-12-2026"
alt: "2026-08-04 County Council (Sunshine): $15,000 ask, no vote. 2026-08-06 City Council: Appropriation 12-2026, $45,000 casino revenue, voice vote."

lanes:
  - id: county
    label: "County Council"
  - id: city
    label: "City Council"

events:
  - date: "2026-08-04"
    lane: county
    label: "$15,000 ask, no vote"
    amount: 15000
    edition: "Vol. I No. 1"
    href: "https://www.vigoledger.org/h/2026-08-04-vigo-county-council-sunshine-susies-place-funding"
    description: "One-time bridge from county general. Presented; no vote."
  - date: "2026-08-06"
    lane: city
    label: "$45,000 approved"
    amount: 45000
    edition: "Vol. I No. 1"
    href: "https://www.vigoledger.org/h/2026-08-06-terre-haute-city-council-appropriation-12-2026-susies-place"
    description: "Appropriation 12-2026, casino revenue, voice vote."
```

YAML — Project Holly (two bodies, pending City Council; do not invent a city vote):

```yaml
type: entity-timeline
title: "Project Holly"
entity:
  name: "Project Holly"
  kind: project
caption: "City Council heard an EDC briefing July 9. Commissioners heard a partial real-property abatement request August 4. Final decision is City Council; this edition has no city vote. Investment figures differ across the two meetings."
source:
  label: "City Council, Jul 9; Commissioners, Aug 4"
  href: "https://www.vigoledger.org/h/2026-08-04-vigo-county-commissioners-project-holly-tax-abatement"
alt: "2026-07-09 City Council EDC briefing, no vote. 2026-08-04 Commissioners: partial real-property abatement, not decided, City Council decides. Figures differ ($30–50M equipment vs $8–10M real + $40–50M personal)."

lanes:
  - id: city
    label: "City Council"
  - id: commissioners
    label: "County Commissioners"

events:
  - date: "2026-07-09"
    lane: city
    label: "EDC briefing, no vote"
    edition: "Vol. I No. 1"
    href: "https://www.vigoledger.org/h/2026-07-09-terre-haute-city-council-edc-project-holly"
    description: "Preview only. Formal request 'in the coming months.' Company figures not yet finalized."
  - date: "2026-08-04"
    lane: commissioners
    label: "Partial abatement asked; not decided"
    edition: "Vol. I No. 1"
    href: "https://www.vigoledger.org/h/2026-08-04-vigo-county-commissioners-project-holly-tax-abatement"
    description: "Final decision is City Council. Do not plot a city vote that is not in this edition."
```

Sheriff (comment / third example — two dates, one lane, no return date):

```yaml
# type: entity-timeline
# entity.name: "Sheriff's budget"
# lanes: [budget-committee]  — two meetings, same body; a timeline would also do.
#        The type earns its keep when a later edition adds County Council.
# 2026-08-12 held off  https://www.vigoledger.org/h/2026-08-12-vigo-county-budget-committee-sheriff-budget-held-off
# 2026-08-13 deferred again, no return date
#            https://www.vigoledger.org/h/2026-08-13-vigo-county-budget-committee-sheriff-budget-deferred
```

```ts
export interface EntityLane {
  id: string;
  label: string;                // "City Council" | "County Council" | "Commissioners"
  color?: string;
}

export interface EntityEvent {
  date: string;
  label: string;
  lane: string;                 // EntityLane.id
  description?: string;
  href?: string;
  edition?: string;             // "Vol. I No. 1"
  amount?: number;              // optional; format with spec.unit via Money formatUnit
}

export interface EntityTimelineSpec extends TimeSpecBase {
  type: 'entity-timeline';
  unit?: 'usd' | 'percent' | 'count';  // only to format event.amount
  entity: { name: string; kind?: 'project' | 'person' | 'fund' | 'body' };
  lanes: EntityLane[];
  events: EntityEvent[];
}
```

**Layout.** Shared real date axis (same parse / proportion rules as `timeline`). One row per lane. Events as dots + labels on their lane. Do not even-space. Cross-edition is just a longer axis. Newspaper-quiet: no swimlane chrome heavier than gantt groups.

**Validate.**

- `entity.name` present.
- `lanes.length >= 1`; unique lane `id`s.
- `events.length >= 1`; each `lane` names an existing lane; each `date` parseable; each `label` present.
- `amount` if set is finite; `unit` if set is the enum.

---

### 5.5 `calendar-heatmap` — NEW

Meeting / highlight density by day. August 2026 grid. Proof: special Wednesday 5pm instead of Tuesday commissioners.

Ledger proofs:

- **2026-08-04** (Tue) Commissioners announced: no regular Tuesday next week; **special call Wednesday 5pm**. Inferred session **2026-08-12 17:00**. **No 08-12 commissioners highlight** in the 78.
- **2026-08-11** (Tue): cancelled regular commissioners meeting — empty for **commissioners**. County Council still met (1 highlight, IT/ADA $40k transfer).
- Commissioners dates in this edition: **08-04, 08-18, 08-25**.
- City Council observed Thursdays. Commissioners regular Tuesday, special Wednesday 5pm.
- Values = **highlight counts** from the weekstrip table for August days we have. Do **not** invent a meeting on every weekday.

YAML — August 2026. Empty days drawn as 0.

```yaml
type: calendar-heatmap
title: "August 2026 highlight density"
from: "2026-08-01"
to: "2026-08-31"
weekStart: sun
caption: "Commissioners skipped their regular Tuesday August 11 and called a special Wednesday 5pm session (inferred August 12) instead. August 12 has nine highlights, none of them a commissioners record."
source:
  label: "Commissioners, Aug 4 (announced)"
  href: "https://www.vigoledger.org/h/2026-08-04-vigo-county-commissioners-special-wednesday-meeting-east-side-school"
alt: "August 2026 highlight counts. 08-04:12, 08-06:8, 08-11:1 (County Council; commissioners regular cancelled), 08-12:9 (Wed 5pm inferred, no commissioners highlight), 08-13:7, 08-18:4, 08-24:1, 08-25:1. Other days 0."
legend:
  items:
    - { label: "0 highlights" }
    - { label: "12 (busiest day)" }

cells:
  - date: "2026-08-04"
    value: 12
    label: "Commissioners + County Sunshine"
    href: "https://www.vigoledger.org/h/2026-08-04-vigo-county-commissioners-special-wednesday-meeting-east-side-school"
  - date: "2026-08-06"
    value: 8
    label: "City Council (Thu)"
  - date: "2026-08-11"
    value: 1
    label: "County Council; commissioners regular cancelled"
  - date: "2026-08-12"
    value: 9
    label: "Wed 5pm special (inferred 17:00); no commissioners highlight"
  - date: "2026-08-13"
    value: 7
    label: "Budget committee"
  - date: "2026-08-18"
    value: 4
    label: "Commissioners"
  - date: "2026-08-24"
    value: 1
    label: "Budget committee"
  - date: "2026-08-25"
    value: 1
    label: "Commissioners"
# all other August days omitted → drawn as 0
```

Time-of-day is a **label on the cell** (`Wed 5pm special`), not a third axis. Cell `date` stays `YYYY-MM-DD`. The inferred `2026-08-12T17:00` belongs on a timeline/weekstrip only if the session itself is the story; here it annotates the cell.

```ts
export interface CalendarHeatmapCell {
  date: string;                 // YYYY-MM-DD
  value: number;                // highlight count (or meeting count — say which), >= 0
  label?: string;               // e.g. "Wed 5pm special (inferred)"
  href?: string;
}

export interface CalendarHeatmapSpec extends TimeSpecBase {
  type: 'calendar-heatmap';
  from: string;
  to: string;
  weekStart?: 'sun' | 'mon';    // default 'sun' (US civic)
  cells: CalendarHeatmapCell[];
}
```

Do not add a second `source` shape or a parallel `valueLegend` type. The imported `legend` keys the ramp.

**Layout.** Month grid, `weekStart: sun`. Empty days are 0 (draw the empty cell; do not omit the calendar). Color ramp by `value`. Annotate the Wednesday 5pm cell and the cancelled Tuesday. Newspaper size: one or two months visible, not a 6-month micro-cell dump. August 2026 for the proof.

**Validate.**

- `from` / `to` parseable, `from < to`.
- Each cell `date` parseable `YYYY-MM-DD`, `value >= 0` finite.
- Cell dates outside `[from, to]` → **error** (stray dates are author mistakes, not a clip-warn like weekstrip).
- Duplicate cell dates → error (author must combine counts).
- `weekStart` enum.

Aug 11 is **not** value 0 on a highlights series (County Council met). It is empty for **commissioners**. Caption / cell label must say which.

---

### 5.6 `sparkline` — NEW

Tiny unlabeled trend. Coordinate with Money; do not compete.

| | Money `line` | Time `sparkline` |
| --- | --- | --- |
| Spec | `LineSpec` (`money-family-spec.md` §3.12) | `SparklineSpec` (this file) |
| X | **Ordinal** `periods: string[]` (`"This year"`, `"Next year"`). **Not** Date-parsed. | Optional `dates?: string[]`, same length as `values`. When present they **do** date-parse and space proportionally. When omitted, even index is OK (a sequence, not a calendar). |
| Chrome | Axes, title, caption, legend, period labels | No ticks, no grid, no legend, no axis labels |
| Size | Full chart | ~80–120 × 20–28px |
| 911 | Two ordinal points: receipts $622,236 vs outlays $711,193 (2026-08-13, voice). That is Money `line` / `grouped-bar`. | Not this. Sparkline needs a series. |

Composition `data-table` cells may embed a sparkline. **Do not spec `data-table`.** Composition owns that type.

Honest Ledger fits — none of these are a sparkline in Vol. I No. 1:

- **911** 2026-08-13: revenue $622,236 vs budget $711,193, approved voice. **One year, two ordinal points.** Money `line`.
- **TIF** 2026-04-09: CBD/hotel spent ~$46,494 more than collected in **2025**. One year. Money `delta` / `stat`.
- **Corrections:** homepage says **0**; N 12th was **corrected 2026-08-28**. Do not fake a series from that collision.

YAML (shape only — wait for a real series):

```yaml
# type: sparkline
# Fill from the note. A Composition data-table cell would hold this
# once two+ fiscal years exist. Vol. I No. 1 has no honest sparkline:
#   911 → Money line / grouped-bar (examples/line-911.yaml)
#   TIF $46,494 → Money delta/stat
#   corrections → homepage "0" vs N 12th corrected 2026-08-28; do not fake a series
#
# type: sparkline
# unit: usd
# showEndValue: true
# values:            # fill from the note; length >= 2
# dates:             # optional; ISO; same length; real-time x if present
```

Do not fabricate monthly 911 points. Do not ship `values: [0, 0]` as if they were 911.

```ts
export interface SparklineSpec extends CivicBase {
  type: 'sparkline';
  // title, theme, caption, source, legend, unit, alt, dataTable, footnote: CivicBase
  // caption/legend usually omitted when embedded
  values: number[];             // >= 2
  dates?: string[];             // optional, same length as values; not drawn as labels
  stroke?: string;
  fill?: boolean;               // area under the line, default false
  showEndValue?: boolean;       // last number via formatUnit; default false in cells
}
```

Sparkline is **not** a miniature `LineSpec`. No `periods`, no `series[]`, no legend, no axes.

**Layout.** No ticks, no grid, no legend. One polyline. Optional end-value. If `dates` present they only affect x-spacing (real time, same `parseISODate` + `positionOnAxis` rule). If `dates` omitted, even index is OK. Size ~80–120 × 20–28px.

**Validate.**

- `values.length >= 2`; every value finite (0 allowed, like Money).
- If `dates` set: `dates.length === values.length`, each parseable.
- `unit` if set is the enum.

---

## 6. `AnyDiagramSpec` / theme

```ts
export type DiagramType =
  | 'flow' | 'gantt' | 'timeline' | 'quadrant'
  // money (separate spec)
  | 'weekstrip' | 'entity-timeline' | 'calendar-heatmap' | 'sparkline';

export type AnyDiagramSpec =
  | DiagramSpec | GanttSpec | TimelineSpec | QuadrantSpec
  // money specs…
  | WeekstripSpec | EntityTimelineSpec | CalendarHeatmapSpec | SparklineSpec;

export interface ThemeConfig {
  // existing fields…
  time?: TimeTheme;
}
```

PPTX / SVG / HTML / PNG round-trip like gantt already does. A demo of the date-axis fix is a YAML **render** through layout, not a hand-drawn HTML mock.

Color: Ledger tags (`MONEY` / `RULES` / `PROPERTY` / `DEFERRAL` / `FRICTION` / `FLAGGED`) may color `weekstrip` when `colorBy: tag`. Legend required if color encodes meaning.

Accessibility: `alt` or an implicit data-table of `date, label[, value]`. High-contrast theme is not enough.

---

## 7. Out of scope

- Implementing renderer code in this slice (this file is the spec).
- A static CSS / `time.html` mock. When someone demos these types, they render YAML.
- Rebuilding `timeline` or `gantt` as new types.
- Money `line` / `stacked-area` (ordinal periods; already specced).
- Composition `data-table` itself (cells may embed sparkline; we don't spec the table).
- Maps, vote matrix, rebuilding `flow`.
- Live `now` cursor on a static newspaper graphic (field exists, default omit).
- Dumping 78 labeled cards into example YAML (the weekstrip is a count table).
- Inventing a county vote for Susie's Place, a City Council vote for Project Holly, a zoning-rewrite end date, a sewer-rate intro highlight on Aug 6, a 911 monthly series, a two-edition corrections series, or a TIF time series from one $46,494 shortfall.

---

## 8. Done when

- Timeline layout no longer `localeCompare`s or even-spaces. Wheel tax 28-day gap vs N 12th 7-day gap is visible (~×4). Dots stay on true time when cards stagger. Single event still draws an axis. `YYYY-MM` still parses (first of month).
- Gantt header shows year / FY. 18-month open rewrite fits ~1000px (`scale: auto`, not 8px/day). Milestones render as points. `start === end` (or omitted `end`) is allowed for `kind: milestone`. `open: true` omits `end` and draws a fade — no invented November 2027.
- `weekstrip`, `entity-timeline`, `calendar-heatmap`, `sparkline` round-trip YAML → PNG/SVG/HTML/PPTX.
- `caption` / `source` / `legend` render (source is a real link in HTML).
- Examples in `examples/ledger-*.yaml` render without hand-tweaking (wheel-tax timeline, weekstrip counts, zoning gantt with `open: true`).
- Validate rejects unparseable timeline dates (`"July ninth"`) and does **not** reject milestone `start === end`. Open range without `end` is valid; open range *with* an invented `end` is not the contract.
- One `parseISODate()` used by all six; timeline/gantt validate call it.
- Skill doc mentions these types (it currently pretends only `flow` exists). `test/parse.test.ts` covers them. `examples/basic.ts` is no longer flow-only.

---

## 9. Uncertainties flagged

1. **Editorial `alt` type.** Primitives owns the name. Import `Alt` if they export it; otherwise `alt?: string`. If chrome later differs from Money's draft, Diagrams adopts theirs.
2. **Zoning rewrite has no calendar end.** Site says "about 18 months" / "roughly an 18-month process" from 2026-05-07. HB1001 "by end of 2026 or show underway" vs that 18-month clock is a tension in the record, not a reason to cap the bar at Dec 31 2026 or Nov 2027.
3. **Sewer rate intro Aug 6** was **expected** on Jul 9 and is **not** in this edition. Sep 3 final is future. YAML milestones are labeled expected/unconfirmed. Construction disruption "before 2030" has no start date; the bar starts at the announcement (2026-07-09) and is `open: true`.
4. **County $15k** is an **ask**, not a vote. Do not draw it as adopted. Name Klinkenberg is Ledger spelling, not independently verified here.
5. **Project Holly figures differ** ($30–50M equipment Jul 9 vs $8–10M real + $40–50M personal Aug 4). Caption does not pick one number as fact. No City Council abatement vote in this edition.
6. **Homepage "No corrections in this edition"** vs N 12th highlight **Corrected 2026-08-28**. Public correction count is not a number you can read off a list. Do not fake a sparkline.
7. **Special Wed 5pm** is inferred `2026-08-12T17:00` (Wednesday after 2026-08-04; also named Aug 12 in the sunshine item). The special-meeting page itself says "next week / Wednesday evening at 5 o'clock," not "August 12." No 08-12 commissioners highlight.
8. **Aug 11** is empty for commissioners (cancelled regular) and value 1 on a **highlights** heatmap (County Council IT/ADA). Do not mix the two series without saying so.
9. **`fyStartMonth: 1`** is a library default because Indiana local budgets look calendar-year. The Ledger never says FY. Do not treat the default as a site claim. State FY Jul 1 is `fyStartMonth: 7`.
10. **Wheel-tax Jun 11** highlight says held over / no motion; URL slug and thread say "tabled." Apr 2 mayor preview exists only on `/t/wheel-tax-2026`, not as a standalone highlight — not plotted unless we are writing that thread.
11. **N 12th 8-0** is stale on `/t/ord-3-2026`. Highlight was corrected 2026-08-28 to voice vote. YAML follows the corrected highlight.
12. **weekstrip clip vs heatmap error.** Marks outside `[from, to]` warn. Heatmap cells outside the window error.
13. **Sparkline has no honest series in this edition.** Wait, or `# fill from the note` in a data-table cell. Do not ship zeros as 911.
14. **Commissioners About table** still says "Not yet" — stale; 10 highlights exist. Don't mark the body as fully covered from About alone.
15. **`event.body` vs `description`.** `body` is the meeting body name; `description` stays the sentence. Do not collapse them.
