import { describe, expect, test } from 'bun:test';
import type { SatoriElement } from '../src/types.js';
import { defaultTheme } from '../src/themes/default.js';
import { renderDiagram } from '../src/render/index.js';
import { buildTimeDiagram, parseISODate, positionOnAxis, TIME_TYPES } from '../src/diagrams/civic/time.js';
import { buildCompositionDiagram, COMPOSITION_TYPES } from '../src/diagrams/civic/composition.js';

const context = { width: 760, padding: 28, theme: defaultTheme, options: {} };
const long = (index: number) => `Very long public-record label ${index + 1} with duplicate and collision pressure`;

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state ^ state >>> 15, 1 | state);
    state ^= state + Math.imul(state ^ state >>> 7, 61 | state);
    return ((state ^ state >>> 14) >>> 0) / 4294967296;
  };
}

function common(type: string) {
  return {
    type,
    title: `Generated ${type}`,
    caption: 'Generated dense and highly variable test data.',
    source: { label: 'Generated samples', href: 'https://example.test/' },
    alt: `${type} generated sample`,
  };
}

function timeSample(type: (typeof TIME_TYPES)[number], seed: number): any {
  const rand = random(seed);
  const duplicateDates = ['2020-01', '2020-01-01', '2020-01-02', '2020-01-02', '2024-02-29', '2038-01-19', '2099-12-31'];
  switch (type) {
    case 'timeline':
      return { ...common(type), direction: seed % 2 ? 'LR' : 'TB', events: Array.from({ length: 15 }, (_, index) => ({ id: `e-${index}`, date: duplicateDates[index % duplicateDates.length], label: long(index), body: `Body ${index % 3}`, description: long(index + 20) })) };
    case 'gantt':
      return {
        ...common(type), fyStartMonth: seed % 2 ? 1 : 7, scale: 'auto', now: '2030-01-01',
        tasks: Array.from({ length: 13 }, (_, index) => index % 5 === 0
          ? { id: `t-${index}`, label: long(index), start: duplicateDates[index % duplicateDates.length], kind: 'milestone', group: `group-${index % 3}`, dependencies: index ? [`t-${index - 1}`] : [] }
          : index % 5 === 1
            ? { id: `t-${index}`, label: long(index), start: duplicateDates[index % duplicateDates.length], open: true, group: `group-${index % 3}`, dependencies: [`t-${index - 1}`] }
            : { id: `t-${index}`, label: long(index), start: `202${index % 4}-01-01`, end: `202${index % 4}-12-31`, progress: Math.round(rand() * 100), group: `group-${index % 3}`, dependencies: index ? [`t-${index - 1}`] : [] }),
      };
    case 'weekstrip':
      return { ...common(type), from: '2020-01-01', to: '2030-12-31', colorBy: 'tag', legend: true, marks: Array.from({ length: 24 }, (_, index) => ({ date: duplicateDates[index % duplicateDates.length].length === 7 ? `${duplicateDates[index % duplicateDates.length]}-01` : duplicateDates[index % duplicateDates.length], count: 1 + index % 37, label: index % 2 ? long(index) : undefined, tag: ['MONEY', 'RULES', 'PROPERTY'][index % 3] })) };
    case 'entity-timeline':
      return { ...common(type), entity: { name: 'A project', kind: 'project' }, lanes: Array.from({ length: 4 }, (_, index) => ({ id: `lane-${index}`, label: long(index) })), events: Array.from({ length: 22 }, (_, index) => ({ date: duplicateDates[index % duplicateDates.length], lane: `lane-${index % 4}`, label: long(index), amount: index % 3 ? Math.round(rand() * 1e8) : 0 })) };
    case 'calendar-heatmap':
      return { ...common(type), from: '2026-07-15', to: '2026-09-20', weekStart: seed % 2 ? 'sun' : 'mon', legend: true, cells: Array.from({ length: 15 }, (_, index) => ({ date: `2026-08-${String(1 + index * 2).padStart(2, '0')}`, value: index % 4 ? Math.round(rand() * 50) : 0, label: long(index) })) };
    case 'sparkline':
      return { ...common(type), unit: 'usd', values: [0, 0, 1e-9, 1e9, 1e9, -1e7, 42], dates: ['2020-01-01', '2020-01-01', '2020-01-02', '2020-01-02', '2050-01-01', '2099-12-31', '2100-01-01'], fill: seed % 2 === 0, showEndValue: true };
  }
}

function compositionSample(type: (typeof COMPOSITION_TYPES)[number], seed: number): any {
  const rand = random(seed);
  const values = [0, 1, 1, 2, 42, 10_000, 999_999_999, ...Array.from({ length: 10 }, () => Math.round(rand() * 500_000))];
  switch (type) {
    case 'waffle':
      return { ...common(type), mode: seed % 2 ? 'n' : 'percent', columns: seed % 2 ? 13 : 10, legend: true, dataTable: { columns: ['Category', 'Count'], records: [['A', 73], ['B', 27]] }, categories: [{ id: 'a', label: long(0), value: 73, approximate: true }, { id: 'empty', label: long(1), value: 0 }, { id: 'b', label: long(2), value: 27 }] };
    case 'isotype':
      return { ...common(type), icon: 'civic:parcel', legend: true, scale: { unitsPerIcon: seed % 3 + 1 }, categories: [{ id: 'a', label: long(0), value: 84, icon: 'civic:parcel' }, { id: 'b', label: long(1), value: 30, icon: 'civic:camera', approximate: true }] };
    case 'small-multiples': {
      const types = ['delta', 'sparkline', 'waffle', 'scorecard'] as const;
      const panelType = types[seed % types.length];
      const inner = (index: number) => panelType === 'delta' ? { from: { value: index ? values[index] : 0 }, to: { value: values[index + 1] } }
        : panelType === 'sparkline' ? { values: values.slice(index, index + 5) }
          : panelType === 'waffle' ? { categories: [{ id: 'a', label: 'A', value: 10 + index }] }
            : { rows: [{ id: 'r', label: long(index), promised: { value: index }, delivered: { value: index + 1 } }] };
      return { ...common(type), panelType, columns: 5, shareScale: true, panels: Array.from({ length: 13 }, (_, index) => ({ id: `p-${index}`, label: long(index), spec: inner(index % 6) })) };
    }
    case 'scorecard':
      return { ...common(type), unit: 'count', rows: Array.from({ length: 12 }, (_, index) => ({ id: `r-${index}`, label: long(index), promised: { label: long(index + 20), value: index % 4 ? values[index] : 0 }, delivered: { value: values[index + 1] }, kept: index % 2 === 0, reportedError: index % 3 ? undefined : values[index + 3], note: long(index + 40) })) };
    case 'beeswarm':
      return { ...common(type), unit: 'usd', axis: seed % 3 ? 'x' : 'y', dotSize: 12, annotations: [{ kind: 'callout', text: long(0), at: { x: 1 } }, { kind: 'peak', text: long(1), at: { x: 999_999_999 } }], items: values.map((value, index) => ({ id: `i-${index}`, label: long(index), value: index < 7 ? 42 : value, group: `g-${index % 3}`, highlight: index % 7 === 0 })) };
    case 'connected-dot':
      return { ...common(type), unit: 'count', rows: Array.from({ length: 14 }, (_, index) => ({ id: `r-${index}`, label: long(index), from: { label: 'From', value: index % 5 ? values[index % values.length] : 0 }, to: { label: 'To', value: index % 4 ? values[(index + 2) % values.length] : values[index % values.length] } })) };
    case 'data-table':
      return { ...common(type), unit: 'usd', sort: { column: 'amount', direction: 'desc' }, columns: [{ id: 'label', label: long(0), encode: 'text' }, { id: 'amount', label: 'Amount', encode: 'bar' }, { id: 'heat', label: 'Heat', encode: 'heat' }, { id: 'trend', label: 'Trend', encode: 'sparkline' }], rows: Array.from({ length: 20 }, (_, index) => ({ label: long(index), amount: values[index % values.length], heat: values[(index + 2) % values.length], trend: values.slice(index % 8, index % 8 + 5) })) };
    case 'category-mix':
      return { ...common(type), legend: true, categories: Array.from({ length: 10 }, (_, index) => `Period ${index} with long label`), series: Array.from({ length: 5 }, (_, seriesIndex) => ({ id: `s-${seriesIndex}`, label: long(seriesIndex), values: Array.from({ length: 10 }, (_, index) => index % 3 ? Math.round(rand() * 40) : 0) })) };
    case 'per-body-count':
      return { ...common(type), unit: 'count', sort: 'desc', items: values.slice(0, 13).map((value, index) => ({ id: `body-${index}`, label: long(index), value })) };
  }
}

function walk(element: SatoriElement, visit: (element: SatoriElement) => void): void {
  visit(element);
  const children = element.props.children;
  if (Array.isArray(children)) children.forEach(child => typeof child === 'string' || walk(child, visit));
  else if (children && typeof children !== 'string') walk(children, visit);
}

function checkGeometry(result: { tree: SatoriElement; width: number; height: number }): void {
  expect(result.width).toBe(context.width);
  expect(result.height).toBeGreaterThan(50);
  expect(JSON.stringify(result)).not.toMatch(/NaN|Infinity|null(?=,|\})/);
  walk(result.tree, element => {
    if (element.type !== 'svg') return;
    const svgWidth = Number(element.props.width); const svgHeight = Number(element.props.height);
    expect(svgWidth).toBeGreaterThan(0); expect(svgHeight).toBeGreaterThan(0);
    const children = element.props.children;
    if (!Array.isArray(children)) return;
    for (const child of children) {
      if (typeof child === 'string') continue;
      for (const key of ['x', 'x1', 'x2', 'cx']) {
        if (child.props[key] == null) continue;
        const value = Number(child.props[key]);
        expect(value).toBeGreaterThanOrEqual(-0.02); expect(value).toBeLessThanOrEqual(svgWidth + 0.02);
      }
      for (const key of ['y', 'y1', 'y2', 'cy']) {
        if (child.props[key] == null) continue;
        const value = Number(child.props[key]);
        expect(value).toBeGreaterThanOrEqual(-0.02); expect(value).toBeLessThanOrEqual(svgHeight + 0.02);
      }
      if (child.type === 'rect') {
        const x = Number(child.props.x); const y = Number(child.props.y); const w = Number(child.props.width); const h = Number(child.props.height);
        expect(w).toBeGreaterThanOrEqual(0); expect(h).toBeGreaterThanOrEqual(0);
        expect(x + w).toBeLessThanOrEqual(svgWidth + 0.02); expect(y + h).toBeLessThanOrEqual(svgHeight + 0.02);
      }
    }
  });
}

function axisSegments(pathData: unknown): Array<[number, number, number, number]> {
  const values = String(pathData).match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const points = Array.from({ length: Math.floor(values.length / 2) }, (_, index) => ({ x: values[index * 2], y: values[index * 2 + 1] }));
  return points.slice(1).map((point, index) => [points[index].x, points[index].y, point.x, point.y]);
}

function crossesInterior(segment: [number, number, number, number], box: { x: number; y: number; width: number; height: number }): boolean {
  const [x1, y1, x2, y2] = segment;
  const inset = 0.05;
  if (Math.abs(x1 - x2) < 0.01) return x1 > box.x + inset && x1 < box.x + box.width - inset && Math.min(y1, y2) < box.y + box.height - inset && Math.max(y1, y2) > box.y + inset;
  if (Math.abs(y1 - y2) < 0.01) return y1 > box.y + inset && y1 < box.y + box.height - inset && Math.min(x1, x2) < box.x + box.width - inset && Math.max(x1, x2) > box.x + inset;
  return true;
}

describe('time render paths', () => {
  test('strict civil dates are UTC-safe and preserve proportional spacing', () => {
    expect(parseISODate('2024-02-29', 'date').toISOString()).toBe('2024-02-29T00:00:00.000Z');
    expect(parseISODate('2020-01', 'date').toISOString()).toBe('2020-01-01T00:00:00.000Z');
    expect(() => parseISODate('July ninth', 'events[1].date')).toThrow('events[1].date');
    expect(() => parseISODate('2023-02-29', 'date')).toThrow('date');
    expect(positionOnAxis(10, 10, 10, 400)).toBe(200);
    expect(positionOnAxis(7, 0, 28, 400)).toBe(100);
  });

  for (const type of TIME_TYPES) {
    test(`${type} is deterministic and bounded across variable samples`, () => {
      for (const seed of [1, 2, 17, 2026]) {
        const spec = timeSample(type, seed);
        const first = buildTimeDiagram(spec, context);
        expect(JSON.stringify(first)).toBe(JSON.stringify(buildTimeDiagram(spec, context)));
        checkGeometry(first);
      }
    });
  }

  test('multi-decade timeline compresses documentary gaps and marks the break', () => {
    const result = buildTimeDiagram(timeSample('timeline', 17), context);
    const points: SatoriElement[] = [];
    const breaks: SatoriElement[] = [];
    walk(result.tree, element => {
      if (element.props['data-role'] === 'timeline-event') points.push(element);
      if (element.props['data-role'] === 'time-break') breaks.push(element);
    });
    expect(points).toHaveLength(15);
    expect(breaks.length).toBeGreaterThanOrEqual(2);
    const uniqueX = [...new Set(points.map(point => Math.round(Number(point.props.cx))))].sort((a, b) => a - b);
    expect(uniqueX).toHaveLength(5);
    expect(Math.min(...uniqueX.slice(1).map((x, index) => x - uniqueX[index]))).toBeGreaterThan(7);
    expect(Math.max(...uniqueX) - Math.min(...uniqueX)).toBeGreaterThan(450);
  });

  test('entity timeline caps tick density while retaining distant years', () => {
    const result = buildTimeDiagram(timeSample('entity-timeline', 17), context);
    const ticks: SatoriElement[] = [];
    const breaks: SatoriElement[] = [];
    walk(result.tree, element => {
      if (element.props['data-role'] === 'time-tick') ticks.push(element);
      if (element.props['data-role'] === 'time-break') breaks.push(element);
    });
    expect(ticks.length).toBeGreaterThanOrEqual(3);
    expect(ticks.length).toBeLessThanOrEqual(10);
    expect(ticks.some(tick => String(tick.props.children).includes('’99'))).toBe(true);
    expect(breaks.length).toBeGreaterThanOrEqual(2);
  });

  test('timeline and lane connectors use elbows that avoid unrelated cards', () => {
    for (const [type, spec, connectorRole, cardRole] of [
      ['timeline', timeSample('timeline', 17), 'timeline-connector', 'timeline-card'],
      ['entity', timeSample('entity-timeline', 17), 'entity-connector', 'entity-card'],
    ] as const) {
      const result = buildTimeDiagram(spec, context);
      const connectors: SatoriElement[] = [];
      const cards: SatoriElement[] = [];
      walk(result.tree, element => {
        if (element.props['data-role'] === connectorRole) connectors.push(element);
        if (element.props['data-role'] === cardRole) cards.push(element);
      });
      expect(connectors.length, type).toBeGreaterThan(0);
      expect(connectors.every(connector => connector.type === 'path' && connector.props['data-route'] === 'elbow'), type).toBe(true);
      for (const connector of connectors) {
        const id = String(connector.props['data-id']);
        for (const card of cards) {
          if (String(card.props['data-id']) === id) continue;
          const box = { x: Number(card.props.x), y: Number(card.props.y), width: Number(card.props.width), height: Number(card.props.height) };
          expect(axisSegments(connector.props.d).some(segment => crossesInterior(segment, box)), `${type}:${id}`).toBe(false);
        }
      }
    }
  });
});

describe('composition render paths', () => {
  for (const type of COMPOSITION_TYPES) {
    test(`${type} is deterministic and bounded across variable samples`, () => {
      for (const seed of [1, 2, 17, 2026]) {
        const spec = compositionSample(type, seed);
        const first = buildCompositionDiagram(spec, context);
        expect(JSON.stringify(first)).toBe(JSON.stringify(buildCompositionDiagram(spec, context)));
        checkGeometry(first);
      }
    });
  }

  test('waffle cells never collide and percent mode shows the whole', () => {
    const result = buildCompositionDiagram(compositionSample('waffle', 2), context);
    const boxes: Array<{ x: number; y: number; width: number; height: number }> = [];
    walk(result.tree, element => {
      if (element.type === 'rect' && element.props.className === 'cell') boxes.push({ x: Number(element.props.x), y: Number(element.props.y), width: Number(element.props.width), height: Number(element.props.height) });
    });
    expect(boxes).toHaveLength(100);
    for (let i = 0; i < boxes.length; i += 1) for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i]; const b = boxes[j];
      expect(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y).toBe(true);
    }
  });

  test('beeswarm packs identical values without collisions', () => {
    const result = buildCompositionDiagram({ ...common('beeswarm'), items: Array.from({ length: 25 }, (_, index) => ({ id: `i-${index}`, label: long(index), value: 42 })), dotSize: 12 }, context);
    const points: Array<{ x: number; y: number; r: number }> = [];
    walk(result.tree, element => { if (element.type === 'circle') points.push({ x: Number(element.props.cx), y: Number(element.props.cy), r: Number(element.props.r) }); });
    expect(points).toHaveLength(25);
    for (let i = 0; i < points.length; i += 1) for (let j = i + 1; j < points.length; j += 1) {
      expect(Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y)).toBeGreaterThanOrEqual(points[i].r + points[j].r + 1.9);
    }
  });

  test('beeswarm automatically preserves extreme positive ranges with a disclosed log scale', () => {
    const specimen = {
      ...common('beeswarm'),
      unit: 'usd',
      items: [
        ...Array.from({ length: 31 }, (_, index) => ({ id: `same-${index}`, label: long(index), value: 42, group: `g-${index % 3}` })),
        { id: 'middle', label: 'A middle-scale award', value: 1_000_000, group: 'g-1' },
        { id: 'outlier', label: 'A billion-scale award', value: 1_000_000_000, group: 'g-2' },
      ],
    };
    const result = buildCompositionDiagram(specimen, context);
    expect(JSON.stringify(result.tree)).toContain('log scale');
    const xValues: number[] = [];
    walk(result.tree, element => { if (element.type === 'circle') xValues.push(Number(element.props.cx)); });
    expect(Math.max(...xValues) - Math.min(...xValues)).toBeGreaterThan(350);

    const forcedLinear = buildCompositionDiagram({ ...specimen, log: false }, context);
    expect(JSON.stringify(forcedLinear.tree)).not.toContain('log scale');
  });
});

test('all time and composition types complete the SVG render pipeline', async () => {
  for (const type of TIME_TYPES) {
    const output = await renderDiagram(timeSample(type, 17), { format: 'svg', width: 760, padding: 28 });
    expect(String(output)).toContain('<svg');
  }
  for (const type of COMPOSITION_TYPES) {
    const output = await renderDiagram(compositionSample(type, 17) as any, { format: 'svg', width: 760, padding: 28 });
    expect(String(output)).toContain('<svg');
  }
});
