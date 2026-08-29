import type { AnyDiagramSpec, RenderOptions } from './types.js';
import { validate } from './validate.js';
import { renderDiagram, buildDiagramTree } from './render/index.js';
import { cloneDiagramSpec } from './spec.js';

export async function diagram(
  spec: AnyDiagramSpec,
  options: RenderOptions = {},
): Promise<string | Buffer> {
  spec = cloneDiagramSpec(spec);
  // Defaults for flow type
  if (!spec.type || spec.type === 'flow') {
    const flowSpec = spec as import('./types.js').DiagramSpec;
    flowSpec.direction = flowSpec.direction ?? 'TB';
  }

  const errors = validate(spec);
  if (errors.length > 0) {
    throw new Error(`Invalid diagram spec:\n  ${errors.join('\n  ')}`);
  }

  return renderDiagram(spec, options);
}

/**
 * Build the Satori element tree without rasterizing.
 * Returns { tree, width, height } for use in React components or custom renderers.
 */
export async function diagramTree(
  spec: AnyDiagramSpec,
  options: RenderOptions = {},
): Promise<{ tree: import('./types.js').SatoriElement; width: number; height: number }> {
  spec = cloneDiagramSpec(spec);
  // Defaults for flow type
  if (!spec.type || spec.type === 'flow') {
    const flowSpec = spec as import('./types.js').DiagramSpec;
    flowSpec.direction = flowSpec.direction ?? 'TB';
  }

  const errors = validate(spec);
  if (errors.length > 0) {
    throw new Error(`Invalid diagram spec:\n  ${errors.join('\n  ')}`);
  }

  return buildDiagramTree(spec, options);
}

// Re-exports
export { renderDiagram, buildDiagramTree } from './render/index.js';
export type { DiagramTreeResult } from './render/index.js';
export { parseSpec } from './parse.js';
export { validate, isSafeHref } from './validate.js';
export { getTheme, defaultTheme, darkTheme } from './themes/index.js';
export type * from './types.js';
export { formatValue, CIVIC_ICON_STARTER, CIVIC_ICON_ISOTYPE } from './diagrams/civic/shared.js';
export { parseISODate, positionOnAxis } from './diagrams/civic/index.js';
