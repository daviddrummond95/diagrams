# Visualization types backlog

Individual types for diagrams.sh, each with a Ledger proof. Not a family spec.
Library today: `flow` | `gantt` | `timeline` | `quadrant`.

Stretch = can fake it with a type we already have. New = needs a renderer.

## Money

| ID | Type | What it shows | Ledger proof (Vol. I No. 1) | Stretch? |
| --- | --- | --- | --- | --- |
| VIZ-01 | `sankey` | Dollars moving fund → fund or source → purpose | Drug court $250k: opioid settlement vs county general. LIT correctional fund cannot pay staff, so it comes from general. Community corrections ~$700k shifted onto local taxpayers. | No. Flow edges have no `value`. |
| VIZ-02 | `waterfall` | A total built from signed line items | Jail budget: vehicles ($65k) + repairs + body cameras. Building maintenance emergencies +$520k. | No. |
| VIZ-03 | `delta` | One number became another | Clinton Road $3M → $500k. Clerk scanning $9k → $109k. Sewer +10% in 2030. | No. Quadrant is not this. |
| VIZ-04 | `bar` | Ranked amounts, one series | This week's appropriations: $469k traffic study, $520k buildings, $225k rescue truck, $100k plow, $45k Susie's Place, $47.5k warming center. | No. Geist `bar-chart` is an icon, not a renderer. |
| VIZ-05 | `grouped-bar` | Same categories, two series | 911 fund receipts vs outlays next year. CBD TIF spent $46,494 more than it collected. | No. |
| VIZ-06 | `stacked-bar` | Composition of a total | Jail increase split across vehicles / repairs / cameras. $2M housing loan fund: $1M city + $1M county. | No. |
| VIZ-07 | `treemap` | Nested composition by size | One edition of county general, sized by department (sheriff, jail, JJC, highway, clerk). | No. Groups cannot nest. |
| VIZ-08 | `bullet` | Actual vs target / budget vs spent | 911 fund runway. Community Corrections $200k restored after it was pulled by mistake. | No. |
| VIZ-09 | `slope` | Two-column before/after across items | Clinton Road, clerk scanning, Clinton Road EDIT, Make My Move $87.5k — several cuts/jumps on one graphic. | No. |
| VIZ-10 | `unit` | Compact currency / % / count formatting | Every money note. `$469k` not `469000`. | Library-wide primitive, not a type. |
| VIZ-42 | `alluvial` | Categorical stages, band = items or dollars | Introduced → committee → deferred → adopted/killed. August's deferral pile is this chart. Distinct from `sankey` (quantitative dollars through funds). | No. Close to VIZ-16. |
| VIZ-43 | `range-plot` | Min–max (optional midpoint) per category | Bid ranges, salary bands, assessed-value spreads in staff reports. | No. |
| VIZ-44 | `line` | Continuous series over fiscal years | 911 fund, TIF surplus/shortfall, levy, enrollment across budgets. | No. Sparkline is the tiny version. |
| VIZ-45 | `stacked-area` | Mix of a whole over time | Revenue mix: property / income / fees / grants across years. Wheel tax city-vs-county swap. | No. |
| VIZ-46 | `histogram` | Binned counts of a continuous variable | Bid amounts, assessed values, parcel sizes in a rezoning. | No. |
| VIZ-47 | `dot-plot` | One value per category as a dot on a shared scale | Many similar-sized funds where bar ink would lie. Salary/per-diem comparisons. | No. |

## Place

| ID | Type | What it shows | Ledger proof | Stretch? |
| --- | --- | --- | --- | --- |
| VIZ-11 | `locator-map` | Pins on a city basemap | 908 S 7th, 2215 Garfield, 335 Kent, 1009 Poplar, 2722 S Fruitridge, 3317 N 12th, 1205 Fort Harrison, S 8th at Wabash. | No. `gcp:maps-geospatial` is an icon slug. |
| VIZ-12 | `region-map` | One outlined district | Otter Creek Township fire district. 13th Street corridor (Wabash–Maple, 13th–25th). 74 former ISU lots (3rd–13th to Locust). | No. |
| VIZ-13 | `choropleth` | Areas shaded by a value | Fire districts, tax/TIF districts, wheel-tax city vs county. Later. | No. |
| VIZ-14 | `corridor` | Linear geography along a road | Clinton Road widening. 13th Street corridor advocacy. Riley Trail. | Could fake with flow. Weak. |
| VIZ-48 | `symbol-map` | Point markers, size/color = magnitude or type | Developments, liquor licenses, demolitions, school buildings, 30 plate cameras. Points, not areas. | No. |
| VIZ-49 | `zoning-map` | Categorical polygons (R-1, C-2, overlay) plus a code legend | Mason Lodge residential→commercial. 335 Kent duplex. Fastenal Poplar. Children's Museum 8th Street park. Current district vs allowed use. | No. |
| VIZ-50 | `before-after-map` | Current vs proposed geography, two panels or overlay | Same rezonings: what the land-use change actually is. Static, not a slider. | No. |

## Power and process

| ID | Type | What it shows | Ledger proof | Stretch? |
| --- | --- | --- | --- | --- |
| VIZ-15 | `agenda-states` | Introduced → approved / deferred / withdrawn / informational | August budget committee: sheriff, JJC, weights & measures, salaries all deferred. Ordinance pulled on jail overcrowding. | Partial: `flow` with diamond. No native states. |
| VIZ-16 | `outcome-funnel` | Counts of those states per meeting | The week's real story: a pile of DEFERRAL tags, invisible as a mix. | No. |
| VIZ-17 | `org` | Bodies and who reports to whom | City Council, County Council, Commissioners, BPW, APC, Redevelopment, BZA, budget committee. | No. Flow is a DAG ranker; groups cannot nest. |
| VIZ-18 | `vote-matrix` | Member × item, yes/no/absent | "Passed 6-0." "7 present, 2 absent." Named movers/seconders. Descriptive, not a scorecard (Ledger does not score officials). | No. |
| VIZ-19 | `impact` | Who a vote touches | Every highlight already has "Who it touches." Unvisualized. | Partial: labeled flow nodes. |
| VIZ-20 | `pipeline` | Automated vs human gate | About: find → fetch → transcribe → draft → link-check → human approval. | Yes: `flow` today. |
| VIZ-51 | `hemicycle` | Fan of seats colored by vote | "Passed 6-0." "7 present, 2 absent." One-vote who-sat-where without a 200-word roll call. Descriptive, not a score. | No. |
| VIZ-52 | `heatmap-table` | Matrix cells colored by value | Members × agenda items, or precinct × millage. Scannable grid. Cousin of `vote-matrix`. | No. |
| VIZ-53 | `network` | Nodes and edges for co-votes or stakeholders | Developer–neighborhood–district–fund. Who votes as a bloc. "Who it touches" as a graph. | Partial: `flow` is directed architecture, not influence. |
| VIZ-56 | `donut` | One part-to-whole ring, 2–5 slices | Fast general-vs-other-funds or yes/no/absent. Use only when waffle is too large and a matrix is too much. Not a first money type. | No. |

## Time

| ID | Type | What it shows | Ledger proof | Stretch? |
| --- | --- | --- | --- | --- |
| VIZ-21 | `timeline` (fix) | Events on a real date axis | Wheel tax: tabled Jun 11 → adopted Jul 9. N 12th rezoning held Apr 2 → passed Apr 9. Sheriff budget deferred twice. | Exists, but string-sorts dates and spaces events evenly. |
| VIZ-22 | `gantt` (fix) | Ranges, fiscal years, milestones | Zoning rewrite ~18 months. Sewer construction disruption. Budget calendar. | Exists. Header is `M/D` only, ~8px/day, no FY. |
| VIZ-23 | `weekstrip` | One edition as a date strip | 78 moments, Mar–Aug, clustered in Aug 4–25. | No. Numbered list 01–78 is the current "chart." |
| VIZ-24 | `entity-timeline` | One project/person across editions | Project Holly abatement. Susie's Place (city $45k + county $15k ask). Sheriff budget. About page already promises these. | Partial: `timeline` once dates are real. |
| VIZ-25 | `calendar-heatmap` | Meeting density by day | Special Wednesday 5pm instead of Tuesday commissioners. | No. |
| VIZ-26 | `sparkline` | A fund or count over months | 911 in vs out; TIF surplus/shortfall; corrections count. | No. |

## Composition and comparison

| ID | Type | What it shows | Ledger proof | Stretch? |
| --- | --- | --- | --- | --- |
| VIZ-27 | `waffle` | Counts as a grid of units | 84 unbilled conservancy parcels. 100 shelter beds. ~10 demolitions. 30 license-plate cameras. 74 ISU lots. | No. |
| VIZ-28 | `isotype` | Icons as units | Same counts, civic glyphs (house, bed, camera) instead of squares. | No civic icon pack. |
| VIZ-29 | `small-multiples` | Same chart, many departments | Budget lines held: sheriff, JJC, weights & measures, tower, salaries. | No. |
| VIZ-30 | `scorecard` | Promised vs delivered | CHI Overhead Doors: tax break kept, jobs missed. Govina: counting error, abatement kept. Apartment: 2 employees. | Partial: two `delta`s. Weak. |
| VIZ-31 | `beeswarm` | Many small amounts, one axis | Clothing allowance $4,500 next to $502k seized-asset ask. Shows scale without a bar chart of everything. | No. |
| VIZ-32 | `connected-dot` | Two values per item, linked | Jobs promised vs reported, per abatement. | No. |
| VIZ-33 | `category-mix` | Items per month by tag | MONEY / RULES / PROPERTY / DEFERRAL / FRICTION / FLAGGED over Mar–Aug. | No. |
| VIZ-34 | `per-body-count` | Highlights by governing body | City Council vs County Council vs Commissioners vs budget committee vs BZA. | No. `bar`. |
| VIZ-54 | `data-table` | Sorted table with optional mini-bars, heat cells, sparklines | Meeting records are lists of funds, motions, names. The table is the graphic when ranking and lookup both matter. | No. |

## Editorial primitives (not types, but the library cannot ship newspaper graphics without them)

| ID | Primitive | Why |
| --- | --- | --- |
| VIZ-35 | `caption` | One sentence a resident can read without the meeting. |
| VIZ-36 | `source` | Label + href. Every Ledger sentence already links to tape. |
| VIZ-37 | `legend` | None today. Color is meaningless without a key. |
| VIZ-38 | `stat` | Big number + unit + source. The homepage KPI band is text. |
| VIZ-39 | `callout` | Annotated highlight on a chart (the $3M→$500k moment). |
| VIZ-40 | `civic-icons` | Courthouse, sheriff, roads, fire, school, housing. Not `aws:lambda`. |
| VIZ-41 | `alt` / data-table fallback | Accessible SVG. Ledger covered the ADA website deadline this month. |
| VIZ-55 | `annotation` | Callouts, peak labels, shaded ranges on the chart | Marks the amendment, the 5–4, the deferral date, on the graphic itself. Cousin of `callout`. |

## Already in the library (keep, don't rebuild)

- `flow` — process, permitting, the About pipeline.
- `gantt` — project/legislative calendars, once FY/milestones exist.
- `timeline` — entity history, once dates are real time.
- `quadrant` — weak civic fit (2×2 scatter, fixed 12px dots). Do not use as the comparison chart.

## Added from civic-newsroom research (not in the first cut)

`alluvial`, `range-plot`, `line`, `stacked-area`, `histogram`, `dot-plot`, `symbol-map`, `zoning-map`, `before-after-map`, `hemicycle`, `heatmap-table`, `network`, `donut`, `data-table`, `annotation`.

Folded, not added: lollipop → bar/dot-plot; sunburst/icicle → treemap; pie → donut; icon-array → isotype; arrow-plot → connected-dot; bubble maps (ProPublica guidance: skip).
