#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
assert.equal(manifest.exports['./server'].import, './dist/server.js');
assert.equal(manifest.exports['./server'].types, './dist/server.d.ts');

const serverPath = resolve(root, 'dist/server.js');
const serverSource = await readFile(serverPath, 'utf8');
for (const forbidden of ['@resvg/resvg-js', 'pptxgenjs', 'renderToHTML', 'renderToPptx']) {
  assert.equal(serverSource.includes(forbidden), false, `server entrypoint contains ${forbidden}`);
}

const { renderHostedSvg } = await import('@agent-clis/diagrams/server');
const result = await renderHostedSvg({
  type: 'delta',
  title: 'Node package smoke test',
  alt: 'The value moved from one to two.',
  dataTable: {
    columns: ['Moment', 'Value'],
    records: [['Before', 1], ['After', 2]],
  },
  from: { label: 'Before', value: 1 },
  to: { label: 'After', value: 2 },
}, { width: 640 });

assert.equal(result.svg.startsWith('<svg'), true);
assert.equal(result.width, 640);
assert.equal(result.contentHash.length, 64);
console.log(`Verified Node hosted-SVG export (${result.width}x${result.height}, ${serverSource.length} bytes)`);
