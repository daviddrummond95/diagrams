# Money family spec — diagrams.sh

Library: `@agent-clis/diagrams` v0.2.0. Specs only (no renderer code).
Match existing gantt/timeline/quadrant: `type`, `title`, `theme`, then type-specific fields.
First customer: [The Vigo Ledger](https://vigoledger.org) (Terre Haute / Vigo County). Numbers below are from Vol. I No. 1 unless marked TBD.

Extension point (same as gantt): add to `DiagramType` / `AnyDiagramSpec` in `src/types.ts`, branch parse/validate/render, add `src/diagrams/<type>/{layout,tree,pptx}.ts`.

`unit` is a formatter primitive, not a `DiagramType`.

---

## 1. Shared: extend CivicBase (do not fork)

Locked chrome lives in `/workspace/diagrams-backlog/00-editorial-chrome.md`. Money specs **extend `CivicBase`**. Do not redeclare `caption`, `source`, `legend`, `stat`/`stats`, `annotations`, `alt`, `dataTable`, `footnote`, `unit`, `title`, `theme`.

```ts
import type {
  CivicBase,
  Unit,
  UnitFormat,
  SourceRef,
  Legend,
  StatSpec,
  Annotation,
  DataTable,
} from './editorial';
import { formatValue } from './editorial';
```

Locked names (copy exactly; forbidden aliases in chrome §15):

| field | type |
| --- | --- |
| `caption` | `string` |
| `source` | `SourceRef \| SourceRef[]` (`{ label, href? }`) |
| `legend` | `true \| false \| LegendItem[] \| LegendSpec` |
| `stat` / `stats` | `StatSpec` / `StatSpec[]` |
| `annotations` | `Annotation[]` with `kind: 'callout' \| 'peak' \| 'range' \| 'label'` |
| `alt` | `string` |
| `dataTable` | `{ columns, records, summary? }` — never `rows` |
| `footnote` | `string` |
| `unit` | `Unit \| UnitFormat` (`usd \| percent \| count`) |
| `title` | hed (existing). No `subtitle` / `kpi` / `bigNumber` / `callouts`. |

`type: 'stat'` is Editorial's diagram, not a money type.

Each money spec:

```ts
export interface SankeySpec extends CivicBase {
  type: 'sankey';
  // money payload only below
}
```

Money-owned (not chrome):

```ts
export interface MoneySeries {
  id: string;
  label: string;
  values: number[];         // raw numbers; never pre-formatted strings
  color?: string;
}

export interface MoneyTheme {
  positive: string;         // waterfall up, delta increase
  negative: string;         // waterfall cut, delta decrease
  zero: string;             // hairline / n/a
  barRadius: number;
  barGap: number;
  axisColor: string;
  axisFontSize: number;
  tickFontSize: number;
  valueFontSize: number;
  gridLineColor: string;
}
```

Rules that apply to every money type:

- YAML authors pass **raw numbers** (`469000`, not `"$469k"`). Labels go through `formatValue` (Editorial §7).
- Finite numbers only. `NaN` / `Infinity` fail validate.
- `0` is valid. On flow encodings (sankey/alluvial links) a zero draws a hairline and the label `n/a` so an incomplete Ledger note can still publish. On bars/dots/treemap leaves, `0` is a real zero (no bar / empty cell).
- If `unit` is omitted, money charts default to `usd`. Percent is **points** (`10` → `10%`), matching chrome `scale: 'points'`.
- `theme` is CivicBase's `string | ThemeConfig`. Optional `theme.money?: MoneyTheme` (same pattern as `theme.gantt`).
- A moment on the plot is `annotations: [{ kind: 'callout', ... }]`. There is no `callouts` field.
- `source` is one object or an array. Do not add `sources`.
- `legend: true` auto-from-series. `legend: false` suppresses. **stacked-bar** (and any 2+ series color encoding) must ship `legend` present and not `false` (chrome §4).
- Vigo publish (chrome §12): `caption`, `source.href`, `alt`, and `dataTable` required on `sankey`, `delta`, `treemap`, `stacked-bar`, `grouped-bar`. Optional in the type so architecture diagrams still parse.
- Do not size-encode with `flow` edges. `DiagramEdge` has no `value`.

Sort defaults: ranked types (`bar`, `dot-plot`, `treemap` siblings) sort descending by value unless `sort: none`.

Orientation defaults: `bar`, `grouped-bar`, `stacked-bar`, `range-plot`, `dot-plot` → `horizontal` (civic labels are long). `histogram` → `vertical`. `waterfall`, `slope` → always the orientation in their layout notes.

Layout order is chrome §13: title → caption → stat/stats → plot → annotations on plot → legend → source → footnote.

---

## 2. Unit: import `formatValue`, do not fork

Chrome owns `unit` and `formatValue` (`00-editorial-chrome.md` §7). Money does **not** ship `formatUnit` / `UnitKind` / `UnitFormatOptions`.

```ts
declare function formatValue(
  value: number,
  spec: Unit | UnitFormat | undefined,
): string;
```

Normative (chrome table): `469000` → `$469k`; `3000000` → `$3M`; `1200000` → `$1.2M`; `500000` → `$500k`; `-500000` → `-$500k` (ASCII hyphen, Satori/Inter); `10` percent-points → `10%`. Compact `k` < 1e6 ≤ `M` < 1e9 ≤ `B`. No Unicode minus, no `$4,500` special-case under 10k (`4500` compact is `$4.5k` if it crosses the `k` rung; `469` compact is `$469`). Count compact default: `1247` → `1.2k`.

Families pass numbers. Formatted strings belong in `stat.display` or `annotations[].text` only.

Validate: if `unit` is present it is `'usd' | 'percent' | 'count'` or a `UnitFormat` whose `unit` is one of those.

---

## 3. Types

`DiagramType` gains:

```ts
| 'sankey' | 'waterfall' | 'delta' | 'bar' | 'grouped-bar' | 'stacked-bar'
| 'treemap' | 'bullet' | 'slope' | 'alluvial' | 'range-plot'
| 'line' | 'stacked-area' | 'histogram' | 'dot-plot'
```

Each spec below extends `CivicBase`. Discriminant is `type`. Payload is money-only. Discriminant is `type`.

---

### 3.1 `sankey` — dollars through funds

Use when the story is "this dollar left A and landed in B" (or a fund spends more than it takes in). Not a styled `flow`.

Ledger proof: drug-treatment court may need $250,000 from county general instead of opioid settlement money. Also: 0.2% correctional/rehab LIT cannot pay non-facility staff (comes from general); community-corrections costs ~$700k shifted onto local taxpayers; 911 receipts vs outlays.

```ts
export interface SankeyNode {
  id: string;
  label: string;
  color?: string;
}
export interface SankeyLink {
  from: string;
  to: string;
  value: number;          // >= 0. Width encodes value.
  label?: string;
  color?: string;
}
export interface SankeySpec extends CivicBase {
  type: 'sankey';
  nodes: SankeyNode[];
  links: SankeyLink[];
}
```

```yaml
type: sankey
title: "Drug court: which fund pays"
unit: usd
caption: "The program may need $250,000 from county general instead of opioid settlement money."
source:
  label: "County council, Aug 12"
  href: "https://vigoledger.org/"

nodes:
  - id: opioid
    label: "Opioid settlement"
  - id: general
    label: "County general"
  - id: program
    label: "Drug-treatment court"
links:
  - from: opioid
    to: program
    value: 0
    label: "this year"
  - from: general
    to: program
    value: 250000
    label: "proposed"
```

**Layout.** Left-to-right ranks from graph topology (sources on the left, sinks on the right). Node height is throughput (max of in-sum, out-sum). Link width is `value`; a zero-value link is a hairline labeled `n/a`. Many-to-one and one-to-many are required (LIT → general → payroll). Cycle-free.

**Validate.** `nodes.length >= 2`; unique `id`s; `links.length >= 1`; every `from`/`to` names a node; no self-loops; no cycles; `value` is a finite number `>= 0`; at least one link with `value > 0` or the chart is allowed to publish all-`n/a` (Ledger incomplete note). Reject if a node is orphaned and has no links.

---

### 3.2 `waterfall` — signed steps to a total

Use when the number moved because of named line items.

Ledger proof: jail budget up for vehicles ($65k), repairs, and body cameras. Building-maintenance emergencies +$520k.

```ts
export interface WaterfallStep {
  id: string;
  label: string;
  value: number;          // signed. Negative is a cut.
  color?: string;         // default theme.money.positive / negative
}
export interface WaterfallSpec extends CivicBase {
  type: 'waterfall';
  start?: { label: string; value: number };
  steps: WaterfallStep[];
  end?: { label: string };   // value is computed, never authored
}
```

```yaml
type: waterfall
title: "Jail budget: what went up"
unit: usd
caption: "Vehicles, repairs, and new body cameras are why the jail budget rose."
source:
  label: "County council, Aug 12"
  href: "https://vigoledger.org/"

start:
  label: "Prior jail budget"
  value: 0
steps:
  - id: vehicles
    label: "Vehicles"
    value: 65000
  - id: repairs
    label: "Repairs"
    value: 0
  - id: cameras
    label: "Body cameras"
    value: 0
end:
  label: "Proposed jail budget"
```

**Layout.** Columns left to right on a shared numeric axis: start (if present), each step as a floating bar from the running total, connectors (bridges) between columns, then a full end column = start + sum(steps). Positive steps rise from the bridge; negative steps drop below it. Zero steps are a tick + `n/a`. End value is never YAML.

**Validate.** `steps.length >= 1`; unique step `id`s; each `value` finite; `end.value` must be absent; `start.value` if present is finite. Reject if every step is `0` and there is no non-zero `start` (nothing to draw except n/a — allowed only when `start` is present).

---

### 3.3 `delta` — one number became another

Use for a cut, jump, or swap when intervening lines are unknown or unused. Slope is the many-item version.

Ledger proofs: Clinton Road widening $3,000,000 → $500,000 (EDIT). Clerk scanning $9,000 → $109,000. Sewer bills +10% in 2030.

```ts
export interface DeltaSpec extends CivicBase {
  type: 'delta';
  from: { label: string; value: number };
  to: { label: string; value: number };
}
```

```yaml
type: delta
title: "Clinton Road widening"
unit: usd
caption: "EDIT-fund funding dropped from $3 million to $500,000."
source:
  label: "County council, Aug 13"
  href: "https://vigoledger.org/"
stat:
  value: 500000
  unit: usd
  label: Adopted
  comparator:
    value: 3000000
    label: from the proposed $3M
    direction: down
annotations:
  - kind: callout
    text: "$3M → $500k"
    at: { x: adopted }
    tone: down
legend: false
alt: "Clinton Road widening in the EDIT budget dropped from $3 million to $500,000."
dataTable:
  columns: [Stage, Amount]
  records:
    - [As previously budgeted, 3000000]
    - [Adopted, 500000]
footnote: "Figures from the adopted EDIT line, not the original agenda packet."

from:
  label: "As previously budgeted"
  value: 3000000
to:
  label: "Adopted"
  value: 500000
```

Percent proof (sewer): `unit: percent`, `from.value: 0`, `to.value: 10`. The $3/month stormwater fee is a second delta, not a field on this one.

**Layout.** Two large formatted numbers, a signed absolute change and a signed percent change (both computed; percent change is ` (to-from)/from ` when `from !== 0`, else omitted). Optional slope mark between the two figures. This is hallway-readable: one pair, no axis chrome.

**Validate.** `from` and `to` required; both `value`s finite; both `label`s non-empty. `from.value === to.value` is allowed (no-change story) and renders `0` / `0%`.

---

### 3.4 `bar` — ranked amounts, one series

Ledger proof (this week's appropriations): traffic study $469k, building emergencies $520k, rescue truck $225k, plow $100k, Susie's Place $45k, warming center $47.5k.

```ts
export interface BarItem {
  id: string;
  label: string;
  value: number;
  color?: string;
}
export interface BarSpec extends CivicBase {
  type: 'bar';
  orientation?: 'horizontal' | 'vertical';  // default 'horizontal'
  sort?: 'desc' | 'asc' | 'none';           // default 'desc'
  items: BarItem[];
}
```

```yaml
type: bar
title: "This week's appropriations"
unit: usd
caption: "The largest add this week is $520,000 for building-maintenance emergencies."
source:
  label: "County council, Aug 12–13"
  href: "https://vigoledger.org/"
orientation: horizontal
sort: desc

items:
  - id: buildings
    label: "Building emergencies"
    value: 520000
  - id: traffic
    label: "Clinton Road traffic study"
    value: 469000
  - id: rescue
    label: "Rescue truck"
    value: 225000
  - id: plow
    label: "Plow"
    value: 100000
  - id: warming
    label: "Warming center"
    value: 47500
  - id: susie
    label: "Susie's Place"
    value: 45000
```

**Layout.** One bar per item on a shared quantitative axis. Horizontal default so department labels stay readable; value labels sit at the bar end, formatted with `unit`. Sort descending unless `sort: none` (author order). No dual axis. Geist `bar-chart` is an icon, not this renderer.

**Validate.** `items.length >= 1`; unique `id`s; each `value` finite and `>= 0`; `orientation` / `sort` if present are the enums above.

---

### 3.5 `grouped-bar` — same categories, two or more series

Ledger proofs: 911 receipts vs outlays next year (amounts TBD in the note). CBD TIF spent $46,494 more than it collected.

```ts
export interface GroupedBarSpec extends CivicBase {
  type: 'grouped-bar';
  orientation?: 'horizontal' | 'vertical';  // default 'horizontal'
  categories: string[];                     // group labels, in order
  series: MoneySeries[];                    // each values.length === categories.length
}
```

```yaml
type: grouped-bar
title: "CBD TIF: collected vs spent"
unit: usd
caption: "The CBD TIF spent $46,494 more than it collected."
source:
  label: "Redevelopment, this edition"
  href: "https://vigoledger.org/"

categories:
  - "CBD TIF"
series:
  - id: collected
    label: "Collected"
    values: [0]
  - id: spent
    label: "Spent"
    values: [0]
```

When the two sides land, they replace the zeros; the gap is computed in the caption, not as a third series. 911 is the same shape with `categories: ["911 fund"]` and series `receipts` / `outlays`.

**Layout.** For each category, series bars sit side by side (not stacked) on a shared axis, grouped with a small gap between categories. Legend (EP) keys series color. No computed "difference bar" unless the author adds a series.

**Validate.** `categories.length >= 1`; `series.length >= 2`; unique series `id`s; every `values.length === categories.length`; values finite and `>= 0`. Reject `series.length === 1` (that is `bar`).

---

### 3.6 `stacked-bar` — composition of a total

Ledger proofs: $2M housing loan fund = $1M city + $1M county. Jail increase composition (vehicles / repairs / cameras) when those remainder figures land.

```ts
export interface StackedBarSpec extends CivicBase {
  type: 'stacked-bar';
  orientation?: 'horizontal' | 'vertical';  // default 'horizontal'
  categories: string[];
  series: MoneySeries[];                    // stack order = series order
}
```

```yaml
type: stacked-bar
title: "Housing loan fund"
unit: usd
caption: "A $2 million housing fund, split evenly between the city and the county."
source:
  label: "City / county, this edition"
  href: "https://vigoledger.org/"
legend: true
alt: "A $2 million housing loan fund split $1 million city and $1 million county."
dataTable:
  columns: [Payer, Amount]
  records:
    - [City, 1000000]
    - [County, 1000000]

categories:
  - "Housing loan fund"
series:
  - id: city
    label: "City"
    values: [1000000]
  - id: county
    label: "County"
    values: [1000000]
```

**Layout.** Segments stack along the value axis in series order; category total is the sum. Direct labels on segments when the segment is large enough for the formatted unit; otherwise the legend carries the series. Do not renormalize to 100% (that would be a different, parked 100% stacked bar).

**Validate.** Same shape as grouped-bar; `series.length >= 2`; values finite and `>= 0`; at least one category with sum `> 0`.

---

### 3.7 `treemap` — nested composition by size

Ledger proof: one edition of money, sized by line. Full county-general-by-department (sheriff, jail, JJC, highway, clerk) when the auditor table lands. This week's appropriations are the numbers we have.

```ts
export interface TreemapNode {
  id: string;
  label: string;
  value?: number;             // required on leaves; parents may omit (sum of children)
  color?: string;
  children?: TreemapNode[];
}
export interface TreemapSpec extends CivicBase {
  type: 'treemap';
  nodes: TreemapNode[];       // forest; usually one root
}
```

```yaml
type: treemap
title: "This week's appropriations"
unit: usd
caption: "Six adds, sized by dollars. Building emergencies and the Clinton Road study dominate."
source:
  label: "County council, Aug 12–13"
  href: "https://vigoledger.org/"

nodes:
  - id: week
    label: "This week's adds"
    children:
      - id: buildings
        label: "Building emergencies"
        value: 520000
      - id: traffic
        label: "Traffic study"
        value: 469000
      - id: rescue
        label: "Rescue truck"
        value: 225000
      - id: plow
        label: "Plow"
        value: 100000
      - id: warming
        label: "Warming center"
        value: 47500
      - id: susie
        label: "Susie's Place"
        value: 45000
```

**Layout.** Squarified treemap (Bruls / squarify). Leaf area encodes `value`. Parent value is the sum of descendants; an authored parent `value` that disagrees with that sum fails validate. Labels: name + formatted unit on leaves large enough to fit; smaller leaves get a tooltip-equivalent in HTML and a data-table fallback (EP `alt`). Groups in `flow` cannot nest; this type exists because of that.

**Validate.** At least one leaf; unique `id`s in the forest; every leaf has a finite `value >= 0`; at least one leaf `> 0`; if a parent has both `value` and `children`, `value === sum(children)`; no cycles (tree, not DAG).

---

### 3.8 `bullet` — actual vs target

Ledger proofs: Community Corrections $200k restored after it was pulled by mistake. 911 fund runway (fill when the note has remaining vs year).

```ts
export interface BulletItem {
  id: string;
  label: string;
  actual: number;
  target?: number;
  ranges?: number[];          // increasing qualitative bands, e.g. [100000, 200000]
}
export interface BulletSpec extends CivicBase {
  type: 'bullet';
  items: BulletItem[];        // one or many (small stack of bullets)
}
```

```yaml
type: bullet
title: "Community Corrections restored"
unit: usd
caption: "Council restored $200,000 to Community Corrections after the line was pulled by mistake."
source:
  label: "County council, this edition"
  href: "https://vigoledger.org/"

items:
  - id: cc
    label: "Community Corrections"
    actual: 200000
    target: 200000
    ranges: [100000, 200000]
```

**Layout.** Stephen Few bullet: qualitative `ranges` as background bands from 0 to each threshold, `actual` as a bar, `target` as a tick mark. Horizontal. Several `items` stack vertically (same scale if they share a unit). Do not draw a full cartesian grid.

**Validate.** `items.length >= 1`; unique `id`s; `actual` finite `>= 0`; `target` if present finite `>= 0`; `ranges` if present are finite, strictly increasing, all `>= 0`.

---

### 3.9 `slope` — several before/after pairs on one graphic

Use when more than one delta belongs on the same axes. A single pair is `delta`.

Ledger proofs: Clinton Road $3M → $500k; clerk scanning $9k → $109k; Make My Move $87.5k (include as a third line when the drop/keep vote lands).

```ts
export interface SlopeItem {
  id: string;
  label: string;
  from: number;
  to: number;
  color?: string;
}
export interface SlopeSpec extends CivicBase {
  type: 'slope';
  columns: { from: string; to: string };   // column headers
  items: SlopeItem[];
}
```

```yaml
type: slope
title: "Cuts and jumps, this edition"
unit: usd
caption: "Clinton Road was cut $2.5 million; the clerk's scanning line jumped $100,000."
source:
  label: "County council, Aug 13"
  href: "https://vigoledger.org/"

columns:
  from: "As budgeted"
  to: "Adopted"
items:
  - id: clinton
    label: "Clinton Road"
    from: 3000000
    to: 500000
  - id: clerk
    label: "Clerk scanning"
    from: 9000
    to: 109000
```

**Layout.** Two vertical labeled axes (`columns.from` / `columns.to`) sharing one quantitative scale (log is not v1). Each item is a line from `(from-axis, from)` to `(to-axis, to)`, labeled at both ends. Crossing lines are expected. Color optional; default by sign of `to - from` using `theme.money.positive/negative`.

**Validate.** `items.length >= 2` (else `delta`); unique `id`s; `columns.from` and `columns.to` non-empty; every `from`/`to` finite. Zero and negative allowed (a dropped program can be `to: 0`).

---

### 3.10 `alluvial` — quantitative bands across named stages

Categorical columns, band width = dollars (or count if `unit: count`). Distinct from `sankey` (topology-ranked funds, not named stages).

Boundary with Process: **Money takes alluvial when a `value` rides on every band.** Process takes `agenda-states` and `outcome-funnel` for the deferral pile as a process story (counts of introduced / deferred / adopted with no dollars). If an alluvial YAML has no values, it does not belong here.

```ts
export interface AlluvialNode {
  id: string;
  stage: string;              // must be in spec.stages
  label: string;
  color?: string;
}
export interface AlluvialLink {
  from: string;
  to: string;
  value: number;              // >= 0. Band width.
  label?: string;
  color?: string;
}
export interface AlluvialSpec extends CivicBase {
  type: 'alluvial';
  stages: string[];           // ordered columns, left → right
  nodes: AlluvialNode[];
  links: AlluvialLink[];
}
```

```yaml
type: alluvial
title: "Appropriations through the week"
unit: usd
caption: "Dollars that made it to adoption this week, sized by the add."
source:
  label: "County council, Aug 12–13"
  href: "https://vigoledger.org/"

stages:
  - "Introduced"
  - "Adopted"
nodes:
  - id: bldg-i
    stage: "Introduced"
    label: "Building emergencies"
  - id: bldg-a
    stage: "Adopted"
    label: "Building emergencies"
  - id: traffic-i
    stage: "Introduced"
    label: "Traffic study"
  - id: traffic-a
    stage: "Adopted"
    label: "Traffic study"
  - id: rescue-i
    stage: "Introduced"
    label: "Rescue truck"
  - id: rescue-a
    stage: "Adopted"
    label: "Rescue truck"
links:
  - from: bldg-i
    to: bldg-a
    value: 520000
  - from: traffic-i
    to: traffic-a
    value: 469000
  - from: rescue-i
    to: rescue-a
    value: 225000
```

Deferred sheriff / JJC / salaries stay with Process unless a dollar amount rides along; then they are extra nodes in a `Deferred` stage with `value`.

**Layout.** One column per `stages[]` entry, left to right. Nodes are stacked in a column (order: author order, then descending throughput). Links connect **adjacent stages only**; band width = `value`. Unlike sankey, ranks are not inferred — `stages` is the axis.

**Validate.** `stages.length >= 2`; unique stage names; unique node `id`s; every node `stage` is in `stages`; `links.length >= 1`; every `from`/`to` names a node; the `from` node's stage is immediately before the `to` node's stage (no skips, no backward, no same-column); `value >= 0` finite; at least one `value > 0`. Reject cycles by construction (links only go stage i → i+1).

---

### 3.11 `range-plot` — min–max per category

Ledger proof: bid ranges and salary bands in staff reports. Appropriated plow $100k is a cap, not a bid spread — fill `min`/`max` from the tabulation when it lands. Shape below uses the Community Corrections ~$700k local hit as a point-in-range until a real bid table is in the note.

```ts
export interface RangeItem {
  id: string;
  label: string;
  min: number;
  max: number;
  mid?: number;               // median / award / requested
}
export interface RangePlotSpec extends CivicBase {
  type: 'range-plot';
  orientation?: 'horizontal' | 'vertical';  // default 'horizontal'
  items: RangeItem[];
}
```

```yaml
type: range-plot
title: "Local share of community corrections"
unit: usd
caption: "State cuts push about $700,000 in community-corrections costs onto the county general fund."
source:
  label: "County council, this edition"
  href: "https://vigoledger.org/"

items:
  - id: cc
    label: "Community corrections (local)"
    min: 0
    max: 700000
    mid: 700000
```

**Layout.** One category per row (horizontal): a line from `min` to `max` and a mark at `mid` when present. Shared quantitative axis. Several items, same scale. Not a Gantt (this is money, not duration).

**Validate.** `items.length >= 1`; unique `id`s; `min`, `max`, and `mid` (if present) finite; `min <= max`; if `mid` is set, `min <= mid <= max`.

---

### 3.12 `line` — series over fiscal periods

Ledger proof: 911 fund, TIF surplus/shortfall, levy across budgets. Time Viz owns real date axes; money `line` uses **ordinal period labels** (`"FY2025"`, `"2026"`) so it does not wait on the timeline date-math fix. Sparkline is Time's tiny version.

Values for a multi-year 911 series are not in this edition. The YAML shows the contract; replace zeros when the auditor table lands. Two confirmed points elsewhere (Clinton Road budgeted vs adopted) are a `delta`/`slope`, not a multi-year line.

```ts
export interface LineSpec extends CivicBase {
  type: 'line';
  periods: string[];          // ordinal x, left → right, not Date-parsed
  series: MoneySeries[];      // values.length === periods.length
}
```

```yaml
type: line
title: "911 fund, next year vs this year"
unit: usd
caption: "The county's 911 fund is set to spend more than it takes in next year."
source:
  label: "County council, Aug 13"
  href: "https://vigoledger.org/"

periods:
  - "This year"
  - "Next year"
series:
  - id: receipts
    label: "Receipts"
    values: [0, 0]
  - id: outlays
    label: "Outlays"
    values: [0, 0]
```

**Layout.** Ordinal x-axis in `periods` order, linear y, one polyline per series, point marks at each period. Legend keys series. Do not interpolate a missing interior point — authors must supply a number (use `0` + caption if unknown). Not a time-scale; unequal real-world gaps are not visually encoded (that is Time's `timeline` fix).

**Validate.** `periods.length >= 2`; unique period strings; `series.length >= 1`; unique series `id`s; every `values.length === periods.length`; values finite. Negative allowed (a TIF shortfall).

---

### 3.13 `stacked-area` — mix of a whole over periods

Ledger proof: revenue mix (property / income / fees / grants) across years; wheel-tax city-vs-county swap. Same ordinal-period contract as `line`. Yearly mix is not in this edition; the housing split is the composition we have, so the example is a two-period stand-in only if a second year lands. Until then this type shares the 911 mix-over-years story with `line`, stacked.

```ts
export interface StackedAreaSpec extends CivicBase {
  type: 'stacked-area';
  periods: string[];
  series: MoneySeries[];      // stack order = series order; values >= 0
}
```

```yaml
type: stacked-area
title: "Housing fund by payer"
unit: usd
caption: "City and county each put up $1 million. A second year turns this into a mix-over-time chart."
source:
  label: "City / county, this edition"
  href: "https://vigoledger.org/"

periods:
  - "This year"
series:
  - id: city
    label: "City"
    values: [1000000]
  - id: county
    label: "County"
    values: [1000000]
```

`periods.length === 1` is allowed so the first edition can publish; it renders as a stacked column (same stack rules). Two-plus periods fill the area.

**Layout.** Same ordinal x as `line`. Series stack from the baseline in series order; the top edge is the running total. No 100% normalization in v1. Legend keys series.

**Validate.** `periods.length >= 1`; `series.length >= 2`; every `values.length === periods.length`; values finite and `>= 0`; at least one period with sum `> 0`.

---

### 3.14 `histogram` — binned distribution

Ledger proof: bid amounts, assessed values, parcel sizes. This week's six appropriation amounts are the only dollar list we have; they are the observations.

```ts
export interface HistogramBin {
  start: number;
  end: number;                // exclusive, except the last bin may be closed
  count: number;
}
export interface HistogramSpec extends CivicBase {
  type: 'histogram';
  values?: number[];          // raw observations; library bins them
  binWidth?: number;          // usd: default a nice number near (max-min)/5
  bins?: HistogramBin[];      // XOR with values; pre-binned
}
```

```yaml
type: histogram
title: "This week's adds, by size"
unit: usd
caption: "Six appropriations. Two sit above $400k; the rest are $225k and under."
source:
  label: "County council, Aug 12–13"
  href: "https://vigoledger.org/"

values: [520000, 469000, 225000, 100000, 47500, 45000]
binWidth: 100000
```

**Layout.** Vertical columns, contiguous bins on a linear x (the observation unit), height = count (`unit` on the x labels is the observation unit; y is always count and ignores `spec.unit`). No gaps between bins. `values` XOR `bins`: authors who already have a table pass `bins`; otherwise pass the raw list.

**Validate.** Exactly one of `values` or `bins`. If `values`: length `>= 1`, all finite, `binWidth` if present `> 0`. If `bins`: length `>= 1`, `start < end`, contiguous (`bins[i].end === bins[i+1].start`), `count` integer `>= 0`. Reject empty observations.

---

### 3.15 `dot-plot` — one value per category on a shared scale

Use when many similar-sized funds would lie if drawn as bars (bar ink overstates small differences). Salary / per-diem comparisons. Beeswarm (Composition) is the many-points-per-category version.

Ledger proof: the smaller adds this week (plow, warming center, Susie's Place) plus Make My Move $87.5k — similar magnitude, one axis.

```ts
export interface DotItem {
  id: string;
  label: string;
  value: number;
  color?: string;
}
export interface DotPlotSpec extends CivicBase {
  type: 'dot-plot';
  orientation?: 'horizontal' | 'vertical';  // default 'horizontal'
  sort?: 'desc' | 'asc' | 'none';           // default 'desc'
  items: DotItem[];
}
```

```yaml
type: dot-plot
title: "Smaller funds, same scale"
unit: usd
caption: "Plow, warming center, Susie's Place, and Make My Move sit within $60k of each other."
source:
  label: "This edition"
  href: "https://vigoledger.org/"

items:
  - id: plow
    label: "Plow"
    value: 100000
  - id: mmm
    label: "Make My Move"
    value: 87500
  - id: warming
    label: "Warming center"
    value: 47500
  - id: susie
    label: "Susie's Place"
    value: 45000
```

**Layout.** One dot per item on a shared linear axis; category labels opposite the axis (horizontal: labels on the left, dots on the x scale). No bar fill. Optional faint gridline from label to dot. Sort descending unless `sort: none`.

**Validate.** `items.length >= 1`; unique `id`s; each `value` finite (negative allowed for a shortfall). Prefer this over `bar` when `max/min < ~3` and `items.length >= 4`; that preference is editorial, not a validate rule.

---

## 4. `AnyDiagramSpec` / theme

```ts
export type AnyDiagramSpec =
  | DiagramSpec | GanttSpec | TimelineSpec | QuadrantSpec
  | SankeySpec | WaterfallSpec | DeltaSpec
  | BarSpec | GroupedBarSpec | StackedBarSpec
  | TreemapSpec | BulletSpec | SlopeSpec | AlluvialSpec
  | RangePlotSpec | LineSpec | StackedAreaSpec
  | HistogramSpec | DotPlotSpec;

export interface ThemeConfig {
  // existing fields…
  money?: MoneyTheme;
}
```

`unit` is not a member of `DiagramType`.

---

## 5. Out of scope

- **pie / donut** — not a first money type. Ledger money stories are flows, cuts, and stacks. Donut (VIZ-56) stays with Process if anyone ships a 2–5 slice ring.
- **100% stacked bar / area** — parked. Stacks stay in dollars.
- **log scales, dual axes, 3D, animation.**
- **CivicBase chrome** — `caption`, `source`, `legend`, `stat`/`stats`, `annotations` (kind `callout`, not a `callouts` field), `alt`, `dataTable`, `footnote`, `unit`, `type: 'stat'`, `civic:` icons. Import; do not fork. No `subtitle`, `kpi`, `bigNumber`.
- **agenda-states, outcome-funnel** — Process. Alluvial is Money only when bands carry `value`.
- **sparkline** — Time (tiny series). Full series here is `line`.
- **beeswarm, waffle, isotype, small-multiples, scorecard** — Composition. A grid of `delta`s is small-multiples, not a money type.
- **lollipop** — folded into `bar` / `dot-plot`.
- **sunburst / icicle** — folded into `treemap`.
- **flow-with-thick-edges** — `DiagramEdge` has no `value`. Use `sankey`.
- **quadrant as a comparison chart** — 2×2 scatter, fixed dots, no size-by-value.
- **currency other than USD, inflation-adjusted series, per-capita mode** — not v1. `unit: usd` is current dollars as the note printed them.

---

## 6. Ship order

1. CivicBase import + `formatValue` (blocks every chart).
2. `delta`, `waterfall`, `sankey` (this week's proofs; examples already in `examples/`).
3. `bar`, `stacked-bar`, `grouped-bar`, `slope`.
4. `treemap`, `bullet`, `dot-plot`, `alluvial`.
5. `line`, `stacked-area`, `range-plot`, `histogram` (need more than one period / a bid table to sing; ship the contract anyway).

Done when: YAML → PNG/SVG/HTML/PPTX like gantt; `formatValue` (Editorial) used for every label; caption/source render under the chart (source is a link in HTML); validate rejects the cases above; skill doc lists these types.
