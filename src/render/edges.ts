import type { DiagramEdge, EdgeRoute, ThemeConfig, SatoriElement } from '../types.js';

/**
 * Render all edges: SVG overlay for paths/arrows + div overlays for labels.
 * Returns an array of elements to be placed in the root container.
 */
export function renderEdges(
  specEdges: DiagramEdge[],
  routes: EdgeRoute[],
  theme: ThemeConfig,
  canvasWidth: number,
  canvasHeight: number,
): SatoriElement[] {
  const edgeMap = new Map(specEdges.map(e => [`${e.from}->${e.to}`, e]));
  const elements: SatoriElement[] = [];

  // SVG layer for paths and arrowheads
  const svgChildren: SatoriElement[] = [];

  for (const route of routes) {
    const edge = edgeMap.get(`${route.from}->${route.to}`);
    const edgeColor = edge?.color ?? theme.edge.color;
    const edgeStyle = edge?.style ?? 'solid';

    let strokeDasharray: string | undefined;
    if (edgeStyle === 'dashed') strokeDasharray = '8,4';
    else if (edgeStyle === 'dotted') strokeDasharray = '3,3';

    const pathProps: Record<string, unknown> = {
      d: route.pathData,
      stroke: edgeColor,
      'stroke-width': String(theme.edge.width),
      fill: 'none',
      'stroke-linecap': 'round',
    };
    if (strokeDasharray) {
      pathProps['stroke-dasharray'] = strokeDasharray;
    }

    svgChildren.push({ type: 'path', props: pathProps });

    if (route.arrowPoints) {
      svgChildren.push({
        type: 'polygon',
        props: { points: route.arrowPoints, fill: edgeColor },
      });
    }
  }

  elements.push({
    type: 'svg',
    props: {
      xmlns: 'http://www.w3.org/2000/svg',
      width: String(canvasWidth),
      height: String(canvasHeight),
      viewBox: `0 0 ${canvasWidth} ${canvasHeight}`,
      style: { position: 'absolute' as const, top: 0, left: 0 },
      children: svgChildren,
    },
  });

  // Div-based edge labels (positioned absolutely over the SVG)
  for (const route of routes) {
    const edge = edgeMap.get(`${route.from}->${route.to}`);
    if (!edge?.label || route.labelX === undefined || route.labelY === undefined) continue;

    const labelWidth = edge.label.length * theme.edge.labelFontSize * 0.6 + 16;
    const labelHeight = theme.edge.labelFontSize + 12;

    elements.push({
      type: 'div',
      props: {
        style: {
          position: 'absolute' as const,
          left: route.labelX - labelWidth / 2,
          top: route.labelY - labelHeight / 2,
          width: labelWidth,
          height: labelHeight,
          display: 'flex' as const,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.edge.labelBackground,
          border: `0.5px solid ${theme.edge.color}`,
          borderRadius: 4,
          fontSize: theme.edge.labelFontSize,
          color: theme.edge.labelColor,
          fontFamily: theme.fontFamily,
        },
        children: edge.label,
      },
    });
  }

  return elements;
}
