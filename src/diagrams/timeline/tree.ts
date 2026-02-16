import type { TimelineSpec, TimelineLayoutResult, ThemeConfig, RenderOptions, SatoriElement } from '../../types.js';

export function buildTimelineTree(
  spec: TimelineSpec,
  layout: TimelineLayoutResult,
  theme: ThemeConfig,
  options: RenderOptions = {},
): SatoriElement {
  const tt = theme.timeline;
  const lineColor = tt?.lineColor ?? theme.edge.color;
  const lineWidth = tt?.lineWidth ?? 3;
  const dotSize = tt?.dotSize ?? 14;
  const dateFontSize = tt?.dateFontSize ?? 11;
  const dateColor = tt?.dateColor ?? theme.node.textColorSecondary;
  const labelFontSize = tt?.labelFontSize ?? 14;
  const descriptionFontSize = tt?.descriptionFontSize ?? 12;

  const children: SatoriElement[] = [];

  // Central line + connectors via SVG
  const svgPaths: SatoriElement[] = [
    // Main line
    {
      type: 'path',
      props: {
        d: layout.linePath,
        fill: 'none',
        stroke: lineColor,
        'stroke-width': String(lineWidth),
        'stroke-linecap': 'round',
      },
    },
  ];

  // Connector lines
  for (const evt of layout.events) {
    svgPaths.push({
      type: 'path',
      props: {
        d: evt.connectorPath,
        fill: 'none',
        stroke: lineColor,
        'stroke-width': '1.5',
        'stroke-dasharray': '4,3',
      },
    });
  }

  children.push({
    type: 'svg',
    props: {
      xmlns: 'http://www.w3.org/2000/svg',
      width: String(layout.width),
      height: String(layout.height),
      viewBox: `0 0 ${layout.width} ${layout.height}`,
      style: { position: 'absolute' as const, top: 0, left: 0 },
      children: svgPaths,
    },
  });

  // Dot markers + cards
  for (const evt of layout.events) {
    const accentColor = evt.color ?? lineColor;

    // Dot on the line
    children.push({
      type: 'div',
      props: {
        style: {
          position: 'absolute' as const,
          left: evt.dotX - dotSize / 2,
          top: evt.dotY - dotSize / 2,
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
          backgroundColor: accentColor,
          border: `2px solid ${theme.canvas.background}`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
          display: 'flex' as const,
        },
        children: '',
      },
    });

    // Card
    const cardChildren: (SatoriElement | string)[] = [];

    // Icon (if present)
    if (evt.iconDataUri) {
      cardChildren.push({
        type: 'img',
        props: {
          src: evt.iconDataUri,
          width: 20,
          height: 20,
          style: { marginBottom: 4, display: 'flex' as const },
        },
      });
    } else if (evt.icon) {
      cardChildren.push({
        type: 'div',
        props: {
          style: { fontSize: 18, marginBottom: 4, display: 'flex' as const },
          children: evt.icon,
        },
      });
    }

    // Date badge
    cardChildren.push({
      type: 'div',
      props: {
        style: {
          fontSize: dateFontSize,
          color: dateColor,
          fontWeight: 500,
          fontFamily: theme.fontFamily,
          marginBottom: 4,
          display: 'flex' as const,
        },
        children: evt.date,
      },
    });

    // Label
    cardChildren.push({
      type: 'div',
      props: {
        style: {
          fontSize: labelFontSize,
          fontWeight: 600,
          color: theme.node.textColor,
          fontFamily: theme.fontFamily,
          display: 'flex' as const,
        },
        children: evt.label,
      },
    });

    // Description
    if (evt.description) {
      cardChildren.push({
        type: 'div',
        props: {
          style: {
            fontSize: descriptionFontSize,
            color: theme.node.textColorSecondary,
            fontFamily: theme.fontFamily,
            marginTop: 2,
            display: 'flex' as const,
          },
          children: evt.description,
        },
      });
    }

    children.push({
      type: 'div',
      props: {
        style: {
          position: 'absolute' as const,
          left: evt.cardX,
          top: evt.cardY,
          width: 220,
          padding: 12,
          backgroundColor: theme.node.background,
          border: `1.5px solid ${theme.node.border}`,
          borderRadius: 10,
          borderLeft: `3px solid ${accentColor}`,
          boxShadow: theme.node.shadow,
          display: 'flex' as const,
          flexDirection: 'column' as const,
          fontFamily: theme.fontFamily,
        },
        children: cardChildren,
      },
    });
  }

  // Title
  const showTitle = options.showTitle !== false;
  if (spec.title && showTitle) {
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

  const isTransparent = options.background === 'transparent';
  const rootStyle: Record<string, unknown> = {
    position: 'relative' as const,
    display: 'flex' as const,
    width: layout.width,
    height: layout.height,
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
