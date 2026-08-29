import type { AnyDiagramSpec, DiagramSpec, GanttSpec, TimelineSpec, QuadrantSpec, RenderOptions, ThemeConfig } from '../types.js';
import { layoutWithGroups } from '../layout/groups.js';
import { getTheme } from '../themes/index.js';
import { resolveIcon } from '../icons.js';
import { cloneDiagramSpec } from '../spec.js';
import { buildTree } from './tree.js';
import { layoutQuadrant } from '../diagrams/quadrant/layout.js';
import { buildQuadrantTree } from '../diagrams/quadrant/tree.js';
import { layoutTimeline } from '../diagrams/timeline/layout.js';
import { buildTimelineTree } from '../diagrams/timeline/tree.js';
import { layoutGantt } from '../diagrams/gantt/layout.js';
import { buildGanttTree } from '../diagrams/gantt/tree.js';
import { buildCivicDiagram, CIVIC_RENDER_TYPES } from '../diagrams/civic/index.js';
import { PLACE_TYPES } from '../diagrams/civic/place.js';
import { hydrateGeoJSON } from '../diagrams/civic/geojson.js';

export interface DiagramTreeResult {
  tree: import('../types.js').SatoriElement;
  width: number;
  height: number;
}

/**
 * Build the Satori element tree without loading PNG, HTML, or PPTX renderers.
 * The input spec is cloned because icon and GeoJSON hydration are intentionally
 * render-local implementation details.
 */
export async function buildDiagramTree(
  input: AnyDiagramSpec,
  options: RenderOptions = {},
): Promise<DiagramTreeResult> {
  const spec = cloneDiagramSpec(input);
  if (!spec.type || spec.type === 'flow') {
    const flowSpec = spec as DiagramSpec;
    flowSpec.direction = flowSpec.direction ?? 'TB';
  }

  const padding = options.padding ?? 40;
  const type = spec.type ?? 'flow';
  const theme: ThemeConfig = getTheme(spec.theme);
  const opts = { ...options, background: options.background ?? 'transparent' };
  const iconOptions = { allowRemote: options.allowRemoteIcons !== false };

  if (CIVIC_RENDER_TYPES.has(type)) {
    if ((PLACE_TYPES as readonly string[]).includes(type)) {
      await hydrateGeoJSON(spec as unknown as Record<string, any>, options.baseDir ?? process.cwd());
    }
    return buildCivicDiagram(spec, theme, opts);
  }

  switch (type) {
    case 'quadrant': {
      const layout = layoutQuadrant(spec as QuadrantSpec, theme, padding);
      const tree = buildQuadrantTree(spec as QuadrantSpec, layout, theme, opts);
      return { tree, width: opts.width ?? layout.width, height: layout.height };
    }
    case 'timeline': {
      const timeline = spec as TimelineSpec;
      await Promise.all(timeline.events.map(async event => {
        if (event.icon) {
          try { event.iconDataUri = await resolveIcon(event.icon, iconOptions); } catch {}
        }
      }));
      const layout = layoutTimeline(timeline, theme, padding);
      const tree = buildTimelineTree(timeline, layout, theme, opts);
      return { tree, width: opts.width ?? layout.width, height: layout.height };
    }
    case 'gantt': {
      const layout = layoutGantt(spec as GanttSpec, theme, padding);
      const tree = buildGanttTree(spec as GanttSpec, layout, theme, opts);
      return { tree, width: opts.width ?? layout.width, height: layout.height };
    }
    case 'flow':
    default: {
      const flow = spec as DiagramSpec;
      await Promise.all(flow.nodes.map(async node => {
        if (node.icon) node.iconDataUri = await resolveIcon(node.icon, iconOptions);
      }));
      const result = layoutWithGroups(flow, theme, padding);
      const tree = buildTree(flow, result, theme, opts);
      return { tree, width: opts.width ?? result.width, height: result.height };
    }
  }
}
