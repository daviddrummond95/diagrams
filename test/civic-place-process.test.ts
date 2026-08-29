import { describe, expect, test } from 'bun:test';
import { buildPlaceDiagram, PLACE_TYPES } from '../src/diagrams/civic/place.js';
import { buildProcessDiagram, PROCESS_TYPES } from '../src/diagrams/civic/process.js';
import { defaultTheme } from '../src/themes/default.js';
import type { SatoriElement } from '../src/types.js';

const context = {
  width: 760,
  padding: 32,
  theme: defaultTheme,
  options: { format: 'svg' as const },
};

const chrome = {
  title: 'Collision stress specimen',
  caption: 'A deliberately dense fixture with unusually long labels.',
  source: { label: 'Test record', href: 'https://example.test/record' },
  legend: true,
  alt: 'Deterministic collision stress specimen.',
};

const basemap = { city: 'Terre Haute', county: 'Vigo', state: 'IN' };
const ring = (lon: number, lat: number, size = 0.003) => [
  { lon: lon - size, lat: lat - size }, { lon: lon + size, lat: lat - size },
  { lon: lon + size, lat: lat + size }, { lon: lon - size, lat: lat + size },
];

function elements(root: SatoriElement, role?: string): SatoriElement[] {
  const found: SatoriElement[] = [];
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    const node = value as SatoriElement;
    if (typeof node.type === 'string') {
      if (!role || node.props?.['data-role'] === role) found.push(node);
      const children = node.props?.children;
      if (Array.isArray(children)) children.forEach(visit);
      else visit(children);
    }
  };
  visit(root);
  return found;
}

function numeric(value: unknown): number { return Number(value); }
function boxes(nodes: SatoriElement[]) {
  return nodes.map(node => ({
    x: numeric(node.props.x), y: numeric(node.props.y), width: numeric(node.props.width), height: numeric(node.props.height),
  }));
}
function overlaps(a: ReturnType<typeof boxes>[number], b: ReturnType<typeof boxes>[number]) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
function expectInBounds(result: ReturnType<typeof buildPlaceDiagram> | ReturnType<typeof buildProcessDiagram>) {
  expect(result.width).toBe(context.width);
  expect(result.height).toBeGreaterThan(0);
  expect(JSON.stringify(result.tree)).not.toContain('NaN');
  expect(JSON.stringify(result.tree)).not.toContain('Infinity');
}
function expectDeterministic(builder: typeof buildPlaceDiagram | typeof buildProcessDiagram, spec: any) {
  expect(JSON.stringify(builder(spec, context))).toBe(JSON.stringify(builder(structuredClone(spec), context)));
}

const placeSamples: Record<(typeof PLACE_TYPES)[number], any> = {
  'locator-map': {
    ...chrome, type: 'locator-map', basemap,
    pins: Array.from({ length: 14 }, (_, index) => ({
      id: `pin-${String(index).padStart(2, '0')}`,
      label: `Coincident civic address with a very long suffix ${index}`,
      lon: -87.40687 + (index % 3) * 0.000001,
      lat: 39.45724 + (index % 2) * 0.000001,
    })),
  },
  'region-map': {
    ...chrome, type: 'region-map', basemap,
    region: { id: 'district', label: 'A district label that must remain within the frame', geojson: {
      type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-87.43, 39.45], [-87.39, 39.45], [-87.39, 39.49], [-87.43, 39.49], [-87.43, 39.45]]] } }],
    } },
    context: [{ id: 'city', label: 'City', ring: ring(-87.41, 39.47, 0.03) }],
  },
  choropleth: {
    ...chrome, type: 'choropleth', basemap, breaks: 'equal', classes: 5, unit: 'count', dataTable: { columns: ['Area', 'Count'], records: [] },
    features: [-900, -2, 0, 1, 8000, null].map((value, index) => ({
      id: `area-${index}`, label: `Area with a long identifying label ${index}`, value,
      geojson: JSON.stringify({ type: 'Polygon', coordinates: [[
        [-87.45 + index * 0.012, 39.45], [-87.44 + index * 0.012, 39.45],
        [-87.44 + index * 0.012, 39.48], [-87.45 + index * 0.012, 39.48], [-87.45 + index * 0.012, 39.45],
      ]] }),
    })),
  },
  corridor: {
    ...chrome, type: 'corridor', basemap,
    corridor: { id: 'road', label: 'Long civic corridor', widthMeters: 50000, path: [{ lon: -87.43, lat: 39.44 }, { lon: -87.41, lat: 39.47 }, { lon: -87.38, lat: 39.50 }] },
    stops: Array.from({ length: 12 }, (_, index) => ({ id: `stop-${index}`, label: `Closely spaced stop label ${index}`, lon: -87.41 + index * 0.000001, lat: 39.47 })),
  },
  'symbol-map': {
    ...chrome, type: 'symbol-map', basemap, sizeBy: 'count', colorBy: 'kind',
    points: [0, 1, 1, 3, 25, 9000, 2, 4, 7, 11].map((count, index) => ({
      id: `symbol-${index}`, label: `Co-located variable symbol ${index}`, lon: -87.401 + (index % 2) * 0.000001, lat: 39.466, count, kind: index % 2 ? 'school' : 'camera',
    })),
  },
  'zoning-map': {
    ...chrome, type: 'zoning-map', basemap: { ...basemap, center: { lon: -87.406, lat: 39.457 }, zoom: 16 },
    parcels: Array.from({ length: 8 }, (_, index) => ({ id: `lot-${index}`, label: `Narrow parcel ${index}`, code: index % 2 ? 'R-1' : 'C-2', overlay: index === 3 ? 'historic' : undefined, ring: ring(-87.407 + index * 0.0003, 39.457, 0.00018) })),
  },
  'before-after-map': {
    ...chrome, type: 'before-after-map', basemap: { ...basemap, center: { lon: -87.406, lat: 39.457 }, zoom: 16 }, layout: 'split',
    before: { label: 'Current', parcels: [{ id: 'lot', label: 'Same camera lot', code: 'R-1', ring: ring(-87.406, 39.457, 0.00035) }] },
    after: { label: 'Proposed', parcels: [{ id: 'lot', label: 'Same camera lot', code: 'C-2', ring: ring(-87.406, 39.457, 0.00035) }, { id: 'added', label: 'Added lot', code: 'PUD', ring: ring(-87.4052, 39.457, 0.0002) }] },
  },
};

describe('civic place render paths', () => {
  for (const type of PLACE_TYPES) {
    test(`${type} is deterministic under high-variability data`, () => {
      const spec = placeSamples[type];
      const result = buildPlaceDiagram(spec, context);
      expectInBounds(result);
      expectDeterministic(buildPlaceDiagram, spec);
    });
  }

  test('locator map separates coincident markers and label boxes', () => {
    const result = buildPlaceDiagram(placeSamples['locator-map'], context);
    const markers = elements(result.tree, 'map-marker');
    expect(new Set(markers.map(marker => `${marker.props.cx}:${marker.props.cy}`)).size).toBe(markers.length);
    for (let i = 0; i < markers.length; i += 1) for (let j = i + 1; j < markers.length; j += 1) {
      const distance = Math.hypot(numeric(markers[i].props.cx) - numeric(markers[j].props.cx), numeric(markers[i].props.cy) - numeric(markers[j].props.cy));
      expect(distance + 0.02).toBeGreaterThanOrEqual(numeric(markers[i].props.r) + numeric(markers[j].props.r));
    }
    const labelBoxes = boxes(elements(result.tree, 'label-box'));
    for (let i = 0; i < labelBoxes.length; i += 1) for (let j = i + 1; j < labelBoxes.length; j += 1) expect(overlaps(labelBoxes[i], labelBoxes[j])).toBe(false);
  });

  test('projection keeps north above south and renders inline GeoJSON', () => {
    const spec = { ...placeSamples['locator-map'], pins: [
      { id: 'north', label: 'North', lon: -87.4, lat: 39.5 }, { id: 'south', label: 'South', lon: -87.4, lat: 39.4 },
    ] };
    const markers = elements(buildPlaceDiagram(spec, context).tree, 'map-marker');
    expect(numeric(markers[0].props.cy)).toBeLessThan(numeric(markers[1].props.cy));
    expect(elements(buildPlaceDiagram(placeSamples.choropleth, context).tree, 'choropleth-feature')).toHaveLength(6);
  });

  test('symbol radius uses sqrt scaling and stays bounded', () => {
    const result = buildPlaceDiagram(placeSamples['symbol-map'], context);
    const radii = elements(result.tree, 'symbol-marker').map(marker => numeric(marker.props.r));
    expect(Math.max(...radii)).toBeLessThanOrEqual(21);
    expect(Math.min(...radii)).toBeGreaterThanOrEqual(5);
  });

  test('automatic map camera expands block-scale data across the frame', () => {
    const spec = {
      ...placeSamples['locator-map'], basemap: { city: 'Terre Haute', state: 'IN' },
      pins: [
        { id: 'west', label: 'West record', lon: -87.4075, lat: 39.4667 },
        { id: 'east', label: 'East record', lon: -87.4065, lat: 39.4667 },
      ],
    };
    const markers = elements(buildPlaceDiagram(spec, context).tree, 'map-marker');
    expect(Math.abs(numeric(markers[1].props.cx) - numeric(markers[0].props.cx))).toBeGreaterThan(250);
  });
});

const STATE = ['introduced', 'forwarded', 'informational', 'deferred', 'recessed', 'approved', 'withdrawn'];

const processSamples: Record<(typeof PROCESS_TYPES)[number], any> = {
  'agenda-states': {
    ...chrome, type: 'agenda-states', item: { id: 'agenda', label: 'A long-running item', body: 'Council', steps: Array.from({ length: 13 }, (_, index) => ({ id: `step-${index}`, state: STATE[index % STATE.length], date: `2026-08-${String(index + 1).padStart(2, '0')}`, label: `Exceptionally long state step ${index}` })) },
  },
  'outcome-funnel': {
    ...chrome, type: 'outcome-funnel', stages: [
      { id: 'approved', label: 'Approved after a long discussion', state: 'approved', value: 999 },
      { id: 'deferred', label: 'Deferred until a future meeting', state: 'deferred', value: 0 },
      { id: 'forwarded', label: 'Forwarded', state: 'forwarded', value: 1 },
    ], items: Array.from({ length: 9 }, (_, index) => ({ id: `item-${index}`, label: `Named item with substantial detail ${index}`, state: index ? 'approved' : 'forwarded' })),
  },
  org: {
    ...chrome, type: 'org', nodes: Array.from({ length: 13 }, (_, index) => ({ id: `body-${index}`, label: `Government body with a long official name ${index}`, kind: index % 3 ? 'appointed' : 'legislative', coverage: index % 2 ? 'not-yet' : 'covered' })),
    edges: Array.from({ length: 9 }, (_, index) => ({ from: `body-${index + 1}`, to: 'body-0', rel: index % 2 ? 'reports-to' : 'recommends-to' })),
  },
  'vote-matrix': {
    ...chrome, type: 'vote-matrix', body: 'A local governing body with a long name', date: '2026-08-29',
    members: Array.from({ length: 16 }, (_, index) => ({ id: `member-${index}`, label: `Council Member With Long Name ${index}`, seat: `District ${index + 1}` })),
    items: Array.from({ length: 9 }, (_, index) => ({ id: `vote-${index}`, label: `Ordinance with verbose title ${index}`, mover: index === 0 ? 'member-0' : undefined, seconder: index === 0 ? 'member-1' : undefined })),
    cells: Array.from({ length: 16 }, (_, index) => ({ member: `member-${index}`, item: `vote-${index % 9}`, vote: ['yea', 'nay', 'absent', 'unknown'][index % 4] })), summary: { yea: 7, nay: 3, present: 12, absent: 4 },
  },
  impact: {
    ...chrome, type: 'impact', item: { id: 'measure', label: 'A consequential local ordinance with a long title', body: 'Commissioners', date: '2026-08-29', action: 'withdrawn without a vote' },
    touches: Array.from({ length: 9 }, (_, index) => ({ id: `touch-${index}`, label: `Residents with a specifically documented interest ${index}`, kind: ['residents', 'taxpayers', 'neighborhood', 'employees', 'program', 'place'][index % 6] })),
  },
  pipeline: {
    ...chrome, type: 'pipeline', stages: Array.from({ length: 14 }, (_, index) => ({ id: `stage-${index}`, label: `Pipeline stage with detail ${index}`, gate: index > 11 ? 'human' : index === 7 ? 'blocked' : 'automated', description: `A long description for stage ${index}` })),
    edges: [...Array.from({ length: 13 }, (_, index) => ({ from: `stage-${index}`, to: `stage-${index + 1}` })), { from: 'stage-12', to: 'stage-3' }],
  },
  hemicycle: {
    ...chrome, type: 'hemicycle', item: { id: 'measure', label: 'A local measure with a verbose title' },
    seats: Array.from({ length: 25 }, (_, index) => ({ id: `seat-${index}`, label: index % 5 === 0 ? `Named member with a long surname ${index}` : undefined, member: `member-${index}`, vote: ['yea', 'nay', 'absent', 'empty'][index % 4] })), mover: 'member-0', seconder: 'member-5', summary: { yea: 7, nay: 6, absent: 6, present: 13 },
  },
  'heatmap-table': {
    ...chrome, type: 'heatmap-table', unit: 'count', rows: Array.from({ length: 15 }, (_, index) => ({ id: `row-${index}`, label: `Public body with long name ${index}` })), columns: Array.from({ length: 12 }, (_, index) => ({ id: `col-${index}`, label: `Aug ${index + 1}–${index + 2}` })),
    cells: Array.from({ length: 70 }, (_, index) => ({ row: `row-${index % 15}`, column: `col-${index % 12}`, value: index % 11 === 0 ? 0 : index * 1000, label: index % 9 === 0 ? `Very long cell annotation ${index}` : undefined })), scale: { min: 0, max: 69000 },
  },
  network: {
    ...chrome, type: 'network', nodes: Array.from({ length: 18 }, (_, index) => ({ id: `node-${String(index).padStart(2, '0')}`, label: `Stakeholder organization with long name ${index}`, kind: ['body', 'developer', 'neighborhood', 'fund', 'resident-group', 'place'][index % 6] })),
    edges: Array.from({ length: 27 }, (_, index) => ({ from: `node-${String(index % 18).padStart(2, '0')}`, to: `node-${String((index * 5 + 3) % 18).padStart(2, '0')}`, rel: index % 6 === 0 ? 'votes-with' : 'touches', directed: index % 3 === 0, item: index % 6 === 0 ? `item-${index}` : undefined })),
  },
  donut: {
    ...chrome, type: 'donut', slices: [
      { id: 'huge', label: 'Overwhelming majority', value: 1_000_000 }, { id: 'tiny', label: 'Tiny minority', value: 1 },
      { id: 'zero-a', label: 'Zero recorded A', value: 0 }, { id: 'zero-b', label: 'Zero recorded B', value: 0 }, { id: 'zero-c', label: 'Zero recorded C', value: 0 },
    ], center: { label: 'One million and one documented records' },
  },
};

describe('civic process render paths', () => {
  for (const type of PROCESS_TYPES) {
    test(`${type} is deterministic under high-variability data`, () => {
      const spec = processSamples[type];
      const result = buildProcessDiagram(spec, context);
      expectInBounds(result);
      expectDeterministic(buildProcessDiagram, spec);
    });
  }

  test('dense network nodes do not overlap and remain in frame', () => {
    const result = buildProcessDiagram(processSamples.network, context);
    const nodeBoxes = boxes(elements(result.tree, 'network-node'));
    for (const box of nodeBoxes) {
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(context.width - context.padding * 2);
    }
    for (let i = 0; i < nodeBoxes.length; i += 1) for (let j = i + 1; j < nodeBoxes.length; j += 1) expect(overlaps(nodeBoxes[i], nodeBoxes[j])).toBe(false);
  });

  test('dense network moves relationship names into a color legend', () => {
    const result = buildProcessDiagram(processSamples.network, context);
    expect(elements(result.tree, 'process-label-box')).toHaveLength(0);
    const edges = elements(result.tree, 'network-edge');
    expect(edges).toHaveLength(processSamples.network.edges.length);
    expect(edges.every(edge => typeof edge.props['data-rel'] === 'string')).toBe(true);
    const output = JSON.stringify(result.tree);
    expect(output).toContain('Edge: Touches');
    expect(output).toContain('Edge: Votes With');
  });

  test('sparse network retains readable inline relationship labels', () => {
    const spec = {
      ...processSamples.network,
      nodes: processSamples.network.nodes.slice(0, 4),
      edges: [
        { from: 'node-00', to: 'node-01', rel: 'funds', directed: true },
        { from: 'node-02', to: 'node-03', rel: 'represents' },
      ],
    };
    const result = buildProcessDiagram(spec, context);
    const labels = boxes(elements(result.tree, 'process-label-box'));
    expect(labels).toHaveLength(2);
    expect(overlaps(labels[0], labels[1])).toBe(false);
  });

  test('sparse vote cells remain explicitly omitted, never inferred absent', () => {
    const result = buildProcessDiagram(processSamples['vote-matrix'], context);
    const cells = elements(result.tree, 'vote-cell');
    expect(cells.some(cell => cell.props['data-vote'] === 'omitted')).toBe(true);
    expect(cells.filter(cell => cell.props['data-vote'] === 'absent')).toHaveLength(4);
  });

  test('zero values remain visible and distinct from omitted table cells', () => {
    const funnel = elements(buildProcessDiagram(processSamples['outcome-funnel'], context).tree, 'funnel-stage');
    expect(funnel.find(stage => stage.props['data-id'] === 'deferred')?.props['data-value']).toBe('0');
    const heat = elements(buildProcessDiagram(processSamples['heatmap-table'], context).tree, 'heat-cell');
    expect(heat.some(cell => cell.props['data-value'] === '0')).toBe(true);
    expect(heat.some(cell => cell.props['data-value'] === 'omitted')).toBe(true);
  });
});
