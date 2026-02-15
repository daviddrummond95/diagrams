import type { QuadrantSpec, QuadrantLayoutResult, ThemeConfig } from '../../types.js';

const DEFAULT_COLORS: Record<string, string> = {
  'top-left': '#22C55E',
  'top-right': '#3B82F6',
  'bottom-left': '#EAB308',
  'bottom-right': '#EF4444',
};

export function layoutQuadrant(spec: QuadrantSpec, theme: ThemeConfig, padding: number): QuadrantLayoutResult {
  const qt = theme.quadrant;
  const gridSize = qt?.gridSize ?? 400;
  const titleOffset = spec.title ? 40 : 0;
  const axisLabelSpace = 50; // space for axis labels on left and bottom

  const gridOriginX = padding + axisLabelSpace;
  const gridOriginY = padding + titleOffset;
  const totalWidth = gridOriginX + gridSize + padding + 20; // 20 for right axis label
  const totalHeight = gridOriginY + gridSize + axisLabelSpace + padding;

  // Map quadrant definitions
  const halfGrid = gridSize / 2;
  const quadrantPositions: Record<string, { x: number; y: number }> = {
    'top-left': { x: gridOriginX, y: gridOriginY },
    'top-right': { x: gridOriginX + halfGrid, y: gridOriginY },
    'bottom-left': { x: gridOriginX, y: gridOriginY + halfGrid },
    'bottom-right': { x: gridOriginX + halfGrid, y: gridOriginY + halfGrid },
  };

  const quadrants = (spec.quadrants ?? []).map(q => ({
    label: q.label,
    x: quadrantPositions[q.position].x,
    y: quadrantPositions[q.position].y,
    width: halfGrid,
    height: halfGrid,
    color: q.color ?? DEFAULT_COLORS[q.position],
  }));

  // If no quadrants defined, create default 4
  if (quadrants.length === 0) {
    for (const [pos, coords] of Object.entries(quadrantPositions)) {
      quadrants.push({
        label: '',
        x: coords.x,
        y: coords.y,
        width: halfGrid,
        height: halfGrid,
        color: DEFAULT_COLORS[pos],
      });
    }
  }

  // Map items: x=0,y=0 is bottom-left; x=1,y=1 is top-right
  const items = spec.items.map(item => ({
    label: item.label,
    x: gridOriginX + item.x * gridSize,
    y: gridOriginY + (1 - item.y) * gridSize, // flip Y since SVG Y goes down
    color: item.color,
  }));

  return {
    items,
    quadrants,
    gridOrigin: { x: gridOriginX, y: gridOriginY },
    gridSize,
    xAxis: spec.xAxis,
    yAxis: spec.yAxis,
    width: totalWidth,
    height: totalHeight,
  };
}
