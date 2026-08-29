# Power and process types

Ten types, one civic constraint. First customer: The Vigo Ledger
(vigoledger.org), Vol. I No. 1, week of Aug 28, 2026.

Preview render lives at `demos/process.html` (demo renderer, not the library).

The Ledger does not score officials. Vote graphics stay descriptive:
attendance and yea / nay / absent. Never ranked, graded, scored, rated,
or colored by party-as-score.

Quantitative alluvial / sankey belong to Money. These types encode
states, bodies, votes, gates, and who a decision touches.

Library today (`@agent-clis/diagrams` 0.2.0): `flow` | `gantt` |
`timeline` | `quadrant`. Groups cannot nest (one group per node). Flow
is a DAG ranker, not an org tree, not an influence graph.
`DiagramEdge` has no `value`.

Extension pattern matches gantt/timeline/quadrant:
`src/types.ts` → `parse.ts` → `validate.ts` → `src/render/index.ts` →
`src/diagrams/{agenda-states,outcome-funnel,org,vote-matrix,impact,pipeline,hemicycle,heatmap-table,network,donut}/{layout,tree,pptx}.ts`.

Demo render (not the library): demos/process.html

## Shared fields

Import `CivicBase` from `00-editorial-chrome.md`. Every family
interface **extends CivicBase**. Do not re-declare `caption`,
`source`, `legend`, `stat`, `stats`, `annotations`, `unit`, `alt`,
`dataTable`, `footnote`, `title`, or `theme` on the family interface.
Process payload lives beside chrome, not instead of it.

Do not alias. Locked field-name table (section 15 of the chrome
contract), copy exactly:

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

`empty` is not a `LegendPattern`. Locked patterns: `solid | hatch | dots | stripes`.
For absent / not-yet / withdrawn, omit `pattern` (unfilled) or use `dots`.
Never `swatch`. Never `key`, `credit`, `byline`, `kpi`, `altText`, or
`rows` as a table (table is `dataTable`).

`unit` is EP-owned (`usd | percent | count`) but process types almost
never need it. Do not put `unit: usd` on `outcome-funnel` or vote types.
`heatmap-table` may take optional `unit` only if cells are numeric, and
the name is still `unit` (this week's grid uses `unit: count`).

Validate returns `string[]` of human-readable errors. No throws.
Duplicate ids, unknown id refs, and missing required labels are errors
on every type.

Reject any field named `score`, `grade`, `rating`, `rank`, `ideology`,
`party-score`, or `loyalty`. The About page: "We do not endorse
candidates, score officials, or make recommendations." Vote graphics
stay descriptive.

## 1. `agenda-states` — one item's civic path

Use when a story is one item moving through introduced → approved |
deferred | withdrawn | informational | forwarded | recessed.

This week's proofs:

- August budget committee deferred sheriff, JJC, weights & measures,
  salaries (and tower). Sheriff held twice (Aug 12, then Aug 13).
- Jail-overcrowding ordinance pulled Aug 18 (withdrawn, no vote).
- Tax-office pay grade forwarded committee → full council, Aug 12.
- Budget committee recessed Aug 13.

YAML:

```yaml
type: agenda-states
title: "Sheriff's Office budget, Aug 12–13"
theme: default
caption: "The budget committee deferred the Sheriff's Office budget, then held it again the next day."
source:
  label: "County budget committee, Aug 12–13"
  href: "https://vigoledger.org/"
legend:
    - { label: "Current / reached", pattern: solid }
    - { label: "Earlier step", pattern: hatch }
    - { label: "Not yet" }

alt: "Three chips left to right: Taken up (hatched, Aug 12), Deferred (hatched, Aug 12), Held again (filled, Aug 13). The Sheriff's Office budget is still deferred after two budget-committee days."

item:
  id: sheriff-budget
  label: "Sheriff's Office budget"
  icon: civic:sheriff
  body: "Vigo County Council budget committee"
  steps:
    - id: taken-up
      state: introduced
      date: "2026-08-12"
      label: "Taken up"
    - id: hold-12
      state: deferred
      date: "2026-08-12"
      label: "Deferred"
    - id: hold-13
      state: deferred
      date: "2026-08-13"
      label: "Held again"
```

Contract:

```ts
type CivicState =
  | 'introduced'
  | 'approved'
  | 'deferred'
  | 'withdrawn'
  | 'informational'
  | 'forwarded'
  | 'recessed';

interface AgendaStep {
  id: string;
  state: CivicState;
  date: string;            # ISO YYYY-MM-DD
  label?: string;
}
interface AgendaItem {
  id: string;
  label: string;
  body: string;
  icon?: string;           # civic:sheriff on this week's sheriff item
  steps: AgendaStep[];
}
interface AgendaStatesSpec extends CivicBase { type: 'agenda-states'; item: AgendaItem; }
```

Layout: left-to-right state chips. Current (last) state filled, earlier
steps hatched or dim, future empty. Terminal states `approved` and
`withdrawn` end the path. `deferred` is a holding terminal until a later
step resumes. `recessed` is a session hold, not an item death.
`forwarded` is committee → parent body.

What this is not: a `flow` with diamond nodes. Flow has no native civic
states. TYPES.md calls diamond-as-state a stretch; do not ship that.

Validate: `item.label` required; `steps` non-empty; last step required
(the array may not end empty); every `state` in the closed enum; dates
ISO `YYYY-MM-DD`; unique step ids; unknown state is an error.

## 2. `outcome-funnel` — counts of those states

Use when the story is the mix of outcomes in a meeting or an edition,
not one item's path. This week's DEFERRAL pile is currently invisible
as a mix.

This week's proofs:

- Vol. I No. 1, week of Aug 28: a pile of DEFERRAL tags — sheriff twice,
  JJC, weights & measures, 908 S 7th rezoning delayed.
- Salaries / tower recessed with the Aug 13 budget committee.
- Jail-overcrowding ordinance pulled (withdrawn, no vote).
- Tax-office pay grade forwarded Aug 12.
- Voice-vote approvals and informational items exist this week; do not
  invent a count for them.

YAML:

```yaml
type: outcome-funnel
title: "This week's outcomes"
theme: default
caption: "The week is a pile of deferred budget items, not a stack of final votes."
source:
  label: "The Vigo Ledger, Vol. I No. 1"
  href: "https://vigoledger.org/"
legend:
    - { label: "Forwarded", pattern: solid }
    - { label: "Deferred", pattern: solid }
    - { label: "Recessed", pattern: hatch }
    - { label: "Withdrawn" }
alt: "Four bars whose widths equal 36 times the count: Forwarded 1 (36px), Deferred 5 (180px), Recessed 1 (36px), Withdrawn 1 (36px). Deferred is the week's pile."
dataTable:
  columns: [State, Count]
  records:
    - [Forwarded, 1]
    - [Deferred, 5]
    - [Recessed, 1]
    - [Withdrawn, 1]

stages:
  - id: forwarded
    label: "Forwarded"
    state: forwarded
    value: 1
  - id: deferred
    label: "Deferred"
    state: deferred
    value: 5
  - id: recessed
    label: "Recessed"
    state: recessed
    value: 1
  - id: withdrawn
    label: "Withdrawn"
    state: withdrawn
    value: 1
items:
  - { id: tax-office, label: "Tax-office pay grade", state: forwarded }
  - { id: sheriff-12, label: "Sheriff's Office budget", state: deferred }
  - { id: sheriff-13, label: "Sheriff's Office budget (held again)", state: deferred }
  - { id: jjc, label: "Juvenile Justice Center", state: deferred }
  - { id: weights, label: "Weights and measures", state: deferred }
  - { id: s7th, label: "908 S 7th rezoning", state: deferred }
  - { id: salaries, label: "Salaries / tower", state: recessed }
  - { id: jail, label: "Jail-overcrowding ordinance", state: withdrawn }
```

Contract:

```ts
interface FunnelStage {
  id: string;
  label: string;
  state: CivicState;       # same closed enum as agenda-states
  value: number;           # count of items, integer >= 0
}
interface FunnelItem {
  id: string;
  label: string;
  state: CivicState;
}
interface OutcomeFunnelSpec extends CivicBase { type: 'outcome-funnel'; stages: FunnelStage[]; items?: FunnelItem[]; }
```

No `unit` field. Width / area encodes count. Stage order is the civic
sequence (introduced → forwarded → informational → deferred → recessed
→ approved → withdrawn), not magnitude-sort. Sum of values may be
annotated as "N items this meeting."

Layout: funnel or stacked stage bars. Not a dollar sankey. Optional
`items` render as a table under the chart when present.

What this is not: Money's `alluvial` / `sankey`. No `value` in dollars.
Do not spec an alluvial here.

Validate: at least 2 stages; `value` integer `>= 0`; stage `state` in
the civic enum; unique stage ids; reject `unit: usd`; if `items` is
present, each `state` is in the enum. Named-item counts per state must
not exceed that stage's `value`.

## 3. `org` — bodies and reporting lines

Use when the story is who sits under whom, who appoints, who forwards,
and which beats the Ledger covers. Coverage chips are a trust signal
from the About page, not decoration.

This week's proofs:

- Terre Haute City Council (covered)
- Vigo County Council (covered)
- Vigo County Commissioners (About: not yet; the week still has
  commissioner items)
- Terre Haute Board of Public Works (not yet)
- Area Plan Commission (not yet; 908 S 7th and N 12th rezonings held
  for APC)
- Terre Haute Redevelopment Commission (not yet)
- Board of Zoning Appeals (garage variance Aug 12)
- County budget committee (Aug 12–13 deferral pile)

YAML:

```yaml
type: org
title: "Bodies the Ledger covers"
theme: default
caption: "The Ledger covers the two councils; commissioners, APC, and several appointed boards are not yet a beat."
source:
  label: "The Vigo Ledger, About / Vol. I No. 1"
  href: "https://vigoledger.org/"
legend:
    - { label: "Covered", pattern: solid }
    - { label: "Not yet" }
alt: "Org boxes on a computed tree: city council, county council, and commissioners on the top rank; budget committee under county council; APC with recommend lines to both councils; remaining boards as empty-stroke not-yet boxes."

nodes:
  - id: city-council
    label: "Terre Haute City Council"
    kind: legislative
    coverage: covered
  - id: county-council
    label: "Vigo County Council"
    kind: legislative
    coverage: covered
  - id: commissioners
    label: "Vigo County Commissioners"
    kind: executive
    coverage: not-yet
  - id: bpw
    label: "Terre Haute Board of Public Works"
    kind: executive
    coverage: not-yet
  - id: apc
    label: "Area Plan Commission"
    kind: appointed
    coverage: not-yet
  - id: redevelopment
    label: "Terre Haute Redevelopment Commission"
    kind: appointed
    coverage: not-yet
  - id: bza
    label: "Board of Zoning Appeals"
    kind: appointed
    coverage: not-yet
  - id: budget-committee
    label: "County budget committee"
    kind: committee
    coverage: covered
edges:
  - { from: budget-committee, to: county-council, rel: reports-to }
  - { from: apc, to: city-council, rel: recommends-to }
  - { from: apc, to: county-council, rel: recommends-to }
```

Contract:

```ts
type OrgKind = 'legislative' | 'executive' | 'appointed' | 'committee' | 'advisory';
type OrgCoverage = 'covered' | 'not-yet';
type OrgRel = 'appoints' | 'reports-to' | 'recommends-to' | 'forwards-to' | 'oversees';

interface OrgNode {
  id: string;
  label: string;
  kind: OrgKind;
  coverage?: OrgCoverage;
  color?: string;
}
interface OrgEdge {
  from: string;
  to: string;
  rel: OrgRel;
}
interface OrgSpec extends CivicBase { type: 'org'; nodes: OrgNode[]; edges: OrgEdge[]; }
```

No `unit`. Layout: tree / hierarchy by appointment and reporting. Top =
the two councils and the commissioners. Committees hang off their parent
body. Edges labeled by `rel`. Coverage chip on each node. BPW,
redevelopment, and BZA may sit as isolated nodes; do not invent a mayor
or an appointment line the tape does not give.

What this is not: nested `flow` groups. Groups cannot nest. Flow
DAG-ranks, which will scramble an org. Not a `network` of stakeholders.

Validate: at least one node; unique ids; every node a known `kind`;
unknown edge endpoints; no cycles on `reports-to` / `appoints`
(`recommends-to` may be cross-body); `coverage` if present is
`covered | not-yet`.

## 4. `vote-matrix` — member × item, yea / nay / absent

Use when the record has a roll call, a tally string, and maybe a named
mover and seconder. Descriptive, not a scorecard.

This week's proofs:

- Apr 2: Council appropriates $20,000 for Ray Park and Riley Trail.
  Passed unanimously. Moved by Loudermilk, seconded by Hinton. Roll
  call: 7 present, 2 absent. Who it touches — residents who use Ray
  Park and the Riley Trail.
- Apr 2: Children's Museum 8th Street park support resolution. Passed
  unanimously. 7 present, 2 absent.
- Aug 11: IT moves $40,000 out of computer-replacement fund. Passed
  6-0. (County — do not attach the city roster to this one.)
- Jun 4: Appropriation 9-2026 approved unanimously (Nation / Loudermilk).
- Special Ordinance 4-2026 passed unanimously (Chalos / Loudermilk) —
  N 13th efficiency homes. Date in the notes is uncertain; do not
  invent one.

Terre Haute City Council roster (public, 9 seats) may be listed for
structure. Do not invent who voted which way:

- At-large: George Azar, Tammy Boland, Curtis DeBaun IV
- D1 Kandace G. Hinton, D2 Amanda Thompson (VP), D3 Cheryl Loudermilk,
  D4 Todd Nation, D5 James P. Chalos, D6 Anthony J. Dinkel (President)

Apr 2 does not name the two absentees. Named mover / seconder are
facts. Filling the other five yeas with guessed names is a spec bug.
Cells are sparse: only cells the record supports. Unnamed members are
allowed (`label` may be "Seat 7" if the tape did not name them).

YAML (Ray Park, Apr 2):

```yaml
type: vote-matrix
title: "Ray Park and Riley Trail, Apr 2"
theme: default
caption: "Council appropriated $20,000 for Ray Park and the Riley Trail; seven members were present, two absent."
source:
  label: "City council, Apr 2"
  href: "https://vigoledger.org/"
legend:
    - { label: "Yea", pattern: solid }
    - { label: "Nay", pattern: hatch }
    - { label: "Absent" }
stat:
  display: "7 present, 2 absent"
alt: "Nine city-council members as rows and one Ray Park column. Only Loudermilk and Hinton are filled yea (mover and seconder). Other cells are empty, not guessed absents or yeas. Tally: 7 present, 2 absent."
dataTable:
  columns: [Member, Seat, Vote]
  records:
    - [Cheryl Loudermilk, District 3, yea]
    - [Kandace G. Hinton, District 1, yea]
  summary: "Sparse cells only. Omitted members are unknown, not absent."

body: "Terre Haute City Council"
date: "2026-04-02"
members:
  - { id: azar, label: "George Azar", seat: "At-large" }
  - { id: boland, label: "Tammy Boland", seat: "At-large" }
  - { id: debaun, label: "Curtis DeBaun IV", seat: "At-large" }
  - { id: hinton, label: "Kandace G. Hinton", seat: "District 1" }
  - { id: thompson, label: "Amanda Thompson", seat: "District 2" }
  - { id: loudermilk, label: "Cheryl Loudermilk", seat: "District 3" }
  - { id: nation, label: "Todd Nation", seat: "District 4" }
  - { id: chalos, label: "James P. Chalos", seat: "District 5" }
  - { id: dinkel, label: "Anthony J. Dinkel", seat: "District 6" }
items:
  - id: ray-park
    label: "Ray Park / Riley Trail $20,000"
    mover: loudermilk
    seconder: hinton
    result: "7 present, 2 absent · passed unanimously"
cells:
  - { member: loudermilk, item: ray-park, vote: yea }
  - { member: hinton, item: ray-park, vote: yea }
summary:
  yea: 7
  absent: 2
  present: 7
```

Do not add a cell `{ member: azar, vote: yea }`. Omit the rest, or mark
unlabeled present seats `unknown`. Omitted cells are unknown, not
absent — do not paint them as A.

Contract:

```ts
type Vote =
  | 'yea'
  | 'nay'
  | 'absent'
  | 'present-not-voting'
  | 'excused'
  | 'unknown';

interface VoteMember {
  id: string;
  label: string;
  seat?: string;
}
interface VoteItem {
  id: string;
  label: string;
  mover?: string;          # member id
  seconder?: string;
  result?: string;
}
interface VoteCell {
  member: string;
  item: string;
  vote: Vote;
}
interface VoteMatrixSpec extends CivicBase {
  type: 'vote-matrix';
  body: string;
  date: string;            # ISO YYYY-MM-DD
  members: VoteMember[];
  items: VoteItem[];
  cells: VoteCell[];       # sparse
  summary?: { yea?: number; nay?: number; absent?: number; present?: number };
}
```

No `unit`. Layout: members as rows (seat then name), items as columns,
cells as color + letter (Y / N / A). Header row is item short labels.
Footer or title-line is the tally string ("Passed 6-0", "7 present, 2
absent"). Mover / seconder marked M / S, not a trophy. Empty cell ≠
absent.

What this is not: a scorecard. No win / loss column. No % agreement. No
party stripe as a ranking. No ideology heat.

Validate: at least one item and one member; unique member / item ids;
vote in the closed enum; cell `member` / `item` exist; mover and
seconder must be members; if `summary` is present, named-cell counts
must not exceed it (sparse is ok); reject `score` / `grade` / `rating`
/ `rank` / `ideology` / `party-score` / `loyalty`; do not infer omitted
cells as yea because `result` says unanimous.

## 5. `impact` — who a vote touches

Use when a highlight already has a "Who it touches" line and it is
still unvisualized. Every Ledger highlight has this line.

This week's proofs:

- Aug 18 jail-overcrowding ordinance pulled — "County taxpayers, and
  residents who have asked commissioners about jail overcrowding."
- Sheriff budget deferred — residents who rely on the Sheriff's Office.
- Fairgrounds concrete — visitors with mobility or balance impairments.
- Apr 2 Ray Park — residents who use Ray Park and the Riley Trail.

YAML:

```yaml
type: impact
title: "Jail-overcrowding ordinance, Aug 18"
theme: default
caption: "The jail-overcrowding ordinance was pulled without a vote; it would have touched county taxpayers and residents who have asked about the jail."
source:
  label: "County commissioners, Aug 18"
  href: "https://vigoledger.org/"
legend:
    - { label: "Taxpayers", pattern: solid }
    - { label: "Residents", pattern: hatch }
alt: "A hub for the jail-overcrowding ordinance with two lines to county taxpayers and to residents who have asked commissioners about the jail."

item:
  id: jail-ordinance
  label: "Jail-overcrowding ordinance"
  body: "Vigo County Commissioners"
  date: "2026-08-18"
  action: "pulled / withdrawn, no vote"
touches:
  - id: taxpayers
    label: "County taxpayers"
    kind: taxpayers
  - id: asked
    label: "Residents who have asked commissioners about jail overcrowding"
    kind: residents
```

Contract:

```ts
type TouchKind =
  | 'residents'
  | 'taxpayers'
  | 'neighborhood'
  | 'employees'
  | 'program'
  | 'place';

interface ImpactItem {
  id: string;
  label: string;
  body: string;
  date: string;
  action: string;
}
interface ImpactTouch {
  id: string;
  label: string;
  kind: TouchKind;
  note?: string;
}
interface ImpactSpec extends CivicBase { type: 'impact'; item: ImpactItem; touches: ImpactTouch[]; }
```

No `unit`. Layout: item as hub (or left column), touches as a small
cluster / list of chips grouped by `kind`. Not a dollar amount. Not a
map.

What this is not: a `flow` of labeled nodes. Not a `network` of
co-votes (that is `network`). Not Place's `locator-map`.

Validate: `item.label` required; at least one touch; unique touch ids;
every `kind` in the enum.

## 6. `pipeline` — automated vs human gate

Use when the story is the publish lock: nothing an agent writes is
published automatically. Flow can stretch a linear pipeline today, but
flow has no gate kind and no publish lock. Spec the type so validate
can require a human stage before publish.

This week's proofs (About page):

- Automated: finding meetings + fetching video / agenda; transcribing +
  separating speakers; drafting record / highlights / timelines;
  checking every sentence has a working source link.
- Human: every generated note reviewed and accepted before it appears;
  reviewer checks claim matches source, timestamp lands, names correct.

YAML:

```yaml
type: pipeline
title: "How a Ledger note gets published"
theme: default
caption: "Nothing an agent writes is published automatically; a human accepts every note."
source:
  label: "The Vigo Ledger, About"
  href: "https://vigoledger.org/"
legend:
    - { label: "Automated", pattern: solid }
    - { label: "Human gate", pattern: hatch }
alt: "Seven stages from find meetings to publish. Automated stages are filled; human review and publish have a heavy stroke. A dashed reject path runs from review back to draft."

stages:
  - id: find
    label: "Find meetings"
    gate: automated
    description: "Find meetings on the calendar."
  - id: fetch
    label: "Fetch"
    gate: automated
    description: "Fetch video and agenda."
  - id: transcribe
    label: "Transcribe"
    gate: automated
    description: "Transcribe and separate speakers."
  - id: draft
    label: "Draft"
    gate: automated
    description: "Draft record, highlights, timelines."
  - id: link-check
    label: "Link-check"
    gate: automated
    description: "Check every sentence has a working source link."
  - id: review
    label: "Human review"
    gate: human
    description: "Claim matches source, timestamp lands, names correct."
  - id: publish
    label: "Publish"
    gate: human
    description: "Appears on the Ledger. Never automated."
edges:
  - { from: find, to: fetch }
  - { from: fetch, to: transcribe }
  - { from: transcribe, to: draft }
  - { from: draft, to: link-check }
  - { from: link-check, to: review }
  - { from: review, to: publish }
  - { from: review, to: draft }    # reject back
```

Contract:

```ts
type PipelineGate = 'automated' | 'human' | 'blocked';

interface PipelineStage {
  id: string;
  label: string;
  gate: PipelineGate;
  description?: string;
}
interface PipelineEdge {
  from: string;
  to: string;
}
interface PipelineSpec extends CivicBase { type: 'pipeline'; stages: PipelineStage[]; edges: PipelineEdge[]; }
```

No `unit`. Layout: left-to-right. Automated stages as machine chips.
Human as a distinct gate (heavier stroke; lock icon if civic-icons
exist). Optional reject edge dashed back. Final stage is publish, only
reachable through the human gate.

What this is not: a generic `flow`. If a later renderer can draw this
as flow + `gate` metadata, keep the type so validate can require a
human stage before publish.

Validate: at least one `human` gate; if a stage label matches
publish / public, it cannot be `automated`; unknown `gate` is an error;
edge endpoints exist; no self-loops; unique stage ids.

## 7. `hemicycle` — one vote, who sat where

Use when one roll call should be a fan of seats, not a 200-word list.
Descriptive, not a score. Color is the vote on this item, not party.
Local council is often unanimous / voice-vote; party coloring would lie.

This week's proofs: Apr 2 Ray Park, 7 present, 2 absent, unanimous
among those present. 9 city seats. Two seats absent without names.

Safer encoding: 7 `yea` + 2 `absent`. Named seats only for Loudermilk
(mover) and Hinton (seconder). Other present seats may be unlabeled
`yea` only if the label is omitted or is a seat number, not a guessed
person. Do not mark Azar yea. Do not name the two absentees.

YAML:

```yaml
type: hemicycle
title: "Ray Park appropriation, Apr 2"
theme: default
caption: "Seven present, two absent: the Ray Park appropriation passed among those in the room. Loudermilk moved; Hinton seconded."
source:
  label: "City council, Apr 2"
  href: "https://vigoledger.org/"
legend:
    - { label: "Yea", pattern: solid }
    - { label: "Nay", pattern: hatch }
    - { label: "Absent" }
stat:
  display: "7 present, 2 absent"
alt: "Nine seats in a hemicycle. Seven filled yea, two empty-stroke absent. Only Loudermilk (mover) and Hinton (seconder) are labeled."

item:
  id: ray-park
  label: "Ray Park / Riley Trail $20,000"
  body: "Terre Haute City Council"
  date: "2026-04-02"
mover: loudermilk
seconder: hinton
seats:
  - { id: loudermilk, label: "Cheryl Loudermilk", member: loudermilk, vote: yea, seat: "District 3" }
  - { id: hinton, label: "Kandace G. Hinton", member: hinton, vote: yea, seat: "District 1" }
  - { id: yea-3, vote: yea }
  - { id: yea-4, vote: yea }
  - { id: yea-5, vote: yea }
  - { id: yea-6, vote: yea }
  - { id: yea-7, vote: yea }
  - { id: absent-1, vote: absent }
  - { id: absent-2, vote: absent }
summary:
  yea: 7
  absent: 2
  present: 7
```

Contract:

```ts
type HemiVote = 'yea' | 'nay' | 'absent' | 'empty';

interface HemiSeat {
  id: string;
  label?: string;
  member?: string;
  vote?: HemiVote;
  seat?: string;
}
interface HemicycleSpec extends CivicBase {
  type: 'hemicycle';
  item: { id: string; label: string; body?: string; date?: string };
  seats: HemiSeat[];
  mover?: string;
  seconder?: string;
  summary?: { yea?: number; nay?: number; absent?: number; present?: number };
}
```

No `unit`. Layout: Wikipedia / NOS-style hemicycle, local scale (3 / 7
/ 9 seats), not a 435-member Congress. Color by this vote. Legend
required (yea / nay / absent). Tally as a stat-sized string under the
fan ("7 present, 2 absent · passed unanimously"). No party wedges.
Mover / seconder are annotations on known seats, not trophies.

What this is not: a party-colored legislature diagram. Not a score.
Not a `vote-matrix` (that is member × many items).

Validate: 3–25 seats (local bodies; reject 100+ as the wrong type);
vote in `yea | nay | absent | empty`; legend present; summary
consistent with seat votes when both are present; reject
party-as-required-field; reject scoring field names; `empty` is a
vacant chair, not an unnamed absentee.

## 8. `heatmap-table` — magnitude in a grid

Use when the cell is a magnitude (count of deferrals, millage, times
an item returned), not a categorical vote. Vote-matrix is the
categorical cousin; do not collapse them.

This week's proofs:

- Bodies × August meetings, cell = number of deferred items. August
  12–13 budget committee is the hot cell: sheriff, JJC, weights &
  measures, salaries (four named items; tower rides with salaries).
- 908 S 7th rezoning delayed (held for APC). Not placed in this grid;
  the meeting cell is not in the record used here.
- Precinct × millage later.

YAML:

```yaml
type: heatmap-table
title: "August deferrals by body"
theme: default
unit: count
caption: "August's deferrals sat on the county budget committee, not spread evenly across bodies."
source:
  label: "The Vigo Ledger, Vol. I No. 1"
  href: "https://vigoledger.org/"
legend:
    - { label: "More deferrals", pattern: solid }
    - { label: "Not recorded" }
alt: "A 6-by-2 grid of bodies by August dates. Only the budget-committee cell for Aug 12–13 is filled, opacity 1, labeled 4. Other cells are empty with no zero."
dataTable:
  columns: [Body, Aug 12–13, Aug 18]
  records:
    - [Budget committee, 4, null]
  summary: "Omitted cells are not recorded, not zero."

rows:
  - { id: city-council, label: "City Council" }
  - { id: county-council, label: "County Council" }
  - { id: commissioners, label: "Commissioners" }
  - { id: budget-committee, label: "Budget committee" }
  - { id: apc, label: "Area Plan Commission" }
  - { id: bza, label: "Board of Zoning Appeals" }
columns:
  - { id: aug12-13, label: "Aug 12–13" }
  - { id: aug18, label: "Aug 18" }
cells:
  - { row: budget-committee, column: aug12-13, value: 4, label: "4 deferred" }
scale:
  min: 0
  max: 4
```

Empty cells (no record in this spec) are distinct from zero. Do not
fill City Council Aug 18 with `0` just because the jail ordinance was
a commissioner item. Jail ordinance was withdrawn, not deferred — do
not put it in this grid.

Contract:

```ts
interface HeatRow {
  id: string;
  label: string;
}
interface HeatCol {
  id: string;
  label: string;
}
interface HeatCell {
  row: string;
  column: string;
  value: number;
  label?: string;
}
interface HeatmapTableSpec extends CivicBase {
  type: 'heatmap-table';
  rows: HeatRow[];
  columns: HeatCol[];
  cells: HeatCell[];       # sparse; omitted ≠ 0
  scale?: { min: number; max: number };
}
```

Layout: row labels left, column labels top, sequential color (single
hue). Numbers printed in the cell. Empty cells a distinct fill from
zero. Not a vote color scheme (no green-yes / red-no). If the value
IS a vote, tell the author to use `vote-matrix`.

What this is not: `vote-matrix`. Not Money's `bar` (if `unit: usd` is
set, that is allowed for millage / money heat, but Money's bar is
usually better).

Validate: at least 1 row and 1 column; unique row / col ids; cell
`row` / `column` exist; `value` numeric finite; reject vote enums in
`value`; omit is not zero.

## 9. `network` — stakeholders, not a DAG

Use when the story is a graph of bodies, applicants, neighborhoods,
districts, funds, places. Flow is the wrong type.

This week's proofs:

- Developer–neighborhood–district on rezonings: Mason Lodge 2215
  Garfield / Sacred Heart; 335 Kent duplex; Fastenal 1009 Poplar; 74
  former ISU lots 3rd–13th to Locust; 13th Street corridor
  Wabash–Maple.
- CHI / Govina abatement — company, taxpayers, promised jobs.
- Apr 2 Ray Park — residents, the park, the trail.
- Do not encode "who votes as a bloc" as a score. `votes-with` is a
  co-occurrence on a named item and requires `item` on the edge.

YAML:

```yaml
type: network
title: "Who the Mason Lodge rezoning touches"
theme: default
caption: "The Mason Lodge proposal at 2215 Garfield sits next to Sacred Heart; the rezoning is a neighbor question, not just a map pin."
source:
  label: "The Vigo Ledger, Vol. I No. 1"
  href: "https://vigoledger.org/"
legend:
    - { label: "Applicant", pattern: solid }
    - { label: "Neighborhood", pattern: hatch }
    - { label: "Place" }
    - { label: "Body", pattern: stripes }
alt: "Four nodes: Mason Lodge, Sacred Heart, 2215 Garfield at the center, and city council. Three edges connect applicant and neighbor to the place, and the applicant to council."

nodes:
  - { id: mason, label: "Mason Lodge", kind: developer }
  - { id: sacred-heart, label: "Sacred Heart", kind: neighborhood }
  - { id: garfield, label: "2215 Garfield", kind: place }
  - { id: city-council, label: "Terre Haute City Council", kind: body }
edges:
  - { from: mason, to: garfield, rel: touches }
  - { from: sacred-heart, to: garfield, rel: abuts }
  - { from: mason, to: city-council, rel: touches }
```

Contract:

```ts
type NetworkKind =
  | 'body'
  | 'member'
  | 'developer'
  | 'neighborhood'
  | 'district'
  | 'fund'
  | 'resident-group'
  | 'place';
type NetworkRel =
  | 'votes-with'
  | 'appoints'
  | 'funds'
  | 'abuts'
  | 'represents'
  | 'touches';

interface NetworkNode {
  id: string;
  label: string;
  kind: NetworkKind;
  color?: string;
}
interface NetworkEdge {
  from: string;
  to: string;
  rel: NetworkRel;
  directed?: boolean;
  item?: string;           # required when rel is votes-with
}
interface NetworkSpec extends CivicBase { type: 'network'; nodes: NetworkNode[]; edges: NetworkEdge[]; }
```

No `unit`. Layout: force- or clustered-layout, undirected by default.
Node size constant (not a score). Kind → color via legend. Edges
labeled by `rel`.

What this is not: `flow` (directed architecture, DAG ranker). Not
`org` (org is appointment / reporting tree). Not `impact` (impact is
one item → who it touches, a hub, not a graph). Not Place's map.

Validate: unique ids; at least 2 nodes and 1 edge; edge endpoints
exist; every `kind` / `rel` in the enums; `votes-with` requires `item`;
no `score` field; node size is not a data field.

## 10. `donut` — 2–5 slice part-to-whole

Use as a last resort for yes / no / absent or general-vs-other-funds
when waffle is too large and a matrix is too much. Not a first money
type. Money owns bar / stacked-bar / treemap.

This week's proofs:

- Apr 2: 7 present / 2 absent (prefer this).
- Aug 11 passed 6-0. A 6-yea single slice is a boring donut; skip
  unless the seventh seat is a known absent / not-voting. Do not invent
  the seventh.
- Do not use donut for jail budget line-items (that is waterfall).

YAML:

```yaml
type: donut
title: "Ray Park roll call, Apr 2"
theme: default
caption: "Seven members were present and two were absent for the Ray Park vote."
source:
  label: "City council, Apr 2"
  href: "https://vigoledger.org/"
legend:
    - { label: "Present", pattern: solid }
    - { label: "Absent" }
stat:
  display: "7 present, 2 absent"
alt: "A donut with two slices: present 7 of 9 (filled) and absent 2 of 9 (unfilled). Center text reads 7 present, 2 absent."
dataTable:
  columns: [Status, Count]
  records:
    - [Present, 7]
    - [Absent, 2]

slices:
  - { id: present, label: "Present", value: 7 }
  - { id: absent, label: "Absent", value: 2 }
center:
  label: "7 present, 2 absent"
```

Contract:

```ts
interface DonutSlice {
  id: string;
  label: string;
  value: number;
  color?: string;
}
interface DonutSpec extends CivicBase { type: 'donut'; slices: DonutSlice[]; center?: { label: string; value?: string | number }; }
```

Layout: single ring, slice angle = value, legend required, center
label is the tally string. No 3D. No explosion. No more than 5 slices.

What this is not: Money's first chart. Not a pie (folded into donut).
Not waffle / isotype (Composition owns unit grids). Not a score.

Validate: 2–5 slices (1 is a delta / `stat`; >5 is a bar or waffle);
values `>= 0`; at least one positive; unique ids; error if no legend
when slice count > 2 (color is meaningless without a key); reject
scoring field names.

## Done when

- All ten types round-trip YAML → PNG / SVG / HTML / PPTX like gantt
  does.
- `caption` and `source` render under the chart (source is a real link
  in HTML).
- `legend` renders for vote colors, gates, coverage chips, kinds, and
  donut slices.
- The example files in `examples/` render without hand-tweaking.
- Validate rejects scoring fields, unknown civic states, unnamed
  guessed roll-call cells that contradict summary, donut slice counts
  outside 2–5, nested org-via-flow-groups, network-as-flow, `usd` on
  `outcome-funnel`.
- Skill doc would need updating (it currently pretends only `flow`
  exists). This spec does not edit the repo.

## Out of scope for this slice

Implementing renderers. Place maps. Money charts (including alluvial /
sankey). Composition waffle / isotype. Time timeline / gantt fixes.
Pie (folded into donut). Lollipop. Party-colored hemicycle. Scoring
officials.
