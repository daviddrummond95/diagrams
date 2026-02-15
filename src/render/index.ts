import type { AnyDiagramSpec, DiagramSpec, GanttSpec, TimelineSpec, QuadrantSpec, RenderOptions, ThemeConfig } from '../types.js';
import { layoutWithGroups } from '../layout/groups.js';
import { getTheme } from '../themes/index.js';
import { resolveIcon } from '../icons.js';
import { buildTree } from './tree.js';
import { renderToSvg, renderToPng } from './rasterize.js';
import { renderToHTML } from './html.js';
import { renderToPptx } from './pptx.js';

// New diagram type imports
import { layoutQuadrant } from '../diagrams/quadrant/layout.js';
import { buildQuadrantTree } from '../diagrams/quadrant/tree.js';
import { renderQuadrantToPptx } from '../diagrams/quadrant/pptx.js';
import { layoutTimeline } from '../diagrams/timeline/layout.js';
import { buildTimelineTree } from '../diagrams/timeline/tree.js';
import { renderTimelineToPptx } from '../diagrams/timeline/pptx.js';
import { layoutGantt } from '../diagrams/gantt/layout.js';
import { buildGanttTree } from '../diagrams/gantt/tree.js';
import { renderGanttToPptx } from '../diagrams/gantt/pptx.js';

export async function renderDiagram(
  spec: AnyDiagramSpec,
  options: RenderOptions = {},
): Promise<string | Buffer> {
  const format = options.format ?? 'png';
  const padding = options.padding ?? 40;
  const scale = options.scale ?? 2;
  const type = spec.type ?? 'flow';

  const theme: ThemeConfig = getTheme(spec.theme);

  switch (type) {
    case 'quadrant':
      return renderQuadrant(spec as QuadrantSpec, theme, format, padding, scale, options.width);
    case 'timeline':
      return renderTimeline(spec as TimelineSpec, theme, format, padding, scale, options.width);
    case 'gantt':
      return renderGantt(spec as GanttSpec, theme, format, padding, scale, options.width);
    case 'flow':
    default:
      return renderFlow(spec as DiagramSpec, theme, format, padding, scale, options);
  }
}

async function renderFlow(
  spec: DiagramSpec,
  theme: ThemeConfig,
  format: string,
  padding: number,
  scale: number,
  options: RenderOptions,
): Promise<string | Buffer> {
  // Resolve icons to data URIs
  await Promise.all(spec.nodes.map(async node => {
    if (node.icon) node.iconDataUri = await resolveIcon(node.icon);
  }));

  const result = layoutWithGroups(spec, theme, padding);

  if (format === 'pptx') {
    return renderToPptx(spec, result, theme);
  }

  const width = options.width ?? result.width;
  const height = result.height;
  const tree = buildTree(spec, result, theme);

  return rasterize(tree, width, height, format, scale);
}

async function renderQuadrant(
  spec: QuadrantSpec,
  theme: ThemeConfig,
  format: string,
  padding: number,
  scale: number,
  overrideWidth?: number,
): Promise<string | Buffer> {
  const layout = layoutQuadrant(spec, theme, padding);

  if (format === 'pptx') {
    return renderQuadrantToPptx(spec, layout, theme);
  }

  const tree = buildQuadrantTree(spec, layout, theme);
  const width = overrideWidth ?? layout.width;
  return rasterize(tree, width, layout.height, format, scale);
}

async function renderTimeline(
  spec: TimelineSpec,
  theme: ThemeConfig,
  format: string,
  padding: number,
  scale: number,
  overrideWidth?: number,
): Promise<string | Buffer> {
  // Resolve icons for events
  await Promise.all(spec.events.map(async event => {
    if (event.icon) {
      try {
        event.iconDataUri = await resolveIcon(event.icon);
      } catch {
        // icon resolution is best-effort for timelines
      }
    }
  }));

  const layout = layoutTimeline(spec, theme, padding);

  if (format === 'pptx') {
    return renderTimelineToPptx(spec, layout, theme);
  }

  const tree = buildTimelineTree(spec, layout, theme);
  const width = overrideWidth ?? layout.width;
  return rasterize(tree, width, layout.height, format, scale);
}

async function renderGantt(
  spec: GanttSpec,
  theme: ThemeConfig,
  format: string,
  padding: number,
  scale: number,
  overrideWidth?: number,
): Promise<string | Buffer> {
  const layout = layoutGantt(spec, theme, padding);

  if (format === 'pptx') {
    return renderGanttToPptx(spec, layout, theme);
  }

  const tree = buildGanttTree(spec, layout, theme);
  const width = overrideWidth ?? layout.width;
  return rasterize(tree, width, layout.height, format, scale);
}

async function rasterize(
  tree: import('../types.js').SatoriElement,
  width: number,
  height: number,
  format: string,
  scale: number,
): Promise<string | Buffer> {
  switch (format) {
    case 'html':
      return renderToHTML(tree);
    case 'svg':
      return renderToSvg(tree, width, height);
    case 'png':
      return renderToPng(tree, width, height, scale);
    default:
      throw new Error(`Unknown format: "${format}"`);
  }
}
