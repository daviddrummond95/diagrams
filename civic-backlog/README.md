# Civic spec pack (Vigo Ledger → diagrams.sh)

Port of the Vigo Ledger infographic expansion work for [agent-clis/diagrams](https://github.com/agent-clis/diagrams). Specs, YAML fixtures, civic icons, and throwaway HTML demos. **Not library `src/`.** Demo renderers are Python/Node SVG prototypes, not the Satori pipeline.

## Layout

- `specs/` — family contracts and the 56-type backlog
- `examples/` — YAML/JSON fixtures plus Census TIGER geometries
- `icons/civic/` — 96 SVG icons, `civic:<slug>` prefix (`manifest.json`)
- `demos/` — visually QA'd HTML (open in a browser) and the renderers that built them

## Canonical specs

| File | Use |
|---|---|
| `specs/00-editorial-chrome.md` | CivicBase chrome (caption, source, legend, stat, annotations, `civic:` icons). Same contract as `civic-chrome-contract.md`. |
| `specs/money-family-spec.md` | **Canonical money spec.** Ignore `01-money.md` (stale). |
| `specs/02-place.md` | Maps. WGS84 lon/lat, Web Mercator. Mason Lodge is **2215 Garfield**, not 908 S 7th. |
| `specs/02-process.md` | Agenda, funnel, org, votes, etc. Do not score officials. |
| `specs/02-time.md` | **Fix** existing `timeline`/`gantt`; add weekstrip, entity-timeline, calendar-heatmap, sparkline. |
| `specs/06-composition.md` | waffle, isotype, small-multiples, scorecard, beeswarm, connected-dot, data-table. |
| `specs/TYPES.md` | Full 56-type backlog. |

## Library facts that bite

- Timeline currently string-sorts `date` (`localeCompare`) and spaces cards evenly. Needs a real date axis.
- Gantt header is `M/D` only, ~8px/day, no FY, no `open: true` milestones.
- `DiagramEdge` has no `value`. Sankey is a new type, not thick flow edges.
- Groups: one group per node, no nesting. Org is not grouped flow.
- Raw numbers in YAML (`469000` not `$469k`). `formatValue` owns labels. Sankey/alluvial `0` = hairline + `n/a`.
- Ship order when implementing: (1) `formatValue` + chrome (2) delta, waterfall, sankey (3) bars/slope (4) treemap/bullet/dot-plot/alluvial (5) line/stacked-area/range-plot/histogram.

## Left out of this commit

`node_modules`, `__pycache__`, QA screenshot PNGs (open the HTML demos instead). Stale `demos/civic-icons-*.png` are not source of truth; the SVGs in `icons/civic/` are.
