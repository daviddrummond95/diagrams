import type { DiagramSpec, ThemeConfig, LayoutResult, RenderOptions, SatoriElement } from '../types.js';
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
  options: RenderOptions = {},
): SatoriElement {
  const { nodes: positions, edges, width, height } = layoutResult;
  const nodeMap = new Map(spec.nodes.map(n => [n.id, n]));
  const showTitle = options.showTitle !== false;
  const isTransparent = options.background === 'transparent';

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
  if (spec.title && showTitle) {
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

  const rootStyle: Record<string, unknown> = {
    position: 'relative' as const,
    display: 'flex' as const,
    width,
    height,
    fontFamily: theme.fontFamily,
  };
  if (!isTransparent) {
    rootStyle.backgroundColor = theme.canvas.background;
  }

  return {
    type: 'div',
    props: {
      style: rootStyle,
      children,
    },
  };
}
