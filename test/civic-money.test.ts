import { describe, expect, test } from 'bun:test';
import type { SatoriElement } from '../src/types.js';
import { buildMoneyDiagram, MONEY_TYPES } from '../src/diagrams/civic/money.js';
import { defaultTheme } from '../src/themes/default.js';

const context = {
  width: 760,
  padding: 28,
  theme: defaultTheme,
  options: {},
};

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state ^ state >>> 15, 1 | state);
    state ^= state + Math.imul(state ^ state >>> 7, 61 | state);
    return ((state ^ state >>> 14) >>> 0) / 4294967296;
  };
}

const longLabel = (index: number) => `Department ${index + 1} with a deliberately long public-budget label`;

function variedValues(seed: number, count: number, allowNegative = false): number[] {
  const rand = random(seed);
  return Array.from({ length: count }, (_, index) => {
    if (index === 0) return 0;
    if (index === 1) return 1;
    if (index === 2) return 1;
    if (index === 3) return 1_000_000_000;
    const magnitude = Math.pow(10, Math.floor(rand() * 8));
    const value = Math.round(rand() * magnitude);
    return allowNegative && index % 4 === 0 ? -value : value;
  });
}

function common(type: string) {
  return {
    type,
    title: `Variable ${type} sample`,
    caption: 'Dense labels, repeated values, zeros, and highly skewed magnitudes exercise the collision policy.',
    unit: 'usd',
    source: { label: 'Generated test data', href: 'https://example.test/' },
    alt: `Generated ${type} chart`,
  };
}

function sample(type: (typeof MONEY_TYPES)[number], seed: number): any {
  const count = 9;
  const positive = variedValues(seed, count);
  const signed = variedValues(seed, count, true);
  const items = positive.map((value, index) => ({ id: `item-${index}`, label: longLabel(index), value }));
  const series = Array.from({ length: 4 }, (_, seriesIndex) => ({
    id: `series-${seriesIndex}`,
    label: `Series ${seriesIndex + 1} with a long legend label`,
    values: positive.slice(0, 6).map((value, index) => index < 3 ? value : Math.round(value / (seriesIndex + 1))),
  }));
  switch (type) {
    case 'sankey': {
      const nodes = [
        ...Array.from({ length: 4 }, (_, index) => ({ id: `source-${index}`, label: longLabel(index) })),
        ...Array.from({ length: 3 }, (_, index) => ({ id: `middle-${index}`, label: longLabel(index + 4) })),
        ...Array.from({ length: 4 }, (_, index) => ({ id: `sink-${index}`, label: longLabel(index + 7) })),
      ];
      const links = [
        ...Array.from({ length: 4 }, (_, index) => ({ from: `source-${index}`, to: `middle-${index % 3}`, value: positive[index], label: `source flow ${index}` })),
        ...Array.from({ length: 4 }, (_, index) => ({ from: `middle-${index % 3}`, to: `sink-${index}`, value: positive[index + 3], label: `outgoing flow ${index}` })),
      ];
      return { ...common(type), nodes, links };
    }
    case 'waterfall':
      return { ...common(type), start: { label: 'Starting appropriation', value: 500_000 }, steps: signed.map((value, index) => ({ id: `step-${index}`, label: longLabel(index), value })), end: { label: 'Adopted total' } };
    case 'delta':
      return { ...common(type), from: { label: longLabel(0), value: signed[4] }, to: { label: longLabel(1), value: signed[3] } };
    case 'bar':
      return { ...common(type), items };
    case 'grouped-bar':
      return { ...common(type), categories: Array.from({ length: 6 }, (_, index) => longLabel(index)), series };
    case 'stacked-bar':
      return { ...common(type), legend: true, categories: Array.from({ length: 6 }, (_, index) => longLabel(index)), series };
    case 'treemap':
      return { ...common(type), nodes: [{ id: 'root', label: 'All appropriations', children: items.map(item => ({ ...item })) }] };
    case 'bullet':
      return { ...common(type), items: items.slice(0, 7).map((item, index) => ({ id: item.id, label: item.label, actual: item.value, target: positive[(index + 1) % positive.length], ranges: [10, 1_000, 1_000_000_000].sort((a, b) => a - b) })) };
    case 'slope':
      return { ...common(type), columns: { from: 'Proposed', to: 'Adopted' }, items: signed.slice(0, 8).map((value, index) => ({ id: `slope-${index}`, label: longLabel(index), from: value, to: signed[(index + 2) % signed.length] })) };
    case 'alluvial': {
      const stages = ['Introduced', 'Amended', 'Adopted'];
      const nodes = stages.flatMap((stage, stageIndex) => Array.from({ length: 5 }, (_, index) => ({ id: `${stageIndex}-${index}`, stage, label: longLabel(index + stageIndex * 5) })));
      const links = [0, 1].flatMap(stageIndex => Array.from({ length: 5 }, (_, index) => ({ from: `${stageIndex}-${index}`, to: `${stageIndex + 1}-${(index + stageIndex) % 5}`, value: positive[index], label: index === 0 ? 'pending' : undefined })));
      return { ...common(type), stages, nodes, links };
    }
    case 'range-plot':
      return { ...common(type), items: signed.slice(0, 8).map((value, index) => { const other = signed[(index + 1) % signed.length]; const min = Math.min(value, other); const max = Math.max(value, other); return { id: `range-${index}`, label: longLabel(index), min, max, mid: index % 2 ? (min + max) / 2 : undefined }; }) };
    case 'line':
      return { ...common(type), periods: Array.from({ length: 6 }, (_, index) => `Fiscal period ${index + 1} with long text`), series: series.map((entry, index) => ({ ...entry, values: index === 0 ? signed.slice(0, 6) : entry.values })) };
    case 'stacked-area':
      return { ...common(type), periods: Array.from({ length: 6 }, (_, index) => `FY ${2025 + index}`), series };
    case 'histogram':
      return { ...common(type), values: [...positive, ...positive.slice(0, 4), 999_999_999] };
    case 'dot-plot':
      return { ...common(type), items: signed.map((value, index) => ({ id: `dot-${index}`, label: longLabel(index), value })) };
  }
}

function walk(element: SatoriElement, visit: (element: SatoriElement) => void): void {
  visit(element);
  const children = element.props.children;
  if (Array.isArray(children)) children.forEach(child => typeof child === 'string' || walk(child, visit));
  else if (children && typeof children !== 'string') walk(children, visit);
}

describe('money render paths', () => {
  for (const type of MONEY_TYPES) {
    test(`${type} renders deterministic high-variability samples in bounds`, () => {
      for (const seed of [1, 7, 91, 2027]) {
        const spec = sample(type, seed);
        const first = buildMoneyDiagram(spec, context);
        const second = buildMoneyDiagram(spec, context);
        expect(JSON.stringify(first)).toBe(JSON.stringify(second));
        expect(first.width).toBe(context.width);
        expect(first.height).toBeGreaterThan(100);
        const serialized = JSON.stringify(first.tree);
        expect(serialized).not.toMatch(/NaN|Infinity|null(?=,|\})/);

        walk(first.tree, element => {
          if (element.type !== 'svg') return;
          const svgWidth = Number(element.props.width);
          const svgHeight = Number(element.props.height);
          expect(svgWidth).toBeGreaterThan(0);
          expect(svgHeight).toBeGreaterThan(0);
          const svgChildren = element.props.children;
          if (!Array.isArray(svgChildren)) return;
          for (const child of svgChildren) {
            if (typeof child === 'string') continue;
            for (const key of ['x', 'x1', 'x2', 'cx']) {
              if (child.props[key] == null) continue;
              const value = Number(child.props[key]);
              expect(value).toBeGreaterThanOrEqual(-0.01);
              expect(value).toBeLessThanOrEqual(svgWidth + 0.01);
            }
            for (const key of ['y', 'y1', 'y2', 'cy']) {
              if (child.props[key] == null) continue;
              const value = Number(child.props[key]);
              expect(value).toBeGreaterThanOrEqual(-0.01);
              expect(value).toBeLessThanOrEqual(svgHeight + 0.01);
            }
            if (child.props.width != null) expect(Number(child.props.width)).toBeGreaterThanOrEqual(0);
            if (child.props.height != null) expect(Number(child.props.height)).toBeGreaterThanOrEqual(0);
          }
        });
      }
    });
  }

  test('zero-value flow bands render a hairline and n/a', () => {
    const result = buildMoneyDiagram({
      ...common('sankey'),
      nodes: [{ id: 'a', label: 'General' }, { id: 'b', label: 'Program' }],
      links: [{ from: 'a', to: 'b', value: 0, label: 'unknown' }],
    }, context);
    const output = JSON.stringify(result.tree);
    expect(output).toContain('n/a');
    expect(output).toContain('data-money-link');
  });

  test('treemap keeps verbose metadata off the drawable surface', () => {
    const result = buildMoneyDiagram({
      ...common('treemap'),
      nodes: [{
        id: 'root', label: 'All governmental funds and component units', children: [
          { id: 'large', label: 'Salaries, benefits, and statutory payroll costs', value: 310_000_000 },
          { id: 'small', label: 'One-block demonstration pilot with a deliberately verbose title', value: 250 },
          { id: 'zero', label: 'Currently unfunded documentary project', value: 0 },
        ],
      }],
    }, context);
    const nodes: SatoriElement[] = [];
    walk(result.tree, element => nodes.push(element));
    expect(nodes.filter(element => element.type === 'title')).toHaveLength(0);
    const leaves = nodes.filter(element => element.props['data-money-leaf']);
    expect(leaves.length).toBeGreaterThanOrEqual(2);
    for (const leaf of leaves) {
      expect(String(leaf.props['aria-label'])).toContain('—');
      expect(leaf.props['data-label']).toBe(leaf.props['aria-label']);
    }
    expect(JSON.stringify(result.tree)).not.toContain('Currently unfunded documentary project');
    expect(JSON.stringify(result.tree)).toContain('data-money-zero-leaves');
  });

  test('wide slope endpoints wrap detail instead of replacing it with ellipses', () => {
    const result = buildMoneyDiagram({
      ...common('slope'), columns: { from: 'Introduced', to: 'Adopted' },
      items: Array.from({ length: 8 }, (_, index) => ({
        id: `program-${index}`,
        label: `${index + 1}. Department of Redevelopment, Infrastructure, and Neighborhood Opportunity`,
        from: index * 100_000, to: (7 - index) * 120_000,
      })),
    }, { ...context, width: 920 });
    const labels: SatoriElement[] = [];
    walk(result.tree, element => { if (element.props['data-money-slope-label']) labels.push(element); });
    expect(labels.length).toBeGreaterThan(16);
    expect(labels.every(element => !String(element.props.children).includes('…'))).toBe(true);
    expect(labels.map(element => String(element.props.children)).join(' ')).toContain('Neighborhood Opportunity');
  });

  test('line deconflicts coincident series points', () => {
    const result = buildMoneyDiagram({
      ...common('line'), periods: ['A', 'B', 'C'],
      series: Array.from({ length: 5 }, (_, index) => ({ id: `s-${index}`, label: `S${index}`, values: [10, 10, 10] })),
    }, context);
    const points: Array<{ x: number; y: number }> = [];
    walk(result.tree, element => {
      if (element.type === 'circle' && element.props['data-money-point']) points.push({ x: Number(element.props.cx), y: Number(element.props.cy) });
    });
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        expect(Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y)).toBeGreaterThan(7.5);
      }
    }
  });

  test('histogram retains repeated observations in one bin', () => {
    const result = buildMoneyDiagram({ ...common('histogram'), values: [42, 42, 42, 42] }, context);
    expect(JSON.stringify(result.tree)).toContain('data-money-bin');
    expect(JSON.stringify(result.tree)).toContain('"children":"4"');
  });

  test('alternate orientations remain bounded', () => {
    for (const type of ['bar', 'grouped-bar', 'stacked-bar', 'range-plot', 'dot-plot'] as const) {
      const spec = { ...sample(type, 404), orientation: 'vertical' };
      const result = buildMoneyDiagram(spec, { ...context, width: 430 });
      expect(JSON.stringify(result.tree)).not.toMatch(/NaN|Infinity/);
      expect(result.width).toBe(430);
    }
  });

  test('pre-binned histogram uses authored contiguous bins', () => {
    const result = buildMoneyDiagram({
      ...common('histogram'),
      bins: [
        { start: -1_000_000, end: 0, count: 2 },
        { start: 0, end: 1_000_000, count: 0 },
        { start: 1_000_000, end: 2_000_000, count: 7 },
      ],
    }, context);
    const output = JSON.stringify(result.tree);
    expect(output).toContain('data-money-bin');
    expect(output).toContain('"children":"7"');
  });

  test('one-period stacked area becomes a data-sized stacked column', () => {
    const result = buildMoneyDiagram({
      ...common('stacked-area'), periods: ['Current year'],
      series: [
        { id: 'city', label: 'City', values: [1_000_000] },
        { id: 'county', label: 'County', values: [1_000_000] },
      ],
    }, context);
    const output = JSON.stringify(result.tree);
    expect(output.match(/data-money-area/g)?.length).toBe(2);
    expect(output).toContain('$2M');
  });

  test('near-limit finite domains never emit non-finite geometry', () => {
    const maximum = Number.MAX_VALUE;
    const cases = [
      { ...common('line'), periods: ['Low', 'High'], series: [{ id: 's', label: 'S', values: [-maximum, maximum] }] },
      { ...common('histogram'), values: [-maximum, 0, maximum] },
      { ...common('slope'), columns: { from: 'A', to: 'B' }, items: [{ id: 'a', label: 'A', from: -maximum, to: maximum }, { id: 'b', label: 'B', from: maximum, to: -maximum }] },
    ];
    for (const spec of cases) expect(JSON.stringify(buildMoneyDiagram(spec, context))).not.toMatch(/NaN|Infinity/);
  });
});
