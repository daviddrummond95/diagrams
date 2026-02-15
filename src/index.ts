import type { AnyDiagramSpec, RenderOptions } from './types.js';
import { validate } from './validate.js';
import { renderDiagram } from './render/index.js';

export async function diagram(
  spec: AnyDiagramSpec,
  options: RenderOptions = {},
): Promise<string | Buffer> {
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
  DiagramType,
  AnyDiagramSpec,
  GanttSpec,
  GanttTask,
  GanttLayoutResult,
  GanttTheme,
  TimelineSpec,
  TimelineEvent,
  TimelineLayoutResult,
  TimelineTheme,
  QuadrantSpec,
  QuadrantAxis,
  QuadrantDef,
  QuadrantItem,
  QuadrantLayoutResult,
  QuadrantTheme,
} from './types.js';
