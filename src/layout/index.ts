import type { DiagramSpec, ThemeConfig, LayoutResult } from '../types.js';
import { assignRanks } from './rank.js';
import { orderNodes } from './order.js';
import { positionNodes } from './position.js';
import { routeEdges } from './edges.js';

export { layoutWithGroups } from './groups.js';

export function layout(spec: DiagramSpec, theme: ThemeConfig, padding: number = 40): LayoutResult {
  // 1. Assign ranks (layers), detecting back-edges
  const { ranks, backEdges } = assignRanks(spec);

  // 2. Order nodes within ranks to minimize crossings
  const layers = orderNodes(spec, ranks, backEdges);

  // 3. Compute pixel positions
  const positions = positionNodes(spec, layers, theme, padding);

  // 4. Route edges (including back-edges)
  const edges = routeEdges(spec, positions, theme);

  // 5. Compute canvas size
  let maxX = 0;
  let maxY = 0;
  for (const pos of positions.values()) {
    maxX = Math.max(maxX, pos.x + pos.width);
    maxY = Math.max(maxY, pos.y + pos.height);
  }

  return {
    nodes: positions,
    edges,
    width: Math.ceil(maxX + padding),
    height: Math.ceil(maxY + padding),
  };
}
