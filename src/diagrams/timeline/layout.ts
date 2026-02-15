import type { TimelineSpec, TimelineLayoutResult, ThemeConfig } from '../../types.js';

export function layoutTimeline(spec: TimelineSpec, theme: ThemeConfig, padding: number): TimelineLayoutResult {
  const tt = theme.timeline;
  const lineWidth = tt?.lineWidth ?? 3;
  const dotSize = tt?.dotSize ?? 14;
  const cardWidth = tt?.cardWidth ?? 220;
  const cardGap = tt?.cardGap ?? 24;
  const connectorLength = tt?.connectorLength ?? 40;

  const direction = spec.direction ?? 'TB';
  const titleOffset = spec.title ? 40 : 0;
  const events = [...spec.events].sort((a, b) => a.date.localeCompare(b.date));

  if (direction === 'TB') {
    return layoutVertical(events, spec, theme, padding, titleOffset, {
      dotSize, cardWidth, cardGap, connectorLength,
    });
  } else {
    return layoutHorizontal(events, spec, theme, padding, titleOffset, {
      dotSize, cardWidth, cardGap, connectorLength,
    });
  }
}

interface LayoutOpts {
  dotSize: number;
  cardWidth: number;
  cardGap: number;
  connectorLength: number;
}

function layoutVertical(
  events: TimelineSpec['events'],
  spec: TimelineSpec,
  theme: ThemeConfig,
  padding: number,
  titleOffset: number,
  opts: LayoutOpts,
): TimelineLayoutResult {
  const { dotSize, cardWidth, cardGap, connectorLength } = opts;
  const cardHeight = 70; // estimated
  const stepY = cardHeight + cardGap;

  // Center line X: leave room for cards on both sides
  const centerX = padding + cardWidth + connectorLength + dotSize / 2;
  const totalWidth = centerX * 2;

  const layoutEvents = events.map((evt, i) => {
    const side = i % 2 === 0 ? 'left' as const : 'right' as const;
    const dotY = padding + titleOffset + 30 + i * stepY;
    const cardX = side === 'left'
      ? centerX - connectorLength - cardWidth
      : centerX + connectorLength;
    const cardY = dotY - 20;

    const connX1 = side === 'left' ? centerX - dotSize / 2 : centerX + dotSize / 2;
    const connX2 = side === 'left' ? cardX + cardWidth : cardX;

    return {
      ...evt,
      dotX: centerX,
      dotY,
      cardX,
      cardY,
      connectorPath: `M ${connX1} ${dotY} L ${connX2} ${dotY}`,
      side,
    };
  });

  const lastY = layoutEvents.length > 0
    ? layoutEvents[layoutEvents.length - 1].dotY
    : padding + titleOffset + 30;

  const linePath = `M ${centerX} ${padding + titleOffset + 10} L ${centerX} ${lastY + 20}`;
  const totalHeight = lastY + 60 + padding;

  return {
    events: layoutEvents,
    linePath,
    width: totalWidth,
    height: totalHeight,
  };
}

function layoutHorizontal(
  events: TimelineSpec['events'],
  spec: TimelineSpec,
  theme: ThemeConfig,
  padding: number,
  titleOffset: number,
  opts: LayoutOpts,
): TimelineLayoutResult {
  const { dotSize, cardWidth, cardGap, connectorLength } = opts;
  const cardHeight = 70;
  const stepX = cardWidth + cardGap;

  const centerY = padding + titleOffset + cardHeight + connectorLength + dotSize / 2 + 30;

  const layoutEvents = events.map((evt, i) => {
    const side = i % 2 === 0 ? 'top' as const : 'bottom' as const;
    const dotX = padding + 40 + i * stepX + cardWidth / 2;
    const cardY = side === 'top'
      ? centerY - connectorLength - cardHeight
      : centerY + connectorLength;
    const cardX = dotX - cardWidth / 2;

    const connY1 = side === 'top' ? centerY - dotSize / 2 : centerY + dotSize / 2;
    const connY2 = side === 'top' ? cardY + cardHeight : cardY;

    return {
      ...evt,
      dotX,
      dotY: centerY,
      cardX,
      cardY,
      connectorPath: `M ${dotX} ${connY1} L ${dotX} ${connY2}`,
      side,
    };
  });

  const lastX = layoutEvents.length > 0
    ? layoutEvents[layoutEvents.length - 1].dotX
    : padding + 40;

  const linePath = `M ${padding + 20} ${centerY} L ${lastX + 40} ${centerY}`;
  const totalWidth = lastX + 80 + padding;
  const totalHeight = centerY + cardHeight + connectorLength + 40 + padding;

  return {
    events: layoutEvents,
    linePath,
    width: totalWidth,
    height: totalHeight,
  };
}
