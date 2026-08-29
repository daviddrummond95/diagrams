import { describe, expect, test } from 'bun:test';
import {
  avoidPointCollisions,
  boxesOverlap,
  formatValue,
  placeLabels,
} from '../src/diagrams/civic/shared.js';
import { detectIconType, resolveIcon } from '../src/icons.js';
import { validate } from '../src/validate.js';

describe('civic value formatting', () => {
  test('matches the locked compact outputs', () => {
    expect(formatValue(469, 'usd')).toBe('$469');
    expect(formatValue(469_000, 'usd')).toBe('$469k');
    expect(formatValue(1_200_000, 'usd')).toBe('$1.2M');
    expect(formatValue(3_000_000, 'usd')).toBe('$3M');
    expect(formatValue(-500_000, 'usd')).toBe('-$500k');
    expect(formatValue(469_000, { unit: 'usd', compact: false })).toBe('$469,000');
    expect(formatValue(10.4, 'percent')).toBe('10%');
    expect(formatValue(0.1, { unit: 'percent', scale: 'ratio' })).toBe('10%');
    expect(formatValue(1_247, 'count')).toBe('1.2k');
  });
});

describe('civic icons', () => {
  test('resolve from the packaged local icon set', async () => {
    expect(detectIconType('civic:courthouse')).toBe('civic');
    const icon = await resolveIcon('civic:courthouse');
    expect(icon.startsWith('data:image/svg+xml;base64,')).toBe(true);
  });
});

describe('shared collision solvers', () => {
  test('separates coincident points deterministically and keeps them in bounds', () => {
    const bounds = { x: 0, y: 0, width: 240, height: 160 };
    const points = Array.from({ length: 18 }, (_, index) => ({ id: `p-${index}`, x: 120, y: 80 }));
    const first = avoidPointCollisions(points, 7, bounds, 160, 0.015);
    const second = avoidPointCollisions(points, 7, bounds, 160, 0.015);
    expect(first).toEqual(second);
    for (const point of first) {
      expect(point.x).toBeGreaterThanOrEqual(7);
      expect(point.x).toBeLessThanOrEqual(233);
      expect(point.y).toBeGreaterThanOrEqual(7);
      expect(point.y).toBeLessThanOrEqual(153);
    }
    const unique = new Set(first.map(point => `${point.x.toFixed(2)},${point.y.toFixed(2)}`));
    expect(unique.size).toBe(first.length);
  });

  test('places varied labels in bounds without overlaps when capacity permits', () => {
    const bounds = { x: 0, y: 0, width: 600, height: 320 };
    const anchors = Array.from({ length: 12 }, (_, index) => ({
      id: `label-${index}`,
      text: index % 3 === 0 ? `A much longer civic label ${index}` : `Place ${index}`,
      x: 40 + (index % 4) * 145,
      y: 40 + Math.floor(index / 4) * 105,
      preferred: (index % 2 ? 'right' : 'top') as 'right' | 'top',
    }));
    const labels = placeLabels(anchors, bounds);
    for (const label of labels) {
      expect(label.x).toBeGreaterThanOrEqual(bounds.x);
      expect(label.y).toBeGreaterThanOrEqual(bounds.y);
      expect(label.x + label.width).toBeLessThanOrEqual(bounds.width);
      expect(label.y + label.height).toBeLessThanOrEqual(bounds.height);
    }
    for (let i = 0; i < labels.length; i += 1) for (let j = i + 1; j < labels.length; j += 1) {
      expect(boxesOverlap(labels[i], labels[j], 1)).toBe(false);
    }
  });
});

describe('civic validation invariants', () => {
  test('rejects flow cycles/orphans and swapped local coordinates', () => {
    const cycle = validate({
      type: 'sankey', nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'orphan', label: 'Orphan' }],
      links: [{ from: 'a', to: 'b', value: 1 }, { from: 'b', to: 'a', value: 1 }],
    });
    expect(cycle.some(error => error.includes('acyclic'))).toBe(true);
    expect(cycle.some(error => error.includes('orphaned'))).toBe(true);
    const swapped = validate({
      type: 'locator-map', basemap: { city: 'Terre Haute', county: 'Vigo' }, legend: [{ label: 'Pin' }],
      pins: [{ id: 'x', label: 'Swapped', lon: 39.46, lat: -87.41 }],
    });
    expect(swapped.some(error => error.includes('city frame'))).toBe(true);
  });
});
