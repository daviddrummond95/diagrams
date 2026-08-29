# diagrams.sh Civic Chrome Contract

**Owner:** Editorial Primitives
**Consumers:** Money, Place, Process, Time, Composition, Diagrams
**Library:** `@agent-clis/diagrams` v0.2.0 (`src/types.ts`)
**Status:** LOCKED field names. Specs only. Do not implement.
**First customer:** The Vigo Ledger (every published sentence already links to meeting tape or a source document)

This is the shared newspaper chrome. Every family spec extends `CivicBase`. You import these names. You do not fork them (`kpi`, `bigNumber`, `callouts`, `rows` as a table, `credit`, `altText`, `dek`, `gov:` icons are all rejects).

Match existing ThemeConfig style: camelCase fields, nested objects, hex color strings + numbers, almost everything optional, kebab-case for theme registry keys and icon slugs, no CSS variables.

---

## 0. What already exists (do not collide)

From `src/types.ts` v0.2.0:

```ts
export type AnyDiagramSpec = DiagramSpec | GanttSpec | TimelineSpec | QuadrantSpec;

// Shared today on every spec:
title?: string;
theme?: string | ThemeConfig;
type?: DiagramType; // 'flow' | 'gantt' | 'timeline' | 'quadrant'
```

| Existing name | Meaning | Chrome rule |
|---|---|---|
| `title` | 18px/600 overlay hed | Keep. Caption is the dek under it. Never rename title. |
| `theme` | name or full ThemeConfig | Keep. Chrome is not a theme token. |
| `type` | discriminator | Keep. Chrome adds one literal: `'stat'`. |
| `description` | node/event secondary line | Keep. Not alt text. Not caption. |
| `rows` | flow **group layout grid** | Never a data table. Table fallback is `dataTable`. |
| `label` | node/edge/group/task text | Keep. Legend/source use `label` *inside* their objects, not at spec root. |
| `icon` | existing resolver (`aws:`, `gcp:`, `geist:`, `favicon:`, emoji) | Keep. Civic icons are a new prefix on this same field: `civic:fire`. |
| `legend` (planned C4 #11, `legend: true`) | not shipped | Occupied here. Boolean `true` means auto-from-series (that is #11). |

`high-contrast` and `high-contrast-light` are visual palettes, not accessibility. A11y is `alt` + `dataTable` (+ real `<a>` in HTML). Issue #24 (`--alt-text` sidecar) maps to `alt`.

HTML export is a **static Satori tree** serialized to `<div>`s (plus one inline SVG for edges). Not interactive. PNG/SVG raster from the same tree: no clickable links. Chrome `href` therefore has two renderings (section 8).

---

## 1. Shape: DiagramChrome + CivicBase

`DiagramChrome` is the newspaper fields. `CivicBase` is what every spec extends (chrome + the two shared fields that already exist). Family types keep their own `type` literal and payload (`nodes`, `tasks`, `events`, `items`, and future `links` / `steps` / `slices`).

```ts
import type { ThemeConfig } from './types';

/** Newspaper chrome. Field names are locked. */
export interface DiagramChrome {
  caption?: string;
  source?: SourceRef | SourceRef[];
  legend?: Legend; // true = auto, false = suppress, array/spec = explicit
  stat?: StatSpec;
  stats?: StatSpec[];
  annotations?: Annotation[];
  unit?: Unit | UnitFormat;
  alt?: string;
  dataTable?: DataTable;
  footnote?: string;
}

/**
 * Extend target for every diagram spec.
 * Existing DiagramSpec / GanttSpec / TimelineSpec / QuadrantSpec
 * (and every family spec) extend CivicBase.
 */
export interface CivicBase extends DiagramChrome {
  title?: string;
  theme?: string | ThemeConfig;
}

/** Chrome's only diagram type. A hero number, not a new chart renderer. */
export interface StatDiagramSpec extends CivicBase {
  type: 'stat';
  stat: StatSpec; // required when the diagram *is* the number
}

export type AnyDiagramSpec =
  | DiagramSpec
  | GanttSpec
  | TimelineSpec
  | QuadrantSpec
  | StatDiagramSpec;
  // families add sankey, delta, choropleth, waffle, stacked-bar, … each extends CivicBase
```

Conceptual change to v0.2.0 (Diagrams owns the patch, not this agent):

```ts
export interface DiagramSpec extends CivicBase {
  type?: DiagramType;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  direction?: Direction;
  groups?: DiagramGroup[];
  rows?: string[][]; // still the group grid
}
```

Same `extends CivicBase` on GanttSpec, TimelineSpec, QuadrantSpec.

These are **fields** (and one `stat` type). They are not nine new chart renderers.

---

## 2. Caption

One sentence a resident can read without the meeting. Not the hed (`title`). Not a node `description`.

```ts
caption?: string;
```

Rules:

- Optional in the type. **Required to publish** at The Vigo Ledger.
- One sentence. No markdown. No embedded href (put links on `source` or `annotations`).
- Render under `title`, using `theme.node.textColorSecondary` and `theme.node.descriptionFontSize` (or 13px if you need a chrome token later — do not add one now).
- Do not invent `subtitle`, `dek`, `kicker`, `standfirst`, `hed`.

---

## 3. Source

Footer credit. Vigo pattern: `"County council, Aug 12"` + tape URL.

```ts
export interface SourceRef {
  label: string;
  href?: string;
}

source?: SourceRef | SourceRef[];
```

Rules:

- `label` is human text, never a raw URL.
- `href` is the tape or document URL. Optional in the type. **Required to publish** at Vigo (every published sentence already links).
- One source: an object. Several: an array. Do not add `sources`.
- Do not invent `credit`, `byline`, `citation`, `href` at spec root.
- Render as the last line of chrome except `footnote`. Prefix is not required; if you need a printed word, use `Source:` in the renderer, not in the field name.
- Multiple sources join with ` · ` (middle dot), same voice as the Vigo homepage band.

---

## 4. Legend

Color / size / pattern key. Required for choropleth, zoning, waffle, stacked-bar (family types; validation lives with those families, rule lives here).

```ts
export type LegendPattern = 'solid' | 'hatch' | 'dots' | 'stripes';
export type LegendPlacement = 'bottom' | 'right' | 'top';

export interface LegendItem {
  label: string;
  color?: string;          // hex, ThemeConfig convention
  pattern?: LegendPattern; // default 'solid'
  size?: 'sm' | 'md' | 'lg' | number;
  icon?: string;           // civic:fire, aws:…, emoji
}

export interface LegendSpec {
  items?: LegendItem[];
  auto?: boolean;
  placement?: LegendPlacement; // default 'bottom'
  title?: string;              // heading inside the key, not diagram title
}

/**
 * true      → auto from series / color scale (covers planned C4 `legend: true`)
 * false     → suppress, even if the type would auto
 * LegendItem[] → explicit items, placement default
 * LegendSpec   → full control
 */
export type Legend = boolean | LegendItem[] | LegendSpec;
```

Rules:

- Locked name is `legend`. Not `key`, `swatches`, `legendItems`.
- Choropleth, zoning, waffle, stacked-bar: `legend` must be present and not `false`, and must resolve to at least one item (explicit or auto). Other types: optional.
- `legend: true` and `{ auto: true }` are the same. Families that can derive swatches from series should prefer `true` over copy-pasted hex.
- Item `color` is a hex string, matching ThemeConfig (`background`, not `backgroundColor`).

---

## 5. Stat / big-number

Hero number + unit + comparator. Homepage KPI band wants this. Locked names: `stat` (one), `stats` (band), `type: 'stat'` (diagram that is the number). Not `kpi`, `bigNumber`, `hero`, `big-number`.

```ts
export interface Comparator {
  value: number;
  unit?: Unit | UnitFormat; // default: parent stat.unit
  label?: string;           // "from the proposed $3M", "vs FY2025"
  direction?: 'up' | 'down' | 'flat'; // omit to derive from value vs stat.value
}

export interface StatSpec {
  value?: number;
  unit?: Unit | UnitFormat;
  label?: string;
  comparator?: Comparator;
  display?: string;  // rare override when the formatter must not run ("AI-assisted")
  href?: string;
  icon?: string;     // civic:courthouse
}
```

### 5.1 Field vs type vs band

| Use | How |
|---|---|
| One hero number on a chart | `stat:` on any CivicBase spec |
| KPI band (homepage: several chips) | `stats:` array. Ignore `stat` if both are set (`stats` wins). |
| The diagram *is* the number | `type: 'stat'` with required `stat` |
| Non-numeric chip ("editor-checked") | `display` + `label`, omit `value` |

Vigo homepage band as chrome, not as a new renderer:

```yaml
type: stat
theme: ink
stats:
  - { value: 6, unit: count, label: months indexed, display: "6 months indexed" }
  - { value: 78, unit: count, label: highlights }
  - { display: "AI-assisted · editor-checked", label: process }
  - { display: "no corrections", label: corrections }
caption: The Ledger has six months of indexed meetings, 78 highlights, and no corrections on file.
alt: Vigo Ledger coverage band — 6 months indexed, 78 highlights, AI-assisted and editor-checked, no corrections.
```

`display` is an escape hatch. Families pass **numbers** and `unit`. They do not hand-build `"$469k"`.

When `type: 'stat'` and only one number, `stat` is required; `stats` is also allowed (the band *is* the plot).

---

## 6. Annotations (callout merged here)

Callout ($3M→$500k), peak labels, and shaded ranges are one list. **There is no `callouts` field.** Money Viz points at a moment with `kind: 'callout'`. Composition / Time use `peak` and `range`. Pick this name and stop.

```ts
export type AnnotationKind = 'callout' | 'peak' | 'range' | 'label';

export interface AnnotationAnchor {
  series?: string;
  index?: number;
  x?: string | number; // category, ISO date, or quantitative
  y?: number;
}

export interface Annotation {
  kind: AnnotationKind;
  text?: string;
  at?: AnnotationAnchor;   // callout, peak, label
  from?: AnnotationAnchor; // range start
  to?: AnnotationAnchor;   // range end
  href?: string;           // Vigo tape deep-link on the mark itself
  tone?: 'neutral' | 'up' | 'down' | 'alert';
}
```

| kind | What | Required anchors |
|---|---|---|
| `callout` | Annotated highlight with a leader. The $3M→$500k moment. | `at` |
| `peak` | Label a max/min. `text` optional; default is the formatted value. | `at` |
| `range` | Shaded band (date span, budget window). | `from`, `to` |
| `label` | In-chart text, no leader. | `at` |

`tone` maps to color via the active theme (`node.textColor` / a down-alert red). Do not pass ad-hoc hex on Annotation; keep hex on `legend` items and ThemeConfig.

---

## 7. Unit formatter

Money Viz uses this. Place and Process do not invent `$` strings. Chrome owns the contract. Series and axes import `unit`. A diagram-wide default lives on CivicBase.

```ts
export type Unit = 'usd' | 'percent' | 'count';

export interface UnitFormat {
  unit: Unit;
  compact?: boolean;     // default true for usd and count, false for percent
  digits?: number;       // max fraction digits. default 1 when compact, 0 otherwise
  sign?: 'auto' | 'never' | 'always';
  scale?: 'ratio' | 'points'; // percent only. default 'points' (10 → "10%")
}

unit?: Unit | UnitFormat;
```

### Function contract (implement later; this is the signature)

```ts
declare function formatValue(
  value: number,
  spec: Unit | UnitFormat | undefined,
): string;
```

### Locked output (examples are normative)

| unit | value | notes | output |
|---|---|---|---|
| usd | 469 | compact | `$469` |
| usd | 469000 | compact | `$469k` |
| usd | 500000 | compact | `$500k` |
| usd | 1200000 | compact | `$1.2M` |
| usd | 3000000 | compact | `$3M` |
| usd | 0 | | `$0` |
| usd | -500000 | ASCII hyphen (Satori/Inter) | `-$500k` |
| usd | 469000 | compact: false | `$469,000` |
| percent | 10 | points (default) | `10%` |
| percent | 10.4 | default digits 0 | `10%` |
| percent | 10.4 | digits: 1 | `10.4%` |
| percent | 0.10 | scale: 'ratio' | `10%` |
| count | 78 | | `78` |
| count | 1247 | compact | `1.2k` |
| count | 1000000 | compact | `1M` |

Rules:

- USD only. `$` prefix, no `US$`, no other currencies in v1. Do not add `eur` / `gbp` to `Unit`.
- Compact thresholds: `k` < 1e6 ≤ `M` < 1e9 ≤ `B`. Letter: lowercase `k`, uppercase `M`/`B`. Never `K`, `m`, `bn`.
- No space: `$469k`, `10%`, `1.2k`.
- Strip trailing zeros after the decimal (`$3M` not `$3.0M`).
- Thousands separators only when `compact: false` (en-US commas).
- Percent default is **points** (the civic CSV already says `10` for ten percent). Set `scale: 'ratio'` only when the number is in 0–1.
- Families pass numbers in data. Formatted strings belong in `display` (stat) or `text` (annotation), nowhere else.
- `unit` on CivicBase is the default for every numeric label on that diagram (axis ticks, sankey node values, delta, stat). A series-level `unit` overrides. Do not format in the family spec.

---

## 8. HTML vs PNG (href)

Satori tree has no `<a>`. Current HTML serializer copies leftover props onto `<div>`s, so a naive `href` would land on a div. Chrome requires a **post-Satori HTML pass** that emits real `<a href>`. PNG/SVG raster cannot click.

| Surface | `href` on `source`, `stat`, `annotations` |
|---|---|
| **HTML** | Real `<a href="…">` around the label. Underlined. `rel` not required (static file). |
| **PNG / SVG raster** | Label rendered with `textDecoration: 'underline'`. **Do not print the URL** on the canvas. URL lives in `href` for HTML and in `alt` / `footnote` if a print archive needs it. |
| **PPTX** | Same as PNG (underlined label). Put the URL in the speaker-notes equivalent only if Diagrams adds notes later; not in the slide chrome. |

`caption` has no href. `footnote` is plain text (may contain a URL if the author writes one; renderer does not autolink on PNG).

`title` is unchanged (`showTitle` still applies). Chrome fields have no `showCaption` flags in RenderOptions; omit the field to hide it.

---

## 9. Alt / data-table fallback

Accessible equivalent of the picture. `high-contrast` does not count.

```ts
alt?: string;

export interface DataTable {
  columns: string[];
  records: Array<Array<string | number | null>>;
  summary?: string; // extra prose. Not named caption (that is the diagram dek).
}

dataTable?: DataTable;
```

Rules:

- `alt`: one paragraph, the text equivalent of the *graphic*. Not a dump of the caption (caption is the dek; alt describes what the marks show). Optional in the type. **Required to publish** at Vigo. Maps to SVG `<desc>`, HTML `aria-describedby` / visually-hidden paragraph, PNG sidecar (`--alt-text` in issue #24), and markdown `![alt]()`.
- SVG `<title>` still comes from `title` (existing). Do not put caption in `<title>`.
- `dataTable`: structured fallback. **Never `rows`** (`rows` is the flow group grid). Never `data`, `table`, `fallback`.
- Values in `records` stay raw numbers. The HTML table renderer runs `formatValue` using diagram `unit` (or per-column later; v1 is diagram-wide).
- **Required to publish** when the type is numeric comparison or area-encoding: choropleth, waffle, stacked-bar, grouped-bar, sankey, delta, treemap. Optional for locator maps whose `alt` already names the one highlighted place.
- HTML: visually-hidden `<table>` (or a `<table>` under the figure for no-JS readers). PNG: `alt` only; the table is in the YAML for the CMS to render beside the figure.
- Do not put ARIA in ThemeConfig. Do not treat `high-contrast` as this.

---

## 10. Civic icons

Existing resolver (`src/icons.ts`): `aws:`, `gcp:`, `geist:`, `favicon:`, simple-icons slug, emoji. Civic is one more prefix. Icon **files can come later**. Slug scheme is locked now so Place / Process / Composition do not invent `gov:` or Lucide names.

### Scheme

```
civic:<kebab-singular>
```

Same colon-prefix pattern as `aws:lambda`. Local-government English. Not cloud inventory. Not Lucide. Not Maki.

Exceptions that stay plural because the brief named them: `civic:roads`.

### Starter set (must ship)

| slug | Use |
|---|---|
| `civic:courthouse` | county building, courts, clerk |
| `civic:sheriff` | sheriff, jail ops when not using civic:jail |
| `civic:roads` | highway, street, county highway garage |
| `civic:fire` | fire district, volunteer fire |
| `civic:school` | school corp, board of education |
| `civic:housing` | housing authority, house-as-unit |

### Isotype units (Composition — locked, not waffle fallback)

| slug | Use |
|---|---|
| `civic:bed` | shelter bed, unit of housing-as-bed |
| `civic:camera` | license-plate / Flock camera |
| `civic:demolition` | house taken down |
| `civic:lot` | vacant lot / parcel-as-lot (`civic:housing` is a house, not a lot) |

Do not invent `civic:cameras`, `civic:beds`, `civic:demo`, `civic:parcel-lot`. `civic:parcel` is the map-parcel mark (separate). `civic:body-camera` is the officer cam, not the street camera.

### Pack (locked names; files in `icons/civic/<slug>.svg`)

Bodies: `civic:courthouse`, `civic:city-hall`, `civic:council`, `civic:commissioners`, `civic:mayor`, `civic:clerk`, `civic:auditor`, `civic:treasurer`, `civic:assessor`, `civic:recorder`, `civic:committee`

Safety: `civic:sheriff`, `civic:police`, `civic:fire`, `civic:ems`, `civic:911`, `civic:dispatch`, `civic:jail`, `civic:court`, `civic:judge`, `civic:prosecutor`, `civic:defender`, `civic:probation`, `civic:corrections`, `civic:camera`, `civic:body-camera`, `civic:vehicle`

Works: `civic:roads`, `civic:highway`, `civic:bridge`, `civic:plow`, `civic:traffic`, `civic:garage`, `civic:construction`, `civic:tower`, `civic:sewer`, `civic:stormwater`, `civic:water`, `civic:utilities`, `civic:trash`

Transit: `civic:transit`, `civic:bus`, `civic:bike`, `civic:parking`, `civic:rail`, `civic:airport`

Land: `civic:housing`, `civic:shelter`, `civic:bed`, `civic:lot`, `civic:parcel`, `civic:zoning`, `civic:demolition`, `civic:building`, `civic:duplex`, `civic:historic`, `civic:ada`

Parks: `civic:park`, `civic:trail`, `civic:pool`, `civic:fairgrounds`, `civic:library`, `civic:museum`, `civic:school`, `civic:university`

People: `civic:health`, `civic:hospital`, `civic:clinic`, `civic:child`, `civic:senior`, `civic:disability`, `civic:food`, `civic:animal`

Money: `civic:tax`, `civic:budget`, `civic:bond`, `civic:grant`, `civic:tif`, `civic:levy`, `civic:fee`, `civic:fund`, `civic:abatement`

Process: `civic:gavel`, `civic:agenda`, `civic:ordinance`, `civic:hearing`, `civic:vote`, `civic:ballot`, `civic:election`, `civic:deferral`, `civic:records`

Place-env: `civic:flood`, `civic:tree`, `civic:river`, `civic:conservancy`, `civic:fireworks`

New slugs: kebab, civic sense, propose to Editorial Primitives. Do not add `civic:aws-*`. Do not reuse `geist:` for a courthouse. Composition does not waffle-square these four.

Usage: the existing `icon` field.

```yaml
icon: civic:fire
```

Future files: `icons/civic/<slug>.svg` (no `civic-` in the filename; the prefix is the scheme).

---

## 11. Footnote

Optional line under `source`. Not a fourth kind of caption.

```ts
footnote?: string;
```

Plain text. Print-archive home for a URL you refused to paint on the PNG. Do not invent `notes`, `note`, `disclaimer`.

---

## 12. Vigo Ledger publish rules

The type system stays optional (architecture diagrams still work). A **Vigo publish** check (CMS or CLI flag, not ThemeConfig) requires:

1. `caption` — one sentence, no meeting required.
2. `source` with `href` on every entry.
3. `alt`.
4. `dataTable` for the numeric types in section 9.
5. `legend` resolved for choropleth, zoning, waffle, stacked-bar.
6. Numbers passed as numbers + `unit`, not preformatted money strings.
7. Tape links on `source.href` and on any `annotations[].href` that marks a moment in the meeting.

Homepage KPI band is `type: 'stat'` + `stats` (section 5.1), not four hand-set text nodes.

ADA: the county ADA website deadline was itself a story. `high-contrast` is not the ADA story. `alt` + `dataTable` + real HTML links are.

---

## 13. Layout order (newspaper)

1. `title` (existing overlay; `options.showTitle`)
2. `caption`
3. `stat` / `stats` (if not `type: 'stat'`, sit above the plot; if `type: 'stat'`, they *are* the plot)
4. plot
5. `annotations` (drawn on the plot)
6. `legend` (default `bottom`)
7. `source`
8. `footnote`

Theme tokens: reuse `canvas.background`, `node.textColor`, `node.textColorSecondary`, `node.descriptionFontSize`, `fontFamily` (Inter). Do not add chrome keys to ThemeConfig in this pass.

---

## 14. YAML examples (types we do not own)

Delta and sankey are Money Viz. Shown here only so chrome fields have a home. Payload fields (`from`, `to`, `links`, …) are illustrative.

### 14.1 Hypothetical `delta`

```yaml
type: delta
title: County parks bond, after the cut
caption: The council cut the proposed $3 million parks bond to $500,000 in one vote.
theme: ink
unit: usd
source:
  label: County council, Aug 12
  href: https://vigoledger.example/tape/2026-08-12
stat:
  value: 500000
  unit: usd
  label: Adopted
  comparator:
    value: 3000000
    label: from the proposed $3M
    direction: down
  href: https://vigoledger.example/tape/2026-08-12#t=1h12m
annotations:
  - kind: callout
    text: "$3M → $500k"
    at: { x: amendment-4 }
    href: https://vigoledger.example/tape/2026-08-12#t=1h12m
    tone: down
legend: false
alt: Parks bond proposal dropped from $3 million to $500,000 at the August 12 county council meeting.
dataTable:
  columns: [Stage, Amount]
  records:
    - [Proposed, 3000000]
    - [Adopted, 500000]
footnote: Figures from the adopted amendment, not the original agenda packet.
# --- Money Viz payload (not ours) ---
from: 3000000
to: 500000
```

PNG: callout text and the source label render underlined (they have `href`). The tape URL does not appear on the pixels. HTML: those labels are `<a href>`.

### 14.2 Hypothetical `sankey`

```yaml
type: sankey
title: Where the public-safety dollar goes
caption: Seventy cents of every public-safety dollar leaves the courthouse for the sheriff and the volunteer fire districts.
theme: corporate
unit: usd
source:
  - label: FY2026 adopted budget
    href: https://vigoledger.example/docs/fy2026-budget
  - label: County council, Aug 12
    href: https://vigoledger.example/tape/2026-08-12
legend:
  - label: Sheriff
    color: "#1f4e79"
    icon: civic:sheriff
  - label: Fire districts
    color: "#b42318"
    icon: civic:fire
  - label: Courthouse
    color: "#5c5c5c"
    icon: civic:courthouse
alt: Of each public-safety dollar, seventy cents flow from the courthouse to the sheriff and volunteer fire districts in the FY2026 adopted budget.
dataTable:
  columns: [From, To, Amount]
  records:
    - [Courthouse, Sheriff, 4200000]
    - [Courthouse, Fire districts, 1800000]
    - [Courthouse, Remaining, 2600000]
# --- Money Viz payload (not ours) ---
links:
  - { from: Courthouse, to: Sheriff, value: 4200000, icon: civic:sheriff }
  - { from: Courthouse, to: Fire districts, value: 1800000, icon: civic:fire }
  - { from: Courthouse, to: Remaining, value: 2600000, icon: civic:courthouse }
```

Stacked-bar / choropleth / waffle / zoning must look like this for `legend` (explicit items or `legend: true`), plus `caption`, `source`, `alt`, `dataTable`.

---

## 15. Locked field-name table (copy exactly)

Other agents paste this. Do not alias.

| Locked name | Kind | Type | Forbidden aliases |
|---|---|---|---|
| `caption` | field | `string` | dek, subtitle, kicker, standfirst, hed, lede |
| `source` | field | `SourceRef \| SourceRef[]` | sources, credit, byline, citation, href (root) |
| `source.label` | field | `string` | text, name, title |
| `source.href` | field | `string` | url, link, tape, src |
| `legend` | field | `boolean \| LegendItem[] \| LegendSpec` | key, swatches, legendItems, legend: as string |
| `legend.items[]` | field | `LegendItem` | entries, swatches |
| `stat` | field | `StatSpec` | bigNumber, kpi, hero, big-number, value (root) |
| `stats` | field | `StatSpec[]` | kpis, band, chips |
| `stat.value` | field | `number` | amount, n |
| `stat.unit` | field | `Unit \| UnitFormat` | currency, format |
| `stat.comparator` | field | `Comparator` | vs, delta, change |
| `stat.display` | field | `string` | text, formatted |
| `annotations` | field | `Annotation[]` | callouts, labels, highlights, bands, marks |
| `annotations[].kind` | enum | `callout \| peak \| range \| label` | type (on the annotation object) |
| `alt` | field | `string` | altText, ariaLabel, aria-label, description |
| `dataTable` | field | `DataTable` | rows, table, data, fallback, csv |
| `dataTable.columns` | field | `string[]` | headers, fields |
| `dataTable.records` | field | `(string\|number\|null)[][]` | rows, data |
| `dataTable.summary` | field | `string` | caption (forbidden here), notes |
| `footnote` | field | `string` | notes, note, disclaimer |
| `unit` | field | `Unit \| UnitFormat` | currency, formatter, format |
| `unit` enum | enum | `usd \| percent \| count` | eur, gbp, integer, number, dollars, pct |
| `type: 'stat'` | diagram type | `StatDiagramSpec` | `'big-number'`, `'kpi'`, `'hero'` |
| `civic:` | icon prefix | `civic:<kebab>` | gov:, muni:, lucide:, tabler:, phosphor: |
| `civic:courthouse` `civic:sheriff` `civic:roads` `civic:fire` `civic:school` `civic:housing` | starter slugs | | synonyms (court, police, highway, fd, education, homes) |

### Locked kinds (not fields)

| Name | Values |
|---|---|
| `AnnotationKind` | `callout`, `peak`, `range`, `label` |
| `Unit` | `usd`, `percent`, `count` |
| `LegendPattern` | `solid`, `hatch`, `dots`, `stripes` |
| `LegendPlacement` | `bottom`, `right`, `top` |
| `Comparator.direction` / `Annotation.tone` | `up`, `down`, `flat` / `neutral`, `up`, `down`, `alert` |

### Do not reuse at spec root

`title`, `theme`, `type`, `description`, `rows`, `label`, `icon`, `style`, `color`, `name`, `groups`, `id`, `direction`, `canvas`, `node`, `edge`, `spacing`, `fontFamily`, `background`, `padding`, `width`, `scale`, `format`, `showTitle`.

---

## 16. TypeScript (full, copy-paste for Diagrams)

```ts
import type { ThemeConfig } from './types';

export type Unit = 'usd' | 'percent' | 'count';

export interface UnitFormat {
  unit: Unit;
  compact?: boolean;
  digits?: number;
  sign?: 'auto' | 'never' | 'always';
  scale?: 'ratio' | 'points';
}

export interface SourceRef {
  label: string;
  href?: string;
}

export type LegendPattern = 'solid' | 'hatch' | 'dots' | 'stripes';
export type LegendPlacement = 'bottom' | 'right' | 'top';

export interface LegendItem {
  label: string;
  color?: string;
  pattern?: LegendPattern;
  size?: 'sm' | 'md' | 'lg' | number;
  icon?: string;
}

export interface LegendSpec {
  items?: LegendItem[];
  auto?: boolean;
  placement?: LegendPlacement;
  title?: string;
}

export type Legend = boolean | LegendItem[] | LegendSpec;

export interface Comparator {
  value: number;
  unit?: Unit | UnitFormat;
  label?: string;
  direction?: 'up' | 'down' | 'flat';
}

export interface StatSpec {
  value?: number;
  unit?: Unit | UnitFormat;
  label?: string;
  comparator?: Comparator;
  display?: string;
  href?: string;
  icon?: string;
}

export type AnnotationKind = 'callout' | 'peak' | 'range' | 'label';

export interface AnnotationAnchor {
  series?: string;
  index?: number;
  x?: string | number;
  y?: number;
}

export interface Annotation {
  kind: AnnotationKind;
  text?: string;
  at?: AnnotationAnchor;
  from?: AnnotationAnchor;
  to?: AnnotationAnchor;
  href?: string;
  tone?: 'neutral' | 'up' | 'down' | 'alert';
}

export interface DataTable {
  columns: string[];
  records: Array<Array<string | number | null>>;
  summary?: string;
}

export interface DiagramChrome {
  caption?: string;
  source?: SourceRef | SourceRef[];
  legend?: Legend;
  stat?: StatSpec;
  stats?: StatSpec[];
  annotations?: Annotation[];
  unit?: Unit | UnitFormat;
  alt?: string;
  dataTable?: DataTable;
  footnote?: string;
}

export interface CivicBase extends DiagramChrome {
  title?: string;
  theme?: string | ThemeConfig;
}

export interface StatDiagramSpec extends CivicBase {
  type: 'stat';
  stat: StatSpec;
}

declare function formatValue(
  value: number,
  spec: Unit | UnitFormat | undefined,
): string;

export const CIVIC_ICON_STARTER = [
  'civic:courthouse',
  'civic:sheriff',
  'civic:roads',
  'civic:fire',
  'civic:school',
  'civic:housing',
] as const;

export const CIVIC_ICON_ISOTYPE = [
  'civic:bed',
  'civic:camera',
  'civic:demolition',
  'civic:lot',
] as const;
```

---

## 17. Decisions log (so families do not reopen them)

1. **Callout vs annotation:** merged. Field is `annotations`. Kind `callout` is the $3M→$500k mark.
2. **`legend: true`:** auto-from-series. Occupies C4 issue #11 instead of fighting it.
3. **`rows`:** remains the flow group grid. Table fallback is `dataTable`.
4. **`title` vs `caption`:** hed vs dek. Both live. No `subtitle`.
5. **`stat` + `stats` + `type: 'stat'`:** one interface, three placements. No `kpi`.
6. **`unit`:** `usd | percent | count` only. Compact `$469k` / `$1.2M` / `10%` is normative.
7. **Icons:** `civic:` prefix on existing `icon`. Starter six + isotype four (`bed`, `camera`, `demolition`, `lot`) + the county pack in section 10. Files in `icons/civic/`.
8. **A11y:** `alt` + `dataTable` + HTML `<a>`. `high-contrast` is paint.
9. **PNG href:** underlined label, URL not painted. HTML: real `<a>` via post-Satori pass.
10. **ThemeConfig:** no new chrome keys this pass. Reuse `textColorSecondary`, `descriptionFontSize`, `fontFamily`.

---

## 18. What Diagrams should do next

- Extend `DiagramSpec`, `GanttSpec`, `TimelineSpec`, `QuadrantSpec` with `CivicBase`.
- Add `'stat'` to the discriminator union and `StatDiagramSpec` to `AnyDiagramSpec`.
- Keep this file as the name authority. Family agents (Money, Place, Process, Time, Composition) import section 15 and section 16. They do not add parallel chrome.
- Implementation is yours / the library's. Editorial Primitives does not ship code.

Questions stay with Editorial Primitives if a family wants a new chrome field. New chart types are not chrome.
