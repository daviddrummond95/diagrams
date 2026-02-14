import type { DiagramSpec, DiagramGroup, ThemeConfig, LayoutResult, LayoutNode, NodeId, GroupLayout } from '../types.js';
import { layout } from './index.js';
import { routeEdgesGlobal } from './edges.js';

/**
 * Two-level layout: lay out nodes within groups, then arrange groups on a grid.
 * Falls back to regular layout() when no groups are defined.
 */
export function layoutWithGroups(spec: DiagramSpec, theme: ThemeConfig, padding: number = 40): LayoutResult {
  if (!spec.groups || spec.groups.length === 0) {
    return layout(spec, theme, padding);
  }

  const groupTheme = theme.group;
  const nodeMap = new Map(spec.nodes.map(n => [n.id, n]));

  // Partition nodes into groups (+ ungrouped)
  const groupedNodeIds = new Set<string>();
  for (const group of spec.groups) {
    for (const m of group.members) groupedNodeIds.add(m);
  }
  const ungroupedNodes = spec.nodes.filter(n => !groupedNodeIds.has(n.id));

  // Build an implicit ungrouped group if needed
  const allGroups: DiagramGroup[] = [...spec.groups];
  if (ungroupedNodes.length > 0) {
    allGroups.push({
      id: '__ungrouped__',
      members: ungroupedNodes.map(n => n.id),
      direction: spec.direction,
    });
  }

  // Step 1: Intra-group layout — lay out each group's nodes independently
  const groupInternalLayouts = new Map<string, LayoutResult>();
  for (const group of allGroups) {
    const memberSet = new Set(group.members);
    const groupNodes = group.members.map(id => nodeMap.get(id)!).filter(Boolean);
    const groupEdges = spec.edges.filter(e => memberSet.has(e.from) && memberSet.has(e.to));

    const miniSpec: DiagramSpec = {
      nodes: groupNodes,
      edges: groupEdges,
      direction: group.direction ?? spec.direction ?? 'TB',
    };

    const innerResult = layout(miniSpec, theme, 0);
    groupInternalLayouts.set(group.id, innerResult);
  }

  // Step 2: Compute group dimensions (inner content + padding + label)
  const groupDimensions = new Map<string, { width: number; height: number }>();
  for (const group of allGroups) {
    const inner = groupInternalLayouts.get(group.id)!;
    const labelHeight = group.label ? groupTheme.labelFontSize + groupTheme.labelMarginBottom : 0;
    const width = inner.width + groupTheme.paddingX * 2;
    const height = inner.height + groupTheme.paddingY * 2 + labelHeight;
    groupDimensions.set(group.id, { width, height });
  }

  // Step 3: Grid placement
  const grid = buildGrid(spec, allGroups);
  const groupPositions = placeGrid(grid, groupDimensions, spec.direction ?? 'TB', groupTheme.gap, padding);

  // Step 4: Apply offsets — shift each node's position by its group's absolute origin
  const allPositions = new Map<NodeId, LayoutNode>();
  const groupLayouts: GroupLayout[] = [];

  for (const group of allGroups) {
    const inner = groupInternalLayouts.get(group.id)!;
    const gPos = groupPositions.get(group.id)!;
    const gDim = groupDimensions.get(group.id)!;
    const labelHeight = group.label ? groupTheme.labelFontSize + groupTheme.labelMarginBottom : 0;

    const offsetX = gPos.x + groupTheme.paddingX;
    const offsetY = gPos.y + groupTheme.paddingY + labelHeight;

    for (const [nodeId, nodePos] of inner.nodes) {
      allPositions.set(nodeId, {
        id: nodeId,
        x: nodePos.x + offsetX,
        y: nodePos.y + offsetY,
        width: nodePos.width,
        height: nodePos.height,
      });
    }

    // Only add visible groups (not __ungrouped__)
    if (group.id !== '__ungrouped__') {
      groupLayouts.push({
        id: group.id,
        label: group.label,
        x: gPos.x,
        y: gPos.y,
        width: gDim.width,
        height: gDim.height,
        style: group.style,
      });
    }
  }

  // Step 5: Route ALL edges globally using absolute positions
  const edges = routeEdgesGlobal(spec, allPositions, theme);

  // Compute canvas size
  let maxX = 0;
  let maxY = 0;
  for (const pos of allPositions.values()) {
    maxX = Math.max(maxX, pos.x + pos.width);
    maxY = Math.max(maxY, pos.y + pos.height);
  }
  for (const gl of groupLayouts) {
    maxX = Math.max(maxX, gl.x + gl.width);
    maxY = Math.max(maxY, gl.y + gl.height);
  }

  return {
    nodes: allPositions,
    edges,
    width: Math.ceil(maxX + padding),
    height: Math.ceil(maxY + padding),
    groups: groupLayouts,
  };
}

/**
 * Build a grid of group IDs from explicit rows or default layout.
 */
function buildGrid(spec: DiagramSpec, allGroups: DiagramGroup[]): string[][] {
  if (spec.rows && spec.rows.length > 0) {
    // Use explicit rows; add any groups not mentioned in rows
    const mentioned = new Set(spec.rows.flat());
    const missing = allGroups.filter(g => !mentioned.has(g.id));
    if (missing.length > 0) {
      return [...spec.rows, missing.map(g => g.id)];
    }
    return spec.rows;
  }

  // Default: single row (LR) or single column (TB)
  const direction = spec.direction ?? 'TB';
  const ids = allGroups.map(g => g.id);
  if (direction === 'LR') {
    return [ids]; // one row with all groups
  } else {
    return ids.map(id => [id]); // each group in its own row
  }
}

/**
 * Place groups on the grid, returning absolute (x, y) positions for each group.
 */
function placeGrid(
  grid: string[][],
  groupDimensions: Map<string, { width: number; height: number }>,
  _direction: string,
  gap: number,
  padding: number,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  // Compute row heights and column widths
  // Each row has a height = max height of its groups
  // Total width of each row = sum of group widths + gaps
  const rowHeights: number[] = [];
  const rowWidths: number[] = [];

  for (const row of grid) {
    let maxH = 0;
    let totalW = 0;
    for (const gId of row) {
      const dim = groupDimensions.get(gId);
      if (dim) {
        maxH = Math.max(maxH, dim.height);
        totalW += dim.width;
      }
    }
    totalW += (row.length - 1) * gap;
    rowHeights.push(maxH);
    rowWidths.push(totalW);
  }

  // Total canvas width needed (for centering rows)
  const maxRowWidth = Math.max(...rowWidths);

  let y = padding;
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];
    const rowHeight = rowHeights[r];
    // Center this row within the max row width
    const rowWidth = rowWidths[r];
    let x = padding + (maxRowWidth - rowWidth) / 2;

    for (const gId of row) {
      const dim = groupDimensions.get(gId);
      if (!dim) continue;
      // Center vertically within the row
      positions.set(gId, { x, y: y + (rowHeight - dim.height) / 2 });
      x += dim.width + gap;
    }
    y += rowHeight + gap;
  }

  return positions;
}
