import type { QuadrantSpec, QuadrantLayoutResult, ThemeConfig, SatoriElement } from '../../types.js';

export function buildQuadrantTree(
  spec: QuadrantSpec,
  layout: QuadrantLayoutResult,
  theme: ThemeConfig,
): SatoriElement {
  const qt = theme.quadrant;
  const dotSize = qt?.dotSize ?? 12;
  const dotLabelFontSize = qt?.dotLabelFontSize ?? 11;
  const dotLabelColor = qt?.dotLabelColor ?? theme.node.textColor;
  const axisLabelColor = qt?.axisLabelColor ?? theme.node.textColorSecondary;
  const axisLabelFontSize = qt?.axisLabelFontSize ?? 13;
  const axisColor = qt?.axisColor ?? theme.edge.color;
  const quadrantOpacity = qt?.quadrantOpacity ?? 0.15;

  const children: SatoriElement[] = [];

  // Quadrant background rectangles
  for (const q of layout.quadrants) {
    // Background fill
    children.push({
      type: 'div',
      props: {
        style: {
          position: 'absolute' as const,
          left: q.x,
          top: q.y,
          width: q.width,
          height: q.height,
          display: 'flex' as const,
          backgroundColor: q.color,
          opacity: quadrantOpacity,
        },
        children: '',
      },
    });

    // Quadrant label (centered)
    if (q.label) {
      children.push({
        type: 'div',
        props: {
          style: {
            position: 'absolute' as const,
            left: q.x,
            top: q.y,
            width: q.width,
            height: q.height,
            display: 'flex' as const,
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: axisLabelFontSize,
            fontWeight: 500,
            color: axisLabelColor,
            fontFamily: theme.fontFamily,
            opacity: 0.7,
          },
          children: q.label,
        },
      });
    }
  }

  // Axis lines (cross in center)
  const gx = layout.gridOrigin.x;
  const gy = layout.gridOrigin.y;
  const gs = layout.gridSize;
  const mid = gs / 2;

  const axisSvg: SatoriElement = {
    type: 'svg',
    props: {
      xmlns: 'http://www.w3.org/2000/svg',
      width: String(layout.width),
      height: String(layout.height),
      viewBox: `0 0 ${layout.width} ${layout.height}`,
      style: { position: 'absolute' as const, top: 0, left: 0 },
      children: [
        // Grid border
        {
          type: 'rect',
          props: {
            x: String(gx),
            y: String(gy),
            width: String(gs),
            height: String(gs),
            fill: 'none',
            stroke: axisColor,
            'stroke-width': '1.5',
          },
        },
        // Vertical center line
        {
          type: 'line',
          props: {
            x1: String(gx + mid),
            y1: String(gy),
            x2: String(gx + mid),
            y2: String(gy + gs),
            stroke: axisColor,
            'stroke-width': '1',
            'stroke-dasharray': '4,4',
          },
        },
        // Horizontal center line
        {
          type: 'line',
          props: {
            x1: String(gx),
            y1: String(gy + mid),
            x2: String(gx + gs),
            y2: String(gy + mid),
            stroke: axisColor,
            'stroke-width': '1',
            'stroke-dasharray': '4,4',
          },
        },
      ],
    },
  };
  children.push(axisSvg);

  // X-axis labels
  children.push({
    type: 'div',
    props: {
      style: {
        position: 'absolute' as const,
        left: gx,
        top: gy + gs + 8,
        width: gs,
        display: 'flex' as const,
        justifyContent: 'space-between',
        fontSize: 11,
        color: axisLabelColor,
        fontFamily: theme.fontFamily,
      },
      children: [
        { type: 'div', props: { style: { display: 'flex' as const }, children: layout.xAxis.low } },
        { type: 'div', props: { style: { display: 'flex' as const, fontWeight: 600, fontSize: axisLabelFontSize }, children: layout.xAxis.label } },
        { type: 'div', props: { style: { display: 'flex' as const }, children: layout.xAxis.high } },
      ],
    },
  });

  // Y-axis labels
  children.push({
    type: 'div',
    props: {
      style: {
        position: 'absolute' as const,
        left: gx - 46,
        top: gy,
        width: 40,
        height: gs,
        display: 'flex' as const,
        flexDirection: 'column' as const,
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 11,
        color: axisLabelColor,
        fontFamily: theme.fontFamily,
      },
      children: [
        { type: 'div', props: { style: { display: 'flex' as const }, children: layout.yAxis.high } },
        { type: 'div', props: { style: { display: 'flex' as const, fontWeight: 600, fontSize: axisLabelFontSize }, children: layout.yAxis.label } },
        { type: 'div', props: { style: { display: 'flex' as const }, children: layout.yAxis.low } },
      ],
    },
  });

  // Item dots + labels
  for (const item of layout.items) {
    const color = item.color ?? theme.node.textColor;

    // Dot
    children.push({
      type: 'div',
      props: {
        style: {
          position: 'absolute' as const,
          left: item.x - dotSize / 2,
          top: item.y - dotSize / 2,
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
          backgroundColor: color,
          display: 'flex' as const,
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        },
        children: '',
      },
    });

    // Label
    children.push({
      type: 'div',
      props: {
        style: {
          position: 'absolute' as const,
          left: item.x + dotSize / 2 + 4,
          top: item.y - dotLabelFontSize / 2 - 1,
          display: 'flex' as const,
          fontSize: dotLabelFontSize,
          fontWeight: 500,
          color: dotLabelColor,
          fontFamily: theme.fontFamily,
        },
        children: item.label,
      },
    });
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
          width: layout.width,
          display: 'flex' as const,
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
        width: layout.width,
        height: layout.height,
        backgroundColor: theme.canvas.background,
        fontFamily: theme.fontFamily,
      },
      children,
    },
  };
}
