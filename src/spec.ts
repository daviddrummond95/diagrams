import type { AnyDiagramSpec } from './types.js';

/**
 * Diagram specs are JSON-shaped values. Renderers hydrate icons, GeoJSON, and
 * defaults internally, so every public render boundary starts from a copy and
 * never mutates the caller's persisted specification.
 */
export function cloneDiagramSpec<T extends AnyDiagramSpec>(spec: T): T {
  return structuredClone(spec);
}
