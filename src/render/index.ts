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
        event.iconDataUri = await resolveIcon(event.icon);
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

export interface DiagramTreeResult {
  tree: import('../types.js').SatoriElement;
  width: number;
  height: number;
}

/**
 * Build the Satori element tree without rasterizing — for use in React components.
 * Returns { tree, width, height } ready for satoriToReact() conversion.
 */
export async function buildDiagramTree(
  spec: AnyDiagramSpec,
  options: RenderOptions = {},
): Promise<DiagramTreeResult> {
  const padding = options.padding ?? 40;
  const type = spec.type ?? 'flow';
  const theme: ThemeConfig = getTheme(spec.theme);

  // Default transparent background for component embedding
  const opts = { ...options, background: options.background ?? 'transparent' };

  switch (type) {
    case 'quadrant': {
      const layout = layoutQuadrant(spec as QuadrantSpec, theme, padding);
      const tree = buildQuadrantTree(spec as QuadrantSpec, layout, theme, opts);
      return { tree, width: opts.width ?? layout.width, height: layout.height };
    }
    case 'timeline': {
      const tSpec = spec as TimelineSpec;
      await Promise.all(tSpec.events.map(async event => {
        if (event.icon) {
          try { event.iconDataUri = await resolveIcon(event.icon); } catch {}
        }
      }));
      const layout = layoutTimeline(tSpec, theme, padding);
      const tree = buildTimelineTree(tSpec, layout, theme, opts);
      return { tree, width: opts.width ?? layout.width, height: layout.height };
    }
    case 'gantt': {
      const layout = layoutGantt(spec as GanttSpec, theme, padding);
      const tree = buildGanttTree(spec as GanttSpec, layout, theme, opts);
      return { tree, width: opts.width ?? layout.width, height: layout.height };
    }
    case 'flow':
    default: {
      const flowSpec = spec as DiagramSpec;
      await Promise.all(flowSpec.nodes.map(async node => {
        if (node.icon) node.iconDataUri = await resolveIcon(node.icon);
      }));
      const result = layoutWithGroups(flowSpec, theme, padding);
      const tree = buildTree(flowSpec, result, theme, opts);
      return { tree, width: opts.width ?? result.width, height: result.height };
    }
  }
}

async function rasterize(
  tree: import('../types.js').SatoriElement,
  width: number,
  height: number,
  format: string,
  scale: number,
  options: RenderOptions = {},
): Promise<string | Buffer> {
  switch (format) {
    case 'html':
      return renderToHTML(tree, options);
    case 'svg':
      return renderToSvg(tree, width, height);
    case 'png':
      return renderToPng(tree, width, height, scale);
    default:
      throw new Error(`Unknown format: "${format}"`);
  }
}
