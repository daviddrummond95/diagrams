# diagrams.sh civic backlog

First customer: [The Vigo Ledger](https://vigoledger.org) (Vol. I No. 1, week of Aug 28, 2026).
Library today (`@agent-clis/diagrams` 0.2.0): `flow` | `gantt` | `timeline` | `quadrant`.
YAML in, PNG/SVG/HTML/PPTX out. Structure + labels, not quantitative viz.

The mayor asked for infographics. The Ledger is a meeting-record paper with dollar
amounts, votes, places, and "who it touches" on almost every note, and no charts.

## Ranking

Build in this order. Money first: that is what this week's edition is made of.

| Rank | Family | New `type`s | Ledger proof this week | Status |
| --- | --- | --- | --- | --- |
| 1 | Money | `sankey`, `waterfall`, `delta` | Clinton Road $3M→$500k; 911 fund in vs out; jail vehicles+repairs+cameras; opioid vs general for drug court | specced (see `01-money.md`) |
| 2 | Editorial primitives | fields on every spec: `caption`, `source`, `unit` | every Ledger sentence already links to tape; ADA website deadline was itself a story | required by money, so ship with #1 |
| 3 | Place | `map` (locator, then choropleth) | Otter Creek fire district; Clinton Road; Ray Park; 13th Street corridor; East Side school; rezoning pins | parked |
| 4 | Power / process | civic states on `flow`; `org`; `votes` | deferred / withdrawn / voice-vote / forwarded; coverage table of bodies | parked |
| 5 | Time (fix, then extend) | fix `timeline` date math; `weekstrip` | timeline currently string-sorts dates and spaces events evenly, ignoring real deltas; 78 moments this week | parked |
| 6 | Composition | `waffle`, `smallmultiples`, `scorecard` | 84 unbilled conservancy parcels; 100 shelter beds; CHI / Govina / 2-employee abatement | parked |

Do not bolt these onto `flow` groups. The existing extension point is already the
right one: add a member to `DiagramType` / `AnyDiagramSpec` in `src/types.ts`,
branch in `parse.ts` / `validate.ts` / `src/render/index.ts`, add
`src/diagrams/<type>/{layout,tree,pptx}.ts`.

## Shared primitives money (and everything after) needs

These are missing library-wide, not just for charts:

- `caption` and `source` (`label` + optional `href`) on every spec
- `unit: usd | percent | count` plus compact formatting (`$469k`, `$1.2M`, `10%`)
- a legend (color key). None today.
- civic icons (`geist:` has `bar-chart` as a *glyph*, not a renderer). Need
  courthouse, sheriff, roads, fire, school, housing — not `aws:lambda`.
- accessible SVG (alt text / data-table fallback). `high-contrast` themes are
  not enough; the Ledger covered the federal ADA website deadline this month.

## What not to do

- Do not add pie/donut as a first money type. The Ledger's money stories are
  flows, cuts, and stacks of additions.
- Do not treat `quadrant` as the comparison chart. It is a 2×2 scatter with
  fixed 12px dots and no size-by-value.
- `flow` edges cannot encode dollar volume (`DiagramEdge` has no `value`).
  A Sankey is a new type, not a styled flowchart.
- Groups cannot nest (one group per node). Org charts are a later type, not
  grouped flow.
- Timeline is not a fiscal-year tool until dates are real time, not `localeCompare`.

## Parked notes from the library itself

- `skills/SKILL.md` is stale: documents flow only, themes `default`/`dark`
  (there are 22), no gantt/timeline/quadrant, CLI version `0.1.0` vs package `0.2.0`.
- Tests only parse/validate flow YAML. Fixtures for the other types exist and
  are unused. No render snapshots.
- `examples/` is one flow script. First civic examples should live here
  (`examples/ledger-*.yaml`) once the types render.
