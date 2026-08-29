import { readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

/** Resolve authored GeoJSON file references before the synchronous map layout. */
export async function hydrateGeoJSON(spec: Record<string, any>, baseDir: string): Promise<void> {
  const assetRoot = await realpath(baseDir);
  const visit = async (value: any, field: string): Promise<void> => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.geojson === 'string') {
      const reference = value.geojson.trim();
      if (reference.startsWith('{') || reference.startsWith('[')) {
        value.geojson = JSON.parse(reference);
      } else {
        if (isAbsolute(reference)) throw new Error(`${field}.geojson must be relative`);
        const candidate = resolve(assetRoot, reference);
        assertInside(assetRoot, candidate, field);
        try {
          const path = await realpath(candidate);
          assertInside(assetRoot, path, field);
          value.geojson = JSON.parse(await readFile(path, 'utf8'));
        } catch (error) {
          if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return;
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(`Unable to load ${field}.geojson "${reference}": ${message}`);
        }
      }
    }
    for (const [key, child] of Object.entries(value)) {
      if (key === 'theme' || key === 'dataTable' || key === 'geojson') continue;
      if (Array.isArray(child)) await Promise.all(child.map((entry, index) => visit(entry, `${field}.${key}[${index}]`)));
      else if (child && typeof child === 'object') await visit(child, `${field}.${key}`);
    }
  };
  await visit(spec, 'spec');
}

function assertInside(root: string, target: string, field: string): void {
  const rel = relative(root, target);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`${field}.geojson must stay inside the configured asset root`);
  }
}
