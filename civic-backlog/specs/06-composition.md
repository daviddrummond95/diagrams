# Composition and comparison types

This family owns part-to-whole, roster, and distribution charts the Ledger
already has counts for, plus two Ledger vocabularies that Money renders.
Seven types get a renderer (`waffle`, `isotype`, `small-multiples`,
`scorecard`, `beeswarm`, `connected-dot`, `data-table`). Two names
(`category-mix`, `per-body-count`) are parse aliases, not renderers.
`quadrant` stays the existing 2×2 scatter (fixed 12px dots, no
size-by-value). Do not use or extend it for comparison.

First customer: [The Vigo Ledger](https://vigoledger.org) (Vol. I No. 1,
week of Aug 28, 2026). Counts below are from the edition index scraped
2026-08-29. Do not invent other numbers. `0` is valid and means
unknown/TBD (same convention as money), so an incomplete note can still
publish. On scorecard / connected-dot, a TBD `0` **displays as `n/a`**,
not `$0` / `0` — that is a Composition convention on those two types,
not a chrome formatter rule.

Extension pattern: add a member to `DiagramType` / `AnyDiagramSpec` in
`src/types.ts`, branch in `parse.ts` / `validate.ts` /
`src/render/index.ts`, add `src/diagrams/<type>/{layout,tree,pptx}.ts`.
Do NOT bolt onto flow groups. This file is the spec. Demo render (not
the library): `demos/composition.html` via `demos/render_composition.py`.

`DiagramType` gains:

```ts
| 'waffle' | 'isotype' | 'small-multiples' | 'scorecard'
| 'beeswarm' | 'connected-dot' | 'data-table'
```

Parse aliases (rewrite, then validate as the target; not members of
`DiagramType`): `category-mix` → `stacked-bar`, `per-body-count` → `bar`.

`ThemeConfig` gains optional keys for types that own a renderer:
`waffle?`, `isotype?`, `smallMultiples?`, `scorecard?`, `beeswarm?`,
`connectedDot?`, `dataTable?`. Same pattern as `gantt?` / `timeline?` /
`quadrant?`. Cell and dot defaults are 12px so waffle squares and packed
dots sit next to existing `QuadrantTheme.dotSize`.

## Shared civic chrome (import CivicBase; do not re-declare)

Locked chrome: [00-editorial-chrome.md](./00-editorial-chrome.md).
**Every Composition spec extends `CivicBase`.** Editorial Primitives
owns `DiagramChrome` / `CivicBase`. Composition does not fork those
names and does not re-declare Caption / Source / Legend / Annotation /
DataTable / Unit shapes. Quote the locked names; point here.

```ts
import type { CivicBase, Legend, SourceRef, Annotation, Unit, DataTable } from './editorial';
// CivicBase already has: title, theme, caption, source, legend, stat, stats,
// annotations, unit, alt, dataTable, footnote

interface WaffleSpec extends CivicBase {
  type: 'waffle';
  mode: 'n' | 'percent';
  columns?: number;
  categories: WaffleCategory[];
}
```

Same `extends CivicBase` on `IsotypeSpec`, `SmallMultiplesSpec`,
`ScorecardSpec`, `BeeswarmSpec`, `ConnectedDotSpec`, `DataTableSpec`
(the **type** `type: 'data-table'`). Do not repeat `title` / `theme` /
`caption` / `source` / `legend` / `stat` / `stats` / `annotations` /
`unit` / `alt` / `dataTable` / `footnote` on the family interfaces.

Locked names (use these, never forks):

| Locked name | Type | Do not invent |
| --- | --- | --- |
| `caption` | `string` | dek, kicker, subtitle |
| `source` | `SourceRef \| SourceRef[]`  // `{label, href?}` | credit, sources, byline |
| `legend` | `boolean \| LegendItem[] \| LegendSpec` | key, swatches |
| `stat` / `stats` | `StatSpec` / `StatSpec[]` | kpi, bigNumber |
| `annotations[]` | `Annotation[]`, `kind: 'callout' \| 'peak' \| 'range' \| 'label'` | **there is NO `callouts` field** |
| `alt` | `string` | altText |
| `dataTable` | `{ columns: string[]; records: Array<Array<string\|number\|null>>; summary?: string }` | NEVER `rows` for this table (`rows` is the flow group grid). Never `data` / `table` / `fallback` |
| `footnote` | `string` | notes, disclaimer |
| `unit` | `Unit \| UnitFormat`  // `usd \| percent \| count` | currency, format |
| `icon` | existing field, `civic:<kebab-singular>` | `gov:` icons |

`unit` compact output is chrome-normative (00 §7). Families pass numbers.
Do not pre-format strings in YAML. Compact usd: `k` under `1e6`, no `k`
under 1000 (`469` → `$469`; `4500` → `$4.5k`; `47500` → `$47.5k`;
`100000` → `$100k`; `469000` → `$469k`; `502000` → `$502k`;
`520000` → `$520k`). Count `84` → `84`. Composition TBD `0` on
scorecard / connected-dot promised or `from` → display `n/a`, not `$0`.

**Waffle requires `legend`** (chrome rule: choropleth, zoning, waffle,
stacked-bar). `legend` must be present and not `false`, and must resolve
to ≥1 item (explicit or auto). Prefer `legend: true` (auto from
`categories`) or explicit `LegendItem[]`. `legend: true` and
`{ auto: true }` are the same.

**Collision (do not "fix" by renaming):**

- CivicBase **field** `dataTable` = accessible fallback
  `{ columns: string[]; records: arrays }`. **Required to publish** on
  waffle (numeric / area encoding), same as stacked-bar / choropleth.
- Composition **type** `type: 'data-table'` = first-class meeting-record
  table (payload `columns` with `encode`, `rows` as records). Different.
  The type still `extends CivicBase`, so it also has the fallback field,
  but the payload stays `columns` / `rows` as already specced. Do not
  rename the type to avoid the field. Do not rename the field to `table`.

Civic icons live on the existing `icon` field,
`civic:<kebab-singular>`. Files: `icons/civic/<slug>.svg` (EP is writing
them). Starter set: `civic:courthouse`, `civic:sheriff`, `civic:roads`,
`civic:fire`, `civic:school`, `civic:housing` (`housing` = a **house**).

Isotype units are **locked** (00-editorial-chrome.md). Use these on
isotype `icon`. Do **not** waffle-square them:

| slug | Use |
| --- | --- |
| `civic:bed` | shelter bed |
| `civic:camera` | street / Flock plate camera. Officer cam is `civic:body-camera`. |
| `civic:demolition` | house taken down. Not `civic:demo`. |
| `civic:lot` | vacant lot. `civic:housing` is a house; `civic:parcel` is a map parcel. |

84 unbilled conservancy parcels → `civic:parcel`. 74 ISU lots →
`civic:lot`. Do not invent `civic:cameras`, `civic:beds`, `civic:demo`,
`civic:parcel-lot`. Other missing slugs still warn + waffle-square;
these four and `civic:parcel` do not.

Rejects (do not add): `dek`, `kicker`, `credit`, `kpi`, `bigNumber`,
`callouts`, `altText`, `gov:` icons, `sources`, `key`, `swatches`.

## 1. `waffle` — N-cell grid, part-to-whole

Use when a story is a count of units the reader should *see* as a grid
(parcels, beds, cameras, lots), not a bar of one number and not a
treemap of sized rectangles.

This week's proofs:

- 84 unbilled conservancy parcels (about 84; software glitch since 2010)
- 100 shelter beds proposed at the fairgrounds
- ~10 May demolitions, plus 5 completed in April
- 30 license-plate cameras (Flock, in place since 2024)
- 74 former ISU lots (3rd–13th to Locust)

Two modes:

- `mode: n` — N is the story. Columns default 10; rows = ceil(N /
  columns). Leftover cells in the last row are **omitted**, not empty
  fillers, unless the story is part-to-whole of a larger whole.
- `mode: percent` — default 10×10 (100 cells). Categories fill that many
  cells; remainder of the 100 stays empty so the whole is visible.

84 parcels → `mode: n`, 10 columns × 9 rows, last row 4 cells (6
omitted). Optional percent telling: 84 filled of 100 with 16 empty, only
when the caption is "84 of a hundred-cell whole." 100 beds → perfect
10×10. 30 cameras → 10×3 (or `columns: 6` → 6×5). 74 lots → 10×8 minus
6, last row 4 cells.

Layout geometry (demo / renderer): `CELL=22`, `GAP=2`, so `x = col * 24`,
`y = row * 24` (newspaper-countable; library default remains 12px). Emit exactly N `<rect class="cell">`. Categories fill
left-to-right, top-to-bottom in author order. One cell = one unit of
`unit`. Do not size cells by value — that is a treemap (Money).
Approximate categories get a small tilde on the label, not a fuzzy cell.

YAML (N-mode, one category). `legend: true` auto-from-categories.
`dataTable` is the accessible fallback (raw numbers):

```yaml
type: waffle
title: "Unbilled conservancy parcels"
mode: n
unit: count
caption: "A years-old billing glitch let about 84 conservancy parcels skip the tax; no back taxes will be collected."
source:
  label: "County commissioners, Aug 4"
  href: "https://vigoledger.org/h/2026-08-04-vigo-county-commissioners-conservancy-tax-correction"
legend: true
alt: "Grid of 84 cells, one per unbilled conservancy parcel."
dataTable:
  columns: ["Category", "Count"]
  records: [["Unbilled", 84]]

categories:
  - id: unbilled
    label: "Unbilled"
    value: 84
    approximate: true     # note says "about 84"
```

100 beds (perfect grid):

```yaml
type: waffle
title: "Shelter beds asked at the fairgrounds"
mode: n
unit: count
caption: "A trustee asked council to approve 100 homeless shelter beds at the fairgrounds with no city money, and got no response on the record."
source:
  label: "City council, Jun 4"
  href: "https://vigoledger.org/h/2026-06-04-terre-haute-city-council-homeless-shelter-fairgrounds-proposal"
legend: true
alt: "10 by 10 grid of 100 shelter beds."
dataTable:
  columns: ["Category", "Count"]
  records: [["Shelter beds", 100]]

categories:
  - id: beds
    label: "Shelter beds"
    value: 100
```

~10 May demolitions plus 5 April (small grid, approximate flag). Legend
is an explicit `LegendItem[]` (array of `{label, color?}` is valid
`Legend`; keep these items):

```yaml
type: waffle
title: "Houses taken down this spring"
mode: n
columns: 5
unit: count
caption: "The city planned about ten more demolitions in May, on top of five already finished in April."
source:
  label: "City council, May 7"
  href: "https://vigoledger.org/h/2026-05-07-terre-haute-city-council-blight-demolitions"
legend:
  - label: "May (about)"
  - label: "April (completed)"
alt: "About 10 May demolitions and 5 completed in April."
dataTable:
  columns: ["Category", "Count"]
  records:
    - ["May (about)", 10]
    - ["April (completed)", 5]

categories:
  - id: may
    label: "May"
    value: 10
    approximate: true
  - id: april
    label: "April completed"
    value: 5
```

30 cameras:

```yaml
type: waffle
title: "Flock cameras already in place"
mode: n
unit: count
caption: "Thirty Flock license-plate cameras have been in place since 2024."
source:
  label: "City council, Jun 11"
  href: "https://vigoledger.org/h/2026-06-11-terre-haute-city-council-flock-camera-privacy-policy"
legend: true
alt: "Grid of 30 cells, one per Flock camera."
dataTable:
  columns: ["Category", "Count"]
  records: [["Cameras", 30]]

categories:
  - id: cameras
    label: "Cameras"
    value: 30
```

74 ISU lots (`mode: n`). $4,000 purchase + $6,500 infrastructure
incentive each — caption material, not a second encoding on the waffle:

```yaml
type: waffle
title: "Former ISU lots"
mode: n
unit: count
caption: "The city moved on 74 former ISU lots from 3rd–13th to Locust, $4,000 purchase plus $6,500 infrastructure incentive each."
source:
  label: "City council, Mar 5"
  href: "https://vigoledger.org/h/2026-03-05-terre-haute-city-council-isu-parcels-redevelopment"
legend: true
alt: "Grid of 74 cells, one per former ISU lot."
dataTable:
  columns: ["Category", "Count"]
  records: [["Former ISU lots", 74]]

categories:
  - id: lots
    label: "Former ISU lots"
    value: 74
```

Contract:

```ts
interface WaffleCategory {
  id: string;
  label: string;
  value: number;          // integer count of cells; >= 0
  color?: string;
  approximate?: boolean;  // tilde in the note (~10, about 84)
}
interface WaffleSpec extends CivicBase {
  type: 'waffle';
  mode: 'n' | 'percent';
  columns?: number;       // default 10
  categories: WaffleCategory[];
}
```

Reject: `value < 0`; non-integer `value`; empty `categories`; duplicate
ids; `columns < 1`; total cells `> 400` (above that, recommend isotype
with `unitsPerIcon` or a Money `bar`). `mode: percent` with a sum `>
100` is a validate error unless `columns` × rows is set large enough to
hold it — default percent grid is 100. Missing `legend` or `legend:
false` on waffle is a Vigo-publish error (chrome rule). Missing
`dataTable` is a Vigo-publish error (numeric / area encoding).

What this is not: a pie/donut (Process owns `donut` VIZ-56). Not a
treemap. Not a bar of one number.

## 2. `isotype` — icons as units

Same data shape as waffle (categories of integer units) but each unit is
a civic icon, not a square. Unit encoding only. Glyphs come from
Editorial Primitives civic-icons (VIZ-40). Composition does not own the
pack. Files: `icons/civic/<slug>.svg`. Demo may stand in paths until
those files land; the `icon` field still carries the **locked** slug.
Do not waffle-square `civic:bed` / `civic:camera` / `civic:demolition` /
`civic:lot` / `civic:parcel`.

This week's proofs: 100 `civic:bed`; 30 `civic:camera` (Flock, not
`civic:body-camera`); 84 `civic:parcel` (map parcels); ~10
`civic:demolition`; 74 `civic:lot`.

YAML (conservancy parcels = map parcels):

```yaml
type: isotype
title: "84 unbilled parcels"
unit: count
caption: "A years-old billing glitch let about 84 conservancy parcels skip the tax; no back taxes will be collected."
source:
  label: "County commissioners, Aug 4"
  href: "https://vigoledger.org/h/2026-08-04-vigo-county-commissioners-conservancy-tax-correction"
legend: true
alt: "Eighty-four parcel icons, one per unbilled conservancy parcel."
icon: civic:parcel        # map parcel. Not civic:housing (house) or civic:lot.
scale:
  unitsPerIcon: 1
categories:
  - id: parcels
    label: "Unbilled parcels"
    value: 84
    approximate: true
    icon: civic:parcel
```

100 beds — locked `civic:bed`. Not a waffle square:

```yaml
type: isotype
title: "100 shelter beds"
unit: count
caption: "A trustee told council 100 people need beds at the fairgrounds before the city can enforce its camping rules."
source:
  label: "City council, Jun 4"
  href: "https://vigoledger.org/h/2026-06-04-terre-haute-city-council-homeless-shelter-fairgrounds-proposal"
legend: true
alt: "One hundred bed icons, one per shelter bed asked."
icon: civic:bed           # locked isotype unit
scale:
  unitsPerIcon: 1         # default 1. Later: 1 icon = 10 units.
categories:
  - id: beds
    label: "Shelter beds"
    value: 100
    icon: civic:bed
```

30 Flock cameras — locked `civic:camera` (street / plate). Officer cam
is `civic:body-camera`; do not mix them. Demolitions: locked
`civic:demolition` (not `civic:demo`), `value: 10`, `approximate: true`.
74 ISU lots: locked `civic:lot` (not `civic:housing`, not `civic:parcel`).

```yaml
type: isotype
title: "74 former ISU lots"
unit: count
caption: "The city moved on 74 former ISU lots from 3rd–13th to Locust."
source:
  label: "City council, Mar 5"
  href: "https://vigoledger.org/h/2026-03-05-terre-haute-city-council-isu-parcels-redevelopment"
legend: true
alt: "Seventy-four lot icons, one per former ISU lot."
icon: civic:lot
scale:
  unitsPerIcon: 1
categories:
  - id: lots
    label: "Former ISU lots"
    value: 74
    icon: civic:lot
```

Locked isotype units (do not waffle-square):

| slug | use |
| --- | --- |
| `civic:bed` | shelter bed |
| `civic:camera` | Flock / license-plate. Not `civic:body-camera`. |
| `civic:demolition` | house taken down. Not `civic:demo`. |
| `civic:lot` | vacant lot. `civic:housing` = house; `civic:parcel` = map parcel. |

Starter set still ships: `civic:courthouse`, `civic:sheriff`,
`civic:roads`, `civic:fire`, `civic:school`, `civic:housing`. Files at
`icons/civic/<slug>.svg`. Other unknown slugs → validate **warning** +
waffle-square fallback. These four plus `civic:parcel` never square.
Do not substitute `geist:` or `aws:lambda`. Do not invent `gov:`.

Contract:

```ts
interface IsotypeScale {
  unitsPerIcon: number;   // integer >= 1, default 1
}
interface IsotypeCategory {
  id: string;
  label: string;
  value: number;          // integer unit count; >= 0
  icon?: string;          // civic:<kebab> on the existing icon field
  color?: string;
  approximate?: boolean;
}
interface IsotypeSpec extends CivicBase {
  type: 'isotype';
  icon?: string;          // default civic slug for categories without one
  scale?: IsotypeScale;
  categories: IsotypeCategory[];
}
```

Layout: rows of icons, wrapping, same reading order as waffle
(left-to-right, top-to-bottom). Icon count per category is
`ceil(value / unitsPerIcon)`. A remainder smaller than `unitsPerIcon`
still draws one icon and marks it approximate if the category is.
Exactly N unit `<g>` marks when `unitsPerIcon` is 1.

Reject: same as waffle on values / empty categories / cap (icon count
after scale `> 400` → raise `unitsPerIcon` or use a bar). Missing both
spec-level `icon` and per-category `icon` is an error.

What this is not: a symbol-map (Place). Not a waffle with clip-art. Not
an icon pack.

## 3. `small-multiples` — panel grid only

Composition owns the **panel grid**, not the inner renderers. Money's
parked note ("two deltas side by side later via small-multiples") lands
here. Each panel references another type; the inner spec is dispatched
to whoever owns that renderer (Money for `bar` / `delta`; Time for
`sparkline`; Composition for `waffle` / `scorecard`).

This week's proof: budget lines held — sheriff, JJC, weights & measures,
tower, salaries. Dollar amounts are not in the notes, so panels use `0`
(TBD) and the caption carries the "held" fact. Prefer `delta` when the
only published state is held vs still-open. Inner delta is Money: do
**not** draw a delta chart in the Composition demo. Grid geometry is
the render — five equal panel rects, label + "Held" + `n/a`.

YAML:

```yaml
type: small-multiples
title: "Budget lines held"
panelType: delta
columns: 5
shareScale: true
unit: usd
caption: "The budget committee held the sheriff, Juvenile Justice Center, weights and measures, tower, and salary lines; dollar amounts were not read into this week's record."
source:
  label: "Budget committee, Aug 12–13"
  href: "https://vigoledger.org/h/2026-08-13-vigo-county-budget-committee-recess-salaries-deferred"
alt: "Five panels, one per held budget line. Amounts not yet in the notes."

panels:
  - id: sheriff
    label: "Sheriff"
    spec:
      from: { label: "Requested", value: 0 }   # fill from the note
      to:   { label: "Held", value: 0 }
  - id: jjc
    label: "JJC"
    spec:
      from: { label: "Requested", value: 0 }
      to:   { label: "Held", value: 0 }
  - id: weights
    label: "Weights & measures"
    spec:
      from: { label: "Requested", value: 0 }
      to:   { label: "Held", value: 0 }
  - id: tower
    label: "Tower"
    spec:
      from: { label: "Requested", value: 0 }
      to:   { label: "Held", value: 0 }
  - id: salaries
    label: "Salaries"
    spec:
      from: { label: "Requested", value: 0 }
      to:   { label: "Held", value: 0 }
```

Hrefs for the other held notes (same figure, one source under the whole):
sheriff
https://vigoledger.org/h/2026-08-13-vigo-county-budget-committee-sheriff-budget-deferred
and
https://vigoledger.org/h/2026-08-12-vigo-county-budget-committee-sheriff-budget-held-off;
JJC
https://vigoledger.org/h/2026-08-13-vigo-county-budget-committee-juvenile-justice-center-items-deferred;
weights & measures
https://vigoledger.org/h/2026-08-13-vigo-county-budget-committee-weights-and-measures-raise-deferred.

Inner `spec` is the owning type **minus** chrome fields inherited from
`CivicBase` on the outer spec. Do not re-specify `BarSpec` /
`DeltaSpec` / `SparklineSpec` fields here. A `panelType: bar` inner spec
is a `BarSpec` minus shared chrome; a `panelType: delta` inner spec is a
`DeltaSpec` minus shared chrome; a `panelType: sparkline` inner spec is
Time's sparkline minus shared chrome. One `panelType` per
small-multiples spec — no mixed inners.

Contract:

```ts
type SmallMultiplesPanelType =
  | 'bar' | 'delta' | 'sparkline'
  | 'waffle' | 'scorecard' | 'isotype'
  | 'beeswarm' | 'connected-dot';

interface SmallMultiplesPanel {
  id: string;
  label: string;
  spec: Record<string, unknown>;  // inner spec minus chrome; validated as panelType
}
interface SmallMultiplesSpec extends CivicBase {
  type: 'small-multiples';
  panelType: SmallMultiplesPanelType;
  columns?: number;       // default: min(panels.length, 3)
  shareScale?: boolean;   // default false. Shared domain when inner type is quantitative.
  panels: SmallMultiplesPanel[];
}
```

Layout: CSS-grid equivalent, equal panel slots, one small label per
panel, shared caption / source / legend / alt once under the whole
figure. If `shareScale`, compute the domain from every panel's
quantitative values (including zeros). Do not draw a second figure
chrome inside a panel. Demo: five equal `<rect>`s (`columns: 5`).

Reject: empty `panels`; mixed types (inner spec that cannot validate as
`panelType`); unknown `panelType`; duplicate panel ids; `columns < 1`.

What this is not: a grouped-bar. Not Money laying out two deltas. Not a
dashboard widget kit.

## 4. `scorecard` — promised vs delivered

A roster of commitments (abatements, contracts, grants) with a status.
Not two deltas. A delta is one number becoming another. A scorecard is
several entities, each with a promise, a delivery, and whether the
break was kept.

This week's proofs:

- CHI Overhead Doors: promised 130 new workers, delivered 54; tax break
  kept another year. Investment $10.7M vs $9M promised (same note;
  jobs are the card, dollars stay in `note`).
- Govina Inc.: CF-1 reported 152 (counted every W-2); actual average 62
  (close to the original promise, which the note does not number).
  Abatement kept. Counting error, not a miss.
- Miller-Parrott Lofts: 2 employees observed; promised job count not in
  the note; found in substantial compliance.

Do not score elected officials. Ledger does not score officials
(TYPES.md). This scores agreements.

YAML:

```yaml
type: scorecard
title: "Abatements: promised vs delivered"
unit: count
caption: "Council kept CHI Overhead Doors' tax break even though hiring landed at 54 of 130 promised jobs, and kept Govina's after a W-2 counting error."
source:
  label: "City council, Jul 9"
  href: "https://vigoledger.org/h/2026-07-09-terre-haute-city-council-chi-overhead-doors-abatement"
alt: "Three abatement rows: CHI 54 of 130 jobs, Govina 62 after a 152 W-2 miscount, Miller-Parrott 2 employees observed."

rows:
  - id: chi
    label: "CHI Overhead Doors"
    promised: { label: "New workers promised", value: 130 }
    delivered: { label: "Reported", value: 54 }
    kept: true
    note: "jobs missed; investment $10.7M vs $9M promised"
  - id: govina
    label: "Govina Inc."
    promised: { label: "Original promise (not stated)", value: 0 }  # TBD → n/a
    delivered: { label: "Actual average", value: 62 }
    reportedError: 152
    kept: true
    note: "counting error (W-2s vs snapshot)"
  - id: miller-parrott
    label: "Miller-Parrott Lofts"
    promised: { label: "Promised jobs (not stated)", value: 0 }     # TBD → n/a
    delivered: { label: "Employees observed", value: 2 }
    kept: true
    note: "found in substantial compliance"
```

Govina source (same meeting):
https://vigoledger.org/h/2026-07-09-terre-haute-city-council-govina-cf1-correction
Miller-Parrott:
https://vigoledger.org/h/2026-05-14-terre-haute-city-council-miller-parrott-employee-count
label "City council, May 14". One `source` under the figure; the other
hrefs belong in the notes / `footnote`, not a second `sources` field.

Status (derived, not authored):

- `promised.value === 0` (TBD) → `unknown`. Display promised as `n/a`.
  Do **not** treat `delivered >= 0` as met. Do **not** format TBD as `$0`.
- else `delivered >= promised` → `met`
- else `delivered < promised && kept` → `kept-short`
- else `!kept` → `clawed-back`

CHI is `kept-short` (gap `54 − 130 = −76`). Govina and Miller-Parrott
are `unknown` on the promise, `kept: true` on the agreement. Govina
delivered 62, with 152 struck as the W-2 miscount.

Contract:

```ts
interface ScorecardBound {
  label?: string;
  value: number;          // 0 = unknown/TBD when the note has no figure
}
interface ScorecardRow {
  id: string;
  label: string;
  promised: ScorecardBound;
  delivered: ScorecardBound;
  kept?: boolean;         // abatement/contract still in force
  reportedError?: number; // Govina: CF-1 W-2 count of 152
  note?: string;
}
interface ScorecardSpec extends CivicBase {
  type: 'scorecard';
  rows: ScorecardRow[];   // payload roster; not flow group grid; not dataTable.records
}
```

Layout: HTML table of entities; two number columns (promised, delivered);
a computed gap (`delivered − promised`, omitted when promised is TBD); a
status pill. A tiny two-dot inline is allowed as decoration on CHI —
same scale as `connected-dot`, not a required `connected-dot` renderer.
Optional `reportedError` renders as a struck or parenthetical figure,
not a third column of promises.

Reject: empty `rows`; missing `promised` or `delivered` objects; missing
`value` on either bound; duplicate ids. Values may be floats; Ledger
uses integers.

What this is not: two `delta`s. Not a vote-matrix. Not a score of
officials.

## 5. `beeswarm` — every observation as a non-overlapping dot

Use when many amounts share one axis and a bar chart of everything
would lie. Each observation is a packed dot. Not `quadrant` (fixed 12px,
2D scatter). Not Money's `dot-plot` (one dot per category, no packing).

This week's proof: clothing allowance $4,500 ($1,500 × 3 officers) next
to a $502,000 seized-asset ask. The gap **is** the story. Linear scale.
Other published asks from this edition sit on the same axis so the pile
of smaller items is visible. Axis ticks use chrome `unit: usd` compact
(`$4.5k`, `$47.5k`, `$100k`, `$502k`, `$520k`).

Do **not** invent a Composition annotation field. Use CivicBase
`annotations[]`. Prefer annotations so highlight is not a forked chrome
name. Optional `highlight?: boolean` on items is a **payload flag** that
selects which items get default `peak` labels — not a chrome field.

YAML:

```yaml
type: beeswarm
title: "Asks on one axis"
unit: usd
axis: x
caption: "A $4,500 clothing allowance for three part-time security officers sits on the same scale as a $502,000 seized-asset ask."
source:
  label: "County council, Aug 4"
  href: "https://vigoledger.org/h/2026-08-04-vigo-county-council-sunshine-building-security-clothing-allowance"
alt: "Dots on a dollar axis from $4,500 clothing allowance to $502,000 seized-asset ask, with this week's other published appropriations."
annotations:
  - { kind: callout, text: "$4,500 clothing allowance", at: { x: 4500 }, href: "https://vigoledger.org/h/2026-08-04-vigo-county-council-sunshine-building-security-clothing-allowance" }
  - { kind: peak, text: "seized-asset ask", at: { x: 502000 }, href: "https://vigoledger.org/h/2026-08-04-vigo-county-council-sunshine-prosecutor-seized-assets-appropriation" }

items:
  - id: clothing
    label: "Clothing allowance"
    value: 4500
  - id: warming
    label: "Warming center"
    value: 47500
  - id: susie
    label: "Susie's Place"
    value: 45000
  - id: plow
    label: "Plow"
    value: 100000
  - id: rescue
    label: "Rescue truck"
    value: 225000
  - id: traffic
    label: "Traffic study"
    value: 469000
  - id: buildings
    label: "Building emergencies"
    value: 520000
  - id: seized
    label: "Seized-asset ask"
    value: 502000
```

Seized-asset source (same Aug 4 sunshine meeting):
https://vigoledger.org/h/2026-08-04-vigo-county-council-sunshine-prosecutor-seized-assets-appropriation
($250k vehicles + $52k investigative leads + $200k equipment — one ask,
one dot). Clothing is $1,500 × 3 officers = $4,500, one dot.

Layout: value maps along `axis`; the perpendicular axis is packing /
jitter so dots do not overlap. Linear scale default. Prefer linear for
the Ledger proof — $4.5k and $502k on one axis is the point. Demo:
eight items, `r = 6`, deterministic y-search so pairwise distance
`>= 13`. Emit 8 `<circle>`s. Labels from `annotations[]` (`callout` /
`peak`); HTML `href` on those marks is a real `<a>`. Dots are 12px
(`r = 6`). Do not size dots by value (no bubbles; ProPublica guidance:
skip bubble maps).

Contract:

```ts
interface BeeswarmItem {
  id: string;
  label: string;
  value: number;
  group?: string;
  color?: string;
  highlight?: boolean;    // payload flag: which items get default peak labels. Not chrome.
}
interface BeeswarmSpec extends CivicBase {
  type: 'beeswarm';
  axis?: 'x' | 'y';       // default 'x' (horizontal value, vertical jitter)
  log?: boolean;          // default false. Only if values span >1000× and the caption says so.
  dotSize?: number;       // default 12, match QuadrantTheme.dotSize
  items: BeeswarmItem[];
}
```

Reject: empty `items`; missing `value`; `< 2` items (use `delta` or
`bar`); non-finite values.

What this is not: `quadrant`. Not Money `dot-plot`. Not a bar of
everything. Not a bubble chart.

## 6. `connected-dot` — two dots per row, connector = gap

Dumbbell / arrow-plot folded into this type. Two dots per **row** on a
shared quantitative axis; the connector length is the gap. Slope (Money)
is two-**column** before/after across items (Clinton Road, clerk
scanning, Make My Move on one graphic). This is paired measures on each
row: jobs promised vs reported.

Same entities as the scorecard, different encoding. Scorecard = roster +
kept/missed status. Connected-dot = the numeric gap.

Shared domain is the nonzero values (here `2..152`). CHI 130→54 red
connector length = `|x(54) − x(130)|`. Govina 152→62 color `#6B7280`
(restatement, not a shortfall). Miller `from: 0` TBD: **no connector**,
only the `to: 2` dot + `n/a`.

YAML:

```yaml
type: connected-dot
title: "Jobs promised vs reported"
unit: count
caption: "CHI Overhead Doors reported 54 of 130 promised jobs; Govina's 152 was a W-2 count, the actual average is 62."
source:
  label: "City council, Jul 9"
  href: "https://vigoledger.org/h/2026-07-09-terre-haute-city-council-chi-overhead-doors-abatement"
alt: "Three rows: CHI 130 to 54, Govina 152 W-2s to 62 average, Miller-Parrott promised jobs not stated to 2 observed."

rows:
  - id: chi
    label: "CHI Overhead Doors"
    from: { label: "Promised", value: 130 }
    to:   { label: "Reported", value: 54 }
  - id: govina
    label: "Govina Inc."
    from: { label: "CF-1 (every W-2)", value: 152 }
    to:   { label: "Actual average", value: 62 }
    color: "#6B7280"      # restatement, not a shortfall — override the default red
  - id: miller-parrott
    label: "Miller-Parrott Lofts"
    from: { label: "Promised (not stated)", value: 0 }  # TBD; no fake gap
    to:   { label: "Observed", value: 2 }
```

Contract:

```ts
interface ConnectedDotBound {
  label?: string;
  value: number;          // 0 = unknown/TBD
}
interface ConnectedDotRow {
  id: string;
  label: string;
  from: ConnectedDotBound;
  to: ConnectedDotBound;
  color?: string;         // connector + dots override
}
interface ConnectedDotSpec extends CivicBase {
  type: 'connected-dot';
  rows: ConnectedDotRow[];
}
```

Layout: one row per entity; shared quantitative axis across rows; 12px
dots; a connector whose length is `|to − from|` in value, and
`|x(to) − x(from)|` in pixels. Signed gap. Default connector color
matches waterfall: shortfall (`to < from`) red, surplus (`to > from`)
green. Override per row when the gap is a restatement (Govina) not a
miss. A `from.value === 0` TBD endpoint draws `n/a` (no connector), so
Miller-Parrott does not imply a promise of zero jobs. Do not size dots
by value.

Reject: empty `rows`; missing `from` / `to`; missing `value` on either
bound; duplicate ids.

What this is not: Money `slope`. Not a scorecard. Not a bubble.

## 7. `data-table` — sorted table, optional cell encodings

Meeting records **are** lists. The table is the graphic when ranking and
lookup both matter. Mini-bar / heat / sparkline are **cell encodings**
that call into Money `bar` (as a 1-row bar), a color scale, and Time
`sparkline`. They are not Composition-owned renderers. Spec `encode` as
a flag; the renderer delegates. Demo `encode: bar` cell = a `<rect>`
whose width is `amount / max * 120`. Caption that it is a cell
encoding; Money owns bar.

Accessible by default: visual encodings are additive; the table remains
a table. That also satisfies VIZ-41 — but `data-table` is a first-class
type, not only a fallback. See the collision in Shared civic chrome:
CivicBase field `dataTable` vs this type. HTML table is the native
output; SVG/PNG is a drawn table for PPTX/PNG. Do not pretend PNG is
the primary.

This week's proofs: (a) appropriations list, sorted, with mini-bars;
(b) budget lines held as department + status (text).

YAML (a):

```yaml
type: data-table
title: "This week's appropriations"
unit: usd
caption: "Building-maintenance emergencies are the largest add in this edition, at $520,000."
source:
  label: "Vol. I No. 1, week of Aug 28"
  href: "https://vigoledger.org/"
alt: "Appropriations: buildings $520,000, traffic study $469,000, rescue truck $225,000, plow $100,000, warming center $47,500, Susie's Place $45,000."
sort:
  column: amount
  direction: desc

columns:
  - id: item
    label: "Item"
    encode: text
  - id: body
    label: "Body"
    encode: text
  - id: amount
    label: "Amount"
    unit: usd
    encode: bar          # 1-row Money bar at cell scale

rows:
  - item: "Building emergencies"
    body: "Budget committee"
    amount: 520000
  - item: "Traffic study"
    body: "Commissioners"
    amount: 469000
  - item: "Rescue truck"
    body: "City Council"
    amount: 225000
  - item: "Plow"
    body: "City Council"
    amount: 100000
  - item: "Warming center"
    body: "City Council"
    amount: 47500
  - item: "Susie's Place"
    body: "City Council"
    amount: 45000
```

(b) budget lines held: columns `department` (text) + `status` (text,
value `"Held"`). No mini-bar required. Same five rows as the
small-multiples proof.

`encode: heat` maps a numeric cell to background intensity (color scale
from theme; legend imported from EP). `encode: sparkline` requires the
cell value to be `number[]`; Time owns the sparkline.

Contract:

```ts
type DataTableEncode = 'text' | 'bar' | 'heat' | 'sparkline';
type DataTableCell = string | number | number[];  // number[] only for sparkline

interface DataTableColumn {
  id: string;
  label: string;
  unit?: Unit | UnitFormat | null;
  encode?: DataTableEncode;  // default 'text'
}
interface DataTableSpec extends CivicBase {
  type: 'data-table';
  columns: DataTableColumn[];
  rows: Array<Record<string, DataTableCell>>;  // payload records. Not dataTable.records.
  sort?: { column: string; direction: 'asc' | 'desc' };
}
```

Layout: HTML `<table>` first (semantic rows/cols, sortable by the
authored `sort` as initial order). Mini-bars share a domain across the
column. Heat uses one scale per column. Sparkline cells are tiny Time
charts, not Composition sparklines. PNG/SVG/PPTX draw the same table.

Reject: empty `columns`; empty `rows`; unknown column id in `sort`;
`encode: sparkline` on a non-array cell; `encode: bar` or `heat` on a
non-number cell; row keys that are not column ids (warn, ignore extras).

What this is not: a heatmap-table of members × votes (Power). Not a
forked bar renderer.

## 8. `category-mix` — Ledger tag vocabulary; Money renders

Not a renderer. Ledger exclusive data-kind tags on the 78 highlights:

`MONEY` | `RULES` | `PROPERTY` | `DEFERRAL` | `FRICTION`

Edition totals (Vol. I No. 1): money 38, deferral 14, property 13,
rules 7, friction 6. Total 78.

**`FLAGGED` is not a sixth kind.** TYPES.md listed it as a tag; the
site treats it as `data-confidence = flagged` overlay: 23 of 78. Do not
stack it. Encode flagged as a stroke / badge / hatch (EP annotation or
a caption: "23 of 78 highlights this edition are flagged unverified").
Category-mix stacks only the five exclusive kinds.

Time grain: month, Mar–Aug 2026 of this volume.

Money owns `stacked-bar` (and `stacked-area` if months are treated as a
continuous series). Field names for stacked-bar are Money's; the YAML
below is the Ledger payload, not a competing contract. Shape from
`money-family-spec.md`: `categories: string[]`, `series: { id, label,
values }[]` with `values[i]` aligned to `categories[i]`. Chrome says
stacked-bar requires legend — this YAML already has legend items. Keep.
Do not fork stacked-bar.

Optional parse alias: `type: category-mix` is accepted by `parse.ts` and
**rewritten to** `type: stacked-bar`. Validate as `StackedBarSpec`
after rewrite. Not a `CategoryMixSpec` renderer. No
`src/diagrams/category-mix/`. Demo of this payload: HTML table of
month × kind **real counts**. Note "Money stacked-bar. Alias
category-mix. FLAGGED is overlay 23/78, not a stack." **No stacked-bar
SVG** in the Composition demo.

YAML (Money payload, real monthly counts):

```yaml
type: stacked-bar          # alias: type: category-mix (parse rewrite)
title: "Highlights by kind, Mar–Aug"
unit: count
caption: "August carried 43 of this edition's 78 highlights; 26 of those 43 are MONEY. 23 of 78 are flagged unverified — that badge is not a sixth stack."
source:
  label: "Vol. I No. 1 edition index"
  href: "https://vigoledger.org/"
legend:
  - label: "MONEY"
  - label: "RULES"
  - label: "PROPERTY"
  - label: "DEFERRAL"
  - label: "FRICTION"
alt: "Stacked bars of highlight counts by month and kind, March through August 2026."
dataTable:
  columns: ["Month", "MONEY", "RULES", "PROPERTY", "DEFERRAL", "FRICTION"]
  records:
    - ["Mar", 1, 2, 2, 2, 1]
    - ["Apr", 3, 1, 2, 1, 1]
    - ["May", 1, 1, 1, 0, 1]
    - ["Jun", 1, 1, 1, 1, 1]
    - ["Jul", 6, 0, 1, 1, 2]
    - ["Aug", 26, 2, 6, 9, 0]

categories: ["Mar", "Apr", "May", "Jun", "Jul", "Aug"]
series:
  - id: money
    label: "MONEY"
    values: [1, 3, 1, 1, 6, 26]
  - id: rules
    label: "RULES"
    values: [2, 1, 1, 1, 0, 2]
  - id: property
    label: "PROPERTY"
    values: [2, 2, 1, 1, 1, 6]
  - id: deferral
    label: "DEFERRAL"
    values: [2, 1, 0, 1, 1, 9]
  - id: friction
    label: "FRICTION"
    values: [1, 1, 1, 1, 2, 0]
```

Month × kind (do not invent a different mix):

| Month | MONEY | RULES | PROPERTY | DEFERRAL | FRICTION | n |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-03 | 1 | 2 | 2 | 2 | 1 | 8 |
| 2026-04 | 3 | 1 | 2 | 1 | 1 | 8 |
| 2026-05 | 1 | 1 | 1 | 0 | 1 | 4 |
| 2026-06 | 1 | 1 | 1 | 1 | 1 | 5 |
| 2026-07 | 6 | 0 | 1 | 1 | 2 | 10 |
| 2026-08 | 26 | 2 | 6 | 9 | 0 | 43 |

Tag id union (vocabulary only):

```ts
type LedgerKindId = 'money' | 'rules' | 'property' | 'deferral' | 'friction';
type LedgerConfidence = 'flagged';  // overlay, not a stack
```

What this is not: a Composition `stacked-bar`. Not a sixth FLAGGED
series.

## 9. `per-body-count` — highlights by governing body; Money renders

Not a renderer. This is a `bar`: one series, ranked counts of highlights
per body. Optional parse alias `type: per-body-count` → `type: bar`.
Validate as `BarSpec` after rewrite. No `PerBodyCountSpec`. No
`src/diagrams/per-body-count/`. Demo: HTML table 43 / 16 / 10 / 8 / 1.
Note "Money bar. Alias per-body-count." **No bar chart.**

Bodies in this week's proof (from highlight slugs, n = 78): City
Council 43, budget committee 16, Commissioners 10, County Council 8,
BZA 1. Org list also has BPW, APC, Redevelopment — omit them; this
edition's proof is the five.

YAML (Money payload):

```yaml
type: bar                  # alias: type: per-body-count (parse rewrite)
title: "Highlights by body"
unit: count
sort: desc
orientation: horizontal
caption: "City Council accounts for 43 of this edition's 78 highlights; the Board of Zoning Appeals accounts for one."
source:
  label: "Vol. I No. 1 edition index"
  href: "https://vigoledger.org/"
alt: "Bar chart of highlights: City Council 43, budget committee 16, Commissioners 10, County Council 8, BZA 1."

items:
  - id: city-council
    label: "City Council"
    value: 43
  - id: budget-committee
    label: "budget committee"
    value: 16
  - id: commissioners
    label: "Commissioners"
    value: 10
  - id: county-council
    label: "County Council"
    value: 8
  - id: bza
    label: "BZA"
    value: 1
```

Field names for `bar` are Money's (`BarItem` / `BarSpec` in
`money-family-spec.md`). Do not fork a bar.

## Owned vs imported

| Field / type | Owner | Composition does |
| --- | --- | --- |
| `CivicBase` / `DiagramChrome` (`caption`, `source`, `legend`, `stat`/`stats`, `annotations`, `unit`, `alt`, `dataTable`, `footnote`, `civic:` on `icon`) | Editorial Primitives ([00-editorial-chrome.md](./00-editorial-chrome.md)) | **extend** `CivicBase`. Do not re-declare. Do not fork. |
| `legend` required on waffle (and choropleth, zoning, stacked-bar) | Editorial Primitives (chrome rule) | enforce on waffle; `legend: true` or explicit items, never `false` |
| `dataTable` **field** (fallback: `columns` + `records`) | Editorial Primitives | required to publish on waffle; visually-hidden table in HTML |
| `type: 'data-table'` (payload `columns` / `rows`) | Composition Viz | first-class meeting-record table. Different from the field. Do not rename either. |
| bar, stacked-bar, stacked-area, delta | Money Viz | reference from small-multiples / category-mix / per-body-count; do not fork |
| sparkline | Time Viz | reference from small-multiples panels and data-table cells |
| waffle, isotype, small-multiples, scorecard, beeswarm, connected-dot, data-table | Composition Viz | own renderer |
| category-mix, per-body-count | Composition Viz (vocabulary + optional parse alias) | Money renders |
| quadrant | existing library | do not use as comparison |
| flow groups / `rows` as group grid | existing library | do not bolt composition onto groups; do not use `rows` as a fallback table |

## Done when

- All seven owned types round-trip YAML → PNG/SVG/HTML/PPTX like gantt
  does, via `src/diagrams/<type>/{layout,tree,pptx}.ts`.
- `DiagramType` / `AnyDiagramSpec` include the seven; `ThemeConfig` has
  the seven optional keys. Every spec `extends CivicBase`.
- `parse.ts` rewrites `category-mix` → `stacked-bar` and
  `per-body-count` → `bar`; validate sees only Money types after rewrite.
- `unit: usd` / `count` formats through the chrome formatter (`$4.5k`,
  `$502k`, `84`). Authors never pre-format strings. Scorecard /
  connected-dot TBD `0` displays `n/a`.
- `caption`, `source`, `legend`, `alt`, `dataTable` (on waffle) render
  under the figure (`source.href` is a real `<a>` in HTML). Legend
  shape stays EP's. Waffle `legend` is present and not `false`.
- Civic-icon slugs: isotype uses locked `civic:bed`, `civic:camera`
  (Flock; officer cam is `civic:body-camera`), `civic:demolition` (not
  `civic:demo`), `civic:lot`. Conservancy parcels use `civic:parcel`
  (map parcel); `civic:housing` is a house. Files at
  `icons/civic/<slug>.svg`. These slugs never waffle-square. Other
  missing slugs still warn + square.
- Beeswarm marks use CivicBase `annotations[]` (`kind: callout | peak`).
  No Composition `callouts` field.
- The YAML examples in this spec render without hand-tweaking once the
  types exist (`examples/ledger-*.yaml`).
- Validate rejects the per-type cases above, plus: unknown `type` (that
  is not a documented alias); `source` without `label`; `unit` other
  than `usd | percent | count`; waffle/isotype non-integers; empty
  collections; unknown ids (`sort.column`, panel inner specs).
- Skill doc names these types. It currently pretends only `flow` exists.
- Money's "two deltas side by side later via small-multiples" is
  un-parked: Composition lays out the grid; Money still renders each
  delta.

## Out of scope

- Pie / donut — Process owns `donut` (VIZ-56). Waffle is the unit grid.
- Treemap — Money. Waffle cells are equal; they do not size by value.
- Quadrant-as-comparison — existing 2×2 scatter, fixed 12px dots, no
  size-by-value. Beeswarm and connected-dot are the comparison charts.
- Bubble charts / size-by-value dots — ProPublica guidance: skip.
  Beeswarm and connected-dot dots stay 12px.
- A forked `bar`, `stacked-bar`, `stacked-area`, or `delta` renderer, or
  a second `BarSpec`. Category-mix and per-body-count are aliases.
- `CategoryMixSpec` / `PerBodyCountSpec` with their own
  `layout` / `tree` / `pptx`.
- Inventing civic-icons glyphs as shipped, `geist:` icons, `gov:`
  icons, or `aws:lambda`. Pack belongs to Editorial Primitives.
- Scoring elected officials. Scorecard scores agreements / abatements.
- A sixth FLAGGED stack on category-mix.
- Bolting any of this onto `flow` groups.
- Forked chrome names: `dek`, `kicker`, `credit`, `kpi`, `bigNumber`,
  `callouts`, `altText`, `sources`, `key`, `swatches`.
