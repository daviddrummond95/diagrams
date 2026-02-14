import type { DiagramSpec, RenderOptions } from './types.js';
import { validate } from './validate.js';
import { renderDiagram } from './render/index.js';

export async function diagram(
  spec: DiagramSpec,
  options: RenderOptions = {},
): Promise<string | Buffer> {
  // Defaults
  spec.direction = spec.direction ?? 'TB';

  const errors = validate(spec);
  if (errors.length > 0) {
    throw new Error(`Invalid diagram spec:\n  ${errors.join('\n  ')}`);
  }

  return renderDiagram(spec, options);
}

// Re-exports
export { renderDiagram } from './render/index.js';
export { parseSpec } from './parse.js';
export { validate } from './validate.js';
export { getTheme, defaultTheme, darkTheme } from './themes/index.js';
export type {
  DiagramSpec,
  DiagramNode,
  DiagramEdge,
  DiagramGroup,
  GroupStyleOverrides,
  GroupLayout,
  RenderOptions,
  ThemeConfig,
  NodeShape,
  NodeVariant,
  EdgeStyle,
  Direction,
  OutputFormat,
} from './types.js';
