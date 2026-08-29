# Place types

Seven types, one shared geography contract. All seven show up in this week's
Ledger (Vol. I No. 1). `choropleth` is later-priority; spec it anyway so the
family is complete. Ship with Editorial chrome (`caption`, `source`, `legend`);
maps are unreadable without a legend.

Extension pattern matches gantt/timeline/quadrant:

`src/types.ts` → `parse.ts` → `validate.ts` → `src/render/index.ts` →
`src/diagrams/{locator-map,region-map,choropleth,corridor,symbol-map,zoning-map,before-after-map}/{layout,tree,pptx}.ts`.

Shared projection/basemap helpers belong in `src/diagrams/_place/` (not a
DiagramType). That is a few functions, not a GIS stack.

`gcp:maps-geospatial` is an icon slug in `skills/gcp-icons.md`. It is not a
map renderer. Do not wire it up as one.

Do not fake `corridor` as `flow`. `DiagramEdge` has no geography.

## Shared chrome (import CivicBase, do not fork)

Owned by Editorial Primitives. Locked contract:
`/workspace/diagrams-backlog/00-editorial-chrome.md`. Every place spec
**extends `CivicBase`**. Do not declare a parallel `PlaceChrome` / `Legend`
type.

```yaml
title: "..."
theme: default
caption: "One sentence a resident can read without the meeting."
source:
  label: "APC, Apr 9"
  href: "https://vigoledger.org/"
legend:
  - label: "Rezoning"
    color: "#C45C26"
```

Locked shapes (copy from Editorial; do not alias):

- `caption?: string` — dek, not `title`. No markdown, no href.
- `source?: SourceRef | SourceRef[]` — `{ label, href? }`. No `sources`, no root `href`.
- `legend?: true | false | LegendItem[] | LegendSpec` — **place types require
  `legend` present and not `false`.** `true` means auto-from-series. An item
  array or `{ items, title?, placement? }` is explicit. Choropleth and zoning
  must resolve to at least one item (explicit or auto). Locator, region,
  corridor, symbol, before-after: same rule for this family (a map without a
  key is unreadable).
- `unit?: 'usd' | 'percent' | 'count' | UnitFormat` — only those three units.
  Place uses it on choropleth values and symbol-map magnitudes. Do not
  pre-format `$` strings.
- `annotations?: Annotation[]` — mark "this parcel" with `kind: callout`.
  There is no `callout` / `callouts` field.
- `alt`, `dataTable`, `stat`/`stats`, `footnote` — available via CivicBase.
  Locator `alt` may name the highlighted place; choropleth requires
  `dataTable` to publish.

`civic:` icons on existing `icon` (`civic:fire`, `civic:school`,
`civic:housing`, `civic:roads`, `civic:zoning`). Not `gcp:maps-geospatial`.

## Shared geography (keep YAML simple)

YAML is always WGS84 lon/lat (`lon` then `lat`, GeoJSON order). No `crs`
field. Renderer projects to Web Mercator (EPSG:3857) for layout only.

```ts
interface LonLat {
  lon: number; // -180..180
  lat: number; // -90..90
}

interface PlaceBasemap {
  city: string;           // "Terre Haute" — frames the view
  county?: string;        // "Vigo"
  state?: string;         // "IN"
  center?: LonLat;        // optional; else fit features + padding
  zoom?: number;          // optional 8–16; else fit
}

type PlaceGeometry =
  | { ring: LonLat[] }           // polygon, first point repeated or auto-closed
  | { path: LonLat[] }           // linestring (corridor)
  | { geojson: string };         // path relative to the YAML file
```

Rules:

- City name + lon/lat (or a GeoJSON file ref) is the whole GIS story.
- Do not put tile URLs, API keys, Mapbox/Google style ids, or a `provider`
  field in YAML. The renderer ships one light civic basemap (streets, water,
  parks; no satellite, no 3D).
- Do not live-geocode at render time. Newspaper graphics must be
  reproducible. Pins carry lon/lat. Named districts use a GeoJSON ref or a
  canned gazetteer key (below), never a network lookup.
- A GeoJSON ref is a file next to the YAML (`examples/geometries/otter-creek-township.geojson`).
  The file is a Feature or FeatureCollection in WGS84. No Shapefile, no
  PostGIS, no topojson pipeline.
- Inline `ring` / `path` is for envelopes and corridors of a few vertices
  (a rezoning parcel, a street segment). Legal fire-district / TIF
  boundaries are GeoJSON refs, not 200-point rings pasted into YAML.

Tiny gazetteer, shipped with the library (extents, not a geocoder):

| key | label | center (lon, lat) | use |
| --- | --- | --- | --- |
| `terre-haute` | Terre Haute | -87.41391, 39.46670 | default city frame |
| `vigo-county` | Vigo County | -87.39, 39.43 | county-wide choropleth |
| `otter-creek-township` | Otter Creek Township | -87.35118, 39.56144 | fire district |

`basemap.city: Terre Haute` is enough; the key is optional sugar.

## Shared TypeScript base

```ts
import type { CivicBase, Legend } from './civic'; // 00-editorial-chrome.md
// Legend = boolean | LegendItem[] | LegendSpec
// CivicBase already has caption?: string; source?: SourceRef | SourceRef[];
// legend?: Legend; unit?: Unit | UnitFormat; annotations?: Annotation[]; alt?: string; dataTable?: DataTable

interface PlaceSpecBase extends CivicBase {
  legend: Legend;          // required on place types; must not be false
  basemap: PlaceBasemap;
}
```

`legend: Legend` is re-stated as required on `PlaceSpecBase` (CivicBase keeps
it optional so flow/gantt still work). Validate: missing or `false` is an
error. `true` is allowed when the type can auto-swatch (choropleth classes,
zoning codes, symbol `kind`). Locator / region / corridor should pass an
item array or `LegendSpec`, not `true`, unless a theme pin color is enough
to auto one swatch.

Add to `DiagramType`:

```ts
export type DiagramType =
  | 'flow' | 'gantt' | 'timeline' | 'quadrant'
  | 'locator-map' | 'region-map' | 'choropleth' | 'corridor'
  | 'symbol-map' | 'zoning-map' | 'before-after-map';
```

Optional `ThemeConfig.place`:

```ts
interface PlaceTheme {
  land: string;
  water: string;
  park: string;
  street: string;
  streetLabel: string;
  boundaryStroke: string;
  boundaryWidth: number;
  pinFill: string;
  pinStroke: string;
  pinRadius: number;
  highlightFill: string;
  highlightStroke: string;
}
```

## Shared validate (every place type)

Return `string[]` like `validate.ts` does today.

- `basemap.city` required.
- `legend` required and not `false`. If `LegendItem[]`, length ≥ 1 and every item has `label`. If `LegendSpec`, `items` or `auto: true`. If `true`, type must be able to auto-swatch. Do not fork a Place Legend type.
- Every `lon` in [-180, 180], every `lat` in [-90, 90].
- `ring` has ≥ 3 points; `path` has ≥ 2 points.
- `geojson` ref, if present, ends in `.geojson` or `.json` and is a relative
  path (no `http://`).
- Duplicate feature `id`s are errors.
- If `basemap.city` is Terre Haute / Vigo and a lon/lat is more than ~0.8°
  away, error (`"Pin X is outside the city frame"`). Catches swapped lon/lat
  (`39.46, -87.41` written as `lat, lon` in the lon field).

---

## 1. `locator-map` — pins on a city basemap

Use when the story is "this parcel is here." Same-size pins, labels on the
pins. Not a chart of magnitudes (that is `symbol-map`).

This week's proofs:

- 908 S 7th (140-year-old home rezoning delayed; not the Lodge)
- 2215 Garfield (former Mason Lodge, residential → commercial)
- 335 Kent (duplex)
- 1009 Poplar (Fastenal)
- 2722 S Fruitridge
- 3317 N 12th
- 1205 Fort Harrison
- S 8th at Wabash (Children's Museum park)

YAML:

```yaml
type: locator-map
title: "This week's rezonings"
caption: "Eight addresses the APC and council actually talked about."
source:
  label: "APC / City council, Vol. I No. 1"
  href: "https://vigoledger.org/"
legend:
  title: "This edition"
  items:
    - label: "Rezoning or site"
      color: "#C45C26"

basemap:
  city: Terre Haute
  county: Vigo
  state: IN
  center: { lon: -87.403, lat: 39.475 }

pins:
  - id: s7th-home
    label: "908 S 7th"
    lon: -87.40687
    lat: 39.45724
    note: "140-year-old home rezoning delayed (not the Lodge)"
  - id: mason-lodge
    label: "2215 Garfield"
    lon: -87.39914
    lat: 39.49361
    note: "Former Mason Lodge, R → C"
  - id: kent
    label: "335 Kent"
    lon: -87.38755
    lat: 39.47206
    note: "Duplex"
  - id: fastenal
    label: "1009 Poplar"
    lon: -87.40188
    lat: 39.46285
    note: "Fastenal"
  - id: fruitridge
    label: "2722 S Fruitridge"
    lon: -87.36012
    lat: 39.4392
    note: "House number not in OSM; 2700 block of S Fruitridge"
  - id: n12th
    label: "3317 N 12th"
    lon: -87.40041
    lat: 39.50566
  - id: fort-harrison
    label: "1205 Fort Harrison"
    lon: -87.39774
    lat: 39.50658
  - id: childrens-museum
    label: "S 8th at Wabash"
    lon: -87.40598
    lat: 39.46621
    note: "Children's Museum park"
```

Contract:

```ts
interface LocatorPin {
  id: string;
  label: string;
  lon: number;
  lat: number;
  note?: string;
  color?: string;
  icon?: string;          // civic:housing, civic:school, civic:fire — not gcp:maps-geospatial
}

interface LocatorMapSpec extends PlaceSpecBase {
  type: 'locator-map';
  pins: LocatorPin[];
}
```

Layout: fit pins + ~15% padding on the civic basemap. Pins are equal radius
(theme `pinRadius`). Label to the right of the pin; if two labels collide,
nudge the later one. Optional `annotations` entry with `kind: callout` on one pin for the
lede parcel. North arrow and scale bar, small, bottom-left. HTML title on
top; caption + source + legend below, same chrome as money.

Validate: ≥ 1 pin; every pin has `id`, `label`, `lon`, `lat`; unique ids.

What this is not: a `flow` of addresses. Not a symbol map. Not a Google
embed. `gcp:maps-geospatial` is not this type.

---

## 2. `region-map` — one outlined district

Use when the story is a single area: a fire district, a corridor envelope,
a land-bank block. One fill, one outline, city around it for context.

This week's proofs:

- Otter Creek Township fire district (new fire tax district, outside city)
- 13th Street corridor (Wabash–Maple, 13th–25th)
- 74 former ISU lots (3rd–13th to Locust)

YAML (fire district — gazetteer key; swap in county GeoJSON for publish):

```yaml
type: region-map
title: "Otter Creek Township fire district"
caption: "The proposed fire tax district is the township, outside Terre Haute city limits."
source:
  label: "County council, Aug 13"
  href: "https://vigoledger.org/"
legend:
  items:
    - label: "Otter Creek Township"
      color: "#C45C26"
    - label: "Terre Haute city"
      color: "#D9D1C3"

basemap:
  city: Terre Haute
  county: Vigo
  state: IN
  center: { lon: -87.38, lat: 39.52 }

region:
  id: otter-creek
  label: "Otter Creek Township"
  place: otter-creek-township    # canned gazetteer; or geojson: ./geometries/otter-creek.geojson
```

YAML (13th Street envelope, inline ring — not a corridor; the story is the
district, not the road):

```yaml
type: region-map
title: "13th Street corridor"
caption: "The advocacy district runs Wabash to Maple, 13th to 25th."
source:
  label: "City council, Vol. I No. 1"
  href: "https://vigoledger.org/"
legend:
  items:
    - label: "13th Street corridor"
      color: "#C45C26"

basemap:
  city: Terre Haute
  county: Vigo
  state: IN

region:
  id: thirteenth
  label: "13th Street corridor"
  ring:
    - { lon: -87.3985, lat: 39.4662 }   # 13th & Wabash
    - { lon: -87.3817, lat: 39.4662 }   # 25th & Wabash
    - { lon: -87.3817, lat: 39.4740 }   # 25th & Maple (envelope)
    - { lon: -87.3985, lat: 39.4740 }   # 13th & Maple
```

YAML (ISU lots):

```yaml
type: region-map
title: "Former ISU lots"
caption: "Seventy-four lots between 3rd and 13th, up to Locust."
source:
  label: "Redevelopment, Vol. I No. 1"
  href: "https://vigoledger.org/"
legend:
  items:
    - label: "74 former ISU lots"
      color: "#C45C26"

basemap:
  city: Terre Haute
  county: Vigo
  state: IN
  center: { lon: -87.406, lat: 39.472 }

region:
  id: isu-lots
  label: "Former ISU lots"
  ring:
    - { lon: -87.4125, lat: 39.4685 }   # 3rd, south edge
    - { lon: -87.3985, lat: 39.4685 }   # 13th
    - { lon: -87.3985, lat: 39.4770 }   # 13th & Locust (envelope)
    - { lon: -87.4125, lat: 39.4770 }
```

Contract:

```ts
interface RegionFeature {
  id: string;
  label: string;
  place?: string;          // gazetteer key
  ring?: LonLat[];
  geojson?: string;
  color?: string;
}

interface RegionMapSpec extends PlaceSpecBase {
  type: 'region-map';
  region: RegionFeature;   // exactly one
  context?: RegionFeature[]; // optional extra outlines (city limit)
}
```

Exactly one of `place` | `ring` | `geojson` on the region.

Layout: fill at ~35% opacity, stroke 2px, label at polygon centroid (or
gazetteer center). City frame around it so "outside city limits" is visible.
North arrow + scale. Do not draw more than one highlighted district; extra
`context` outlines are line-only.

Validate: `region` present; exactly one geometry field; if `ring`, ≥ 3
points; gazetteer `place` must be a known key.

What this is not: a choropleth (no value). Not a corridor (no linear
geography). Not a zoning map.

---

## 3. `choropleth` — areas shaded by a value

Later-priority. Spec it so wheel-tax / TIF / fire-district stories have a
home. Use when each area has a number (or a category that is really a
value class).

Proofs (this week and next):

- Fire districts (rate / yes-no coverage)
- Tax and TIF districts
- Wheel-tax city vs county

YAML:

```yaml
type: choropleth
title: "Wheel tax: city vs county"
unit: usd
caption: "Who pays the wheel tax depends on which side of the city limit the car is kept."
source:
  label: "County council, Jul 9"
  href: "https://vigoledger.org/"
legend:
  title: "Wheel tax"
  items:
    - label: "City"
      color: "#5B7C6A"
    - label: "County (outside city)"
      color: "#C45C26"

basemap:
  city: Terre Haute
  county: Vigo
  state: IN

breaks: categorical          # categorical | quantile | equal | explicit
valueKey: class

features:
  - id: city
    label: "Terre Haute"
    place: terre-haute
    value: city
  - id: county
    label: "Vigo County"
    place: vigo-county
    value: county
```

YAML (numeric, explicit breaks — TIF-style, values filled from the note):

```yaml
type: choropleth
title: "CBD TIF: collected vs spent"
unit: usd
caption: "The CBD TIF spent $46,494 more than it collected."
source:
  label: "Redevelopment, Vol. I No. 1"
  href: "https://vigoledger.org/"
legend:
  title: "Surplus / shortfall"
  items:
    - label: "Shortfall"
      color: "#9B3A2F"
    - label: "Near even"
      color: "#D9D1C3"
    - label: "Surplus"
      color: "#5B7C6A"

basemap:
  city: Terre Haute
  county: Vigo
  state: IN

breaks: explicit
breakValues: [-50000, 0, 50000]
valueKey: delta

features:
  - id: cbd-tif
    label: "CBD TIF"
    geojson: ./geometries/cbd-tif.geojson
    value: -46494
```

Contract:

```ts
interface ChoroplethFeature {
  id: string;
  label: string;
  value: number | string;
  place?: string;
  ring?: LonLat[];
  geojson?: string;
}

interface ChoroplethSpec extends PlaceSpecBase {
  type: 'choropleth';
  breaks: 'categorical' | 'quantile' | 'equal' | 'explicit';
  breakValues?: number[];     // required when breaks is explicit
  classes?: number;           // default 5 for quantile/equal
  valueKey?: string;
  features: ChoroplethFeature[];
}
```

Layout: sequential palette for numbers (light → dark, or Editorial's
diverging if values are signed). Categorical palette for city vs county.
Legend is a stepped key, not a pin list. No overlapping choropleth layers.
Missing `value` draws the outline and a hatched fill, labeled "n/a".

Validate: ≥ 1 feature; every feature has `value` **or** is explicitly
nullable with `value: null` (hatched); `breaks: explicit` requires
`breakValues`; categorical values must each appear on a legend item;
exactly one geometry field per feature.

What this is not: a region-map with extra colors. Not a zoning map
(zoning is a code, not a number). Bubble maps are out (civic-newsroom
research: skip).

---

## 4. `corridor` — linear geography along a road

Use when the story is a road, a trail, or a widening: a line with a start
and an end, optional width for right-of-way. Callouts sit on the mile, not
on a flowchart rank.

This week's proofs:

- Clinton Road widening ($3M → $500k is the money `delta`; this type is the
  road itself)
- 13th Street corridor advocacy (the *street*, when the story is linear;
  use `region-map` when the story is the bounding district)
- Riley Trail

YAML:

```yaml
type: corridor
title: "Clinton Road widening"
caption: "EDIT-fund funding for the widening dropped from $3 million to $500,000; the road still runs north through Otter Creek."
source:
  label: "County council, Aug 13"
  href: "https://vigoledger.org/"
legend:
  items:
    - label: "Clinton Road (project)"
      color: "#C45C26"
    - label: "Fire Station 1"
      color: "#3F3A36"

basemap:
  city: Terre Haute
  county: Vigo
  state: IN
  center: { lon: -87.370, lat: 39.530 }

corridor:
  id: clinton-road
  label: "Clinton Road"
  path:
    - { lon: -87.3700, lat: 39.5000 }    # south, toward city
    - { lon: -87.3692, lat: 39.53549 }   # 5701 N Clinton St, Otter Creek Station 1
    - { lon: -87.3680, lat: 39.5614 }    # north, township
  widthMeters: 40                        # optional ROW hint, not a GIS buffer stack

stops:
  - id: station-1
    label: "Otter Creek Station 1"
    lon: -87.36917
    lat: 39.53549
  - id: south
    label: "Toward Terre Haute"
    lon: -87.3700
    lat: 39.5000
  - id: north
    label: "Toward Clinton"
    lon: -87.3680
    lat: 39.5614
```

YAML (Riley Trail):

```yaml
type: corridor
title: "Riley Trail"
caption: "The Riley Spur Trail is the linear park the county keeps funding as a trail, not a road."
source:
  label: "County council, Vol. I No. 1"
  href: "https://vigoledger.org/"
legend:
  items:
    - label: "Riley Spur Trail"
      color: "#5B7C6A"

basemap:
  city: Terre Haute
  county: Vigo
  state: IN
  center: { lon: -87.310, lat: 39.393 }

corridor:
  id: riley-trail
  label: "Riley Spur Trail"
  path:
    - { lon: -87.3180, lat: 39.4000 }
    - { lon: -87.31024, lat: 39.39270 }
    - { lon: -87.3000, lat: 39.3860 }
```

Contract:

```ts
interface CorridorStop {
  id: string;
  label: string;
  lon: number;
  lat: number;
  note?: string;
}

interface CorridorSpec extends PlaceSpecBase {
  type: 'corridor';
  corridor: {
    id: string;
    label: string;
    path: LonLat[];        // ≥ 2
    geojson?: string;      // alternative to path (LineString)
    widthMeters?: number;
    color?: string;
  };
  stops?: CorridorStop[];
}
```

Exactly one of `path` | `geojson` on `corridor`.

Layout: thick stroke along the path (width from `widthMeters` scaled to
pixels, with a min/max so a 40 m ROW does not vanish or swallow the city).
Start/end labels. Stops as ticks + labels offset perpendicular to the
path. Frame is a padded bbox of the path, not the whole county, so a
three-mile widening is readable. Optional band fill at low opacity for ROW.

Validate: `path.length >= 2` or a LineString GeoJSON ref; `widthMeters`,
if set, > 0; stop lon/lat required when `stops` present.

What this is not: a `flow`. Ranked boxes with arrows are the wrong
geography. A corridor is a street. Also not a region-map of the 13th
Street *district* — pick region vs corridor by whether the story is an
area or a line.

---

## 5. `symbol-map` — point markers, size and color mean something

Use when each point has a magnitude or a type: demolitions, cameras,
schools, liquor licenses. Same geography as locator; the encoding is
different. Locator pins are equal. Symbol markers are not.

Proofs:

- ~10 demolitions
- 30 license-plate cameras
- school buildings (East Side school, Rio Grande, Otter Creek Middle)
- developments / liquor licenses

YAML:

```yaml
type: symbol-map
title: "Where the cameras and the school sit"
unit: count
caption: "Thirty plate cameras and the east-side school are points, not districts."
source:
  label: "City council / VCSC, Vol. I No. 1"
  href: "https://vigoledger.org/"
legend:
  title: "Type"
  items:
    - label: "License-plate camera"
      color: "#3F3A36"
    - label: "School"
      color: "#5B7C6A"
    - label: "Park"
      color: "#7A8F4F"

basemap:
  city: Terre Haute
  county: Vigo
  state: IN

sizeBy: count            # optional field name; omit = equal size
colorBy: kind

points:
  - id: cameras-downtown
    label: "Plate cameras (downtown cluster)"
    lon: -87.41391
    lat: 39.46670
    kind: camera
    count: 12
  - id: east-side-school
    label: "East Side school"
    lon: -87.36012
    lat: 39.47253
    kind: school
    count: 1
    note: "East-side campus near Fruitridge / Deming Park; confirm building name from the note"
  - id: ray-park
    label: "Ray Park"
    lon: -87.40203
    lat: 39.42259
    kind: park
    count: 1
    note: "OSM: Rea Park Golf Course, 3500 S 7th"
  - id: rio-grande
    label: "Rio Grande Elementary"
    lon: -87.35118
    lat: 39.56144
    kind: school
    count: 1
    note: "In Otter Creek Township; pin at township center until the site lon/lat is in the note"
```

Contract:

```ts
interface SymbolPoint {
  id: string;
  label: string;
  lon: number;
  lat: number;
  kind?: string;
  count?: number;
  note?: string;
  color?: string;
}

interface SymbolMapSpec extends PlaceSpecBase {
  type: 'symbol-map';
  sizeBy?: string;         // field on the point (usually count)
  colorBy?: string;        // field on the point (usually kind)
  points: SymbolPoint[];
}
```

Layout: circle area ∝ `sizeBy` (sqrt scale, so a 30-camera dot is not 30×
a 1-school dot). Color from `colorBy` via legend items. If `sizeBy` is
omitted, radius = locator pin. Legend shows both a color key and, when
`sizeBy` is set, three sample sizes (min / mid / max). Do not overlap a
choropleth fill; this type is points on the civic basemap.

Validate: ≥ 1 point; `sizeBy` / `colorBy` names, if set, exist on at least
one point; `count` ≥ 0 when present; every `kind` value has a legend item
when `colorBy: kind`.

What this is not: a locator (no magnitude). Not a bubble-on-choropleth.
ProPublica guidance still holds: skip bubble *maps* of rates; this type is
counts and categories of sites.

---

## 6. `zoning-map` — categorical polygons plus a code legend

Use when the story is a zoning code: R-1, C-2, overlay. The legend is the
ordinance table, not a color afterthought. Current district vs allowed use
on **one** map; the land-use *change* is `before-after-map`.

This week's proofs:

- Mason Lodge, 2215 Garfield, residential → commercial
- 335 Kent duplex
- Fastenal, 1009 Poplar
- Children's Museum 8th Street park

YAML:

```yaml
type: zoning-map
title: "2215 Garfield — former Mason Lodge"
caption: "Council approved rezoning the former Mason Lodge from residential to commercial."
source:
  label: "APC, Vol. I No. 1"
  href: "https://vigoledger.org/"
legend:
  title: "Zoning"
  items:
    - label: "R-1 Residential"
      color: "#E6D9B8"
    - label: "C-2 Commercial"
      color: "#C45C26"
    - label: "Park / civic"
      color: "#7A8F4F"

basemap:
  city: Terre Haute
  county: Vigo
  state: IN
  center: { lon: -87.4069, lat: 39.4572 }
  zoom: 16

parcels:
  - id: mason-lodge
    label: "908 S 7th"
    code: R-1
    ring:
      - { lon: -87.40710, lat: 39.45710 }
      - { lon: -87.40664, lat: 39.45710 }
      - { lon: -87.40664, lat: 39.45738 }
      - { lon: -87.40710, lat: 39.45738 }
  - id: neighbors-r
    label: "Adjacent residential"
    code: R-1
    ring:
      - { lon: -87.40740, lat: 39.45690 }
      - { lon: -87.40640, lat: 39.45690 }
      - { lon: -87.40640, lat: 39.45750 }
      - { lon: -87.40740, lat: 39.45750 }
    note: "Envelope for context; replace with parcel GeoJSON from the APC packet"
```

A second example, Fastenal on Poplar:

```yaml
type: zoning-map
title: "1009 Poplar — Fastenal"
caption: "The Poplar Street site sits in a commercial district; the fight is the use, not the pin."
source:
  label: "APC, Vol. I No. 1"
  href: "https://vigoledger.org/"
legend:
  title: "Zoning"
  items:
    - label: "C-2 Commercial"
      color: "#C45C26"
    - label: "Adjacent mixed"
      color: "#D9D1C3"

basemap:
  city: Terre Haute
  county: Vigo
  state: IN
  center: { lon: -87.40188, lat: 39.46285 }
  zoom: 16

parcels:
  - id: fastenal
    label: "1009 Poplar"
    code: C-2
    ring:
      - { lon: -87.40210, lat: 39.46270 }
      - { lon: -87.40165, lat: 39.46270 }
      - { lon: -87.40165, lat: 39.46300 }
      - { lon: -87.40210, lat: 39.46300 }
```

Contract:

```ts
interface ZoningParcel {
  id: string;
  label: string;
  code: string;            // "R-1" | "C-2" | overlay id
  ring?: LonLat[];
  geojson?: string;
  overlay?: string;        // optional second code (historic, flood, TIF)
  note?: string;
}

interface ZoningMapSpec extends PlaceSpecBase {
  type: 'zoning-map';
  parcels: ZoningParcel[];
}
```

Layout: each parcel filled by `code` → legend color. Overlays are hatch or
a second stroke, called out in the same legend (`"R-1 + historic overlay"`).
Zoom is parcel-scale (16), not city-scale. Label the subject parcel; mute
neighbors. Code legend at the right or below, ordinance order (R, then C,
then I, then overlays), not rainbow order.

Validate: ≥ 1 parcel; every `code` has a legend item; exactly one of
`ring` | `geojson`; overlay codes also appear on the legend if used.

What this is not: a choropleth of assessed value. Not a before-after
(that is the next type). Not a locator with a colored pin.

---

## 7. `before-after-map` — current vs proposed, static

Use when the story is the change: what the land-use *was* and what the
petition *asks*. Two panels side by side, or one overlay of proposed on
current. **Static.** No slider, no animation, no GIF. Print and PPTX have
to work.

Same rezonings as zoning-map: Mason Lodge, Kent duplex, Fastenal, Children's
Museum park.

YAML (split panels — default, the print version):

```yaml
type: before-after-map
title: "2215 Garfield: residential to commercial"
caption: "Left is the lot as zoned. Right is the commercial district council approved for the former Mason Lodge."
source:
  label: "APC, Vol. I No. 1"
  href: "https://vigoledger.org/"
legend:
  title: "Zoning"
  items:
    - label: "R-1 Residential"
      color: "#E6D9B8"
    - label: "C-2 Commercial"
      color: "#C45C26"

basemap:
  city: Terre Haute
  county: Vigo
  state: IN
  center: { lon: -87.40687, lat: 39.45724 }
  zoom: 16

layout: split              # split | overlay

extent:                    # shared camera; both panels use this
  - { lon: -87.4080, lat: 39.4565 }
  - { lon: -87.4057, lat: 39.4565 }
  - { lon: -87.4057, lat: 39.4580 }
  - { lon: -87.4080, lat: 39.4580 }

before:
  label: "Current"
  parcels:
    - id: mason-lodge
      label: "908 S 7th"
      code: R-1
      ring:
        - { lon: -87.40710, lat: 39.45710 }
        - { lon: -87.40664, lat: 39.45710 }
        - { lon: -87.40664, lat: 39.45738 }
        - { lon: -87.40710, lat: 39.45738 }

after:
  label: "Proposed"
  parcels:
    - id: mason-lodge
      label: "908 S 7th"
      code: C-2
      ring:
        - { lon: -87.40710, lat: 39.45710 }
        - { lon: -87.40664, lat: 39.45710 }
        - { lon: -87.40664, lat: 39.45738 }
        - { lon: -87.40710, lat: 39.45738 }
```

YAML (overlay — hatched proposed on current, one panel):

```yaml
type: before-after-map
title: "335 Kent duplex"
caption: "Current zoning in fill; proposed duplex district in hatch. Same lot, one frame."
source:
  label: "APC, Vol. I No. 1"
  href: "https://vigoledger.org/"
legend:
  items:
    - label: "Current"
      color: "#E6D9B8"
    - label: "Proposed (hatch)"
      color: "#C45C26"

basemap:
  city: Terre Haute
  county: Vigo
  state: IN
  center: { lon: -87.38755, lat: 39.47206 }
  zoom: 16

layout: overlay

before:
  label: "Current"
  parcels:
    - id: kent
      label: "335 Kent"
      code: R-1
      ring:
        - { lon: -87.38775, lat: 39.47195 }
        - { lon: -87.38735, lat: 39.47195 }
        - { lon: -87.38735, lat: 39.47218 }
        - { lon: -87.38775, lat: 39.47218 }

after:
  label: "Proposed"
  parcels:
    - id: kent
      label: "335 Kent"
      code: duplex
      ring:
        - { lon: -87.38775, lat: 39.47195 }
        - { lon: -87.38735, lat: 39.47195 }
        - { lon: -87.38735, lat: 39.47218 }
        - { lon: -87.38775, lat: 39.47218 }
```

Contract:

```ts
interface BeforeAfterPanel {
  label: string;
  parcels: ZoningParcel[];
}

interface BeforeAfterMapSpec extends PlaceSpecBase {
  type: 'before-after-map';
  layout?: 'split' | 'overlay';   // default split
  extent?: LonLat[];              // shared camera; else fit union
  before: BeforeAfterPanel;
  after: BeforeAfterPanel;
}
```

Layout:

- `split` (default): two identical cameras, labeled CURRENT / PROPOSED,
  shared scale bar and legend. One caption under both. PPTX: two frames
  on one slide, not a transition.
- `overlay`: current fill, proposed hatch (or dashed stroke) on top.
  Legend must distinguish fill vs hatch. Still static.

Same `extent` both sides so the lot does not "jump." Do not add a range
input, a play button, or a swipe.

Validate: `before` and `after` both present with ≥ 1 parcel; `layout` is
`split` or `overlay` if set; parcel ids in `after` should match `before`
(warn, do not error, if a lot is added); legend covers codes on both
panels.

What this is not: a slider. Not two unrelated locators. Not a `delta`
(that is money). The money story of Clinton Road is `$3M → $500k`; the
place story of Mason Lodge is R-1 → C-2 on the same lot.

---

## Coordinates used in the examples

WGS84. Sources: OpenStreetMap Nominatim (pins), USGS / TopoQuest (Otter
Creek Township centroid), Otter Creek Fire (Station 1 = 5701 N Clinton St).
Envelopes for 13th Street, ISU lots, and parcel rings are **simplified**
for layout tests; a published Ledger graphic replaces those rings with a
GeoJSON ref from the APC packet or county GIS.

| id | label | lon | lat |
| --- | --- | --- | --- |
| terre-haute | city center | -87.41391 | 39.46670 |
| mason-lodge | 908 S 7th | -87.40687 | 39.45724 |
| garfield | 2215 Garfield | -87.39914 | 39.49361 |
| kent | 335 Kent | -87.38755 | 39.47206 |
| fastenal | 1009 Poplar | -87.40188 | 39.46285 |
| fruitridge | 2722 S Fruitridge | -87.36012 | 39.4392 |
| n12th | 3317 N 12th | -87.40041 | 39.50566 |
| fort-harrison | 1205 Fort Harrison | -87.39774 | 39.50658 |
| childrens-museum | 727 Wabash (S 8th at Wabash) | -87.40598 | 39.46621 |
| otter-creek | township centroid | -87.35118 | 39.56144 |
| station-1 | 5701 N Clinton St | -87.36917 | 39.53549 |
| riley-trail | Riley Spur Trail | -87.31024 | 39.39270 |
| ray-park | Ray Park / Rea Park | -87.40203 | 39.42259 |
| isu | 200 N 7th | -87.40921 | 39.47092 |

`2722 S Fruitridge`: OSM has the street, not the house. Lon from S
Fruitridge; lat interpolated to the 2700 South block. `Ray Park` is the
Ledger label; OSM's name is Rea Park Golf Course at 3500 S 7th.

## Done when

- All seven types round-trip YAML → PNG/SVG/HTML/PPTX like gantt does.
- `caption`, `source`, and `legend` render (source is a link in HTML).
- Validate rejects missing legend, swapped lon/lat, empty pin lists, and
  corridor-as-flow YAML (`nodes`/`edges` on a place type).
- Basemap is the shipped civic style; no provider key in YAML.
- `before-after-map` has no slider in HTML.
- Skill doc lists the seven types (it currently pretends only `flow` exists).
- Example files render without hand-tweaking:
  `examples/ledger-locator-rezonings.yaml`
  `examples/ledger-region-otter-creek.yaml`
  `examples/ledger-corridor-clinton-road.yaml`
  `examples/ledger-zoning-908-s7th.yaml`
  `examples/ledger-before-after-908-s7th.yaml`

## Out of scope for this slice

- Live geocoding, tile APIs, Mapbox/Google, satellite, 3D, street view.
- Bubble maps of rates.
- A slider on before-after.
- Treating `gcp:maps-geospatial` as a renderer.
- Faking corridor as `flow`.
- Legal parcel geometry inside YAML (use a GeoJSON ref).
- Money types, vote maps, org charts.
