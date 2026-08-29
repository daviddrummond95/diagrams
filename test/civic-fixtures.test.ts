import { describe, expect, test } from 'bun:test';
import { dirname, join } from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';
import { diagram, parseSpec, validate } from '../src/index.js';

const examples = join(import.meta.dir, '..', 'civic-backlog', 'examples');
const fixtures = readdirSync(examples).filter(name => name.endsWith('.yaml')).sort();

describe('canonical civic fixtures', () => {
  for (const name of fixtures) {
    test(`${name} validates and completes the SVG render path`, async () => {
      const path = join(examples, name);
      const spec = parseSpec(readFileSync(path, 'utf8'));
      expect(validate(spec)).toEqual([]);
      const svg = await diagram(spec, { format: 'svg', width: 760, padding: 28, baseDir: dirname(path) });
      expect(typeof svg).toBe('string');
      expect(String(svg).startsWith('<svg')).toBe(true);
      expect(String(svg)).not.toContain('NaN');
      expect(String(svg)).not.toContain('Infinity');
      if ('alt' in spec && spec.alt) expect(String(svg)).toContain('<desc>');
    }, 15_000);
  }

  test('shared civic output paths include accessibility and complete binary formats', async () => {
    const spec = {
      type: 'delta' as const,
      title: 'Output path QA',
      caption: 'A value changed.',
      unit: 'usd' as const,
      source: { label: 'Public record', href: 'https://example.com/record' },
      alt: 'The amount fell from one million dollars to five hundred thousand dollars.',
      dataTable: { columns: ['Moment', 'Amount'], records: [['Before', 1_000_000], ['After', 500_000]] },
      from: { label: 'Before', value: 1_000_000 },
      to: { label: 'After', value: 500_000 },
    };
    const html = await diagram(spec, { format: 'html', width: 700 });
    expect(String(html)).toContain('href="https://example.com/record"');
    expect(String(html)).toContain('Accessible diagram data');
    expect(String(html)).toContain('$1M');
    const png = await diagram(spec, { format: 'png', width: 700, scale: 1 });
    expect(Buffer.isBuffer(png)).toBe(true);
    expect((png as Buffer).subarray(1, 4).toString()).toBe('PNG');
    const pptx = await diagram(spec, { format: 'pptx', width: 700 });
    expect(Buffer.isBuffer(pptx)).toBe(true);
    expect((pptx as Buffer).subarray(0, 2).toString()).toBe('PK');
  }, 15_000);
});
