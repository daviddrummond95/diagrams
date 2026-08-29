import { describe, expect, test } from 'bun:test';
import { diagram } from '../src/index.js';
import {
  HostedSvgValidationError,
  hostedSvgContentHash,
  renderHostedSvg,
  validateHostedSvg,
} from '../src/server.js';

function hostedFlow() {
  return {
    type: 'flow' as const,
    title: 'A hosted diagram',
    alt: 'One step named Review.',
    dataTable: {
      columns: ['Step'],
      records: [['Review']],
    },
    source: { label: 'Public record', href: 'https://example.com/record' },
    nodes: [{ id: 'review', label: 'Review', icon: 'civic:building' }],
    edges: [],
  };
}

describe('hosted SVG boundary', () => {
  test('renders accessible SVG with deterministic metadata', async () => {
    const spec = hostedFlow();
    const result = await renderHostedSvg(spec, { width: 700, padding: 24 });

    expect(result.svg.startsWith('<svg')).toBe(true);
    expect(result.svg).toContain('<title>A hosted diagram</title>');
    expect(result.svg).toContain('<desc>One step named Review.</desc>');
    expect(result.width).toBe(700);
    expect(result.height).toBeGreaterThan(0);
    expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.contentHash).toBe(hostedSvgContentHash(spec, { padding: 24, width: 700 }));
  });

  test('does not mutate specs in either public render API', async () => {
    const spec = hostedFlow();
    const before = structuredClone(spec);

    await diagram(spec, { format: 'svg', width: 700 });
    expect(spec).toEqual(before);

    await renderHostedSvg(spec, { width: 700 });
    expect(spec).toEqual(before);
  });

  test('requires accessible publication metadata by default', () => {
    const missing = { ...hostedFlow(), alt: '', dataTable: undefined };
    const errors = validateHostedSvg(missing);

    expect(errors).toContain('alt must be a non-empty string for hosted SVG');
    expect(errors).toContain('dataTable with columns and records is required for hosted SVG');
  });

  test('fails closed on non-JSON and malformed structures', () => {
    const cyclic: Record<string, unknown> = hostedFlow();
    cyclic.self = cyclic;
    expect(validateHostedSvg(cyclic)).toEqual(['Diagram spec must be JSON-serializable and acyclic']);
    expect(validateHostedSvg({ type: 'flow', alt: 'Broken.', dataTable: { columns: ['x'], records: [] }, nodes: 'not-an-array' }))
      .toContain('Diagram spec has an invalid structure');
  });

  test('rejects unsafe links, nondeterministic icons, and filesystem GeoJSON', () => {
    const unsafeLink = hostedFlow();
    unsafeLink.source.href = 'javascript:alert(1)';
    expect(validateHostedSvg(unsafeLink).some(error => error.includes('spec.source.href'))).toBe(true);

    const remoteIcon = hostedFlow();
    remoteIcon.nodes[0]!.icon = 'favicon:example.com';
    expect(validateHostedSvg(remoteIcon)).toContain('spec.nodes.0.icon uses disallowed favicon icon resolution');

    const fileBacked = { ...hostedFlow(), geojson: '../private.json' };
    expect(validateHostedSvg(fileBacked)).toContain('spec.geojson must be inline JSON; hosted SVG cannot read filesystem paths');
  });

  test('enforces request, dimension, and output limits', async () => {
    expect(validateHostedSvg(hostedFlow(), { width: 10 })).toContain('width must be between 64 and 2400');
    expect(validateHostedSvg(hostedFlow(), { limits: { maxSpecBytes: 10 } })).toContain('Diagram spec exceeds 10 bytes');

    await expect(renderHostedSvg(hostedFlow(), {
      width: 700,
      limits: { maxOutputBytes: 10 },
    })).rejects.toBeInstanceOf(HostedSvgValidationError);
  });
});
