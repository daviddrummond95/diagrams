import type { DiagramSpec, ThemeConfig, LayoutResult, SatoriElement } from '../types.js';
import { renderNode } from './nodes.js';
import { renderEdges } from './edges.js';
import { renderGroupCard } from './groups.js';

/**
 * Build the complete Satori-compatible element tree.
 */
export function buildTree(
  spec: DiagramSpec,
  layoutResult: LayoutResult,
  theme: ThemeConfig,
): SatoriElement {
  const { nodes: positions, edges, width, height } = layoutResult;
  const nodeMap = new Map(spec.nodes.map(n => [n.id, n]));

  const children: SatoriElement[] = [];

  // Group card layer (just above background, behind everything else)
  if (layoutResult.groups) {
    for (const group of layoutResult.groups) {
      children.push(renderGroupCard(group, theme));
    }
  }

  // Edge SVG layer + labels (above cards, behind nodes)
  children.push(...renderEdges(spec.edges, edges, theme, width, height));

  // Node layer
  for (const [id, pos] of positions) {
    const node = nodeMap.get(id);
    if (!node) continue;
    children.push(renderNode(node, pos, theme));
  }

  // Title
  if (spec.title) {
    children.unshift({
      type: 'div',
      props: {
        style: {
          position: 'absolute' as const,
          top: 8,
          left: 0,
          width,
          display: 'flex',
          justifyContent: 'center',
          fontSize: 18,
          fontWeight: 600,
          color: theme.node.textColor,
          fontFamily: theme.fontFamily,
        },
        children: spec.title,
      },
    });
  }

  return {
    type: 'div',
    props: {
      style: {
        position: 'relative' as const,
        display: 'flex' as const,
        width,
        height,
        backgroundColor: theme.canvas.background,
        fontFamily: theme.fontFamily,
      },
      children,
    },
  };
}
