import type { DiagramSpec, LayoutNode, NodeId, EdgeRoute, ThemeConfig } from '../types.js';

/**
 * Compute edge paths (SVG path data) and arrowhead polygons.
 */
export function routeEdges(
  spec: DiagramSpec,
  positions: Map<NodeId, LayoutNode>,
  theme: ThemeConfig,
): EdgeRoute[] {
  const direction = spec.direction ?? 'TB';
  const routes: EdgeRoute[] = [];

  for (const edge of spec.edges) {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to) continue;

    let startX: number, startY: number, endX: number, endY: number;

    if (direction === 'TB') {
      // Exit bottom center, enter top center
      startX = from.x + from.width / 2;
      startY = from.y + from.height;
      endX = to.x + to.width / 2;
      endY = to.y;
    } else {
      // LR: exit right center, enter left center
      startX = from.x + from.width;
      startY = from.y + from.height / 2;
      endX = to.x;
      endY = to.y + to.height / 2;
    }

    // Shorten end by arrow size so arrow tip lands at node edge
    const arrowSize = theme.edge.arrowSize;
    const dx = endX - startX;
    const dy = endY - startY;
    const len = Math.sqrt(dx * dx + dy * dy);

    let adjEndX = endX;
    let adjEndY = endY;
    if (len > 0) {
      adjEndX = endX - (dx / len) * arrowSize;
      adjEndY = endY - (dy / len) * arrowSize;
    }

    // Build path
    let pathData: string;
    if (direction === 'TB') {
      if (Math.abs(startX - endX) < 1) {
        // Straight vertical
        pathData = `M ${startX} ${startY} L ${adjEndX} ${adjEndY}`;
      } else {
        // Cubic bezier
        const midY = (startY + adjEndY) / 2;
        pathData = `M ${startX} ${startY} C ${startX} ${midY}, ${adjEndX} ${midY}, ${adjEndX} ${adjEndY}`;
      }
    } else {
      if (Math.abs(startY - endY) < 1) {
        // Straight horizontal
        pathData = `M ${startX} ${startY} L ${adjEndX} ${adjEndY}`;
      } else {
        // Cubic bezier
        const midX = (startX + adjEndX) / 2;
        pathData = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${adjEndY}, ${adjEndX} ${adjEndY}`;
      }
    }

    // Arrowhead polygon pointing at endX, endY
    const arrowPoints = computeArrowhead(adjEndX, adjEndY, endX, endY, arrowSize);

    // Label position: midpoint of edge
    const labelX = (startX + endX) / 2;
    const labelY = (startY + endY) / 2;

    routes.push({
      from: edge.from,
      to: edge.to,
      pathData,
      arrowPoints,
      labelX: edge.label ? labelX : undefined,
      labelY: edge.label ? labelY : undefined,
    });
  }

  return routes;
}

/**
 * Position-based edge routing for grouped layouts.
 * Instead of using a single global direction, picks ports based on the relative
 * positions of the two nodes (dominant axis determines port choice).
 */
export function routeEdgesGlobal(
  spec: DiagramSpec,
  positions: Map<NodeId, LayoutNode>,
  theme: ThemeConfig,
): EdgeRoute[] {
  const routes: EdgeRoute[] = [];

  for (const edge of spec.edges) {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to) continue;

    const fromCX = from.x + from.width / 2;
    const fromCY = from.y + from.height / 2;
    const toCX = to.x + to.width / 2;
    const toCY = to.y + to.height / 2;

    const dx = toCX - fromCX;
    const dy = toCY - fromCY;

    let startX: number, startY: number, endX: number, endY: number;

    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal dominant — use left/right ports
      if (dx > 0) {
        startX = from.x + from.width;
        startY = fromCY;
        endX = to.x;
        endY = toCY;
      } else {
        startX = from.x;
        startY = fromCY;
        endX = to.x + to.width;
        endY = toCY;
      }
    } else {
      // Vertical dominant — use top/bottom ports
      if (dy > 0) {
        startX = fromCX;
        startY = from.y + from.height;
        endX = toCX;
        endY = to.y;
      } else {
        startX = fromCX;
        startY = from.y;
        endX = toCX;
        endY = to.y + to.height;
      }
    }

    // Shorten end by arrow size
    const arrowSize = theme.edge.arrowSize;
    const edx = endX - startX;
    const edy = endY - startY;
    const len = Math.sqrt(edx * edx + edy * edy);

    let adjEndX = endX;
    let adjEndY = endY;
    if (len > 0) {
      adjEndX = endX - (edx / len) * arrowSize;
      adjEndY = endY - (edy / len) * arrowSize;
    }

    // Build path
    let pathData: string;
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal dominant
      if (Math.abs(startY - adjEndY) < 1) {
        pathData = `M ${startX} ${startY} L ${adjEndX} ${adjEndY}`;
      } else {
        const midX = (startX + adjEndX) / 2;
        pathData = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${adjEndY}, ${adjEndX} ${adjEndY}`;
      }
    } else {
      // Vertical dominant
      if (Math.abs(startX - adjEndX) < 1) {
        pathData = `M ${startX} ${startY} L ${adjEndX} ${adjEndY}`;
      } else {
        const midY = (startY + adjEndY) / 2;
        pathData = `M ${startX} ${startY} C ${startX} ${midY}, ${adjEndX} ${midY}, ${adjEndX} ${adjEndY}`;
      }
    }

    const arrowPoints = computeArrowhead(adjEndX, adjEndY, endX, endY, arrowSize);

    const labelX = (startX + endX) / 2;
    const labelY = (startY + endY) / 2;

    routes.push({
      from: edge.from,
      to: edge.to,
      pathData,
      arrowPoints,
      labelX: edge.label ? labelX : undefined,
      labelY: edge.label ? labelY : undefined,
    });
  }

  return routes;
}

/**
 * Compute SVG polygon points for an arrowhead.
 * The arrow tip is at (tipX, tipY), pointing from (baseX, baseY) toward (tipX, tipY).
 */
function computeArrowhead(
  baseX: number,
  baseY: number,
  tipX: number,
  tipY: number,
  size: number,
): string {
  const dx = tipX - baseX;
  const dy = tipY - baseY;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return '';

  // Unit vector from base to tip
  const ux = dx / len;
  const uy = dy / len;

  // Perpendicular
  const px = -uy;
  const py = ux;

  const halfWidth = size * 0.5;

  // Two base corners of the arrowhead triangle
  const x1 = tipX - ux * size + px * halfWidth;
  const y1 = tipY - uy * size + py * halfWidth;
  const x2 = tipX - ux * size - px * halfWidth;
  const y2 = tipY - uy * size - py * halfWidth;

  return `${tipX},${tipY} ${x1},${y1} ${x2},${y2}`;
}
