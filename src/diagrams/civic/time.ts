import type { SatoriElement } from '../../types.js';
import {
  buildCivicFrame,
  clamp,
  colorAt,
  extent,
  formatValue,
  linearScale,
  svgElement,
  svgText,
  type CivicDiagramResult,
  type CivicRenderContext,
  type Point,
} from './shared.js';

export const TIME_TYPES = [
  'timeline',
  'gantt',
  'weekstrip',
  'entity-timeline',
  'calendar-heatmap',
  'sparkline',
] as const;

const DAY = 86_400_000;

interface AdaptiveTimeAxis {
  position(time: number): number;
  breaks: number[];
  compressed: boolean;
}

interface RouteBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Keep civil time ordered while preventing one documentary gap from consuming
 * the entire graphic. Ordinary ranges stay linear; extreme gap ratios use a
 * disclosed, monotonic log-gap scale with explicit break marks.
 */
function adaptiveTimeAxis(times: number[], length: number): AdaptiveTimeAxis {
  const unique = [...new Set(times.filter(Number.isFinite))].sort((a, b) => a - b);
  if (unique.length < 2) return { position: () => Math.max(0, length) / 2, breaks: [], compressed: false };
  const gaps = unique.slice(1).map((time, index) => time - unique[index]).filter(gap => gap > 0);
  const minGap = Math.max(1, Math.min(...gaps));
  const compressed = Math.max(...gaps) / minGap > 64;
  if (!compressed) {
    return {
      position: time => positionOnAxis(time, unique[0], unique[unique.length - 1], length),
      breaks: [], compressed: false,
    };
  }
  const weights = gaps.map(gap => Math.max(1, Math.log1p(gap / DAY)));
  const cumulative = [0];
  weights.forEach(weight => cumulative.push(cumulative[cumulative.length - 1] + weight));
  const total = cumulative[cumulative.length - 1] || 1;
  const position = (time: number) => {
    if (time <= unique[0]) return 0;
    if (time >= unique[unique.length - 1]) return Math.max(0, length);
    let index = 0;
    while (index < unique.length - 2 && time > unique[index + 1]) index += 1;
    const fraction = (time - unique[index]) / Math.max(1, unique[index + 1] - unique[index]);
    return clamp((cumulative[index] + weights[index] * fraction) / total * length, 0, Math.max(0, length));
  };
  const breaks = gaps
    .map((gap, index) => ({ gap, position: (cumulative[index] + weights[index] / 2) / total * length }))
    .filter(item => item.gap / minGap > 64)
    .map(item => item.position);
  return { position, breaks, compressed: true };
}

/** Strict, UTC-safe parsing for civic calendar dates. */
export function parseISODate(value: string, field = 'date'): Date {
  if (typeof value !== 'string') throw new Error(`${field} must be an ISO date`);
  const match = /^(\d{4})-(\d{2})(?:-(\d{2})(?:T(\d{2}):(\d{2}))?)?$/.exec(value);
  if (!match) throw new Error(`${field} must be YYYY-MM, YYYY-MM-DD, or YYYY-MM-DDTHH:mm`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = match[3] == null ? 1 : Number(match[3]);
  const hour = match[4] == null ? 0 : Number(match[4]);
  const minute = match[5] == null ? 0 : Number(match[5]);
  const time = Date.UTC(year, month - 1, day, hour, minute);
  const date = new Date(time);
  if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59
    || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day || date.getUTCHours() !== hour
    || date.getUTCMinutes() !== minute) {
    throw new Error(`${field} is not a valid ISO civic date`);
  }
  return date;
}

/** Position a timestamp without collapsing a single-instant axis. */
export function positionOnAxis(t: number, tMin: number, tMax: number, length: number): number {
  if (!Number.isFinite(t) || !Number.isFinite(tMin) || !Number.isFinite(tMax) || !Number.isFinite(length)) return 0;
  if (tMin === tMax) return Math.max(0, length) / 2;
  return clamp(((t - tMin) / (tMax - tMin)) * length, 0, Math.max(0, length));
}

export function buildTimeDiagram(spec: any, context: CivicRenderContext): CivicDiagramResult {
  switch (spec.type) {
    case 'timeline': return buildTimeline(spec, context);
    case 'gantt': return buildGantt(spec, context);
    case 'weekstrip': return buildWeekstrip(spec, context);
    case 'entity-timeline': return buildEntityTimeline(spec, context);
    case 'calendar-heatmap': return buildCalendarHeatmap(spec, context);
    case 'sparkline': return buildSparkline(spec, context);
    default: throw new Error(`Unsupported time diagram type: ${String(spec.type)}`);
  }
}

function buildTimeline(spec: any, context: CivicRenderContext): CivicDiagramResult {
  const width = innerWidth(context);
  const events = (Array.isArray(spec.events) ? spec.events : []).map((event: any, index: number) => ({
    ...event,
    _id: String(event.id ?? `event-${index}`),
    _time: parseISODate(event.date, `events[${index}].date`).getTime(),
    _order: index,
  })).sort((a: any, b: any) => a._time - b._time || a._order - b._order);
  if (!events.length) return framedEmpty(spec, context, 'No timeline events');

  const tt = timeTheme(context);
  const dotRadius = Math.max(3, Number(tt.dotSize ?? 14) / 2);
  const cardWidth = clamp(Number(tt.cardWidth ?? 220), 100, Math.max(100, width - 36));
  const cardHeight = Math.max(54, Number(tt.cardHeight ?? 70));
  const gap = Math.max(6, Number(tt.cardGap ?? 24));
  const connector = Math.max(12, Number(tt.connectorLength ?? 40));
  const direction = spec.direction === 'LR' ? 'LR' : 'TB';

  if (direction === 'LR') {
    const marginX = cardWidth / 2 + 4;
    const axisLength = Math.max(1, width - marginX * 2);
    const timeAxis = adaptiveTimeAxis(events.map((event: any) => event._time), axisLength);
    const placed = events.map((event: any) => {
      const dotX = marginX + timeAxis.position(event._time);
      return { ...event, dotX, cardX: clamp(dotX - cardWidth / 2, 0, width - cardWidth) };
    });
    const top: any[][] = [];
    const bottom: any[][] = [];
    for (let i = 0; i < placed.length; i += 1) {
      const buckets = i % 2 === 0 ? top : bottom;
      const event = placed[i];
      let lane = buckets.findIndex(items => !items.some(other => intervalOverlap(event.cardX, cardWidth, other.cardX, cardWidth, gap)));
      if (lane < 0) { lane = buckets.length; buckets.push([]); }
      buckets[lane].push(event);
      event._side = buckets === top ? 'top' : 'bottom';
      event._lane = lane;
    }
    const topDepth = Math.max(1, top.length) * (cardHeight + gap);
    const axisY = 18 + topDepth + connector;
    const height = axisY + connector + Math.max(1, bottom.length) * (cardHeight + gap) + 24;
    const children: SatoriElement[] = [line(marginX, axisY, width - marginX, axisY, tt.axisColor ?? tt.lineColor ?? '#6b7280', 2)];
    timeAxis.breaks.forEach(position => horizontalAxisBreak(children, marginX + position, axisY, tt.axisColor ?? '#6b7280'));
    placed.forEach((event: any) => {
      event.cardY = event._side === 'top'
        ? axisY - connector - (event._lane + 1) * (cardHeight + gap)
        : axisY + connector + event._lane * (cardHeight + gap);
      event._box = { id: event._id, x: event.cardX, y: event.cardY, width: cardWidth, height: cardHeight };
    });
    const connectorGroups = new Map<string, any[]>();
    placed.forEach((event: any) => {
      const key = `${event._time}:${event._side}`;
      if (!connectorGroups.has(key)) connectorGroups.set(key, []);
      connectorGroups.get(key)!.push(event);
    });
    [...connectorGroups.values()].forEach((group, groupIndex) => {
      group.sort((a: any, b: any) => a._lane - b._lane || a._order - b._order);
      const first = group[0];
      const preferRight = groupIndex % 2 === 1;
      const leftX = first.cardX - 8;
      const rightX = first.cardX + cardWidth + 8;
      const useRight = leftX < 2 || (rightX <= width - 2 && preferRight);
      const routeX = useRight ? rightX : leftX;
      const edgeX = useRight ? first.cardX + cardWidth : first.cardX;
      const channelOffset = 8 + (groupIndex % 4) * 3;
      const channelY = axisY + (first._side === 'top' ? -channelOffset : channelOffset);
      const targets = group.map((event: any) => event.cardY + cardHeight / 2);
      const farY = first._side === 'top' ? Math.min(...targets) : Math.max(...targets);
      children.push(path(pointsPath([
        { x: first.dotX, y: axisY }, { x: first.dotX, y: channelY }, { x: routeX, y: channelY }, { x: routeX, y: farY },
      ]), 'none', withAlpha(tt.axisColor ?? tt.lineColor ?? '#6b7280', 0.58), 1, {
        'data-role': 'timeline-trunk', 'data-time': String(first._time), 'data-side': first._side,
      }));
      group.forEach((event: any) => {
        const targetY = event.cardY + cardHeight / 2;
        children.push(path(pointsPath([{ x: routeX, y: targetY }, { x: edgeX, y: targetY }]), 'none', event.color ?? colorAt(event._order), 1.15, {
          'data-role': 'timeline-connector', 'data-id': event._id, 'data-route': 'elbow',
        }));
      });
    });
    for (const event of placed) {
      children.push(circle(event.dotX, axisY, dotRadius, event.color ?? colorAt(event._order), undefined, 0, {
        'data-role': 'timeline-event', 'data-id': event._id,
      }));
      children.push(...timelineCard(event, event.cardX, event.cardY, cardWidth, cardHeight, context));
    }
    return buildCivicFrame(spec, svgElement(width, height, children, spec.alt), height, context);
  }

  const cardW = Math.min(cardWidth, Math.max(100, (width - 70) / 2));
  const axisX = width / 2;
  const axisLength = Math.max(240, Math.ceil(events.length / 2) * (cardHeight + gap));
  const timeAxis = adaptiveTimeAxis(events.map((event: any) => event._time), axisLength);
  const axisTop = cardHeight / 2 + 12;
  const preferred = events.map((event: any, index: number) => ({
    ...event,
    dotY: axisTop + timeAxis.position(event._time),
    _side: index % 2 === 0 ? 'left' : 'right',
  }));
  const sides = ['left', 'right'] as const;
  let maxBottom = axisTop + axisLength;
  for (const side of sides) {
    let bottom = 0;
    for (const event of preferred.filter((item: any) => item._side === side)) {
      event.cardY = Math.max(event.dotY - cardHeight / 2, bottom);
      bottom = event.cardY + cardHeight + gap;
      maxBottom = Math.max(maxBottom, event.cardY + cardHeight);
    }
  }
  const height = maxBottom + 16;
  const children: SatoriElement[] = [line(axisX, axisTop, axisX, axisTop + axisLength, tt.axisColor ?? tt.lineColor ?? '#6b7280', 2)];
  timeAxis.breaks.forEach(position => verticalAxisBreak(children, axisX, axisTop + position, tt.axisColor ?? '#6b7280'));
  for (const event of preferred) {
    const left = event._side === 'left';
    const cardX = left ? Math.max(0, axisX - connector - cardW) : Math.min(width - cardW, axisX + connector);
    const edgeX = left ? cardX + cardW : cardX;
    const channelX = axisX + (left ? -Math.max(6, connector / 2) : Math.max(6, connector / 2));
    children.push(path(`M ${round(axisX)} ${round(event.dotY)} L ${round(channelX)} ${round(event.dotY)} L ${round(channelX)} ${round(event.cardY + cardHeight / 2)} L ${round(edgeX)} ${round(event.cardY + cardHeight / 2)}`, 'none', event.color ?? tt.axisColor ?? '#6b7280', 1, {
      'data-role': 'timeline-connector', 'data-id': event._id, 'data-route': 'elbow',
    }));
  }
  for (const event of preferred) {
    const left = event._side === 'left';
    const cardX = left ? Math.max(0, axisX - connector - cardW) : Math.min(width - cardW, axisX + connector);
    children.push(circle(axisX, event.dotY, dotRadius, event.color ?? colorAt(event._order), undefined, 0, {
      'data-role': 'timeline-event', 'data-id': event._id,
    }));
    children.push(...timelineCard(event, cardX, event.cardY, cardW, cardHeight, context));
  }
  return buildCivicFrame(spec, svgElement(width, height, children, spec.alt), height, context);
}

function timelineCard(event: any, x: number, y: number, width: number, height: number, context: CivicRenderContext): SatoriElement[] {
  const theme = context.theme;
  const text = theme.node.textColor;
  const secondary = theme.node.textColorSecondary;
  const date = formatDate(new Date(event._time), false);
  const labelMax = Math.max(10, Math.floor((width - 20) / 7));
  return [
    rect(x, y, width, height, theme.node.background, theme.node.border, 1, Math.min(8, theme.node.borderRadius), {
      'data-role': 'timeline-card', 'data-id': event._id,
    }),
    svgText(x + 9, y + 16, date, { fill: event.color ?? colorAt(event._order), fontSize: 10, fontWeight: 600 }),
    svgText(x + 9, y + 33, truncate(String(event.label ?? ''), labelMax), { fill: text, fontSize: 12, fontWeight: 600 }),
    ...(event.body ? [svgText(x + width - 9, y + 16, truncate(String(event.body), 18), { fill: secondary, fontSize: 9, textAnchor: 'end' })] : []),
    ...(event.description ? [svgText(x + 9, y + Math.min(height - 9, 51), truncate(String(event.description), labelMax + 4), { fill: secondary, fontSize: 9 })] : []),
  ];
}

function buildGantt(spec: any, context: CivicRenderContext): CivicDiagramResult {
  const width = innerWidth(context);
  const tasks = (Array.isArray(spec.tasks) ? spec.tasks : []).map((task: any, index: number) => {
    const start = parseISODate(task.start, `tasks[${index}].start`).getTime();
    const end = task.end == null ? start : parseISODate(task.end, `tasks[${index}].end`).getTime();
    return { ...task, _start: start, _end: end, _index: index, _kind: task.kind ?? 'range' };
  });
  if (!tasks.length) return framedEmpty(spec, context, 'No Gantt tasks');
  let min = Math.min(...tasks.map((task: any) => task._start));
  let max = Math.max(...tasks.map((task: any) => Math.max(task._start, task._end)));
  if (spec.now) {
    const now = parseISODate(spec.now, 'now').getTime();
    min = Math.min(min, now); max = Math.max(max, now);
  }
  const originalSpan = max - min;
  if (min === max) { min -= 15 * DAY; max += 15 * DAY; }
  const openTasks = tasks.filter((task: any) => task.open);
  if (openTasks.length) max += Math.max(30 * DAY, (max - min || 90 * DAY) * 0.22);

  const gt = ganttTheme(context);
  const labelWidth = clamp(Math.round(width * 0.26), 130, 220);
  const chartLeft = labelWidth + 10;
  const chartWidth = Math.max(120, width - chartLeft - 4);
  const headerHeight = Math.max(48, Number(gt.headerHeight ?? 48));
  const barHeight = Math.max(10, Number(gt.barHeight ?? 20));
  const rowHeight = barHeight + Math.max(18, Number(gt.barGap ?? 14));
  const plotHeight = headerHeight + tasks.length * rowHeight + 18;
  const xScale = linearScale([min, max], [chartLeft, chartLeft + chartWidth]);
  const children: SatoriElement[] = [];

  children.push(line(chartLeft, headerHeight - 8, chartLeft + chartWidth, headerHeight - 8, gt.gridLineColor ?? '#d1d5db', 1));
  const ticks = dateTicks(min, max, spec.scale, chartWidth);
  let previousLabelRight = -Infinity;
  for (const tick of ticks) {
    const x = xScale(tick);
    children.push(line(x, headerHeight - 8, x, plotHeight - 10, gt.gridLineColor ?? '#e5e7eb', 1));
    const label = ganttTickLabel(new Date(tick), max - min);
    const labelW = label.length * 6;
    if (x - labelW / 2 > previousLabelRight + 5 && x + labelW / 2 <= width) {
      children.push(svgText(x, headerHeight - 13, label, { fill: gt.dateHeaderColor ?? context.theme.node.textColorSecondary, fontSize: gt.dateHeaderFontSize ?? 10, textAnchor: 'middle' }));
      previousLabelRight = x + labelW / 2;
    }
  }
  for (const boundary of fiscalBoundaries(min, max, Number(spec.fyStartMonth ?? 1))) {
    const x = xScale(boundary.time);
    children.push(line(x, 14, x, plotHeight - 10, timeTheme(context).fyTickColor ?? '#8b5cf6', 1, '4 3'));
    children.push(svgText(clamp(x + 3, chartLeft + 2, width - 45), 11, boundary.label, { fill: timeTheme(context).fyTickColor ?? '#8b5cf6', fontSize: 9, fontWeight: 600 }));
  }

  const positions = new Map<string, { x: number; y: number }>();
  tasks.forEach((task: any, index: number) => {
    const y = headerHeight + index * rowHeight;
    const cy = y + barHeight / 2;
    const color = task.color ?? colorAt(index);
    const groupPrefix = task.group ? `${truncate(String(task.group), 12)} · ` : '';
    children.push(svgText(2, cy + 4, truncate(`${groupPrefix}${String(task.label ?? '')}`, Math.max(12, Math.floor(labelWidth / 6.3))), {
      fill: gt.barLabelColor ?? context.theme.node.textColor, fontSize: gt.barLabelFontSize ?? 10,
    }));
    if (index % 2 === 1) children.unshift(rect(0, y - 5, width, rowHeight, 'rgba(127,127,127,0.035)'));
    const startX = xScale(task._start);
    if (task._kind === 'milestone') {
      children.push(path(`M ${startX} ${cy - 7} L ${startX + 7} ${cy} L ${startX} ${cy + 7} L ${startX - 7} ${cy} Z`, color, color, 1));
      positions.set(String(task.id), { x: startX, y: cy });
    } else if (task.open) {
      const fadeStart = startX + Math.max(10, (chartLeft + chartWidth - startX) * 0.42);
      children.push(rect(startX, cy - barHeight / 2, Math.max(4, fadeStart - startX), barHeight, color, undefined, undefined, Number(gt.barRadius ?? 3)));
      const tail = Math.max(1, chartLeft + chartWidth - fadeStart);
      children.push(rect(fadeStart, cy - barHeight / 2, tail * 0.42, barHeight, withAlpha(color, 0.62)));
      children.push(rect(fadeStart + tail * 0.42, cy - barHeight / 2, tail * 0.34, barHeight, withAlpha(color, 0.34)));
      children.push(rect(fadeStart + tail * 0.76, cy - barHeight / 2, tail * 0.24, barHeight, withAlpha(color, 0.12)));
      positions.set(String(task.id), { x: fadeStart, y: cy });
    } else {
      const endX = xScale(task._end);
      const barWidth = Math.max(4, endX - startX);
      children.push(rect(startX, cy - barHeight / 2, barWidth, barHeight, withAlpha(color, 0.25), color, 1, Number(gt.barRadius ?? 3)));
      const progress = clamp(Number(task.progress ?? 0), 0, 100);
      if (progress > 0) children.push(rect(startX, cy - barHeight / 2, barWidth * progress / 100, barHeight, color, undefined, undefined, Number(gt.barRadius ?? 3)));
      positions.set(String(task.id), { x: endX, y: cy });
    }
  });

  // Dependencies are drawn last but route through row gutters, so arrows do not cover labels.
  tasks.forEach((task: any, index: number) => {
    const target = positions.get(String(task.id));
    if (!target) return;
    (Array.isArray(task.dependencies) ? task.dependencies : []).forEach((dependency: unknown, dependencyIndex: number) => {
      const source = positions.get(String(dependency));
      if (!source) return;
      const bend = clamp(Math.max(source.x + 8, target.x - 12 - dependencyIndex * 4), chartLeft, chartLeft + chartWidth);
      const targetX = xScale(task._start);
      children.push(path(`M ${source.x} ${source.y} H ${bend} V ${target.y} H ${targetX - 5}`, 'none', gt.dependencyArrowColor ?? '#6b7280', 1));
      children.push(path(`M ${targetX - 5} ${target.y - 3} L ${targetX} ${target.y} L ${targetX - 5} ${target.y + 3} Z`, gt.dependencyArrowColor ?? '#6b7280'));
    });
  });
  if (spec.now) {
    const nowX = xScale(parseISODate(spec.now, 'now').getTime());
    children.push(line(nowX, 10, nowX, plotHeight - 10, timeTheme(context).nowColor ?? '#dc2626', 2, '3 3'));
  }
  return buildCivicFrame(spec, svgElement(width, plotHeight, children, spec.alt), plotHeight, context);
}

function buildWeekstrip(spec: any, context: CivicRenderContext): CivicDiagramResult {
  const width = innerWidth(context);
  const from = parseISODate(spec.from, 'from').getTime();
  const to = parseISODate(spec.to, 'to').getTime();
  const marks = (Array.isArray(spec.marks) ? spec.marks : []).map((mark: any, index: number) => ({
    ...mark, _time: parseISODate(mark.date, `marks[${index}].date`).getTime(), _index: index,
    _count: Math.max(1, Number(mark.count ?? 1)),
  })).sort((a: any, b: any) => a._time - b._time || a._index - b._index);
  if (!marks.length) return framedEmpty(spec, context, 'No marks');
  const margin = 18;
  const axisWidth = Math.max(1, width - margin * 2);
  const packed: any[] = [];
  let maxLane = 0;
  const laneStep = 42;
  for (const mark of marks) {
    mark.x = margin + positionOnAxis(mark._time, from, to, axisWidth);
    mark.r = clamp(3 + Math.sqrt(mark._count) * 2.1, 4, 19);
    let lane = 0;
    while (packed.some(other => Math.hypot(other.x - mark.x, (other.lane - lane) * laneStep) < other.r + mark.r + 3)) lane += 1;
    mark.lane = lane;
    packed.push(mark);
    maxLane = Math.max(maxLane, lane);
  }
  const labelMarks = marks.filter((mark: any) => mark.label);
  const labelLanes: Array<Array<{ x: number; width: number }>> = [];
  for (const mark of labelMarks) {
    const labelWidth = clamp(String(mark.label).length * 5.5 + 8, 45, 160);
    const x = clamp(mark.x - labelWidth / 2, 0, width - labelWidth);
    let lane = labelLanes.findIndex(row => !row.some(item => intervalOverlap(x, labelWidth, item.x, item.width, 4)));
    if (lane < 0) { lane = labelLanes.length; labelLanes.push([]); }
    labelLanes[lane].push({ x, width: labelWidth });
    mark.labelX = x; mark.labelWidth = labelWidth; mark.labelLane = lane;
  }
  const labelBand = labelLanes.length * 18;
  const axisY = 28 + labelBand + (maxLane + 1) * laneStep;
  const height = axisY + 35;
  const tt = timeTheme(context);
  const children: SatoriElement[] = [line(margin, axisY, width - margin, axisY, tt.axisColor ?? '#6b7280', 2)];
  monthTicks(from, to, Math.max(2, Math.floor(axisWidth / 72))).forEach(time => {
    const x = margin + positionOnAxis(time, from, to, axisWidth);
    children.push(line(x, axisY - 5, x, axisY + 6, tt.axisColor ?? '#6b7280', 1));
    children.push(svgText(clamp(x, 22, width - 22), axisY + 21, formatMonth(new Date(time)), { fill: context.theme.node.textColorSecondary, fontSize: 9, textAnchor: 'middle' }));
  });
  for (const mark of marks) {
    const y = axisY - 8 - mark.lane * laneStep - mark.r;
    const color = spec.colorBy === 'tag' && mark.tag ? colorForTag(mark.tag) : colorAt(mark._index);
    children.push(line(mark.x, y + mark.r, mark.x, axisY, withAlpha(color, 0.55), 1));
    children.push(circle(mark.x, y, mark.r, color));
    if (mark._count > 1) children.push(svgText(mark.x, y + 3, String(mark._count), { fill: '#ffffff', fontSize: clamp(mark.r * 0.75, 8, 11), fontWeight: 700, textAnchor: 'middle' }));
    if (mark.label) {
      const labelY = 12 + mark.labelLane * 18;
      children.push(line(mark.x, y - mark.r, mark.labelX + mark.labelWidth / 2, labelY + 3, withAlpha(color, 0.5), 1));
      children.push(svgText(mark.labelX + 3, labelY, truncate(String(mark.label), Math.floor((mark.labelWidth - 6) / 5.5)), { fill: context.theme.node.textColor, fontSize: 9 }));
    }
  }
  const autoLegend: Array<{ label: string; color: string }> = uniqueBy(
    marks.filter((mark: any) => mark.tag).map((mark: any) => ({ label: String(mark.tag), color: colorForTag(mark.tag) })),
    (item: { label: string; color: string }) => item.label,
  );
  return buildCivicFrame(spec, svgElement(width, height, children, spec.alt), height, context, autoLegend);
}

function buildEntityTimeline(spec: any, context: CivicRenderContext): CivicDiagramResult {
  const width = innerWidth(context);
  const labelWidth = clamp(Math.round(width * 0.2), 95, 170);
  const axisLeft = labelWidth + 8;
  const axisRight = width - 10;
  const axisWidth = Math.max(1, axisRight - axisLeft);
  const lanes = Array.isArray(spec.lanes) ? spec.lanes : [];
  const events = (Array.isArray(spec.events) ? spec.events : []).map((event: any, index: number) => ({
    ...event, _time: parseISODate(event.date, `events[${index}].date`).getTime(), _index: index,
  })).sort((a: any, b: any) => a._time - b._time || a._index - b._index);
  if (!events.length || !lanes.length) return framedEmpty(spec, context, 'No entity events');
  let min = Math.min(...events.map((event: any) => event._time));
  let max = Math.max(...events.map((event: any) => event._time));
  const axisTimes = events.map((event: any) => event._time);
  if (spec.now) { const now = parseISODate(spec.now, 'now').getTime(); min = Math.min(min, now); max = Math.max(max, now); axisTimes.push(now); }
  const timeAxis = adaptiveTimeAxis(axisTimes, axisWidth);
  const cardWidth = clamp(Math.floor(axisWidth / Math.min(4, Math.max(2, events.length))), 90, 150);
  const cardHeight = 34;
  const laneLayouts: any[] = [];
  let cursorY = 34;
  for (const lane of lanes) {
    const laneEvents = events.filter((event: any) => event.lane === lane.id).map((event: any) => {
      const x = axisLeft + timeAxis.position(event._time);
      return { ...event, x, cardX: clamp(x - cardWidth / 2, axisLeft, axisRight - cardWidth) };
    });
    const rows: any[][] = [];
    for (const event of laneEvents) {
      let row = rows.findIndex(items => !items.some(other => intervalOverlap(event.cardX, cardWidth, other.cardX, cardWidth, 5)));
      if (row < 0) { row = rows.length; rows.push([]); }
      rows[row].push(event); event._row = row;
    }
    const height = 26 + Math.max(1, rows.length) * (cardHeight + 5);
    laneLayouts.push({ ...lane, events: laneEvents, y: cursorY, height });
    cursorY += height + 8;
  }
  const height = cursorY + 14;
  const children: SatoriElement[] = [];
  children.push(line(axisLeft, 22, axisRight, 22, timeTheme(context).axisColor ?? '#6b7280', 2));
  timeAxis.breaks.forEach(position => horizontalAxisBreak(children, axisLeft + position, 22, timeTheme(context).axisColor ?? '#6b7280'));
  const tickCandidates = monthTicks(min, max, Math.max(2, Math.floor(axisWidth / 72))).map(time => {
    const text = formatTimeTick(new Date(time), max - min);
    return { time, text, x: axisLeft + timeAxis.position(time), width: text.length * 5.3 };
  });
  const ticks: typeof tickCandidates = [];
  tickCandidates.forEach((tick, index) => {
    const previous = ticks[ticks.length - 1];
    const enoughRoom = !previous || tick.x - previous.x >= (previous.width + tick.width) / 2 + 7;
    if (enoughRoom) ticks.push(tick);
    else if (index === tickCandidates.length - 1) {
      const beforePrevious = ticks[ticks.length - 2];
      if (!beforePrevious || tick.x - beforePrevious.x >= (beforePrevious.width + tick.width) / 2 + 7) ticks[ticks.length - 1] = tick;
    }
  });
  ticks.forEach(({ text, x }) => {
    children.push(line(x, 18, x, height - 10, context.theme.group.border, 1));
    children.push(svgText(x, 13, text, {
      fill: context.theme.node.textColorSecondary, fontSize: 9, textAnchor: 'middle', 'data-role': 'time-tick',
    }));
  });
  laneLayouts.forEach((lane, laneIndex) => {
    const baseline = lane.y + 12;
    children.push(rect(0, lane.y - 7, width, lane.height, laneIndex % 2 ? 'rgba(127,127,127,0.035)' : 'transparent'));
    children.push(svgText(2, baseline + 4, truncate(String(lane.label ?? lane.id), Math.floor(labelWidth / 6)), { fill: lane.color ?? context.theme.node.textColor, fontSize: 10, fontWeight: 600 }));
    children.push(line(axisLeft, baseline, axisRight, baseline, context.theme.group.border, 1));
    lane.events.forEach((event: any) => {
      event.cardY = baseline + 10 + event._row * (cardHeight + 5);
      event._box = { id: String(event.id ?? event._index), x: event.cardX, y: event.cardY, width: cardWidth, height: cardHeight };
    });
    const eventBoxes: RouteBox[] = lane.events.map((event: any) => event._box);
    for (const event of lane.events) {
      const color = event.color ?? lane.color ?? colorAt(laneIndex);
      const targetY = event.cardY + cardHeight / 2;
      const routed = routeAroundBoxes(
        { x: event.x, y: baseline + 7 }, event._box, eventBoxes,
        { x: axisLeft, y: baseline + 6, width: axisWidth, height: lane.height - 12 }, event._row % 2 === 1,
      );
      const routePoints = [{ x: event.x, y: baseline + 5 }, { x: event.x, y: baseline + 7 }, ...routed.slice(1)];
      children.push(path(pointsPath(routePoints), 'none', color, 1, {
        'data-role': 'entity-connector', 'data-id': String(event.id ?? event._index), 'data-route': 'elbow',
      }));
    }
    for (const event of lane.events) {
      const color = event.color ?? lane.color ?? colorAt(laneIndex);
      children.push(circle(event.x, baseline, 5, color, undefined, 0, {
        'data-role': 'entity-event', 'data-id': String(event.id ?? event._index),
      }));
      children.push(rect(event.cardX, event.cardY, cardWidth, cardHeight, context.theme.node.background, context.theme.node.border, 1, 4, {
        'data-role': 'entity-card', 'data-id': String(event.id ?? event._index),
      }));
      children.push(svgText(event.cardX + 5, event.cardY + 13, truncate(String(event.label ?? ''), Math.floor((cardWidth - 10) / 6)), { fill: context.theme.node.textColor, fontSize: 9, fontWeight: 600 }));
      const detail = event.amount != null ? formatValue(Number(event.amount), spec.unit) : formatDate(new Date(event._time), false);
      children.push(svgText(event.cardX + 5, event.cardY + 27, truncate(detail, Math.floor((cardWidth - 10) / 6)), { fill: context.theme.node.textColorSecondary, fontSize: 8 }));
    }
  });
  if (spec.now) {
    const x = axisLeft + timeAxis.position(parseISODate(spec.now, 'now').getTime());
    children.push(line(x, 18, x, height - 10, timeTheme(context).nowColor ?? '#dc2626', 2, '3 3'));
  }
  const autoLegend = lanes.map((lane: any, index: number) => ({ label: String(lane.label ?? lane.id), color: lane.color ?? colorAt(index) }));
  return buildCivicFrame(spec, svgElement(width, height, children, spec.alt), height, context, autoLegend);
}

function buildCalendarHeatmap(spec: any, context: CivicRenderContext): CivicDiagramResult {
  const width = innerWidth(context);
  const fromDate = parseISODate(spec.from, 'from');
  const toDate = parseISODate(spec.to, 'to');
  const from = fromDate.getTime();
  const to = toDate.getTime();
  const cells = new Map<string, any>();
  (Array.isArray(spec.cells) ? spec.cells : []).forEach((cell: any, index: number) => {
    const date = parseISODate(cell.date, `cells[${index}].date`);
    cells.set(isoDay(date), { ...cell, _time: date.getTime() });
  });
  const weekStart = spec.weekStart === 'mon' ? 1 : 0;
  const firstDow = (fromDate.getUTCDay() - weekStart + 7) % 7;
  const dayCount = Math.max(1, Math.floor((to - from) / DAY) + 1);
  const weeks = Math.ceil((firstDow + dayCount) / 7);
  const gap = 3;
  const header = 24;
  const cellWidth = Math.max(6, (width - gap * 6) / 7);
  const cellHeight = clamp(cellWidth * 0.58, 25, 48);
  const height = header + weeks * (cellHeight + gap) + 4;
  const values = [...cells.values()].map(cell => Number(cell.value)).filter(Number.isFinite);
  const maxValue = Math.max(1, ...values);
  const ramp = timeTheme(context).heatmapRamp ?? ['#eef3ef', '#bfd1c4', '#7aa286', '#3d5a45'];
  const names = weekStart ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const children: SatoriElement[] = names.map((name, index) => svgText(index * (cellWidth + gap) + cellWidth / 2, 12, name, {
    fill: context.theme.node.textColorSecondary, fontSize: 9, textAnchor: 'middle',
  }));
  for (let offset = 0; offset < dayCount; offset += 1) {
    const time = from + offset * DAY;
    const date = new Date(time);
    const gridIndex = firstDow + offset;
    const col = gridIndex % 7;
    const row = Math.floor(gridIndex / 7);
    const x = col * (cellWidth + gap);
    const y = header + row * (cellHeight + gap);
    const cell = cells.get(isoDay(date));
    const value = Math.max(0, Number(cell?.value ?? 0));
    const colorIndex = value <= 0 ? 0 : Math.max(1, Math.round((value / maxValue) * (ramp.length - 1)));
    const fill = ramp[clamp(colorIndex, 0, ramp.length - 1)] ?? ramp[0] ?? '#e5e7eb';
    children.push(rect(x, y, cellWidth, cellHeight, fill, context.theme.group.border, 1, 3));
    children.push(svgText(x + 4, y + 12, String(date.getUTCDate()), { fill: contrastText(fill), fontSize: 9, fontWeight: 600 }));
    if (date.getUTCDate() === 1 || offset === 0) children.push(svgText(x + cellWidth - 4, y + 12, formatMonth(date), { fill: contrastText(fill), fontSize: 7, textAnchor: 'end' }));
    if (value > 0) children.push(svgText(x + cellWidth / 2, y + Math.min(cellHeight - 5, 30), String(value), { fill: contrastText(fill), fontSize: 13, fontWeight: 700, textAnchor: 'middle' }));
    if (cell?.label && cellHeight >= 40) children.push(svgText(x + 4, y + cellHeight - 5, truncate(String(cell.label), Math.max(3, Math.floor((cellWidth - 8) / 5))), { fill: contrastText(fill), fontSize: 7 }));
  }
  const autoLegend = [{ label: '0', color: ramp[0] }, { label: String(maxValue), color: ramp[ramp.length - 1] }];
  return buildCivicFrame(spec, svgElement(width, height, children, spec.alt), height, context, autoLegend);
}

function buildSparkline(spec: any, context: CivicRenderContext): CivicDiagramResult {
  const width = innerWidth(context);
  const values: number[] = (Array.isArray(spec.values) ? spec.values : []).map((value: unknown) => Number(value));
  if (values.length < 2) return framedEmpty(spec, context, 'Not enough values');
  const showEnd = Boolean(spec.showEndValue);
  const endLabel = showEnd ? formatValue(values[values.length - 1], spec.unit) : '';
  const labelWidth = showEnd ? clamp(endLabel.length * 7 + 8, 34, Math.min(82, width * 0.35)) : 0;
  const chartWidth = Math.max(20, width - labelWidth - 3);
  const height = 32;
  const yScale = linearScale(extent(values), [height - 4, 4]);
  let points: Array<{ value: number; index: number; time: number }> = values.map((value: number, index: number) => ({ value, index, time: index }));
  if (Array.isArray(spec.dates) && spec.dates.length === values.length) {
    points = values.map((value: number, index: number) => ({ value, index, time: parseISODate(spec.dates[index], `dates[${index}]`).getTime() }))
      .sort((a: { time: number; index: number }, b: { time: number; index: number }) => a.time - b.time || a.index - b.index);
  }
  const tMin = points[0].time;
  const tMax = points[points.length - 1].time;
  const coordinates: Array<{ x: number; y: number }> = points.map((point: { value: number; index: number; time: number }, index: number) => ({
    x: 4 + (Array.isArray(spec.dates) ? positionOnAxis(point.time, tMin, tMax, chartWidth - 8) : index / (points.length - 1) * (chartWidth - 8)),
    y: yScale(point.value),
  }));
  const stroke = spec.stroke ?? colorAt(0);
  const linePath = coordinates.map((point: { x: number; y: number }, index: number) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const children: SatoriElement[] = [];
  if (spec.fill) children.push(path(`${linePath} L ${coordinates[coordinates.length - 1].x} ${height - 3} L ${coordinates[0].x} ${height - 3} Z`, withAlpha(stroke, 0.16), 'none'));
  children.push(path(linePath, 'none', stroke, 2));
  const minValue = Math.min(...values); const maxValue = Math.max(...values);
  const extremaCoordinates = new Set<string>();
  coordinates.forEach((point: { x: number; y: number }, index: number) => {
    const key = `${point.x.toFixed(3)}:${point.y.toFixed(3)}`;
    if ((points[index].value === minValue || points[index].value === maxValue) && !extremaCoordinates.has(key)) {
      extremaCoordinates.add(key);
      children.push(circle(point.x, point.y, 2.5, stroke, context.theme.canvas.background, 1));
    }
  });
  if (showEnd) children.push(svgText(chartWidth + 4, height / 2 + 4, truncate(endLabel, 12), { fill: context.theme.node.textColor, fontSize: 11, fontWeight: 600 }));
  return buildCivicFrame(spec, svgElement(width, height, children, spec.alt), height, context);
}

function framedEmpty(spec: any, context: CivicRenderContext, label: string): CivicDiagramResult {
  const width = innerWidth(context);
  const height = 42;
  return buildCivicFrame(spec, svgElement(width, height, [svgText(width / 2, 24, label, { fill: context.theme.node.textColorSecondary, fontSize: 11, textAnchor: 'middle' })], spec.alt), height, context);
}

function innerWidth(context: CivicRenderContext): number {
  return Math.max(80, context.width - context.padding * 2);
}

function timeTheme(context: CivicRenderContext): any {
  return (context.theme as any).time ?? (context.theme as any).timeline ?? {};
}

function ganttTheme(context: CivicRenderContext): any {
  return (context.theme as any).gantt ?? {};
}

function line(x1: number, y1: number, x2: number, y2: number, stroke: string, strokeWidth = 1, dash?: string, extras: Record<string, unknown> = {}): SatoriElement {
  return { type: 'line', props: { x1: String(x1), y1: String(y1), x2: String(x2), y2: String(y2), stroke, strokeWidth: String(strokeWidth), ...(dash ? { strokeDasharray: dash } : {}), ...extras } };
}

function rect(x: number, y: number, width: number, height: number, fill: string, stroke?: string, strokeWidth = 0, rx = 0, extras: Record<string, unknown> = {}): SatoriElement {
  return { type: 'rect', props: { x: String(x), y: String(y), width: String(Math.max(0, width)), height: String(Math.max(0, height)), fill, ...(stroke ? { stroke, strokeWidth: String(strokeWidth) } : {}), ...(rx ? { rx: String(rx) } : {}), ...extras } };
}

function circle(cx: number, cy: number, r: number, fill: string, stroke?: string, strokeWidth = 0, extras: Record<string, unknown> = {}): SatoriElement {
  return { type: 'circle', props: { cx: String(cx), cy: String(cy), r: String(Math.max(0, r)), fill, ...(stroke ? { stroke, strokeWidth: String(strokeWidth) } : {}), ...extras } };
}

function path(d: string, fill = 'none', stroke?: string, strokeWidth = 0, extras: Record<string, unknown> = {}): SatoriElement {
  return { type: 'path', props: { d, fill, ...(stroke ? { stroke, strokeWidth: String(strokeWidth), strokeLinecap: 'round', strokeLinejoin: 'round' } : {}), ...extras } };
}

function intervalOverlap(a: number, aw: number, b: number, bw: number, gap = 0): boolean {
  return a < b + bw + gap && a + aw + gap > b;
}

function routeAroundBoxes(
  start: Point,
  target: RouteBox,
  boxes: RouteBox[],
  bounds: { x: number; y: number; width: number; height: number },
  preferRight: boolean,
): Point[] {
  const targetY = target.y + target.height / 2;
  const goals = preferRight
    ? [{ x: target.x + target.width, y: targetY }, { x: target.x, y: targetY }]
    : [{ x: target.x, y: targetY }, { x: target.x + target.width, y: targetY }];
  const obstacles = boxes.filter(box => box.id !== target.id);
  const candidates = goals.map((goal, index) => {
    const points = orthogonalPath(start, goal, obstacles, bounds);
    const distance = points.slice(1).reduce((sum, point, pointIndex) => sum
      + Math.abs(point.x - points[pointIndex].x) + Math.abs(point.y - points[pointIndex].y), index * 8);
    return { points, distance };
  }).filter(candidate => candidate.points.length > 1);
  candidates.sort((a, b) => a.distance - b.distance || a.points.length - b.points.length);
  return candidates[0]?.points ?? [start, goals[0]];
}

function orthogonalPath(
  start: Point,
  goal: Point,
  obstacles: RouteBox[],
  bounds: { x: number; y: number; width: number; height: number },
): Point[] {
  const clearance = 0;
  const gutter = 5;
  const minX = bounds.x;
  const maxX = bounds.x + bounds.width;
  const minY = bounds.y;
  const maxY = bounds.y + bounds.height;
  const xs = [...new Set([
    minX, maxX, clamp(start.x, minX, maxX), clamp(goal.x, minX, maxX),
    ...obstacles.flatMap(box => [clamp(box.x - gutter, minX, maxX), clamp(box.x + box.width + gutter, minX, maxX)]),
  ])].sort((a, b) => a - b);
  const ys = [...new Set([
    minY, maxY, clamp(start.y, minY, maxY), clamp(goal.y, minY, maxY),
    ...obstacles.flatMap(box => [clamp(box.y - gutter, minY, maxY), clamp(box.y + box.height + gutter, minY, maxY)]),
  ])].sort((a, b) => a - b);
  const pointAt = (xi: number, yi: number): Point => ({ x: xs[xi], y: ys[yi] });
  const pointClear = (point: Point) => !obstacles.some(box => point.x > box.x - clearance && point.x < box.x + box.width + clearance
    && point.y > box.y - clearance && point.y < box.y + box.height + clearance);
  const segmentClear = (a: Point, b: Point) => !obstacles.some(box => {
    const left = box.x - clearance; const right = box.x + box.width + clearance;
    const top = box.y - clearance; const bottom = box.y + box.height + clearance;
    if (Math.abs(a.x - b.x) < 0.01) return a.x > left && a.x < right && Math.min(a.y, b.y) < bottom && Math.max(a.y, b.y) > top;
    return a.y > top && a.y < bottom && Math.min(a.x, b.x) < right && Math.max(a.x, b.x) > left;
  });
  const startXi = xs.indexOf(clamp(start.x, minX, maxX));
  const startYi = ys.indexOf(clamp(start.y, minY, maxY));
  const goalXi = xs.indexOf(clamp(goal.x, minX, maxX));
  const goalYi = ys.indexOf(clamp(goal.y, minY, maxY));
  type State = { xi: number; yi: number; direction: 'h' | 'v' | 'n'; cost: number; estimate: number; key: string };
  const startKey = `${startXi}:${startYi}:n`;
  const open: State[] = [{ xi: startXi, yi: startYi, direction: 'n', cost: 0, estimate: 0, key: startKey }];
  const best = new Map<string, number>([[startKey, 0]]);
  const previous = new Map<string, string>();
  const states = new Map<string, State>([[startKey, open[0]]]);
  let finalKey: string | undefined;
  while (open.length) {
    open.sort((a, b) => a.estimate - b.estimate || a.cost - b.cost || a.key.localeCompare(b.key));
    const current = open.shift()!;
    if (current.xi === goalXi && current.yi === goalYi) { finalKey = current.key; break; }
    const neighbors = [
      [current.xi - 1, current.yi, 'h'], [current.xi + 1, current.yi, 'h'],
      [current.xi, current.yi - 1, 'v'], [current.xi, current.yi + 1, 'v'],
    ] as const;
    for (const [xi, yi, direction] of neighbors) {
      if (xi < 0 || yi < 0 || xi >= xs.length || yi >= ys.length) continue;
      const from = pointAt(current.xi, current.yi); const to = pointAt(xi, yi);
      if ((!pointClear(to) && !(xi === goalXi && yi === goalYi)) || !segmentClear(from, to)) continue;
      const bend = current.direction !== 'n' && current.direction !== direction ? 12 : 0;
      const cost = current.cost + Math.abs(to.x - from.x) + Math.abs(to.y - from.y) + bend;
      const key = `${xi}:${yi}:${direction}`;
      if (cost >= (best.get(key) ?? Number.POSITIVE_INFINITY)) continue;
      const estimate = cost + Math.abs(goal.x - to.x) + Math.abs(goal.y - to.y);
      const state: State = { xi, yi, direction, cost, estimate, key };
      best.set(key, cost); previous.set(key, current.key); states.set(key, state); open.push(state);
    }
  }
  if (!finalKey) return [];
  const reversed: Point[] = [];
  let cursor: string | undefined = finalKey;
  while (cursor) {
    const state = states.get(cursor);
    if (!state) break;
    reversed.push(pointAt(state.xi, state.yi));
    cursor = previous.get(cursor);
  }
  const points = reversed.reverse();
  return points.filter((point, index) => {
    if (index === 0 || index === points.length - 1) return true;
    const before = points[index - 1]; const after = points[index + 1];
    return !((before.x === point.x && point.x === after.x) || (before.y === point.y && point.y === after.y));
  });
}

function pointsPath(points: Point[]): string {
  return points.map((point, index) => `${index ? 'L' : 'M'} ${round(point.x)} ${round(point.y)}`).join(' ');
}

function round(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function truncate(value: string, limit: number): string {
  const safe = Math.max(1, Math.floor(limit));
  return value.length <= safe ? value : `${value.slice(0, Math.max(1, safe - 1))}…`;
}

function formatDate(date: Date, includeYear: boolean): string {
  const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  return `${month} ${date.getUTCDate()}${includeYear ? `, ${date.getUTCFullYear()}` : ''}`;
}

function formatMonth(date: Date): string {
  return date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
}

function isoDay(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function monthTicks(min: number, max: number, maxTicks = 12): number[] {
  const first = new Date(min);
  let cursor = Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1);
  if (cursor < min) cursor = Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1);
  const end = new Date(max);
  const spanMonths = Math.max(1, (end.getUTCFullYear() - first.getUTCFullYear()) * 12 + end.getUTCMonth() - first.getUTCMonth());
  const desiredStep = Math.max(1, Math.ceil(spanMonths / Math.max(1, maxTicks - 1)));
  const steps = [1, 2, 3, 6, 12, 24, 36, 60, 120];
  const monthStep = steps.find(step => step >= desiredStep) ?? Math.ceil(desiredStep / 120) * 120;
  const ticks: number[] = [];
  while (cursor <= max && ticks.length < Math.max(2, maxTicks)) {
    ticks.push(cursor);
    const date = new Date(cursor);
    cursor = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + monthStep, 1);
  }
  if (!ticks.length || ticks[0] !== min) ticks.unshift(min);
  if (ticks[ticks.length - 1] !== max) ticks.push(max);
  return [...new Set(ticks)].sort((a, b) => a - b);
}

function formatTimeTick(date: Date, span: number): string {
  if (span > 370 * DAY) return `${formatMonth(date)} ’${String(date.getUTCFullYear()).slice(-2)}`;
  return formatMonth(date);
}

function horizontalAxisBreak(children: SatoriElement[], x: number, y: number, color: string): void {
  children.push(line(x - 5, y + 5, x - 1, y - 5, color, 1.4, undefined, { 'data-role': 'time-break' }));
  children.push(line(x + 1, y + 5, x + 5, y - 5, color, 1.4, undefined, { 'data-role': 'time-break' }));
}

function verticalAxisBreak(children: SatoriElement[], x: number, y: number, color: string): void {
  children.push(line(x - 5, y - 5, x + 5, y - 1, color, 1.4, undefined, { 'data-role': 'time-break' }));
  children.push(line(x - 5, y + 1, x + 5, y + 5, color, 1.4, undefined, { 'data-role': 'time-break' }));
}

function dateTicks(min: number, max: number, authoredScale: unknown, chartWidth: number): number[] {
  const spanDays = (max - min) / DAY;
  const scale = authoredScale === 'auto' || authoredScale == null
    ? spanDays <= 45 ? 'day' : spanDays <= 150 ? 'week' : spanDays <= 900 ? 'month' : 'quarter'
    : authoredScale;
  const roughStep = scale === 'day' ? DAY : scale === 'week' ? 7 * DAY : 0;
  let ticks: number[] = [];
  if (roughStep) {
    const maxTicks = Math.max(2, Math.floor(chartWidth / 58));
    const multiplier = Math.max(1, Math.ceil(((max - min) / roughStep) / maxTicks));
    const step = roughStep * multiplier;
    for (let time = min; time <= max; time += step) ticks.push(time);
  } else {
    const first = new Date(min);
    const months = scale === 'quarter' ? 3 : 1;
    let cursor = Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1);
    if (cursor < min) cursor = Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + months, 1);
    while (cursor <= max && ticks.length < 120) {
      ticks.push(cursor);
      const date = new Date(cursor);
      cursor = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1);
    }
  }
  if (!ticks.length || ticks[0] !== min) ticks.unshift(min);
  if (ticks[ticks.length - 1] !== max) ticks.push(max);
  return ticks;
}

function ganttTickLabel(date: Date, span: number): string {
  if (span > 330 * DAY) return `${formatMonth(date)} ${date.getUTCFullYear()}`;
  return formatDate(date, false);
}

function fiscalBoundaries(min: number, max: number, month: number): Array<{ time: number; label: string }> {
  const safeMonth = clamp(Math.round(month), 1, 12);
  const startYear = new Date(min).getUTCFullYear() - 1;
  const endYear = new Date(max).getUTCFullYear() + 1;
  const result: Array<{ time: number; label: string }> = [];
  for (let year = startYear; year <= endYear; year += 1) {
    const time = Date.UTC(year, safeMonth - 1, 1);
    if (time < min || time > max) continue;
    const endingYear = safeMonth === 1 ? year : year + 1;
    result.push({ time, label: safeMonth === 1 ? `FY${endingYear}` : `FY${String(endingYear).slice(-2)}` });
  }
  return result;
}

function colorForTag(tag: string): string {
  const names = ['MONEY', 'RULES', 'PROPERTY', 'DEFERRAL', 'FRICTION', 'FLAGGED'];
  const index = names.indexOf(String(tag).toUpperCase());
  return colorAt(index < 0 ? 0 : index);
}

function withAlpha(color: string, alpha: number): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}

function contrastText(color: string): string {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return '#17202a';
  const value = match[1];
  const luminance = (0.299 * parseInt(value.slice(0, 2), 16) + 0.587 * parseInt(value.slice(2, 4), 16) + 0.114 * parseInt(value.slice(4, 6), 16));
  return luminance < 135 ? '#ffffff' : '#17202a';
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter(item => { const value = key(item); if (seen.has(value)) return false; seen.add(value); return true; });
}
