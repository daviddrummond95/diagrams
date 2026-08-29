> Canonical family spec (all 15 types + unit formatter): [money-family-spec.md](./money-family-spec.md). This file is the first-slice note (sankey / waterfall / delta only).

# Money types

Three types, one shared contract. All three show up in this week's Ledger.
Ship editorial fields (`caption`, `source`, `unit`) in the same slice; without
them a money chart cannot live on a record that cites the tape.

Extension pattern matches gantt/timeline/quadrant:
`src/types.ts` → `parse.ts` → `validate.ts` → `src/render/index.ts` →
`src/diagrams/{sankey,waterfall,delta}/{layout,tree,pptx}.ts`.

## Shared fields (add to a civic base, not only these types)

```yaml
title: "..."
theme: default          # existing
unit: usd               # usd | percent | count. Formats labels.
caption: "One sentence a resident can read without the meeting."
source:
  label: "County council, Aug 12"
  href: "https://vigoledger.org/..."   # tape or document
```

`unit: usd` renders `469000` as `$469k`, `3000000` as `$3M`, `4500` as `$4,500`.
Never require the YAML author to pre-format strings. Ledger amounts arrive as
integers from the notes.

## 1. `sankey` — money moving between funds

Use when a story is "this dollar left A and landed in B" or "this fund takes
in less than it spends."

This week's proofs:

- 911 fund set to spend more than it takes in next year
- Drug-treatment court may need $250,000 from county general instead of opioid
  settlement money
- State guidance: 0.2% correctional/rehab LIT cannot pay non-facility staff;
  that spending has to come from county general
- State cuts push community-corrections costs onto local taxpayers (~$700k
  supplement, new county-general line)

YAML:

```yaml
type: sankey
title: "911 fund: in vs out next year"
unit: usd
caption: "The county's 911 fund is set to spend more than it takes in."
source:
  label: "County council, Aug 13"
  href: "https://vigoledger.org/"

nodes:
  - id: intake
    label: "911 receipts"
  - id: fund
    label: "911 fund"
  - id: ops
    label: "Dispatch & operations"

links:
  - from: intake
    to: fund
    value: 0          # fill from the note; 0 is valid, means unknown/TBD
  - from: fund
    to: ops
    value: 0
```

Contract:

```ts
interface SankeyNode {
  id: string;
  label: string;
  color?: string;
}
interface SankeyLink {
  from: string;
  to: string;
  value: number;       # required, >= 0. Width encodes value.
  label?: string;
  color?: string;
}
interface SankeySpec {
  type: 'sankey';
  title?: string;
  theme?: string | ThemeConfig;
  unit?: 'usd' | 'percent' | 'count';
  caption?: string;
  source?: { label: string; href?: string };
  nodes: SankeyNode[];
  links: SankeyLink[];
}
```

Layout: left-to-right ranks (source → sink), node height by throughput, link
width by `value`. Unknown/zero values still draw a hairline and a "n/a" so a
Ledger note with an incomplete dollar can publish.

Reject cycles. Allow many-to-one and one-to-many (LIT → general → payroll).

What this is not: a `flow` with thicker edges. `DiagramEdge` has no `value`.

## 2. `waterfall` — a total built from additions and cuts

Use when a story is "the number moved because of these line items."

This week's proofs:

- Jail budget up for vehicles, repairs, and new body cameras
- $520,000 added for a run of building-maintenance emergencies
- Clerk scanning project $9,000 → $109,000 (also a delta; waterfall if we
  have the intervening lines)
- Community corrections: new county-general line + ~$700k supplement

YAML:

```yaml
type: waterfall
title: "Jail budget: what went up"
unit: usd
caption: "Vehicles, repairs, and body cameras are why the jail budget rose."
source:
  label: "County council, Aug 12"
  href: "https://vigoledger.org/"

start:
  label: "Current jail budget"
  value: 0              # fill when the note has a base; 0 = start from zero
steps:
  - id: vehicles
    label: "Vehicles"
    value: 65000
  - id: repairs
    label: "Repairs"
    value: 0            # unnamed remainder in the note
  - id: cameras
    label: "Body cameras"
    value: 0
end:
  label: "Proposed jail budget"
```

Contract:

```ts
interface WaterfallStep {
  id: string;
  label: string;
  value: number;        # signed. Negative is a cut, drawn below the bridge.
  color?: string;       # optional override; default green up / red down
}
interface WaterfallSpec {
  type: 'waterfall';
  title?: string;
  theme?: string | ThemeConfig;
  unit?: 'usd' | 'percent' | 'count';
  caption?: string;
  source?: { label: string; href?: string };
  start?: { label: string; value: number };
  steps: WaterfallStep[];
  end?: { label: string };   # value is computed
}
```

Layout: columns on a baseline, connectors between running totals, end column
is the sum. Signed steps. Connector labels optional.

## 3. `delta` — one number became another

Use when a story is a cut, a jump, or a swap, and we do not have (or need)
the in-between lines.

This week's proofs:

- Clinton Road widening: $3,000,000 → $500,000 (EDIT fund)
- Clerk scanning: $9,000 → $109,000
- Sewer bills on track to rise 10% in 2030, plus a new $3/month stormwater fee
- Make My Move: $87,500 reimbursement, program may be dropped

YAML:

```yaml
type: delta
title: "Clinton Road widening"
unit: usd
caption: "Funding in the EDIT budget dropped from $3 million to $500,000."
source:
  label: "County council, Aug 13"
  href: "https://vigoledger.org/"

from:
  label: "As previously budgeted"
  value: 3000000
to:
  label: "Adopted in the EDIT budget"
  value: 500000
```

Contract:

```ts
interface DeltaSpec {
  type: 'delta';
  title?: string;
  theme?: string | ThemeConfig;
  unit?: 'usd' | 'percent' | 'count';
  caption?: string;
  source?: { label: string; href?: string };
  from: { label: string; value: number };
  to: { label: string; value: number };
}
```

Layout: two big numbers, a signed change (`−$2.5M`, `−83%`), optional slope
between them. Percent change is computed, not authored. This is the type a
mayor can read from the hallway.

A `delta` with `unit: percent` is how the sewer 10% rise renders. Absolute
`$3/month` is a second `delta` (or two deltas side by side later via
small-multiples — parked).

## Done when

- All three types round-trip YAML → PNG/SVG/HTML/PPTX like gantt does.
- `unit: usd` formats compact currency.
- `caption` and `source` render under the chart (source is a real link in HTML).
- The three example files in `examples/` render without hand-tweaking.
- Validate rejects missing `value`s, unknown node ids on sankey links, and
  empty waterfall `steps`.
- Skill doc updated (it currently pretends only `flow` exists).

## Out of scope for this slice

Treemap, stacked bar, bullet, pie, maps, vote matrix. Parked in README.md.
