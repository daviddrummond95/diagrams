import type { DiagramNode, DiagramSpec, NodeId, ThemeConfig, LayoutNode } from '../types.js';

/**
 * Estimate a node's rendered dimensions based on label text and theme.
 */
export function measureNode(node: DiagramNode, theme: ThemeConfig): { width: number; height: number } {
  const isIconVariant = node.variant === 'icon' && node.iconDataUri;

  const fontSize = isIconVariant ? theme.node.icon.dominantLabelFontSize : theme.node.fontSize;
  const paddingX = isIconVariant ? 12 : theme.node.paddingX;
  const paddingY = isIconVariant ? 10 : theme.node.paddingY;

  const charWidth = fontSize * 0.58;
  const labelWidth = node.label.length * charWidth;

  let width = labelWidth + paddingX * 2;
  if (isIconVariant) {
    width = Math.max(width, theme.node.icon.dominantSize + paddingX * 2);
  }
  width = Math.max(width, theme.node.minWidth);
  width = Math.min(width, theme.node.maxWidth);

  let height = paddingY * 2 + fontSize;
  if (node.iconDataUri) {
    const iconSize = isIconVariant ? theme.node.icon.dominantSize : theme.node.icon.size;
    const iconMargin = isIconVariant ? theme.node.icon.dominantMarginBottom : theme.node.icon.marginBottom;
    height += iconSize + iconMargin;
  }
  if (node.description) {
    height += theme.node.descriptionFontSize + 4;
  }

  // Diamond and circle shapes need extra space
  if (node.shape === 'diamond') {
    width = Math.max(width, height) * 1.2;
    height = width;
  } else if (node.shape === 'circle') {
    const side = Math.max(width, height);
    width = side;
    height = side;
  }

  return { width: Math.round(width), height: Math.round(height) };
}

/**
 * Assign pixel positions to nodes.
 * TB: ranks go top to bottom, nodes within a rank spread horizontally.
 * LR: ranks go left to right, nodes within a rank spread vertically.
 */
export function positionNodes(
  spec: DiagramSpec,
  layers: NodeId[][],
  theme: ThemeConfig,
  padding: number,
): Map<NodeId, LayoutNode> {
  const direction = spec.direction ?? 'TB';
  const nodeMap = new Map(spec.nodes.map(n => [n.id, n]));
  const positions = new Map<NodeId, LayoutNode>();

  // Measure all nodes
  const sizes = new Map<NodeId, { width: number; height: number }>();
  for (const n of spec.nodes) {
    sizes.set(n.id, measureNode(n, theme));
  }

  if (direction === 'TB') {
    // Each rank is a horizontal row
    let y = padding;

    for (const layer of layers) {
      const layerSizes = layer.map(id => sizes.get(id)!);
      const layerHeight = Math.max(...layerSizes.map(s => s.height));
      const totalWidth = layerSizes.reduce((sum, s) => sum + s.width, 0)
        + (layer.length - 1) * theme.spacing.nodeSep;

      let x = padding;
      // We'll center the layer later once we know total width

      for (let i = 0; i < layer.length; i++) {
        const id = layer[i];
        const size = layerSizes[i];
        positions.set(id, {
          id,
          x, // temporary — will center after
          y: y + (layerHeight - size.height) / 2,
          width: size.width,
          height: size.height,
        });
        x += size.width + theme.spacing.nodeSep;
      }

      y += layerHeight + theme.spacing.rankSep;
    }

    // Center each layer horizontally
    const maxLayerWidth = Math.max(
      ...layers.map(layer => {
        const layerSizes = layer.map(id => sizes.get(id)!);
        return layerSizes.reduce((sum, s) => sum + s.width, 0) + (layer.length - 1) * theme.spacing.nodeSep;
      }),
    );

    for (const layer of layers) {
      const layerSizes = layer.map(id => sizes.get(id)!);
      const layerWidth = layerSizes.reduce((sum, s) => sum + s.width, 0)
        + (layer.length - 1) * theme.spacing.nodeSep;
      const offsetX = (maxLayerWidth - layerWidth) / 2;

      let x = padding + offsetX;
      for (let i = 0; i < layer.length; i++) {
        const pos = positions.get(layer[i])!;
        pos.x = x;
        x += layerSizes[i].width + theme.spacing.nodeSep;
      }
    }
  } else {
    // LR: each rank is a vertical column
    let x = padding;

    for (const layer of layers) {
      const layerSizes = layer.map(id => sizes.get(id)!);
      const layerWidth = Math.max(...layerSizes.map(s => s.width));
      const totalHeight = layerSizes.reduce((sum, s) => sum + s.height, 0)
        + (layer.length - 1) * theme.spacing.nodeSep;

      let y = padding;

      for (let i = 0; i < layer.length; i++) {
        const id = layer[i];
        const size = layerSizes[i];
        positions.set(id, {
          id,
          x: x + (layerWidth - size.width) / 2,
          y,
          width: size.width,
          height: size.height,
        });
        y += size.height + theme.spacing.nodeSep;
      }

      x += layerWidth + theme.spacing.rankSep;
    }

    // Center each column vertically
    const maxColHeight = Math.max(
      ...layers.map(layer => {
        const layerSizes = layer.map(id => sizes.get(id)!);
        return layerSizes.reduce((sum, s) => sum + s.height, 0) + (layer.length - 1) * theme.spacing.nodeSep;
      }),
    );

    for (const layer of layers) {
      const layerSizes = layer.map(id => sizes.get(id)!);
      const colHeight = layerSizes.reduce((sum, s) => sum + s.height, 0)
        + (layer.length - 1) * theme.spacing.nodeSep;
      const offsetY = (maxColHeight - colHeight) / 2;

      let y = padding + offsetY;
      for (let i = 0; i < layer.length; i++) {
        const pos = positions.get(layer[i])!;
        pos.y = y;
        y += layerSizes[i].height + theme.spacing.nodeSep;
      }
    }
  }

  return positions;
}
