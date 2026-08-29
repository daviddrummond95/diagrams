import type { AnyDiagramSpec, CivicBase, DiagramSpec, GanttSpec, TimelineSpec, QuadrantSpec, RenderOptions, ThemeConfig } from '../types.js';
import { layoutWithGroups } from '../layout/groups.js';
import { getTheme } from '../themes/index.js';
import { resolveIcon } from '../icons.js';
import { cloneDiagramSpec } from '../spec.js';
import { buildTree } from './tree.js';
import { renderToSvg } from './svg.js';
import { renderToPng } from './rasterize.js';
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
import { buildCivicDiagram, CIVIC_RENDER_TYPES } from '../diagrams/civic/index.js';
import { PLACE_TYPES } from '../diagrams/civic/place.js';
import { hydrateGeoJSON } from '../diagrams/civic/geojson.js';
import { renderCivicToPptx } from '../diagrams/civic/pptx.js';

export { buildDiagramTree } from './build.js';
export type { DiagramTreeResult } from './build.js';

export async function renderDiagram(
  spec: AnyDiagramSpec,
  options: RenderOptions = {},
): Promise<string | Buffer> {
  spec = cloneDiagramSpec(spec);
  if (!spec.type || spec.type === 'flow') {
    const flowSpec = spec as DiagramSpec;
    flowSpec.direction = flowSpec.direction ?? 'TB';
  }
  const format = options.format ?? 'png';
  const padding = options.padding ?? 40;
  const scale = options.scale ?? 2;
  const type = spec.type ?? 'flow';

  const theme: ThemeConfig = getTheme(spec.theme);

  if (CIVIC_RENDER_TYPES.has(type)) {
    return renderCivic(spec, theme, format, scale, options);
  }

  switch (type) {
    case 'quadrant':
      return renderQuadrant(spec as QuadrantSpec, theme, format, padding, scale, options);
    case 'timeline':
      return renderTimeline(spec as TimelineSpec, theme, format, padding, scale, options);
    case 'gantt':
      return renderGantt(spec as GanttSpec, theme, format, padding, scale, options);
    case 'flow':
    default:
      return renderFlow(spec as DiagramSpec, theme, format, padding, scale, options);
  }
}

async function renderCivic(
  spec: AnyDiagramSpec,
  theme: ThemeConfig,
  format: string,
  scale: number,
  options: RenderOptions,
): Promise<string | Buffer> {
  if ((PLACE_TYPES as readonly string[]).includes(spec.type ?? '')) {
    await hydrateGeoJSON(spec as unknown as Record<string, any>, options.baseDir ?? process.cwd());
  }
  const result = buildCivicDiagram(spec, theme, options);
  if (format === 'pptx') {
    return renderCivicToPptx(result.tree, result.width, result.height, theme, spec as CivicBase);
  }
  return rasterize(result.tree, result.width, result.height, format, scale, options, spec as CivicBase);
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
    if (node.icon) node.iconDataUri = await resolveIcon(node.icon, { allowRemote: options.allowRemoteIcons !== false });
  }));

  const result = layoutWithGroups(spec, theme, padding);
  const width = options.width ?? result.width;
  const height = result.height;
  const tree = buildTree(spec, result, theme, options);

  if (format === 'pptx') {
    return renderToPptx(spec, result, theme, options);
  }

  return rasterize(tree, width, height, format, scale, options);
}

async function renderQuadrant(
  spec: QuadrantSpec,
  theme: ThemeConfig,
  format: string,
  padding: number,
  scale: number,
  options: RenderOptions,
): Promise<string | Buffer> {
  const layout = layoutQuadrant(spec, theme, padding);
  const tree = buildQuadrantTree(spec, layout, theme, options);
  const width = options.width ?? layout.width;

  if (format === 'pptx') {
    return renderQuadrantToPptx(spec, layout, theme, options);
  }

  return rasterize(tree, width, layout.height, format, scale, options);
}

async function renderTimeline(
  spec: TimelineSpec,
  theme: ThemeConfig,
  format: string,
  padding: number,
  scale: number,
  options: RenderOptions,
): Promise<string | Buffer> {
  // Resolve icons for events
  await Promise.all(spec.events.map(async event => {
    if (event.icon) {
      try {
        event.iconDataUri = await resolveIcon(event.icon, { allowRemote: options.allowRemoteIcons !== false });
      } catch {
        // icon resolution is best-effort for timelines
      }
    }
  }));

  const layout = layoutTimeline(spec, theme, padding);
  const tree = buildTimelineTree(spec, layout, theme, options);
  const width = options.width ?? layout.width;

  if (format === 'pptx') {
    return renderTimelineToPptx(spec, layout, theme, options);
  }

  return rasterize(tree, width, layout.height, format, scale, options);
}

async function renderGantt(
  spec: GanttSpec,
  theme: ThemeConfig,
  format: string,
  padding: number,
  scale: number,
  options: RenderOptions,
): Promise<string | Buffer> {
  const layout = layoutGantt(spec, theme, padding);
  const tree = buildGanttTree(spec, layout, theme, options);
  const width = options.width ?? layout.width;

  if (format === 'pptx') {
    return renderGanttToPptx(spec, layout, theme, options);
  }

  return rasterize(tree, width, layout.height, format, scale, options);
}

async function rasterize(
  tree: import('../types.js').SatoriElement,
  width: number,
  height: number,
  format: string,
  scale: number,
  options: RenderOptions = {},
  metadata?: CivicBase,
): Promise<string | Buffer> {
  switch (format) {
    case 'html':
      return renderToHTML(tree, options, metadata);
    case 'svg':
      return renderToSvg(tree, width, height, metadata ? { title: metadata.title, alt: metadata.alt } : undefined);
    case 'png':
      return renderToPng(tree, width, height, scale, metadata ? { title: metadata.title, alt: metadata.alt } : undefined);
    default:
      throw new Error(`Unknown format: "${format}"`);
  }
}
