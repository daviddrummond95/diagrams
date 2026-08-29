import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { diagram, validate } from '../src/index.js';
import type { AnyDiagramSpec, CivicBase, DiagramType } from '../src/types.js';

type Family = 'money' | 'place' | 'process' | 'time' | 'composition';

interface TortureSample {
  id: string;
  family: Family;
  eyebrow: string;
  stress: string[];
  spec: AnyDiagramSpec;
}

const long = (index: number) => [
  'Department of Redevelopment, Infrastructure, and Neighborhood Opportunity',
  'County-administered public service with a name that refuses to be abbreviated',
  'Resident-facing program with extensive statutory and reporting obligations',
  'Intergovernmental capital project with a multi-year implementation horizon',
  'Unallocated, restricted, or not-yet-classified public funds',
][index % 5];

const chrome = <Type extends DiagramType>(type: Type, title: string, caption: string, unit?: 'usd' | 'percent' | 'count'): CivicBase & { type: Type } => ({
  type,
  title,
  caption,
  unit,
  source: { label: 'Deterministic torture harness · illustrative data' },
  alt: `${title}. ${caption}`,
});

const ring = (lon: number, lat: number, width = 0.001, height = width) => [
  { lon: lon - width, lat: lat - height },
  { lon: lon + width, lat: lat - height },
  { lon: lon + width, lat: lat + height },
  { lon: lon - width, lat: lat + height },
];

// Omit a fixed zoom so every specimen exercises the renderer's data-fit camera.
const basemap = { city: 'Terre Haute', county: 'Vigo', state: 'IN', center: { lon: -87.4069, lat: 39.4667 } };
const palette = ['#E4572E', '#17BEBB', '#3D348B', '#F3A712', '#5C946E', '#9C528B'];

const samples: TortureSample[] = [
  {
    id: 'sankey-pressure', family: 'money', eyebrow: 'Money · flow',
    stress: ['12 nodes', '17 ribbons', 'zero-value link', 'long labels', '1 → 75M range'],
    spec: {
      ...chrome('sankey', 'One revenue stream, twelve destinations', 'Hairline zeroes, giant transfers, and a packed middle stage test ribbon and label separation.', 'usd'),
      nodes: [
        ...['property', 'income', 'grants', 'fees'].map((id, index) => ({ id, label: ['Property-tax levy', 'Local income-tax allocation', 'State and federal grant receipts', 'Permits, fees, and service charges'][index] })),
        ...['general', 'capital', 'restricted', 'reserve'].map((id, index) => ({ id, label: ['General operating fund', 'Capital projects fund', 'Restricted-purpose funds', 'Rainy-day and stabilization reserve'][index] })),
        ...['safety', 'streets', 'housing', 'admin'].map((id, index) => ({ id, label: ['Public safety and emergency response', 'Streets, drainage, and transportation', 'Housing and neighborhood reinvestment', 'Administration and shared services'][index] })),
      ],
      links: [
        { from: 'property', to: 'general', value: 75_000_000 }, { from: 'property', to: 'capital', value: 3_250_000 },
        { from: 'income', to: 'general', value: 22_400_000 }, { from: 'income', to: 'reserve', value: 1_200_000 },
        { from: 'grants', to: 'restricted', value: 14_800_000 }, { from: 'grants', to: 'capital', value: 8_500_000 },
        { from: 'fees', to: 'general', value: 1_100_000 }, { from: 'fees', to: 'restricted', value: 0, label: 'No transfer recorded' },
        { from: 'general', to: 'safety', value: 53_000_000 }, { from: 'general', to: 'streets', value: 21_500_000 },
        { from: 'general', to: 'admin', value: 24_000_000 }, { from: 'capital', to: 'streets', value: 7_500_000 },
        { from: 'capital', to: 'housing', value: 4_250_000 }, { from: 'restricted', to: 'housing', value: 9_600_000 },
        { from: 'restricted', to: 'safety', value: 5_200_000 }, { from: 'reserve', to: 'safety', value: 350_000 },
        { from: 'reserve', to: 'admin', value: 850_000 },
      ],
    },
  },
  {
    id: 'waterfall-whiplash', family: 'money', eyebrow: 'Money · change',
    stress: ['mixed signs', 'near-zero step', 'billion-dollar outlier', '11 labels'],
    spec: {
      ...chrome('waterfall', 'The budget that changed direction eleven times', 'Positive, negative, negligible, and enormous adjustments share one readable baseline.', 'usd'),
      start: { label: 'Introduced operating plan', value: 84_250_000 },
      steps: [15_000_000, -4_300_000, 125, -11_800_000, 2_400_000, -50_000, 1_250_000_000, -975_000_000, 620_000, -8_900_000, 0].map((value, index) => ({ id: `adjustment-${index + 1}`, label: `${long(index)} · amendment ${index + 1}`, value })),
      end: { label: 'Adopted total after reconciliation' },
    },
  },
  {
    id: 'grouped-bar-crowd', family: 'money', eyebrow: 'Money · comparison',
    stress: ['12 categories', '5 series', 'negative values', '60 marks', 'skewed scale'],
    spec: {
      ...chrome('grouped-bar', 'Five plans across twelve crowded programs', 'Sixty bars, signed values, and verbose categories pressure the shared axis and legend.', 'usd'),
      categories: Array.from({ length: 12 }, (_, index) => `${String(index + 1).padStart(2, '0')} · ${long(index)}`),
      series: Array.from({ length: 5 }, (_, seriesIndex) => ({
        id: `plan-${seriesIndex + 1}`,
        label: ['Introduced', 'Committee substitute', 'Executive revision', 'Public hearing draft', 'Final adopted'][seriesIndex],
        color: palette[seriesIndex],
        values: Array.from({ length: 12 }, (_, index) => index === 10 && seriesIndex === 4
          ? 920_000_000
          : (index % 5 === 0 ? -1 : 1) * Math.round((index + 1) * (seriesIndex + 2) * 187_500)),
      })),
    },
  },
  {
    id: 'treemap-fractal', family: 'money', eyebrow: 'Money · hierarchy',
    stress: ['nested hierarchy', 'zero-value leaves', 'tiny allocations', 'long labels'],
    spec: {
      ...chrome('treemap', 'The appropriation inside the appropriation', 'Deep nesting and a nine-order-of-magnitude range test minimum cells and label fallback.', 'usd'),
      nodes: [{ id: 'all', label: 'All governmental funds and component units', children: [
        { id: 'operations', label: 'Recurring operations', children: [
          { id: 'payroll', label: 'Salaries, benefits, and statutory payroll costs', value: 310_000_000 },
          { id: 'utilities', label: 'Utilities and facility operations', value: 22_000_000 },
          { id: 'postage', label: 'Public notice postage adjustment', value: 17 },
        ] },
        { id: 'capital', label: 'Capital improvement program', children: [
          { id: 'roads', label: 'Roads, bridges, drainage, and complete streets', value: 145_000_000 },
          { id: 'parks', label: 'Parks, trails, and public-realm investments', value: 18_500_000 },
          { id: 'placeholder', label: 'Reserved but currently unfunded project', value: 0 },
        ] },
        { id: 'community', label: 'Community and neighborhood initiatives', children: [
          { id: 'housing', label: 'Affordable housing stabilization', value: 8_400_000 },
          { id: 'arts', label: 'Arts access microgrants', value: 9_500 },
          { id: 'pilot', label: 'One-block demonstration pilot', value: 250 },
        ] },
      ] }],
    },
  },
  {
    id: 'slope-crossings', family: 'money', eyebrow: 'Money · before/after',
    stress: ['14 crossing series', 'equal endpoints', 'long labels', 'signed values'],
    spec: {
      ...chrome('slope', 'Fourteen programs cross between drafts', 'Repeated endpoints and reversals force endpoint label deconfliction on both columns.', 'usd'),
      columns: { from: 'Introduced ordinance', to: 'Adopted ordinance' },
      items: Array.from({ length: 14 }, (_, index) => ({
        id: `program-${index}`,
        label: `${index + 1}. ${long(index)}`,
        from: index < 5 ? 2_000_000 : (index - 6) * 430_000,
        to: index % 4 === 0 ? 2_000_000 : (7 - index) * 510_000,
        color: palette[index % palette.length],
      })),
    },
  },
  {
    id: 'line-coincidence', family: 'money', eyebrow: 'Money · trend',
    stress: ['18 periods', '5 coincident series', 'huge spike', 'negative dip'],
    spec: {
      ...chrome('line', 'Five funds share the same number—until they do not', 'Coincident points, a billion-dollar spike, and an isolated negative value test displacement and scaling.', 'usd'),
      periods: Array.from({ length: 18 }, (_, index) => `FY${2009 + index}`),
      series: Array.from({ length: 5 }, (_, seriesIndex) => ({
        id: `fund-${seriesIndex}`,
        label: `${['General', 'Capital', 'Redevelopment', 'Stormwater', 'Transit'][seriesIndex]} fund, audited actual`,
        color: palette[seriesIndex],
        values: Array.from({ length: 18 }, (_, index) => index < 7
          ? 12_000_000
          : index === 12 && seriesIndex === 4
            ? 1_400_000_000
            : index === 15 && seriesIndex === 2
              ? -80_000_000
              : 12_000_000 + (index - 6) * (seriesIndex + 1) * 460_000),
      })),
    },
  },
  {
    id: 'locator-pileup', family: 'place', eyebrow: 'Place · locator',
    stress: ['16 co-located pins', 'micro-offsets', 'long addresses', 'leader lines'],
    spec: {
      ...chrome('locator-map', 'Sixteen public records point to one corner', 'Almost-identical coordinates test deterministic marker packing and label-box placement.'),
      legend: { auto: true, placement: 'bottom', title: 'Public record locations' }, basemap,
      pins: Array.from({ length: 16 }, (_, index) => ({
        id: `pin-${index}`, label: `${120 + index}½ Wabash Avenue — ${long(index)}`,
        note: index % 3 === 0 ? 'Entrance is recorded on the alley-facing elevation' : undefined,
        lon: -87.40687 + (index % 4) * 0.000001, lat: 39.46673 + (index % 3) * 0.000001,
        color: palette[index % palette.length], icon: index % 2 ? 'civic:building' : 'civic:pin',
      })),
    },
  },
  {
    id: 'symbol-pileup', family: 'place', eyebrow: 'Place · proportional symbols',
    stress: ['14 co-located symbols', '0 → 2.5M counts', 'sqrt scale', 'categorical color'],
    spec: {
      ...chrome('symbol-map', 'A downtown block with wildly unequal counts', 'Size and collision packing remain legible when every point nearly shares a coordinate.', 'count'),
      legend: { auto: true, placement: 'bottom', title: 'Facility type and record count' }, basemap, sizeBy: 'count', colorBy: 'kind',
      points: [0, 1, 1, 2, 4, 9, 17, 80, 410, 2_400, 12_000, 95_000, 800_000, 2_500_000].map((count, index) => ({
        id: `symbol-${index}`, label: `${['Camera', 'School', 'Shelter', 'Park'][index % 4]} record cluster ${index + 1}`,
        lon: -87.4055 + (index % 3) * 0.000002, lat: 39.4672 + (index % 2) * 0.000002,
        count, kind: ['camera', 'school', 'shelter', 'park'][index % 4], color: palette[index % 4],
      })),
    },
  },
  {
    id: 'before-after-shared-camera', family: 'place', eyebrow: 'Place · scenario',
    stress: ['shared extent', '17 narrow parcels', 'split comparison', 'repeated codes'],
    spec: {
      ...chrome('before-after-map', 'Same camera, radically different parcel pattern', 'Two dense parcel plans use a shared geographic frame so the comparison stays honest.'),
      legend: { auto: true, placement: 'bottom', title: 'Zoning code' }, basemap, layout: 'split',
      extent: [{ lon: -87.4105, lat: 39.464 }, { lon: -87.402, lat: 39.4695 }],
      before: { label: 'Current parcel pattern', parcels: Array.from({ length: 8 }, (_, index) => ({
        id: `before-${index}`, label: `Current narrow parcel ${index + 1}`, code: index % 3 === 0 ? 'C-2' : 'R-1',
        ring: ring(-87.409 + index * 0.00082, 39.4667, 0.00032, 0.00135),
      })) },
      after: { label: 'Proposed consolidation', parcels: [
        { id: 'after-main', label: 'Consolidated mixed-use development site', code: 'PUD', ring: ring(-87.4062, 39.4667, 0.00315, 0.00135), overlay: 'overlay district' },
        ...Array.from({ length: 9 }, (_, index) => ({ id: `after-edge-${index}`, label: `Retained edge parcel ${index + 1}`, code: index % 2 ? 'R-1' : 'C-2', ring: ring(-87.409 + index * 0.00075, 39.469, 0.00025, 0.00035) })),
      ] },
    },
  },
  {
    id: 'network-hairball', family: 'process', eyebrow: 'Process · network',
    stress: ['20 nodes', '38 edges', 'six entity kinds', 'long names', 'cycles'],
    spec: {
      ...chrome('network', 'The civic network everyone calls “simple”', 'A cyclic, multi-kind graph pressures node packing, edge routing, and label containment.'),
      legend: { auto: true, placement: 'bottom', title: 'Organization kind' },
      nodes: Array.from({ length: 20 }, (_, index) => ({
        id: `node-${String(index).padStart(2, '0')}`,
        label: `${index + 1}. ${['Government body', 'Private developer', 'Neighborhood association', 'Restricted public fund', 'Resident coalition', 'Project location'][index % 6]} with an unusually specific official name`,
        kind: ['body', 'developer', 'neighborhood', 'fund', 'resident-group', 'place'][index % 6] as 'body',
        color: palette[index % palette.length],
      })),
      edges: Array.from({ length: 38 }, (_, index) => {
        const from = index % 20;
        let to = (index * 7 + 3) % 20;
        if (to === from) to = (to + 1) % 20;
        return { from: `node-${String(from).padStart(2, '0')}`, to: `node-${String(to).padStart(2, '0')}`, rel: index % 5 === 0 ? 'funds' : index % 3 === 0 ? 'represents' : 'touches', directed: index % 2 === 0, item: index % 7 === 0 ? `public-record-${index}` : undefined };
      }),
    },
  },
  {
    id: 'vote-matrix-sparse', family: 'process', eyebrow: 'Process · votes',
    stress: ['14 members', '9 items', 'sparse cells', '126 possible intersections'],
    spec: {
      ...chrome('vote-matrix', 'Nine votes, fourteen members, and deliberate silence', 'Omitted cells stay omitted while crowded labels and explicit absences remain distinguishable.'),
      legend: { auto: true, placement: 'bottom', title: 'Recorded vote' }, body: 'Consolidated City–County Legislative and Fiscal Review Body', date: '2026-08-29',
      members: Array.from({ length: 14 }, (_, index) => ({ id: `member-${index}`, label: `Council Member ${String.fromCharCode(65 + index)} with an exceptionally long surname`, seat: `District ${index + 1}` })),
      items: Array.from({ length: 9 }, (_, index) => ({ id: `item-${index}`, label: `Ordinance ${2026 + index}-${100 + index}: ${long(index)}`, mover: index === 0 ? 'member-0' : undefined, seconder: index === 0 ? 'member-1' : undefined })),
      cells: Array.from({ length: 68 }, (_, index) => ({ member: `member-${index % 14}`, item: `item-${(index * 5 + Math.floor(index / 14)) % 9}`, vote: ['yea', 'nay', 'absent', 'present-not-voting', 'excused', 'unknown'][index % 6] as 'yea' })),
      summary: { yea: 31, nay: 12, absent: 9, present: 47 },
    },
  },
  {
    id: 'hemicycle-packed', family: 'process', eyebrow: 'Process · chamber',
    stress: ['31 seats', 'named members', 'mixed status', 'mover + seconder'],
    spec: {
      ...chrome('hemicycle', 'A packed chamber with every outcome in play', 'Thirty-one seats test arc spacing, status encoding, and annotation placement.'),
      legend: { auto: true, placement: 'bottom', title: 'Seat status' },
      item: { id: 'measure-204', label: 'Ordinance 204: Consolidated capital improvement and neighborhood reinvestment program', body: 'Common Council', date: '2026-08-29' },
      seats: Array.from({ length: 31 }, (_, index) => ({ id: `seat-${index}`, member: `member-${index}`, label: index % 3 === 0 ? `Member ${index + 1} · At-large or district seat` : undefined, vote: ['yea', 'nay', 'absent', 'empty'][index % 4] as 'yea' })),
      mover: 'member-0', seconder: 'member-3', summary: { yea: 8, nay: 8, absent: 8, present: 16 },
    },
  },
  {
    id: 'heatmap-sparse', family: 'process', eyebrow: 'Process · matrix',
    stress: ['15 × 12 grid', 'sparse records', 'zero vs omitted', '69K range'],
    spec: {
      ...chrome('heatmap-table', 'The matrix where missing is not zero', 'A large, sparse table preserves semantic gaps without losing the extreme values.', 'count'),
      legend: { auto: true, placement: 'bottom', title: 'Records released' },
      rows: Array.from({ length: 15 }, (_, index) => ({ id: `row-${index}`, label: `${index + 1}. ${long(index)}` })),
      columns: Array.from({ length: 12 }, (_, index) => ({ id: `month-${index}`, label: `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][index]} ’26` })),
      cells: Array.from({ length: 92 }, (_, index) => ({ row: `row-${index % 15}`, column: `month-${(index * 7 + Math.floor(index / 15)) % 12}`, value: index % 13 === 0 ? 0 : index === 91 ? 69_000 : index * 73, label: index % 17 === 0 ? `Audited exception ${index}` : undefined })),
      scale: { min: 0, max: 69_000 },
    },
  },
  {
    id: 'timeline-timewarp', family: 'time', eyebrow: 'Time · events',
    stress: ['18 events', 'duplicate dates', '80-year gap', 'long descriptions'],
    spec: {
      ...chrome('timeline', 'Eighteen events occupy seven moments in time', 'Duplicate dates and a multi-decade gap test proportional spacing and collision lanes.'), direction: 'LR',
      events: Array.from({ length: 18 }, (_, index) => ({
        id: `event-${index}`,
        date: ['2020-01', '2020-01-01', '2020-01-02', '2020-01-02', '2024-02-29', '2038-01-19', '2099-12-31'][index % 7],
        label: `${index + 1}. ${long(index)}`,
        body: ['Council', 'Commissioners', 'Plan Commission'][index % 3],
        description: index % 2 === 0 ? 'A detailed public-record description that must wrap without invading the neighboring event.' : undefined,
      })),
    },
  },
  {
    id: 'gantt-entanglement', family: 'time', eyebrow: 'Time · schedule',
    stress: ['17 tasks', 'dependencies', 'milestones', 'open-ended work', 'mixed progress'],
    spec: {
      ...chrome('gantt', 'Seventeen tasks compete for one implementation window', 'Dependencies, progress overlays, milestones, and open-ended tasks share a long fiscal horizon.'), fyStartMonth: 7, scale: 'auto', now: '2027-03-15',
      tasks: Array.from({ length: 17 }, (_, index) => index % 6 === 0
        ? { id: `task-${index}`, label: `${index + 1}. Decision milestone — ${long(index)}`, start: `${2026 + Math.floor(index / 4)}-${String((index % 12) + 1).padStart(2, '0')}-15`, kind: 'milestone' as const, group: `Workstream ${index % 4 + 1}`, dependencies: index ? [`task-${index - 1}`] : [] }
        : index % 6 === 1
          ? { id: `task-${index}`, label: `${index + 1}. Open-ended monitoring — ${long(index)}`, start: `${2026 + Math.floor(index / 5)}-${String((index % 12) + 1).padStart(2, '0')}-01`, open: true, group: `Workstream ${index % 4 + 1}`, dependencies: [`task-${index - 1}`] }
          : { id: `task-${index}`, label: `${index + 1}. Delivery task — ${long(index)}`, start: `${2026 + Math.floor(index / 6)}-${String((index % 6) + 1).padStart(2, '0')}-01`, end: `${2026 + Math.floor(index / 6)}-${String((index % 6) + 7).padStart(2, '0')}-01`, progress: (index * 17) % 101, group: `Workstream ${index % 4 + 1}`, dependencies: index ? [`task-${index - 1}`] : [] }),
    },
  },
  {
    id: 'entity-timeline-lanes', family: 'time', eyebrow: 'Time · lanes',
    stress: ['5 lanes', '27 events', 'duplicate dates', '0 → 900M amounts'],
    spec: {
      ...chrome('entity-timeline', 'One project, five lanes, twenty-seven records', 'Coincident events remain traceable to their lane across a highly uneven time and amount range.', 'usd'),
      entity: { name: 'Union Station catalytic redevelopment and mobility program', kind: 'project' },
      lanes: Array.from({ length: 5 }, (_, index) => ({ id: `lane-${index}`, label: ['Legislation and votes', 'Funding commitments', 'Land and zoning', 'Procurement and contracts', 'Public engagement'][index], color: palette[index] })),
      events: Array.from({ length: 27 }, (_, index) => ({
        date: ['2025-01-01', '2025-01-01', '2025-01-02', '2025-06-15', '2028-01-01', '2035-12-31'][index % 6], lane: `lane-${index % 5}`,
        label: `${index + 1}. ${long(index)}`, amount: index % 7 === 0 ? 0 : index === 25 ? 900_000_000 : index * 425_000,
        description: index % 4 === 0 ? 'Linked public action with a deliberately long explanatory record.' : undefined,
      })),
    },
  },
  {
    id: 'calendar-spikes', family: 'time', eyebrow: 'Time · calendar',
    stress: ['184-day window', 'sparse cells', 'zero days', 'one huge spike'],
    spec: {
      ...chrome('calendar-heatmap', 'Six months of mostly nothing—and one impossible week', 'Sparse dates, explicit zeroes, and a single outlier test calendar geometry and color scaling.', 'count'),
      legend: { auto: true, placement: 'bottom', title: 'Daily records' }, from: '2026-01-01', to: '2026-07-03', weekStart: 'mon',
      cells: Array.from({ length: 50 }, (_, index) => {
        const date = new Date(Date.UTC(2026, 0, 1 + index * 3));
        return { date: date.toISOString().slice(0, 10), value: index % 8 === 0 ? 0 : index === 37 ? 250_000 : (index * 13) % 211, label: index === 37 ? 'Bulk legacy-record import' : undefined };
      }),
    },
  },
  {
    id: 'waffle-odd-total', family: 'composition', eyebrow: 'Composition · units',
    stress: ['137 cells', '13 columns', '7 categories', 'zero category'],
    spec: {
      ...chrome('waffle', 'One hundred thirty-seven units refuse a ten-by-ten grid', 'An awkward total, seven categories, and a zero-value category test whole-unit allocation.', 'count'),
      legend: { auto: true, placement: 'bottom', title: 'Disposition' }, mode: 'n', columns: 13,
      categories: [61, 31, 19, 13, 8, 5, 0].map((value, index) => ({ id: `category-${index}`, label: `${['Approved', 'Deferred', 'Forwarded', 'Withdrawn', 'Informational', 'Recessed', 'No record'][index]} — ${long(index)}`, value, approximate: index === 4, color: palette[index % palette.length] })),
    },
  },
  {
    id: 'isotype-fractions', family: 'composition', eyebrow: 'Composition · pictograms',
    stress: ['6 categories', 'units-per-icon scale', 'partial final icons', 'mixed symbols'],
    spec: {
      ...chrome('isotype', 'Icons do not divide evenly', 'Six uneven categories test partial units, per-category glyphs, and legend packing.', 'count'),
      legend: { auto: true, placement: 'bottom', title: 'Asset class' }, icon: 'civic:building', scale: { unitsPerIcon: 7 },
      categories: [85, 43, 22, 13, 8, 1].map((value, index) => ({
        id: `asset-${index}`, label: `${['Public buildings', 'Cameras', 'Parcels', 'Vehicles', 'Parks', 'Unclassified asset'][index]} — audited inventory`, value,
        icon: ['civic:building', 'civic:camera', 'civic:parcel', 'civic:bus', 'civic:park', 'civic:pin'][index], color: palette[index], approximate: index === 5,
      })),
    },
  },
  {
    id: 'beeswarm-singularity', family: 'composition', eyebrow: 'Composition · distribution',
    stress: ['52 dots', '31 identical values', '1 → 1B range', 'three groups'],
    spec: {
      ...chrome('beeswarm', 'Thirty-one records collapse onto the same value', 'Deterministic packing prevents collisions at the singularity while preserving billion-scale context.', 'usd'),
      legend: { auto: true, placement: 'bottom', title: 'Record group' }, axis: 'x', dotSize: 11,
      annotations: [{ kind: 'callout', text: 'Thirty-one identical awards', at: { x: 42 } }, { kind: 'peak', text: 'One exceptional capital award', at: { x: 1_000_000_000 } }],
      items: Array.from({ length: 52 }, (_, index) => ({
        id: `award-${index}`, label: `${index + 1}. ${long(index)}`, value: index < 31 ? 42 : index === 51 ? 1_000_000_000 : Math.round(Math.pow(index - 29, 5) * 37),
        group: ['Municipal', 'County', 'Intergovernmental'][index % 3], color: palette[index % 3], highlight: index % 17 === 0,
      })),
    },
  },
  {
    id: 'small-multiples-battery', family: 'composition', eyebrow: 'Composition · panels',
    stress: ['13 panels', '5-column grid', 'shared scale', 'reversals and ties'],
    spec: {
      ...chrome('small-multiples', 'Thirteen districts, one comparison grammar', 'A non-rectangular panel count and shared extreme scale test consistent miniature layouts.', 'usd'),
      panelType: 'delta', columns: 5, shareScale: true,
      panels: Array.from({ length: 13 }, (_, index) => ({ id: `district-${index}`, label: `District ${index + 1} · ${long(index)}`, spec: { from: { label: 'Introduced', value: index % 4 === 0 ? 0 : index * 125_000 }, to: { label: 'Adopted', value: index === 12 ? 88_000_000 : index % 3 === 0 ? index * -85_000 : index * 150_000 } } })),
    },
  },
  {
    id: 'data-table-dashboard', family: 'composition', eyebrow: 'Composition · table',
    stress: ['16 rows', 'four encodings', 'sparklines', 'negative + billion-scale values'],
    spec: {
      ...chrome('data-table', 'A table asked to behave like four charts', 'Text, bars, heat, and sparklines stay aligned across long labels and extreme magnitudes.', 'usd'),
      sort: { column: 'amount', direction: 'desc' },
      columns: [
        { id: 'program', label: 'Program, fund, or responsible public body', encode: 'text' },
        { id: 'amount', label: 'Adopted amount', encode: 'bar', unit: 'usd' },
        { id: 'variance', label: 'Variance intensity', encode: 'heat', unit: 'usd' },
        { id: 'trend', label: 'Seven-period audited trend', encode: 'sparkline', unit: 'usd' },
      ],
      rows: Array.from({ length: 16 }, (_, index) => ({
        program: `${index + 1}. ${long(index)}`,
        amount: index === 15 ? 1_200_000_000 : index % 7 === 0 ? -75_000 : (index + 1) * 625_000,
        variance: index % 5 === 0 ? 0 : index === 14 ? 500_000_000 : (index - 8) * 110_000,
        trend: Array.from({ length: 7 }, (_, period) => index < 3 ? 42 : (index + 1) * (period + 1) * 93_000 * (period === 4 && index % 4 === 0 ? -1 : 1)),
      })),
    },
  },
];

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function titleOf(spec: AnyDiagramSpec): string {
  return spec.title ?? spec.type ?? 'Untitled specimen';
}

function namespaceSvg(svg: string, namespace: string): string {
  const prefix = `torture-${namespace}-`;
  return svg
    .replace(/\bid="([^"]+)"/g, (_match, id: string) => `id="${prefix}${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_match, id: string) => `url(#${prefix}${id})`)
    .replace(/\b(href|xlink:href)="#([^"]+)"/g, (_match, attribute: string, id: string) => `${attribute}="#${prefix}${id}"`);
}

const rendered = await Promise.all(samples.map(async sample => {
  const errors = validate(sample.spec);
  if (errors.length) throw new Error(`${sample.id}:\n${errors.join('\n')}`);
  const rawSvg = await diagram(structuredClone(sample.spec), { format: 'svg', width: 920, padding: 28 });
  if (typeof rawSvg !== 'string' || !rawSvg.includes('<svg')) throw new Error(`${sample.id}: renderer did not return SVG`);
  const svg = namespaceSvg(rawSvg, sample.id);
  const yaml = YAML.stringify(sample.spec, { lineWidth: 88 });
  return `
    <article class="specimen" data-family="${sample.family}" id="${sample.id}">
      <header class="specimen__header">
        <div>
          <p class="specimen__eyebrow">${escapeHtml(sample.eyebrow)}</p>
          <h2>${escapeHtml(titleOf(sample.spec))}</h2>
        </div>
        <a class="anchor" href="#${sample.id}" aria-label="Link to ${escapeHtml(titleOf(sample.spec))}">#</a>
      </header>
      <ul class="stress" aria-label="Stress conditions">${sample.stress.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      <figure class="render" aria-label="Rendered ${escapeHtml(sample.spec.type ?? 'diagram')} specimen">${svg}</figure>
      <details>
        <summary>Inspect the exact YAML spec</summary>
        <pre><code>${escapeHtml(yaml)}</code></pre>
      </details>
    </article>`;
}));

const counts = samples.reduce<Record<Family, number>>((all, sample) => {
  all[sample.family] += 1;
  return all;
}, { money: 0, place: 0, process: 0, time: 0, composition: 0 });

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark light">
  <title>Civic diagrams under pressure</title>
  <style>
    :root {
      color-scheme: dark;
      --ink: #f4efe4;
      --muted: #a9a49a;
      --paper: #f8f4ea;
      --night: #141514;
      --panel: #1d1f1d;
      --line: #393b37;
      --signal: #ff6138;
      --acid: #d7ff4f;
      --max: 1560px;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      background:
        radial-gradient(circle at 80% -10%, rgba(255, 97, 56, .18), transparent 34rem),
        var(--night);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-variant-numeric: tabular-nums;
    }
    a { color: inherit; }
    .masthead, main, footer { width: min(calc(100% - 40px), var(--max)); margin-inline: auto; }
    .masthead { padding: clamp(48px, 8vw, 112px) 0 44px; border-bottom: 1px solid var(--line); }
    .kicker { color: var(--acid); text-transform: uppercase; letter-spacing: .14em; font-size: 12px; font-weight: 800; }
    h1 { max-width: 1050px; margin: 18px 0 22px; font-size: clamp(48px, 8.4vw, 132px); line-height: .88; letter-spacing: -.065em; font-weight: 850; }
    .lede { max-width: 790px; margin: 0; color: #d0ccc3; font-size: clamp(18px, 2.1vw, 27px); line-height: 1.42; }
    .proof { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); max-width: 760px; gap: 1px; margin-top: 42px; background: var(--line); border: 1px solid var(--line); }
    .proof div { background: var(--night); padding: 20px; }
    .proof strong { display: block; color: var(--acid); font-size: clamp(30px, 4vw, 54px); line-height: 1; letter-spacing: -.05em; }
    .proof span { display: block; margin-top: 7px; color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .1em; }
    .controls { position: sticky; z-index: 20; top: 0; display: flex; align-items: center; gap: 8px; padding: 13px max(20px, calc((100vw - var(--max)) / 2)); overflow-x: auto; border-bottom: 1px solid var(--line); background: rgba(20, 21, 20, .93); backdrop-filter: blur(16px); }
    .controls span { flex: none; margin-right: 8px; color: var(--muted); font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
    button { flex: none; appearance: none; border: 1px solid #4a4d48; border-radius: 999px; padding: 9px 13px; background: transparent; color: var(--ink); font: inherit; font-size: 13px; cursor: pointer; }
    button:hover { border-color: var(--ink); }
    button[aria-pressed="true"] { border-color: var(--acid); background: var(--acid); color: #171915; }
    main { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px; padding: 44px 0 80px; }
    .specimen { width: 100%; max-width: 100%; min-width: 0; align-self: start; overflow: hidden; border: 1px solid var(--line); border-radius: 18px; background: var(--panel); box-shadow: 0 25px 75px rgba(0, 0, 0, .2); }
    .specimen[hidden] { display: none; }
    .specimen__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; padding: 24px 26px 0; }
    .specimen__eyebrow { margin: 0 0 8px; color: var(--signal); font-size: 11px; font-weight: 850; letter-spacing: .14em; text-transform: uppercase; }
    h2 { margin: 0; max-width: 690px; font-size: clamp(22px, 2.2vw, 34px); line-height: 1.03; letter-spacing: -.035em; }
    .anchor { opacity: .5; padding: 4px; font-size: 22px; text-decoration: none; }
    .anchor:hover { opacity: 1; color: var(--acid); }
    .stress { display: flex; flex-wrap: wrap; gap: 6px; margin: 17px 26px 20px; padding: 0; list-style: none; }
    .stress li { border: 1px solid #444741; border-radius: 999px; padding: 5px 9px; color: #c8c4ba; font-size: 11px; }
    .render { width: 100%; max-width: 100%; min-width: 0; margin: 0; overflow: auto; background: var(--paper); border-block: 1px solid var(--line); }
    .render > svg { display: block; width: 100%; height: auto; min-width: 520px; pointer-events: none; user-select: none; }
    details { color: #ccc7bd; }
    summary { padding: 17px 26px; cursor: pointer; font-size: 13px; font-weight: 700; }
    summary:hover { color: var(--acid); }
    pre { max-height: 430px; margin: 0; padding: 22px 26px 28px; overflow: auto; border-top: 1px solid var(--line); background: #111210; color: #d9d5ca; font: 12px/1.55 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
    footer { display: flex; justify-content: space-between; gap: 24px; padding: 28px 0 52px; border-top: 1px solid var(--line); color: var(--muted); font-size: 13px; }
    footer strong { color: var(--ink); }
    @media (max-width: 980px) { main { grid-template-columns: 1fr; } .specimen { max-width: 920px; margin-inline: auto; } }
    @media (max-width: 620px) {
      .masthead, main, footer { width: min(calc(100% - 24px), var(--max)); }
      .masthead { padding-top: 50px; }
      h1 { font-size: clamp(48px, 18vw, 82px); }
      .proof { grid-template-columns: 1fr; }
      .controls { padding-inline: 12px; }
      main { padding-top: 24px; gap: 14px; }
      .specimen { border-radius: 12px; }
      .specimen__header { padding: 20px 18px 0; }
      .stress { margin-inline: 18px; }
      .render > svg { min-width: 680px; }
      summary { padding-inline: 18px; }
      pre { padding-inline: 18px; }
      footer { flex-direction: column; }
    }
    @media print {
      :root { color-scheme: light; }
      body { background: white; color: #111; }
      .controls { display: none; }
      .masthead, main, footer { width: 100%; }
      .masthead { padding-top: 0; }
      .lede, .specimen__eyebrow, footer, .stress { color: #333; }
      main { display: block; }
      .specimen { break-inside: avoid; margin: 0 0 24px; border-color: #bbb; background: white; box-shadow: none; }
      details { display: none; }
    }
  </style>
</head>
<body>
  <header class="masthead">
    <p class="kicker">Civic render-path specimen book · generated, not mocked</p>
    <h1>Diagrams<br>under pressure.</h1>
    <p class="lede">${samples.length} adversarial specs push the same production renderer through collisions, sparse records, hostile labels, awkward totals, duplicate dates, co-located geography, and nine-order-of-magnitude scales. Every graphic below is the actual SVG output.</p>
    <div class="proof" aria-label="Gallery summary">
      <div><strong>${samples.length}</strong><span>live specimens</span></div>
      <div><strong>5</strong><span>visual families</span></div>
      <div><strong>0</strong><span>mocked graphics</span></div>
    </div>
  </header>
  <nav class="controls" aria-label="Filter specimens">
    <span>Show</span>
    <button type="button" data-filter="all" aria-pressed="true">All ${samples.length}</button>
    <button type="button" data-filter="money" aria-pressed="false">Money ${counts.money}</button>
    <button type="button" data-filter="place" aria-pressed="false">Place ${counts.place}</button>
    <button type="button" data-filter="process" aria-pressed="false">Process ${counts.process}</button>
    <button type="button" data-filter="time" aria-pressed="false">Time ${counts.time}</button>
    <button type="button" data-filter="composition" aria-pressed="false">Composition ${counts.composition}</button>
  </nav>
  <main>${rendered.join('')}</main>
  <footer>
    <span><strong>How to audit it:</strong> open any YAML disclosure and compare the hostile input with its SVG immediately above.</span>
    <span>Generated ${new Date().toISOString().slice(0, 10)} with the branch’s public <code>diagram()</code> API.</span>
  </footer>
  <script>
    const buttons = [...document.querySelectorAll('[data-filter]')];
    const cards = [...document.querySelectorAll('[data-family]')];
    for (const button of buttons) button.addEventListener('click', () => {
      const filter = button.dataset.filter;
      for (const candidate of buttons) candidate.setAttribute('aria-pressed', String(candidate === button));
      for (const card of cards) card.hidden = filter !== 'all' && card.dataset.family !== filter;
    });
  </script>
</body>
</html>`;

const outputPath = fileURLToPath(new URL('./civic-torture-gallery.html', import.meta.url));
await Bun.write(outputPath, html);
console.log(`Rendered ${samples.length} adversarial specs to ${outputPath}`);
