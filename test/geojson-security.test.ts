import { describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { hydrateGeoJSON } from '../src/diagrams/civic/geojson.js';

describe('GeoJSON asset confinement', () => {
  test('rejects lexical traversal outside the asset root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'diagrams-geojson-root-'));
    try {
      const spec = { region: { geojson: '../outside.geojson' } };
      await expect(hydrateGeoJSON(spec, root)).rejects.toThrow('must stay inside the configured asset root');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('rejects symlinks that escape the asset root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'diagrams-geojson-root-'));
    const outside = await mkdtemp(join(tmpdir(), 'diagrams-geojson-outside-'));
    try {
      const target = join(outside, 'private.geojson');
      await writeFile(target, JSON.stringify({ type: 'FeatureCollection', features: [] }));
      await mkdir(join(root, 'assets'));
      await symlink(target, join(root, 'assets', 'linked.geojson'));

      const spec = { region: { geojson: 'assets/linked.geojson' } };
      await expect(hydrateGeoJSON(spec, root)).rejects.toThrow('must stay inside the configured asset root');
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });
});
