import type { LegendItem, SatoriElement } from '../../types.js';
import {
  avoidPointCollisions,
  buildCivicFrame,
  clamp,
  colorAt,
  formatValue,
  placeLabels,
  svgElement,
  svgText,
  type Box,
  type CivicDiagramResult,
  type CivicRenderContext,
  type Point,
} from './shared.js';

export const MONEY_TYPES = [
  'sankey', 'waterfall', 'delta', 'bar', 'grouped-bar', 'stacked-bar',
  'treemap', 'bullet', 'slope', 'alluvial', 'range-plot', 'line',
  'stacked-area', 'histogram', 'dot-plot',
] as const;

type MoneyType = (typeof MONEY_TYPES)[number];
type Mark = SatoriElement;

interface MoneyStyle {
  positive: string;
  negative: string;
  zero: string;
  barRadius: number;
  barGap: number;
  axisColor: string;
  axisFontSize: number;
  tickFontSize: number;
  valueFontSize: number;
  gridLineColor: string;
  text: string;
  secondary: string;
  canvas: string;
}

interface RenderedPlot {
  plot: SatoriElement;
  height: number;
  legend?: LegendItem[];
}

interface FlowNodeLayout {
  id: string;
  label: string;
  color: string;
  rank: number;
  x: number;
  y: number;
  width: number;
  height: number;
  throughput: number;
  inputOffset: number;
  outputOffset: number;
}

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const number = (value: unknown): number => isFiniteNumber(value) ? value : 0;
const list = <T>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];
const text = (value: unknown): string => typeof value === 'string' ? value : '';

function addFinite(left: number, right: number): number {
  const total = left + right;
  if (Number.isFinite(total)) return total;
  return left < 0 && right < 0 ? -Number.MAX_VALUE : Number.MAX_VALUE;
}

function sumFinite(values: number[]): number {
  return values.reduce(addFinite, 0);
}

/** Overflow-safe numeric domain for finite but potentially near-limit values. */
function extent(values: number[], includeZero = false): [number, number] {
  const safe = values.filter(Number.isFinite);
  if (includeZero) safe.push(0);
  if (!safe.length) return [0, 1];
  let min = Math.min(...safe);
  let max = Math.max(...safe);
  if (min === max) {
    if (min === 0) return [0, 1];
    const delta = Math.abs(min) * 0.1;
    const low = min - delta;
    const high = max + delta;
    min = Number.isFinite(low) ? low : min * 0.9;
    max = Number.isFinite(high) ? high : max;
    if (min === max) min = 0;
  }
  return [min, max];
}

/** Scaling through a normalized domain avoids overflow for [-MAX_VALUE, MAX_VALUE]. */
function linearScale(domain: [number, number], range: [number, number]): (value: number) => number {
  const magnitude = Math.max(1, Math.abs(domain[0]), Math.abs(domain[1]));
  const start = domain[0] / magnitude;
  const end = domain[1] / magnitude;
  const span = end - start || 1;
  const rangeSpan = range[1] - range[0];
  return value => range[0] + (((Number.isFinite(value) ? value : 0) / magnitude - start) / span) * rangeSpan;
}

function moneyStyle(context: CivicRenderContext): MoneyStyle {
  const configured = (context.theme as unknown as { money?: Partial<MoneyStyle> }).money ?? {};
  return {
    positive: configured.positive ?? '#3d7a55',
    negative: configured.negative ?? '#b63a45',
    zero: configured.zero ?? '#7b8088',
    barRadius: configured.barRadius ?? 3,
    barGap: configured.barGap ?? 10,
    axisColor: configured.axisColor ?? context.theme.edge.color,
    axisFontSize: configured.axisFontSize ?? 11,
    tickFontSize: configured.tickFontSize ?? 10,
    valueFontSize: configured.valueFontSize ?? 11,
    gridLineColor: configured.gridLineColor ?? context.theme.group.border,
    text: context.theme.node.textColor,
    secondary: context.theme.node.textColorSecondary,
    canvas: context.options.background === 'transparent'
      ? context.theme.canvas.background
      : (context.options.background ?? context.theme.canvas.background),
  };
}

function mark(type: string, props: Record<string, unknown>): Mark {
  return { type, props };
}

function rect(x: number, y: number, width: number, height: number, fill: string, extras: Record<string, unknown> = {}): Mark {
  return mark('rect', {
    x: n(x), y: n(y), width: n(Math.max(0, width)), height: n(Math.max(0, height)), fill, ...extras,
  });
}

function line(x1: number, y1: number, x2: number, y2: number, stroke: string, width = 1, extras: Record<string, unknown> = {}): Mark {
  return mark('line', { x1: n(x1), y1: n(y1), x2: n(x2), y2: n(y2), stroke, 'stroke-width': n(width), ...extras });
}

function circle(cx: number, cy: number, radius: number, fill: string, extras: Record<string, unknown> = {}): Mark {
  return mark('circle', { cx: n(cx), cy: n(cy), r: n(radius), fill, ...extras });
}

function path(d: string, stroke: string, width: number, fill = 'none', extras: Record<string, unknown> = {}): Mark {
  return mark('path', { d, fill, stroke, 'stroke-width': n(width), ...extras });
}

function n(value: number): string {
  return Number.isFinite(value) ? String(Math.round(value * 100) / 100) : '0';
}

function label(x: number, y: number, value: string, style: MoneyStyle, options: Record<string, unknown> = {}): Mark {
  return svgText(x, y, value, {
    fill: style.text,
    'font-size': n(style.valueFontSize),
    'font-family': 'inherit',
    ...options,
  });
}

function truncate(value: string, maxWidth: number, fontSize = 11): string {
  if (maxWidth <= fontSize) return '';
  const capacity = Math.max(1, Math.floor(maxWidth / (fontSize * 0.57)));
  if (value.length <= capacity) return value;
  if (capacity <= 2) return value.slice(0, capacity);
  return `${value.slice(0, capacity - 1).trimEnd()}…`;
}

function wrapText(value: string, maxWidth: number, fontSize = 11, maxLines = 2): string[] {
  const capacity = Math.max(4, Math.floor(maxWidth / (fontSize * 0.57)));
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let index = 0;
  while (index < words.length && lines.length < maxLines) {
    let current = '';
    while (index < words.length) {
      const candidate = current ? `${current} ${words[index]}` : words[index];
      if (current && candidate.length > capacity) break;
      current = candidate;
      index += 1;
    }
    if (lines.length === maxLines - 1 && index < words.length) {
      current = truncate([current, ...words.slice(index)].filter(Boolean).join(' '), maxWidth, fontSize);
      index = words.length;
    }
    lines.push(current);
  }
  return lines.length ? lines : [''];
}

function autoLegend(series: any[]): LegendItem[] {
  return list<any>(series).map((entry, index) => ({
    label: text(entry?.label) || text(entry?.id) || `Series ${index + 1}`,
    color: text(entry?.color) || colorAt(index),
  }));
}

function withAutoLegend(spec: any, legend: LegendItem[]): any {
  if (!legend.length || spec.legend === false || spec.legend != null) return spec;
  return { ...spec, legend: true };
}

function unit(spec: any): any {
  return spec.unit ?? 'usd';
}

function fmt(value: number, spec: any, signed = false): string {
  const base = unit(spec);
  if (!signed || value === 0) return formatValue(value, base);
  const configured = typeof base === 'string' ? { unit: base, sign: 'always' } : { ...base, sign: 'always' };
  return formatValue(value, configured);
}

function axisTicks(domain: [number, number], count = 5): number[] {
  const [min, max] = domain;
  if (count <= 1 || max === min) return [min];
  return Array.from({ length: count }, (_, index) => {
    const ratio = index / (count - 1);
    return min * (1 - ratio) + max * ratio;
  });
}

function plotSvg(width: number, height: number, children: Mark[], alt?: string): SatoriElement {
  return svgElement(Math.max(1, width), Math.max(1, height), children, alt);
}

function frame(spec: any, rendered: RenderedPlot, context: CivicRenderContext): CivicDiagramResult {
  return buildCivicFrame(
    withAutoLegend(spec, rendered.legend ?? []),
    rendered.plot,
    rendered.height,
    context,
    rendered.legend ?? [],
  );
}

export function buildMoneyDiagram(spec: any, context: CivicRenderContext): CivicDiagramResult {
  const type = spec?.type as MoneyType;
  const width = Math.max(280, context.width - context.padding * 2);
  const rendered = type === 'sankey' ? renderSankey(spec, width, context)
    : type === 'waterfall' ? renderWaterfall(spec, width, context)
      : type === 'delta' ? renderDelta(spec, width, context)
        : type === 'bar' ? renderBar(spec, width, context)
          : type === 'grouped-bar' ? renderGroupedBar(spec, width, context)
            : type === 'stacked-bar' ? renderStackedBar(spec, width, context)
              : type === 'treemap' ? renderTreemap(spec, width, context)
                : type === 'bullet' ? renderBullet(spec, width, context)
                  : type === 'slope' ? renderSlope(spec, width, context)
                    : type === 'alluvial' ? renderAlluvial(spec, width, context)
                      : type === 'range-plot' ? renderRangePlot(spec, width, context)
                        : type === 'line' ? renderLine(spec, width, context)
                          : type === 'stacked-area' ? renderStackedArea(spec, width, context)
                            : type === 'histogram' ? renderHistogram(spec, width, context)
                              : type === 'dot-plot' ? renderDotPlot(spec, width, context)
                                : emptyPlot(width, context, `Unsupported money diagram: ${String(type)}`);
  return frame(spec, rendered, context);
}

function emptyPlot(width: number, context: CivicRenderContext, message: string): RenderedPlot {
  const style = moneyStyle(context);
  const height = 120;
  return { plot: plotSvg(width, height, [label(width / 2, height / 2, message, style, { 'text-anchor': 'middle' })]), height };
}

function addAxes(
  children: Mark[],
  domain: [number, number],
  scale: (value: number) => number,
  y1: number,
  y2: number,
  spec: any,
  style: MoneyStyle,
  orientation: 'x' | 'y' = 'x',
): void {
  for (const tick of axisTicks(domain)) {
    const position = scale(tick);
    if (orientation === 'x') {
      children.push(line(position, y1, position, y2, style.gridLineColor, 1));
      children.push(label(position, y2 + 16, formatValue(tick, unit(spec)), style, {
        fill: style.secondary, 'font-size': n(style.tickFontSize), 'text-anchor': 'middle',
      }));
    } else {
      children.push(line(y1, position, y2, position, style.gridLineColor, 1));
      children.push(label(y1 - 7, position + 3, formatValue(tick, unit(spec)), style, {
        fill: style.secondary, 'font-size': n(style.tickFontSize), 'text-anchor': 'end',
      }));
    }
  }
}

function sortedItems(spec: any): any[] {
  const items = list<any>(spec.items).map((item, index) => ({ ...item, __index: index }));
  if (spec.sort === 'none') return items;
  const direction = spec.sort === 'asc' ? 1 : -1;
  return items.sort((a, b) => direction * (number(a.value) - number(b.value)) || a.__index - b.__index || text(a.id).localeCompare(text(b.id)));
}

function renderSankey(spec: any, width: number, context: CivicRenderContext): RenderedPlot {
  const style = moneyStyle(context);
  const nodes = list<any>(spec.nodes);
  const links = list<any>(spec.links);
  const ids = new Set(nodes.map(node => text(node.id)));
  const incoming = new Map<string, any[]>();
  const outgoing = new Map<string, any[]>();
  for (const node of nodes) {
    incoming.set(text(node.id), []);
    outgoing.set(text(node.id), []);
  }
  for (const link of links) {
    if (!ids.has(text(link.from)) || !ids.has(text(link.to))) continue;
    outgoing.get(text(link.from))?.push(link);
    incoming.get(text(link.to))?.push(link);
  }

  // Longest-path ranks, with deterministic source and edge ordering.
  const indegree = new Map(nodes.map(node => [text(node.id), incoming.get(text(node.id))?.length ?? 0]));
  const rank = new Map(nodes.map(node => [text(node.id), 0]));
  const queue = nodes.filter(node => indegree.get(text(node.id)) === 0);
  const processed = new Set<string>();
  let cursor = 0;
  while (cursor < queue.length) {
    const node = queue[cursor++];
    const nodeId = text(node.id);
    processed.add(nodeId);
    for (const edge of outgoing.get(nodeId) ?? []) {
      const target = text(edge.to);
      rank.set(target, Math.max(rank.get(target) ?? 0, (rank.get(nodeId) ?? 0) + 1));
      indegree.set(target, (indegree.get(target) ?? 1) - 1);
      if (indegree.get(target) === 0) queue.push(nodes.find(candidate => text(candidate.id) === target));
    }
  }
  // A validated sankey is acyclic; the fallback still keeps malformed input finite.
  if (processed.size < nodes.length) {
    let fallbackRank = Math.max(0, ...rank.values());
    nodes.filter(node => !processed.has(text(node.id))).forEach(node => {
      rank.set(text(node.id), fallbackRank++);
    });
  }
  const maxRank = Math.max(1, ...rank.values());
  const rankGroups = Array.from({ length: maxRank + 1 }, () => [] as any[]);
  nodes.forEach(node => rankGroups[clamp(rank.get(text(node.id)) ?? 0, 0, maxRank)].push(node));
  const mostInRank = Math.max(1, ...rankGroups.map(group => group.length));
  const height = Math.max(300, mostInRank * 58 + 48, links.length * 20 + 40);
  const top = 26;
  const bottom = height - 20;
  const nodeWidth = 18;
  const sideLabel = clamp(width * 0.17, 76, 128);
  const plotLeft = sideLabel;
  const plotRight = width - sideLabel;
  const rankX = (value: number) => plotLeft + (plotRight - plotLeft - nodeWidth) * value / maxRank;
  const throughput = (node: any) => Math.max(
    sumFinite((incoming.get(text(node.id)) ?? []).map(edge => Math.max(0, number(edge.value)))),
    sumFinite((outgoing.get(text(node.id)) ?? []).map(edge => Math.max(0, number(edge.value)))),
  );
  const scaleCandidates = rankGroups.map(group => {
    const available = bottom - top - Math.max(0, group.length - 1) * 14;
    const total = sumFinite(group.map(throughput));
    return total > 0 ? Math.max(0, available - group.length * 4) / total : Number.POSITIVE_INFINITY;
  });
  const flowScale = Math.min(...scaleCandidates.filter(Number.isFinite), 1);
  const layout = new Map<string, FlowNodeLayout>();
  rankGroups.forEach((group, groupRank) => {
    const heights = group.map(node => Math.max(4, throughput(node) * flowScale));
    const used = heights.reduce((sum, value) => sum + value, 0) + Math.max(0, group.length - 1) * 14;
    let y = top + Math.max(0, (bottom - top - used) / 2);
    group.forEach((node, index) => {
      const id = text(node.id);
      layout.set(id, {
        id,
        label: text(node.label) || id,
        color: text(node.color) || colorAt(nodes.indexOf(node)),
        rank: groupRank,
        x: rankX(groupRank),
        y,
        width: nodeWidth,
        height: heights[index],
        throughput: throughput(node),
        inputOffset: 0,
        outputOffset: 0,
      });
      y += heights[index] + 14;
    });
  });

  const children: Mark[] = [];
  const annotationAnchors = new Map<string, Point>();
  const linkAnchors: Array<{ id: string; text: string; x: number; y: number }> = [];
  links.forEach((edge, edgeIndex) => {
    const from = layout.get(text(edge.from));
    const to = layout.get(text(edge.to));
    if (!from || !to) return;
    const edgeWidth = number(edge.value) > 0 ? Math.max(1.25, number(edge.value) * flowScale) : 1;
    const sy = from.y + Math.min(from.height, from.outputOffset + edgeWidth / 2);
    const ty = to.y + Math.min(to.height, to.inputOffset + edgeWidth / 2);
    from.outputOffset += edgeWidth;
    to.inputOffset += edgeWidth;
    const x1 = from.x + from.width;
    const x2 = to.x;
    const bend = Math.max(20, (x2 - x1) * 0.45);
    const d = `M ${n(x1)} ${n(sy)} C ${n(x1 + bend)} ${n(sy)}, ${n(x2 - bend)} ${n(ty)}, ${n(x2)} ${n(ty)}`;
    const edgeColor = text(edge.color) || from.color;
    children.push(path(d, edgeColor, edgeWidth, 'none', {
      opacity: number(edge.value) > 0 ? '0.48' : '0.8',
      'stroke-linecap': 'round',
      'data-money-link': `${text(edge.from)}:${text(edge.to)}`,
    }));
    const anchorX = (x1 + x2) / 2;
    const anchorY = (sy + ty) / 2;
    const valueText = number(edge.value) === 0 ? 'n/a' : formatValue(number(edge.value), unit(spec));
    linkAnchors.push({ id: `link-${edgeIndex}`, text: text(edge.label) ? `${text(edge.label)} · ${valueText}` : valueText, x: anchorX, y: anchorY });
  });
  const occupied: Box[] = [...layout.values()].map(node => ({ x: node.x, y: node.y, width: node.width, height: node.height }));
  const placed = placeLabels(linkAnchors.map(anchor => ({ ...anchor, preferred: 'top' as const })), {
    x: plotLeft + 20, y: 4, width: Math.max(1, plotRight - plotLeft - 40), height: height - 8,
  }, occupied, style.tickFontSize);
  for (const item of placed) {
    children.push(line(item.anchorX, item.anchorY, item.x + item.width / 2, item.y + item.height / 2, style.gridLineColor, 0.75));
    children.push(rect(item.x, item.y, item.width, item.height, style.canvas, { opacity: '0.9', rx: '2' }));
    children.push(label(item.x + 4, item.y + item.height - 5, truncate(item.text, item.width - 8, style.tickFontSize), style, { 'font-size': n(style.tickFontSize) }));
  }
  for (const node of layout.values()) {
    children.push(rect(node.x, node.y, node.width, node.height, node.color, { rx: n(Math.min(style.barRadius, node.height / 2)), 'data-money-node': node.id }));
    const anchor = node.rank === 0 ? 'end' : node.rank === maxRank ? 'start' : 'middle';
    const labelX = node.rank === 0 ? node.x - 7 : node.rank === maxRank ? node.x + node.width + 7 : node.x + node.width / 2;
    const maxLabel = node.rank === 0 || node.rank === maxRank ? sideLabel - 12 : Math.max(35, (plotRight - plotLeft) / (maxRank + 1) - 10);
    children.push(label(labelX, node.y + node.height / 2 - 2, truncate(node.label, maxLabel, style.axisFontSize), style, {
      'font-size': n(style.axisFontSize), 'text-anchor': anchor, 'font-weight': '600',
    }));
    children.push(label(labelX, node.y + node.height / 2 + 12, node.throughput === 0 ? 'n/a' : formatValue(node.throughput, unit(spec)), style, {
      fill: style.secondary, 'font-size': n(style.tickFontSize), 'text-anchor': anchor,
    }));
    annotationAnchors.set(node.id, { x: node.x + node.width / 2, y: node.y + node.height / 2 });
  }
  addAnnotations(children, spec, width, height, annotationAnchors, style);
  return { plot: plotSvg(width, height, children, spec.alt), height };
}

function renderWaterfall(spec: any, width: number, context: CivicRenderContext): RenderedPlot {
  const style = moneyStyle(context);
  const steps = list<any>(spec.steps);
  const columns: Array<{ id: string; label: string; start: number; end: number; total: boolean; color?: string; value: number }> = [];
  let running = spec.start ? number(spec.start.value) : 0;
  if (spec.start) columns.push({ id: 'start', label: text(spec.start.label), start: 0, end: running, total: true, value: running });
  for (const step of steps) {
    const startValue = running;
    running = addFinite(running, number(step.value));
    columns.push({ id: text(step.id), label: text(step.label), start: startValue, end: running, total: false, value: number(step.value), color: text(step.color) });
  }
  if (spec.end) columns.push({ id: 'end', label: text(spec.end.label), start: 0, end: running, total: true, value: running });
  const height = 340;
  const top = 30;
  const bottom = height - 58;
  const values = columns.flatMap(column => [column.start, column.end]);
  const domain = extent(values, true);
  const y = linearScale(domain, [bottom, top]);
  const left = 50;
  const right = width - 18;
  const band = (right - left) / Math.max(1, columns.length);
  const barWidth = clamp(band * 0.55, 5, 54);
  const children: Mark[] = [];
  addAxes(children, domain, y, left, right, spec, style, 'y');
  const anchors = new Map<string, Point>();
  columns.forEach((column, index) => {
    const x = left + band * (index + 0.5);
    if (index > 0) {
      const prior = columns[index - 1];
      children.push(line(left + band * (index - 0.5) + barWidth / 2, y(prior.end), x - barWidth / 2, y(prior.end), style.axisColor, 1, { 'stroke-dasharray': '3,3' }));
    }
    if (!column.total && column.value === 0) {
      children.push(line(x - barWidth / 2, y(column.start), x + barWidth / 2, y(column.start), style.zero, 2));
    } else {
      const y1 = y(column.start);
      const y2 = y(column.end);
      const fill = column.color || (column.total ? colorAt(index) : column.value > 0 ? style.positive : column.value < 0 ? style.negative : style.zero);
      children.push(rect(x - barWidth / 2, Math.min(y1, y2), barWidth, Math.max(1.5, Math.abs(y2 - y1)), fill, {
        rx: n(Math.min(style.barRadius, barWidth / 2)), 'data-money-column': column.id,
      }));
    }
    const valueY = clamp(Math.min(y(column.start), y(column.end)) - 7, 12, bottom - 4);
    const shown = !column.total && column.value === 0 ? 'n/a' : fmt(column.value, spec, !column.total);
    children.push(label(x, valueY, truncate(shown, band - 3, style.valueFontSize), style, { 'text-anchor': 'middle', 'font-weight': '600' }));
    children.push(label(x, bottom + 20 + (index % 2) * 13, truncate(column.label, band - 3, style.tickFontSize), style, {
      'text-anchor': 'middle', fill: style.secondary, 'font-size': n(style.tickFontSize),
    }));
    anchors.set(column.id, { x, y: y(column.end) });
  });
  addAnnotations(children, spec, width, height, anchors, style);
  return { plot: plotSvg(width, height, children, spec.alt), height };
}

function renderDelta(spec: any, width: number, context: CivicRenderContext): RenderedPlot {
  const style = moneyStyle(context);
  const from = number(spec.from?.value);
  const to = number(spec.to?.value);
  const change = to - from;
  const percentage = from === 0 ? undefined : change / Math.abs(from) * 100;
  const height = 220;
  const leftX = width * 0.22;
  const rightX = width * 0.78;
  const centerX = width / 2;
  const color = change > 0 ? style.positive : change < 0 ? style.negative : style.zero;
  const children: Mark[] = [
    label(leftX, 36, truncate(text(spec.from?.label), width * 0.38, 12), style, { 'text-anchor': 'middle', fill: style.secondary, 'font-size': '12' }),
    label(leftX, 93, formatValue(from, unit(spec)), style, { 'text-anchor': 'middle', 'font-size': '34', 'font-weight': '700' }),
    label(rightX, 36, truncate(text(spec.to?.label), width * 0.38, 12), style, { 'text-anchor': 'middle', fill: style.secondary, 'font-size': '12' }),
    label(rightX, 93, formatValue(to, unit(spec)), style, { 'text-anchor': 'middle', 'font-size': '34', 'font-weight': '700' }),
    path(`M ${n(leftX)} 117 L ${n(rightX)} 117`, color, 3, 'none', { 'stroke-linecap': 'round' }),
    mark('polygon', { points: `${n(rightX)},117 ${n(rightX - 10)},111 ${n(rightX - 10)},123`, fill: color }),
    label(centerX, 153, fmt(change, spec, true), style, { 'text-anchor': 'middle', fill: color, 'font-size': '22', 'font-weight': '700' }),
    label(centerX, 178, percentage == null ? 'Change from zero' : `${percentage > 0 ? '+' : ''}${formatValue(percentage, 'percent')}`, style, {
      'text-anchor': 'middle', fill: style.secondary, 'font-size': '12',
    }),
  ];
  const anchors = new Map<string, Point>([
    ['from', { x: leftX, y: 93 }], ['to', { x: rightX, y: 93 }],
    [text(spec.from?.label), { x: leftX, y: 93 }], [text(spec.to?.label), { x: rightX, y: 93 }],
  ]);
  addAnnotations(children, spec, width, height, anchors, style);
  return { plot: plotSvg(width, height, children, spec.alt), height };
}

function renderBar(spec: any, width: number, context: CivicRenderContext): RenderedPlot {
  const style = moneyStyle(context);
  const items = sortedItems(spec);
  return spec.orientation === 'vertical'
    ? renderVerticalBars(spec, items.map((item, index) => ({ ...item, color: text(item.color) || colorAt(index) })), width, context)
    : renderHorizontalBars(spec, items.map((item, index) => ({ ...item, color: text(item.color) || colorAt(index) })), width, context);
}

function renderHorizontalBars(spec: any, items: any[], width: number, context: CivicRenderContext): RenderedPlot {
  const style = moneyStyle(context);
  const rowHeight = 38;
  const height = Math.max(130, 36 + items.length * rowHeight);
  const labelWidth = clamp(width * 0.31, 82, 220);
  const left = labelWidth;
  const right = width - 18;
  const domain = extent(items.map(item => number(item.value)), true);
  const x = linearScale(domain, [left, right]);
  const zero = x(0);
  const children: Mark[] = [];
  addAxes(children, domain, x, 16, height - 24, spec, style);
  const anchors = new Map<string, Point>();
  items.forEach((item, index) => {
    const cy = 22 + index * rowHeight;
    const value = number(item.value);
    const valueX = x(value);
    children.push(label(left - 9, cy + 4, truncate(text(item.label), labelWidth - 16, style.axisFontSize), style, { 'text-anchor': 'end', 'font-size': n(style.axisFontSize) }));
    if (value === 0) children.push(line(zero, cy - 7, zero, cy + 7, style.zero, 2));
    else children.push(rect(Math.min(zero, valueX), cy - 9, Math.max(1, Math.abs(valueX - zero)), 18, text(item.color) || colorAt(index), {
      rx: n(style.barRadius), 'data-money-bar': text(item.id),
    }));
    const roomRight = right - valueX;
    const formatted = formatValue(value, unit(spec));
    const inside = Math.abs(valueX - zero) > formatted.length * style.valueFontSize * 0.62 + 12;
    const valueLabelX = inside ? (value >= 0 ? valueX - 5 : valueX + 5) : clamp(valueX + (value >= 0 ? 6 : -6), left + 2, right - 2);
    children.push(label(valueLabelX, cy + 4, roomRight < 18 && !inside ? '' : formatted, style, {
      'text-anchor': inside ? (value >= 0 ? 'end' : 'start') : (value >= 0 ? 'start' : 'end'),
      fill: inside ? '#ffffff' : style.text, 'font-size': n(style.valueFontSize), 'font-weight': '600',
    }));
    anchors.set(text(item.id), { x: valueX, y: cy });
  });
  addAnnotations(children, spec, width, height, anchors, style);
  return { plot: plotSvg(width, height, children, spec.alt), height };
}

function renderVerticalBars(spec: any, items: any[], width: number, context: CivicRenderContext): RenderedPlot {
  const style = moneyStyle(context);
  const height = 350;
  const left = 52;
  const right = width - 14;
  const top = 22;
  const bottom = height - 58;
  const domain = extent(items.map(item => number(item.value)), true);
  const y = linearScale(domain, [bottom, top]);
  const zero = y(0);
  const band = (right - left) / Math.max(1, items.length);
  const barWidth = clamp(band * 0.62, 3, 54);
  const children: Mark[] = [];
  addAxes(children, domain, y, left, right, spec, style, 'y');
  const anchors = new Map<string, Point>();
  items.forEach((item, index) => {
    const x = left + band * (index + 0.5);
    const valueY = y(number(item.value));
    if (number(item.value) === 0) children.push(line(x - barWidth / 2, zero, x + barWidth / 2, zero, style.zero, 2));
    else children.push(rect(x - barWidth / 2, Math.min(zero, valueY), barWidth, Math.max(1, Math.abs(zero - valueY)), text(item.color) || colorAt(index), {
      rx: n(Math.min(style.barRadius, barWidth / 2)), 'data-money-bar': text(item.id),
    }));
    children.push(label(x, clamp(valueY + (number(item.value) >= 0 ? -7 : 14), top + 9, bottom - 2), truncate(formatValue(number(item.value), unit(spec)), band - 3, style.tickFontSize), style, {
      'text-anchor': 'middle', 'font-size': n(style.tickFontSize), 'font-weight': '600',
    }));
    children.push(label(x, bottom + 19 + (index % 2) * 13, truncate(text(item.label), band - 4, style.tickFontSize), style, {
      'text-anchor': 'middle', fill: style.secondary, 'font-size': n(style.tickFontSize),
    }));
    anchors.set(text(item.id), { x, y: valueY });
  });
  addAnnotations(children, spec, width, height, anchors, style);
  return { plot: plotSvg(width, height, children, spec.alt), height };
}

function renderGroupedBar(spec: any, width: number, context: CivicRenderContext): RenderedPlot {
  const categories = list<string>(spec.categories).map(String);
  const series = list<any>(spec.series);
  const legend = autoLegend(series);
  return spec.orientation === 'vertical'
    ? renderGroupedVertical(spec, categories, series, legend, width, context)
    : renderGroupedHorizontal(spec, categories, series, legend, width, context);
}

function renderGroupedHorizontal(spec: any, categories: string[], series: any[], legend: LegendItem[], width: number, context: CivicRenderContext): RenderedPlot {
  const style = moneyStyle(context);
  const barHeight = clamp(18 - Math.max(0, series.length - 3), 7, 18);
  const categoryGap = 16;
  const groupHeight = series.length * (barHeight + 4) + categoryGap;
  const height = Math.max(150, 28 + categories.length * groupHeight);
  const labelWidth = clamp(width * 0.28, 82, 205);
  const left = labelWidth;
  const right = width - 22;
  const values = series.flatMap(entry => list<number>(entry.values).map(number));
  const domain = extent(values, true);
  const x = linearScale(domain, [left, right]);
  const zero = x(0);
  const children: Mark[] = [];
  addAxes(children, domain, x, 14, height - 25, spec, style);
  const anchors = new Map<string, Point>();
  categories.forEach((category, categoryIndex) => {
    const groupY = 20 + categoryIndex * groupHeight;
    children.push(label(left - 9, groupY + Math.max(13, series.length * (barHeight + 4) / 2), truncate(category, labelWidth - 15, style.axisFontSize), style, {
      'text-anchor': 'end', 'font-size': n(style.axisFontSize), 'font-weight': '600',
    }));
    series.forEach((entry, seriesIndex) => {
      const value = number(entry.values?.[categoryIndex]);
      const valueX = x(value);
      const y = groupY + seriesIndex * (barHeight + 4);
      if (value === 0) children.push(line(zero, y, zero, y + barHeight, style.zero, 1.5));
      else children.push(rect(Math.min(zero, valueX), y, Math.max(1, Math.abs(valueX - zero)), barHeight, text(entry.color) || colorAt(seriesIndex), {
        rx: n(Math.min(style.barRadius, barHeight / 2)), 'data-money-bar': `${text(entry.id)}:${categoryIndex}`,
      }));
      const shown = formatValue(value, unit(spec));
      children.push(label(clamp(valueX + 5, left + 3, right - 2), y + barHeight - 4, truncate(shown, Math.max(0, right - valueX - 4), style.tickFontSize), style, {
        'font-size': n(style.tickFontSize), 'font-weight': '600',
      }));
      anchors.set(`${text(entry.id)}:${category}`, { x: valueX, y: y + barHeight / 2 });
    });
  });
  addAnnotations(children, spec, width, height, anchors, style);
  return { plot: plotSvg(width, height, children, spec.alt), height, legend };
}

function renderGroupedVertical(spec: any, categories: string[], series: any[], legend: LegendItem[], width: number, context: CivicRenderContext): RenderedPlot {
  const style = moneyStyle(context);
  const height = 360;
  const left = 54;
  const right = width - 12;
  const top = 20;
  const bottom = height - 58;
  const values = series.flatMap(entry => list<number>(entry.values).map(number));
  const domain = extent(values, true);
  const y = linearScale(domain, [bottom, top]);
  const zero = y(0);
  const categoryBand = (right - left) / Math.max(1, categories.length);
  const groupWidth = categoryBand * 0.76;
  const barWidth = clamp(groupWidth / Math.max(1, series.length), 2, 42);
  const children: Mark[] = [];
  addAxes(children, domain, y, left, right, spec, style, 'y');
  const anchors = new Map<string, Point>();
  categories.forEach((category, categoryIndex) => {
    const center = left + categoryBand * (categoryIndex + 0.5);
    series.forEach((entry, seriesIndex) => {
      const value = number(entry.values?.[categoryIndex]);
      const valueY = y(value);
      const x = center - series.length * barWidth / 2 + seriesIndex * barWidth;
      if (value === 0) children.push(line(x, zero, x + barWidth, zero, style.zero, 1.5));
      else children.push(rect(x, Math.min(zero, valueY), Math.max(1, barWidth - 1), Math.max(1, Math.abs(zero - valueY)), text(entry.color) || colorAt(seriesIndex), {
        rx: n(Math.min(style.barRadius, barWidth / 2)), 'data-money-bar': `${text(entry.id)}:${categoryIndex}`,
      }));
      anchors.set(`${text(entry.id)}:${category}`, { x: x + barWidth / 2, y: valueY });
    });
    children.push(label(center, bottom + 20 + categoryIndex % 2 * 13, truncate(category, categoryBand - 5, style.tickFontSize), style, {
      'text-anchor': 'middle', fill: style.secondary, 'font-size': n(style.tickFontSize),
    }));
  });
  addAnnotations(children, spec, width, height, anchors, style);
  return { plot: plotSvg(width, height, children, spec.alt), height, legend };
}

function renderStackedBar(spec: any, width: number, context: CivicRenderContext): RenderedPlot {
  const categories = list<string>(spec.categories).map(String);
  const series = list<any>(spec.series);
  const legend = autoLegend(series);
  const totals = categories.map((_, categoryIndex) => sumFinite(series.map(entry => Math.max(0, number(entry.values?.[categoryIndex])))));
  const style = moneyStyle(context);
  if (spec.orientation === 'vertical') {
    const height = 360;
    const left = 54;
    const right = width - 16;
    const top = 22;
    const bottom = height - 58;
    const y = linearScale(extent(totals, true), [bottom, top]);
    const band = (right - left) / Math.max(1, categories.length);
    const barWidth = clamp(band * 0.62, 4, 72);
    const children: Mark[] = [];
    addAxes(children, extent(totals, true), y, left, right, spec, style, 'y');
    const anchors = new Map<string, Point>();
    categories.forEach((category, categoryIndex) => {
      let running = 0;
      const x = left + band * (categoryIndex + 0.5);
      series.forEach((entry, seriesIndex) => {
        const value = Math.max(0, number(entry.values?.[categoryIndex]));
        const y0 = y(running);
        running = addFinite(running, value);
        const y1 = y(running);
        if (value > 0) children.push(rect(x - barWidth / 2, y1, barWidth, Math.max(1, y0 - y1), text(entry.color) || colorAt(seriesIndex), {
          'data-money-segment': `${text(entry.id)}:${categoryIndex}`,
        }));
        const formatted = formatValue(value, unit(spec));
        if (y0 - y1 > 17 && barWidth > formatted.length * style.tickFontSize * 0.55) {
          children.push(label(x, (y0 + y1) / 2 + 4, formatted, style, { 'text-anchor': 'middle', fill: '#ffffff', 'font-size': n(style.tickFontSize), 'font-weight': '600' }));
        }
        anchors.set(`${text(entry.id)}:${category}`, { x, y: (y0 + y1) / 2 });
      });
      children.push(label(x, y(running) - 7, formatValue(running, unit(spec)), style, { 'text-anchor': 'middle', 'font-size': n(style.tickFontSize), 'font-weight': '600' }));
      children.push(label(x, bottom + 20 + categoryIndex % 2 * 13, truncate(category, band - 5, style.tickFontSize), style, { 'text-anchor': 'middle', fill: style.secondary, 'font-size': n(style.tickFontSize) }));
    });
    addAnnotations(children, spec, width, height, anchors, style);
    return { plot: plotSvg(width, height, children, spec.alt), height, legend };
  }

  const rowHeight = 48;
  const height = Math.max(140, categories.length * rowHeight + 38);
  const labelWidth = clamp(width * 0.28, 85, 210);
  const left = labelWidth;
  const right = width - 55;
  const x = linearScale(extent(totals, true), [left, right]);
  const children: Mark[] = [];
  addAxes(children, extent(totals, true), x, 12, height - 25, spec, style);
  const anchors = new Map<string, Point>();
  categories.forEach((category, categoryIndex) => {
    const cy = 23 + categoryIndex * rowHeight;
    children.push(label(left - 9, cy + 4, truncate(category, labelWidth - 15, style.axisFontSize), style, { 'text-anchor': 'end', 'font-size': n(style.axisFontSize), 'font-weight': '600' }));
    let running = 0;
    series.forEach((entry, seriesIndex) => {
      const value = Math.max(0, number(entry.values?.[categoryIndex]));
      const x0 = x(running);
      running = addFinite(running, value);
      const x1 = x(running);
      if (value > 0) children.push(rect(x0, cy - 11, Math.max(1, x1 - x0), 22, text(entry.color) || colorAt(seriesIndex), {
        'data-money-segment': `${text(entry.id)}:${categoryIndex}`,
      }));
      const formatted = formatValue(value, unit(spec));
      if (x1 - x0 > formatted.length * style.tickFontSize * 0.57 + 8) {
        children.push(label((x0 + x1) / 2, cy + 4, formatted, style, { 'text-anchor': 'middle', fill: '#ffffff', 'font-size': n(style.tickFontSize), 'font-weight': '600' }));
      }
      anchors.set(`${text(entry.id)}:${category}`, { x: (x0 + x1) / 2, y: cy });
    });
    children.push(label(Math.min(width - 3, x(running) + 6), cy + 4, formatValue(running, unit(spec)), style, { 'font-size': n(style.tickFontSize), 'font-weight': '600' }));
  });
  addAnnotations(children, spec, width, height, anchors, style);
  return { plot: plotSvg(width, height, children, spec.alt), height, legend };
}

interface TreeNodeValue {
  node: any;
  value: number;
  children: TreeNodeValue[];
}

interface TreeRect extends Box {
  item: TreeNodeValue;
  depth: number;
}

function treeValue(node: any): TreeNodeValue {
  const children = list<any>(node.children).map(treeValue);
  const childSum = sumFinite(children.map(child => child.value));
  return { node, children, value: children.length ? childSum : Math.max(0, number(node.value)) };
}

function squarify(items: TreeNodeValue[], box: Box, depth: number): TreeRect[] {
  const positive = items.filter(item => item.value > 0).sort((a, b) => b.value - a.value || text(a.node.id).localeCompare(text(b.node.id)));
  const magnitude = Math.max(0, ...positive.map(item => item.value));
  const normalizedTotal = magnitude > 0 ? positive.reduce((sum, item) => sum + item.value / magnitude, 0) : 0;
  if (!normalizedTotal || box.width <= 0 || box.height <= 0) return [];
  const areaFor = (item: TreeNodeValue) => item.value / magnitude / normalizedTotal * box.width * box.height;
  const result: TreeRect[] = [];
  let remaining = { ...box };
  let row: TreeNodeValue[] = [];
  let rowAreas: number[] = [];
  const worst = (areas: number[], side: number) => {
    if (!areas.length || side <= 0) return Number.POSITIVE_INFINITY;
    const sum = areas.reduce((a, b) => a + b, 0);
    const max = Math.max(...areas);
    const min = Math.min(...areas);
    return Math.max(side * side * max / (sum * sum), sum * sum / (side * side * min));
  };
  const emit = () => {
    if (!row.length) return;
    const area = rowAreas.reduce((sum, value) => sum + value, 0);
    const horizontal = remaining.width >= remaining.height;
    if (horizontal) {
      const rowWidth = area / Math.max(1, remaining.height);
      let y = remaining.y;
      row.forEach((item, index) => {
        const itemHeight = rowAreas[index] / Math.max(1, rowWidth);
        result.push({ item, x: remaining.x, y, width: rowWidth, height: itemHeight, depth });
        y += itemHeight;
      });
      remaining = { x: remaining.x + rowWidth, y: remaining.y, width: Math.max(0, remaining.width - rowWidth), height: remaining.height };
    } else {
      const rowHeight = area / Math.max(1, remaining.width);
      let x = remaining.x;
      row.forEach((item, index) => {
        const itemWidth = rowAreas[index] / Math.max(1, rowHeight);
        result.push({ item, x, y: remaining.y, width: itemWidth, height: rowHeight, depth });
        x += itemWidth;
      });
      remaining = { x: remaining.x, y: remaining.y + rowHeight, width: remaining.width, height: Math.max(0, remaining.height - rowHeight) };
    }
    row = [];
    rowAreas = [];
  };
  for (const item of positive) {
    const area = areaFor(item);
    const side = Math.max(1, Math.min(remaining.width, remaining.height));
    if (row.length && worst([...rowAreas, area], side) > worst(rowAreas, side)) emit();
    row.push(item);
    rowAreas.push(area);
  }
  emit();
  return result;
}

function renderTreemap(spec: any, width: number, context: CivicRenderContext): RenderedPlot {
  const style = moneyStyle(context);
  const roots = list<any>(spec.nodes).map(treeValue);
  const height = clamp(width * 0.62, 330, 560);
  const children: Mark[] = [];
  const anchors = new Map<string, Point>();
  const renderLevel = (items: TreeNodeValue[], box: Box, depth: number, baseIndex: number) => {
    const boxes = squarify(items, box, depth);
    boxes.forEach((entry, index) => {
      const inset = depth ? 1.5 : 2;
      const x = entry.x + inset;
      const y = entry.y + inset;
      const w = Math.max(0, entry.width - inset * 2);
      const h = Math.max(0, entry.height - inset * 2);
      const node = entry.item.node;
      const color = text(node.color) || colorAt(baseIndex + index + depth);
      if (entry.item.children.length) {
        children.push(rect(x, y, w, h, 'none', { stroke: color, 'stroke-width': depth === 0 ? '2' : '1', 'data-money-parent': text(node.id) }));
        const header = h >= 35 && w >= 60 ? 18 : 0;
        if (header) children.push(label(x + 5, y + 13, truncate(text(node.label), w - 10, style.tickFontSize), style, { 'font-size': n(style.tickFontSize), 'font-weight': '600' }));
        renderLevel(entry.item.children, { x: x + 2, y: y + header + 2, width: Math.max(0, w - 4), height: Math.max(0, h - header - 4) }, depth + 1, baseIndex + index + 1);
      } else {
        const accessibleLabel = `${text(node.label)} — ${formatValue(entry.item.value, unit(spec))}`;
        children.push(rect(x, y, w, h, color, {
          rx: n(Math.min(style.barRadius, 3)), 'data-money-leaf': text(node.id),
          'aria-label': accessibleLabel, 'data-label': accessibleLabel,
        }));
        const maxWidth = w - 10;
        if (w >= 68 && h >= 30) {
          children.push(label(x + 5, y + 14, truncate(text(node.label), maxWidth, style.tickFontSize), style, { fill: '#ffffff', 'font-size': n(style.tickFontSize), 'font-weight': '600' }));
          if (h >= 48) children.push(label(x + 5, y + 29, truncate(formatValue(entry.item.value, unit(spec)), maxWidth, style.tickFontSize), style, { fill: '#ffffff', 'font-size': n(style.tickFontSize) }));
        }
      }
      anchors.set(text(node.id), { x: x + w / 2, y: y + h / 2 });
    });
  };
  renderLevel(roots, { x: 3, y: 3, width: width - 6, height: height - 6 }, 0, 0);
  // Zero leaves intentionally have zero area and must not claim drawable space.
  // Preserve their authored ids as metadata without painting labels over the hierarchy.
  const zeroLeaves: any[] = [];
  const collectZeros = (items: TreeNodeValue[]) => items.forEach(item => item.children.length ? collectZeros(item.children) : item.value === 0 && zeroLeaves.push(item.node));
  collectZeros(roots);
  addAnnotations(children, spec, width, height, anchors, style);
  const plot = plotSvg(width, height, children, spec.alt);
  if (zeroLeaves.length) plot.props['data-money-zero-leaves'] = zeroLeaves.map(node => text(node.id)).filter(Boolean).join(' ');
  return { plot, height };
}

function renderBullet(spec: any, width: number, context: CivicRenderContext): RenderedPlot {
  const style = moneyStyle(context);
  const items = list<any>(spec.items);
  const rowHeight = 62;
  const height = Math.max(130, items.length * rowHeight + 34);
  const labelWidth = clamp(width * 0.3, 90, 220);
  const left = labelWidth;
  const right = width - 18;
  const maxValue = Math.max(1, ...items.flatMap(item => [number(item.actual), number(item.target), ...list<number>(item.ranges).map(number)]));
  const x = linearScale([0, maxValue], [left, right]);
  const children: Mark[] = [];
  const anchors = new Map<string, Point>();
  items.forEach((item, index) => {
    const cy = 25 + index * rowHeight;
    children.push(label(left - 9, cy + 4, truncate(text(item.label), labelWidth - 15, style.axisFontSize), style, { 'text-anchor': 'end', 'font-size': n(style.axisFontSize), 'font-weight': '600' }));
    const ranges = list<number>(item.ranges).map(number).filter(value => value >= 0).sort((a, b) => b - a);
    ranges.forEach((value, rangeIndex) => {
      const shade = rangeIndex % 3 === 0 ? '#d5d8dc' : rangeIndex % 3 === 1 ? '#e3e5e8' : '#eff0f2';
      children.push(rect(left, cy - 13, Math.max(1, x(value) - left), 26, shade));
    });
    const actual = Math.max(0, number(item.actual));
    if (actual === 0) children.push(line(left, cy - 8, left, cy + 8, style.zero, 2));
    else children.push(rect(left, cy - 7, Math.max(1, x(actual) - left), 14, colorAt(index), { rx: n(style.barRadius), 'data-money-bullet': text(item.id) }));
    if (isFiniteNumber(item.target)) children.push(line(x(item.target), cy - 18, x(item.target), cy + 18, style.text, 3));
    children.push(label(clamp(x(actual) + 6, left + 4, right - 2), cy + 4, truncate(formatValue(actual, unit(spec)), Math.max(0, right - x(actual) - 4), style.tickFontSize), style, { 'font-size': n(style.tickFontSize), 'font-weight': '600' }));
    if (isFiniteNumber(item.target)) children.push(label(x(item.target), cy + 29, `Target ${formatValue(item.target, unit(spec))}`, style, { 'text-anchor': 'middle', fill: style.secondary, 'font-size': n(style.tickFontSize) }));
    anchors.set(text(item.id), { x: x(actual), y: cy });
  });
  addAnnotations(children, spec, width, height, anchors, style);
  return { plot: plotSvg(width, height, children, spec.alt), height };
}

function distribute(values: Array<{ id: string; ideal: number }>, min: number, max: number, gap: number): Map<string, number> {
  if (!values.length) return new Map();
  const sorted = [...values].sort((a, b) => a.ideal - b.ideal || a.id.localeCompare(b.id));
  const positions = sorted.map(item => clamp(item.ideal, min, max));
  for (let index = 1; index < positions.length; index += 1) positions[index] = Math.max(positions[index], positions[index - 1] + gap);
  if (positions[positions.length - 1] > max) {
    positions[positions.length - 1] = max;
    for (let index = positions.length - 2; index >= 0; index -= 1) positions[index] = Math.min(positions[index], positions[index + 1] - gap);
  }
  if (positions[0] < min) {
    positions[0] = min;
    for (let index = 1; index < positions.length; index += 1) positions[index] = Math.max(positions[index], positions[index - 1] + gap);
  }
  // When labels cannot physically fit, evenly pack them rather than oscillating/overlapping.
  if (positions[positions.length - 1] > max && positions.length > 1) {
    positions.forEach((_, index) => { positions[index] = min + (max - min) * index / (positions.length - 1); });
  }
  return new Map(sorted.map((item, index) => [item.id, positions[index]]));
}

function renderSlope(spec: any, width: number, context: CivicRenderContext): RenderedPlot {
  const style = moneyStyle(context);
  const items = list<any>(spec.items);
  const labelGap = width >= 720 ? 30 : 24;
  const height = Math.max(360, items.length * labelGap + 116);
  const top = 48;
  const bottom = height - 34;
  const x1 = width * 0.38;
  const x2 = width * 0.62;
  const domain = extent(items.flatMap(item => [number(item.from), number(item.to)]), true);
  const y = linearScale(domain, [bottom, top]);
  const children: Mark[] = [
    line(x1, top, x1, bottom, style.axisColor, 1.5),
    line(x2, top, x2, bottom, style.axisColor, 1.5),
    label(x1, 20, truncate(text(spec.columns?.from), width * 0.28, 12), style, { 'text-anchor': 'middle', 'font-size': '12', 'font-weight': '600' }),
    label(x2, 20, truncate(text(spec.columns?.to), width * 0.28, 12), style, { 'text-anchor': 'middle', 'font-size': '12', 'font-weight': '600' }),
  ];
  const fromLabels = distribute(items.map(item => ({ id: text(item.id), ideal: y(number(item.from)) })), top + 5, bottom - 5, labelGap);
  const toLabels = distribute(items.map(item => ({ id: text(item.id), ideal: y(number(item.to)) })), top + 5, bottom - 5, labelGap);
  const anchors = new Map<string, Point>();
  items.forEach((item, index) => {
    const id = text(item.id);
    const fromY = y(number(item.from));
    const toY = y(number(item.to));
    const fromLabelY = fromLabels.get(id) ?? fromY;
    const toLabelY = toLabels.get(id) ?? toY;
    const color = text(item.color) || (number(item.to) > number(item.from) ? style.positive : number(item.to) < number(item.from) ? style.negative : style.zero);
    children.push(line(x1, fromY, x2, toY, color, 2, { opacity: '0.82', 'data-money-slope': id }));
    children.push(circle(x1, fromY, 4, color, { stroke: style.canvas, 'stroke-width': '1' }));
    children.push(circle(x2, toY, 4, color, { stroke: style.canvas, 'stroke-width': '1' }));
    children.push(line(x1 - 5, fromY, x1 - 10, fromLabelY, style.gridLineColor, 0.8));
    children.push(line(x2 + 5, toY, x2 + 10, toLabelY, style.gridLineColor, 0.8));
    const leftAvailable = Math.max(40, x1 - 17);
    const rightAvailable = Math.max(40, width - x2 - 17);
    const fromLines = wrapText(`${text(item.label)} · ${formatValue(number(item.from), unit(spec))}`, leftAvailable, style.tickFontSize, 2);
    const toLines = wrapText(`${text(item.label)} · ${formatValue(number(item.to), unit(spec))}`, rightAvailable, style.tickFontSize, 2);
    fromLines.forEach((value, lineIndex) => children.push(label(x1 - 12, fromLabelY + 3 + (lineIndex - (fromLines.length - 1) / 2) * 12, value, style, {
      'text-anchor': 'end', 'font-size': n(style.tickFontSize), fill: style.text,
      'data-money-slope-label': id, 'data-side': 'from', 'data-line': String(lineIndex),
    })));
    toLines.forEach((value, lineIndex) => children.push(label(x2 + 12, toLabelY + 3 + (lineIndex - (toLines.length - 1) / 2) * 12, value, style, {
      'text-anchor': 'start', 'font-size': n(style.tickFontSize), fill: style.text,
      'data-money-slope-label': id, 'data-side': 'to', 'data-line': String(lineIndex),
    })));
    anchors.set(id, { x: x2, y: toY });
    anchors.set(`${id}:from`, { x: x1, y: fromY });
    anchors.set(`${id}:to`, { x: x2, y: toY });
  });
  addAnnotations(children, spec, width, height, anchors, style);
  return { plot: plotSvg(width, height, children, spec.alt), height };
}

function renderAlluvial(spec: any, width: number, context: CivicRenderContext): RenderedPlot {
  const style = moneyStyle(context);
  const stages = list<string>(spec.stages).map(String);
  const nodes = list<any>(spec.nodes);
  const links = list<any>(spec.links);
  const incoming = new Map(nodes.map(node => [text(node.id), [] as any[]]));
  const outgoing = new Map(nodes.map(node => [text(node.id), [] as any[]]));
  links.forEach(edge => {
    incoming.get(text(edge.to))?.push(edge);
    outgoing.get(text(edge.from))?.push(edge);
  });
  const byStage = stages.map(stage => nodes.filter(node => text(node.stage) === stage));
  const maxNodes = Math.max(1, ...byStage.map(group => group.length));
  const labeledLinks = links.filter(edge => text(edge.label) || number(edge.value) === 0).length;
  const height = Math.max(320, maxNodes * 58 + 62, labeledLinks * 20 + 60);
  const top = 39;
  const bottom = height - 20;
  const nodeWidth = 18;
  const stageX = (index: number) => 28 + (width - 56 - nodeWidth) * index / Math.max(1, stages.length - 1);
  const throughput = (node: any) => Math.max(
    sumFinite((incoming.get(text(node.id)) ?? []).map(edge => Math.max(0, number(edge.value)))),
    sumFinite((outgoing.get(text(node.id)) ?? []).map(edge => Math.max(0, number(edge.value)))),
  );
  const scales = byStage.map(group => {
    const total = sumFinite(group.map(throughput));
    const available = bottom - top - Math.max(0, group.length - 1) * 14;
    return total > 0 ? Math.max(0, available - group.length * 4) / total : Number.POSITIVE_INFINITY;
  });
  const flowScale = Math.min(...scales.filter(Number.isFinite), 1);
  const layout = new Map<string, FlowNodeLayout>();
  byStage.forEach((group, stageIndex) => {
    const heights = group.map(node => Math.max(4, throughput(node) * flowScale));
    const used = heights.reduce((sum, value) => sum + value, 0) + Math.max(0, group.length - 1) * 14;
    let y = top + Math.max(0, (bottom - top - used) / 2);
    group.forEach((node, index) => {
      layout.set(text(node.id), {
        id: text(node.id), label: text(node.label), color: text(node.color) || colorAt(index), rank: stageIndex,
        x: stageX(stageIndex), y, width: nodeWidth, height: heights[index], throughput: throughput(node), inputOffset: 0, outputOffset: 0,
      });
      y += heights[index] + 14;
    });
  });
  const children: Mark[] = [];
  stages.forEach((stage, index) => children.push(label(stageX(index) + nodeWidth / 2, 18, truncate(stage, Math.max(40, width / stages.length - 8), style.axisFontSize), style, { 'text-anchor': 'middle', 'font-size': n(style.axisFontSize), 'font-weight': '600' })));
  const linkLabelAnchors: Array<{ id: string; text: string; x: number; y: number }> = [];
  links.forEach((edge, index) => {
    const from = layout.get(text(edge.from));
    const to = layout.get(text(edge.to));
    if (!from || !to) return;
    const edgeWidth = number(edge.value) > 0 ? Math.max(1.25, number(edge.value) * flowScale) : 1;
    const sy = from.y + Math.min(from.height, from.outputOffset + edgeWidth / 2);
    const ty = to.y + Math.min(to.height, to.inputOffset + edgeWidth / 2);
    from.outputOffset += edgeWidth;
    to.inputOffset += edgeWidth;
    const x1 = from.x + nodeWidth;
    const x2 = to.x;
    const bend = (x2 - x1) * 0.45;
    children.push(path(`M ${n(x1)} ${n(sy)} C ${n(x1 + bend)} ${n(sy)}, ${n(x2 - bend)} ${n(ty)}, ${n(x2)} ${n(ty)}`, text(edge.color) || from.color, edgeWidth, 'none', {
      opacity: number(edge.value) > 0 ? '0.48' : '0.8', 'stroke-linecap': 'round', 'data-money-link': `${text(edge.from)}:${text(edge.to)}`,
    }));
    if (text(edge.label) || number(edge.value) === 0) linkLabelAnchors.push({
      id: `edge-${index}`, text: number(edge.value) === 0 ? `${text(edge.label)}${text(edge.label) ? ' · ' : ''}n/a` : `${text(edge.label)} · ${formatValue(number(edge.value), unit(spec))}`,
      x: (x1 + x2) / 2, y: (sy + ty) / 2,
    });
  });
  const labelBounds = { x: 40, y: top, width: Math.max(1, width - 80), height: Math.max(1, bottom - top) };
  const placed = placeLabels(linkLabelAnchors.map(anchor => ({ ...anchor, preferred: 'top' as const })), labelBounds, [], style.tickFontSize);
  placed.forEach(item => {
    children.push(rect(item.x, item.y, item.width, item.height, style.canvas, { opacity: '0.9' }));
    children.push(label(item.x + 4, item.y + item.height - 5, truncate(item.text, item.width - 8, style.tickFontSize), style, { 'font-size': n(style.tickFontSize) }));
  });
  const anchors = new Map<string, Point>();
  for (const node of layout.values()) {
    children.push(rect(node.x, node.y, node.width, node.height, node.color, { rx: n(Math.min(style.barRadius, node.height / 2)), 'data-money-node': node.id }));
    const labelWidth = Math.max(35, width / Math.max(2, stages.length) - 25);
    const anchor = node.rank === stages.length - 1 ? 'end' : 'start';
    const x = node.rank === stages.length - 1 ? node.x - 6 : node.x + nodeWidth + 6;
    children.push(label(x, node.y + node.height / 2 + 3, truncate(node.label, labelWidth, style.tickFontSize), style, { 'text-anchor': anchor, 'font-size': n(style.tickFontSize), 'font-weight': '600' }));
    anchors.set(node.id, { x: node.x + node.width / 2, y: node.y + node.height / 2 });
  }
  addAnnotations(children, spec, width, height, anchors, style);
  return { plot: plotSvg(width, height, children, spec.alt), height };
}

function renderRangePlot(spec: any, width: number, context: CivicRenderContext): RenderedPlot {
  const style = moneyStyle(context);
  const items = list<any>(spec.items);
  const domain = extent(items.flatMap(item => [number(item.min), number(item.max), ...(isFiniteNumber(item.mid) ? [item.mid] : [])]), true);
  if (spec.orientation === 'vertical') {
    const height = 350;
    const left = 54;
    const right = width - 14;
    const top = 24;
    const bottom = height - 58;
    const y = linearScale(domain, [bottom, top]);
    const band = (right - left) / Math.max(1, items.length);
    const children: Mark[] = [];
    addAxes(children, domain, y, left, right, spec, style, 'y');
    const anchors = new Map<string, Point>();
    items.forEach((item, index) => {
      const x = left + band * (index + 0.5);
      const minY = y(number(item.min));
      const maxY = y(number(item.max));
      children.push(line(x, minY, x, maxY, text(item.color) || colorAt(index), 4, { 'stroke-linecap': 'round', 'data-money-range': text(item.id) }));
      children.push(circle(x, minY, 4, style.canvas, { stroke: text(item.color) || colorAt(index), 'stroke-width': '2' }));
      children.push(circle(x, maxY, 4, style.canvas, { stroke: text(item.color) || colorAt(index), 'stroke-width': '2' }));
      if (isFiniteNumber(item.mid)) children.push(circle(x, y(item.mid), 5, text(item.color) || colorAt(index)));
      children.push(label(x, bottom + 20 + index % 2 * 13, truncate(text(item.label), band - 5, style.tickFontSize), style, { 'text-anchor': 'middle', fill: style.secondary, 'font-size': n(style.tickFontSize) }));
      anchors.set(text(item.id), { x, y: isFiniteNumber(item.mid) ? y(item.mid) : (minY + maxY) / 2 });
    });
    addAnnotations(children, spec, width, height, anchors, style);
    return { plot: plotSvg(width, height, children, spec.alt), height };
  }
  const rowHeight = 40;
  const height = Math.max(130, items.length * rowHeight + 36);
  const labelWidth = clamp(width * 0.3, 90, 220);
  const left = labelWidth;
  const right = width - 18;
  const x = linearScale(domain, [left, right]);
  const children: Mark[] = [];
  addAxes(children, domain, x, 14, height - 24, spec, style);
  const anchors = new Map<string, Point>();
  items.forEach((item, index) => {
    const cy = 22 + index * rowHeight;
    const minX = x(number(item.min));
    const maxX = x(number(item.max));
    const color = text(item.color) || colorAt(index);
    children.push(label(left - 9, cy + 4, truncate(text(item.label), labelWidth - 15, style.axisFontSize), style, { 'text-anchor': 'end', 'font-size': n(style.axisFontSize) }));
    children.push(line(minX, cy, maxX, cy, color, 4, { 'stroke-linecap': 'round', 'data-money-range': text(item.id) }));
    children.push(circle(minX, cy, 4, style.canvas, { stroke: color, 'stroke-width': '2' }));
    children.push(circle(maxX, cy, 4, style.canvas, { stroke: color, 'stroke-width': '2' }));
    if (isFiniteNumber(item.mid)) children.push(circle(x(item.mid), cy, 5, color));
    anchors.set(text(item.id), { x: isFiniteNumber(item.mid) ? x(item.mid) : (minX + maxX) / 2, y: cy });
  });
  addAnnotations(children, spec, width, height, anchors, style);
  return { plot: plotSvg(width, height, children, spec.alt), height };
}

function renderLine(spec: any, width: number, context: CivicRenderContext): RenderedPlot {
  const style = moneyStyle(context);
  const periods = list<string>(spec.periods).map(String);
  const series = list<any>(spec.series);
  const legend = autoLegend(series);
  const height = 360;
  const left = 58;
  const right = width - 18;
  const top = 24;
  const bottom = height - 56;
  const values = series.flatMap(entry => list<number>(entry.values).map(number));
  const domain = extent(values, true);
  const y = linearScale(domain, [bottom, top]);
  const x = (index: number) => periods.length <= 1 ? (left + right) / 2 : left + (right - left) * index / (periods.length - 1);
  const children: Mark[] = [];
  addAxes(children, domain, y, left, right, spec, style, 'y');
  const points = series.flatMap((entry, seriesIndex) => periods.map((period, index) => ({
    id: `${text(entry.id)}:${index}`,
    x: x(index),
    y: y(number(entry.values?.[index])),
    seriesIndex,
    periodIndex: index,
    value: number(entry.values?.[index]),
    color: text(entry.color) || colorAt(seriesIndex),
  })));
  // Coincident values are deterministically relaxed within a narrow neighborhood,
  // keeping every mark visible while preserving its ordinal period and value.
  const relaxed = avoidPointCollisions(points, 4, { x: left - 5, y: top - 5, width: right - left + 10, height: bottom - top + 10 }, 260, 0);
  const pointMap = new Map(relaxed.map(point => [point.id, point]));
  series.forEach((entry, seriesIndex) => {
    const seriesPoints = periods.map((_, index) => pointMap.get(`${text(entry.id)}:${index}`)).filter(Boolean) as typeof relaxed;
    const d = seriesPoints.map((point, index) => `${index ? 'L' : 'M'} ${n(point.x)} ${n(point.y)}`).join(' ');
    const color = text(entry.color) || colorAt(seriesIndex);
    children.push(path(d, color, 2.25, 'none', { 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'data-money-series': text(entry.id) }));
    seriesPoints.forEach(point => children.push(circle(point.x, point.y, 4, color, { stroke: style.canvas, 'stroke-width': '1.5', 'data-money-point': point.id })));
  });
  const periodWidth = (right - left) / Math.max(1, periods.length);
  periods.forEach((period, index) => {
    children.push(line(x(index), bottom, x(index), bottom + 5, style.axisColor, 1));
    children.push(label(x(index), bottom + 19 + index % 2 * 13, truncate(period, periodWidth - 4, style.tickFontSize), style, { 'text-anchor': 'middle', fill: style.secondary, 'font-size': n(style.tickFontSize) }));
  });
  const anchors = new Map<string, Point>();
  relaxed.forEach(point => {
    anchors.set(point.id, point);
    anchors.set(`${text(series[point.seriesIndex]?.id)}:${periods[point.periodIndex]}`, point);
  });
  addAnnotations(children, spec, width, height, anchors, style);
  return { plot: plotSvg(width, height, children, spec.alt), height, legend };
}

function renderStackedArea(spec: any, width: number, context: CivicRenderContext): RenderedPlot {
  const style = moneyStyle(context);
  const periods = list<string>(spec.periods).map(String);
  const series = list<any>(spec.series);
  const legend = autoLegend(series);
  const height = 360;
  const left = 58;
  const right = width - 18;
  const top = 24;
  const bottom = height - 56;
  const totals = periods.map((_, periodIndex) => sumFinite(series.map(entry => Math.max(0, number(entry.values?.[periodIndex])))));
  const domain = extent(totals, true);
  const y = linearScale(domain, [bottom, top]);
  const x = (index: number) => periods.length <= 1 ? (left + right) / 2 : left + (right - left) * index / (periods.length - 1);
  const children: Mark[] = [];
  addAxes(children, domain, y, left, right, spec, style, 'y');
  const cumulative = periods.map(() => 0);
  const anchors = new Map<string, Point>();
  series.forEach((entry, seriesIndex) => {
    const lower = cumulative.map((value, index) => ({ x: x(index), y: y(value) }));
    const upper = cumulative.map((value, index) => {
      cumulative[index] = addFinite(value, Math.max(0, number(entry.values?.[index])));
      return { x: x(index), y: y(cumulative[index]) };
    });
    const color = text(entry.color) || colorAt(seriesIndex);
    if (periods.length === 1) {
      const columnWidth = clamp(width * 0.28, 45, 130);
      const y0 = lower[0]?.y ?? bottom;
      const y1 = upper[0]?.y ?? bottom;
      children.push(rect(x(0) - columnWidth / 2, y1, columnWidth, Math.max(1, y0 - y1), color, { 'data-money-area': text(entry.id) }));
    } else {
      const polygon = [...upper, ...lower.slice().reverse()].map(point => `${n(point.x)},${n(point.y)}`).join(' ');
      children.push(mark('polygon', { points: polygon, fill: color, opacity: '0.78', stroke: color, 'stroke-width': '1', 'data-money-area': text(entry.id) }));
    }
    upper.forEach((point, periodIndex) => anchors.set(`${text(entry.id)}:${periods[periodIndex]}`, point));
  });
  const periodWidth = periods.length <= 1 ? right - left : (right - left) / periods.length;
  periods.forEach((period, index) => {
    children.push(line(x(index), bottom, x(index), bottom + 5, style.axisColor, 1));
    children.push(label(x(index), bottom + 19 + index % 2 * 13, truncate(period, periodWidth - 4, style.tickFontSize), style, { 'text-anchor': 'middle', fill: style.secondary, 'font-size': n(style.tickFontSize) }));
    children.push(label(x(index), y(totals[index]) - 7, truncate(formatValue(totals[index], unit(spec)), periodWidth - 4, style.tickFontSize), style, { 'text-anchor': 'middle', 'font-size': n(style.tickFontSize), 'font-weight': '600' }));
  });
  addAnnotations(children, spec, width, height, anchors, style);
  return { plot: plotSvg(width, height, children, spec.alt), height, legend };
}

interface Bin {
  start: number;
  end: number;
  count: number;
}

function niceStep(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  const fraction = raw / power;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

function histogramBins(spec: any): Bin[] {
  if (Array.isArray(spec.bins)) return spec.bins.map((bin: any) => ({ start: number(bin.start), end: number(bin.end), count: Math.max(0, Math.round(number(bin.count))) }));
  const values = list<number>(spec.values).filter(isFiniteNumber);
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const makeBoundedBins = (binCount = 40): Bin[] => {
    const boundaries = Array.from({ length: binCount + 1 }, (_, index) => {
      const ratio = index / binCount;
      return min * (1 - ratio) + max * ratio;
    });
    const generated = Array.from({ length: binCount }, (_, index) => ({ start: boundaries[index], end: boundaries[index + 1], count: 0 }));
    const magnitude = Math.max(1, Math.abs(min), Math.abs(max));
    const normalizedMin = min / magnitude;
    const normalizedSpan = max / magnitude - normalizedMin || 1;
    values.forEach(value => {
      const index = clamp(Math.floor(((value / magnitude - normalizedMin) / normalizedSpan) * binCount), 0, binCount - 1);
      generated[index].count += 1;
    });
    return generated;
  };
  if (!Number.isFinite(max - min)) return makeBoundedBins();
  let step = isFiniteNumber(spec.binWidth) && spec.binWidth > 0 ? spec.binWidth : niceStep((max - min) / 5);
  if (!Number.isFinite(min / step) || !Number.isFinite(max / step)) return makeBoundedBins();
  let start = Math.floor(min / step) * step;
  let count = Math.max(1, Math.ceil((max - start) / step));
  if (max === start + count * step) count += 1;
  // Guard against hostile/extreme ranges while preserving a deterministic linear binning.
  if (count > 80) {
    step = niceStep((max - min) / 40);
    if (!Number.isFinite(min / step) || !Number.isFinite(max / step)) return makeBoundedBins();
    start = Math.floor(min / step) * step;
    count = Math.max(1, Math.ceil((max - start) / step));
    if (max === start + count * step) count += 1;
  }
  if (!Number.isFinite(start) || !Number.isFinite(count) || count > 1000) return makeBoundedBins();
  if (min === max) {
    start = min - step / 2;
    count = 1;
  }
  const bins = Array.from({ length: count }, (_, index) => ({ start: start + index * step, end: start + (index + 1) * step, count: 0 }));
  values.forEach(value => {
    const index = clamp(Math.floor((value - start) / step), 0, bins.length - 1);
    bins[index].count += 1;
  });
  return bins;
}

function renderHistogram(spec: any, width: number, context: CivicRenderContext): RenderedPlot {
  const style = moneyStyle(context);
  const bins = histogramBins(spec);
  const height = 350;
  const left = 48;
  const right = width - 16;
  const top = 24;
  const bottom = height - 58;
  const maxCount = Math.max(1, ...bins.map(bin => bin.count));
  const y = linearScale([0, maxCount], [bottom, top]);
  const x = linearScale(bins.length ? [bins[0].start, bins[bins.length - 1].end] : [0, 1], [left, right]);
  const children: Mark[] = [];
  // Counts are always count-formatted, regardless of the observation unit.
  addAxes(children, [0, maxCount], y, left, right, { unit: 'count' }, style, 'y');
  const anchors = new Map<string, Point>();
  bins.forEach((bin, index) => {
    const x0 = x(bin.start);
    const x1 = x(bin.end);
    const y1 = y(bin.count);
    if (bin.count > 0) children.push(rect(x0, y1, Math.max(1, x1 - x0), Math.max(1, bottom - y1), colorAt(index), {
      stroke: style.canvas, 'stroke-width': '0.5', 'data-money-bin': String(index),
    }));
    else children.push(line(x0, bottom, x1, bottom, style.zero, 1));
    if (x1 - x0 >= 18 && bin.count > 0) children.push(label((x0 + x1) / 2, y1 - 6, String(bin.count), style, { 'text-anchor': 'middle', 'font-size': n(style.tickFontSize), 'font-weight': '600' }));
    children.push(label(x0, bottom + 17 + index % 2 * 13, truncate(formatValue(bin.start, unit(spec)), Math.max(12, x1 - x0 - 2), style.tickFontSize), style, { 'text-anchor': 'middle', fill: style.secondary, 'font-size': n(style.tickFontSize) }));
    anchors.set(String(index), { x: (x0 + x1) / 2, y: y1 });
  });
  if (bins.length) children.push(label(right, bottom + 17 + bins.length % 2 * 13, formatValue(bins[bins.length - 1].end, unit(spec)), style, { 'text-anchor': 'middle', fill: style.secondary, 'font-size': n(style.tickFontSize) }));
  addAnnotations(children, spec, width, height, anchors, style);
  return { plot: plotSvg(width, height, children, spec.alt), height };
}

function renderDotPlot(spec: any, width: number, context: CivicRenderContext): RenderedPlot {
  const style = moneyStyle(context);
  const items = sortedItems(spec);
  const domain = extent(items.map(item => number(item.value)), true);
  if (spec.orientation === 'vertical') {
    const height = 340;
    const left = 54;
    const right = width - 14;
    const top = 24;
    const bottom = height - 56;
    const y = linearScale(domain, [bottom, top]);
    const band = (right - left) / Math.max(1, items.length);
    const children: Mark[] = [];
    addAxes(children, domain, y, left, right, spec, style, 'y');
    const anchors = new Map<string, Point>();
    items.forEach((item, index) => {
      const x = left + band * (index + 0.5);
      const valueY = y(number(item.value));
      children.push(line(x, bottom, x, valueY, style.gridLineColor, 1));
      children.push(circle(x, valueY, 6, text(item.color) || colorAt(index), { stroke: style.canvas, 'stroke-width': '1.5', 'data-money-dot': text(item.id) }));
      children.push(label(x, clamp(valueY - 9, top + 5, bottom - 3), truncate(formatValue(number(item.value), unit(spec)), band - 4, style.tickFontSize), style, { 'text-anchor': 'middle', 'font-size': n(style.tickFontSize), 'font-weight': '600' }));
      children.push(label(x, bottom + 19 + index % 2 * 13, truncate(text(item.label), band - 4, style.tickFontSize), style, { 'text-anchor': 'middle', fill: style.secondary, 'font-size': n(style.tickFontSize) }));
      anchors.set(text(item.id), { x, y: valueY });
    });
    addAnnotations(children, spec, width, height, anchors, style);
    return { plot: plotSvg(width, height, children, spec.alt), height };
  }
  const rowHeight = 37;
  const height = Math.max(130, items.length * rowHeight + 36);
  const labelWidth = clamp(width * 0.31, 90, 225);
  const left = labelWidth;
  const right = width - 42;
  const x = linearScale(domain, [left, right]);
  const children: Mark[] = [];
  addAxes(children, domain, x, 14, height - 24, spec, style);
  const anchors = new Map<string, Point>();
  items.forEach((item, index) => {
    const cy = 22 + index * rowHeight;
    const dotX = x(number(item.value));
    children.push(label(left - 9, cy + 4, truncate(text(item.label), labelWidth - 15, style.axisFontSize), style, { 'text-anchor': 'end', 'font-size': n(style.axisFontSize) }));
    children.push(line(left, cy, dotX, cy, style.gridLineColor, 1));
    children.push(circle(dotX, cy, 6, text(item.color) || colorAt(index), { stroke: style.canvas, 'stroke-width': '1.5', 'data-money-dot': text(item.id) }));
    children.push(label(clamp(dotX + 9, left + 3, width - 3), cy + 4, truncate(formatValue(number(item.value), unit(spec)), Math.max(0, width - dotX - 10), style.tickFontSize), style, { 'font-size': n(style.tickFontSize), 'font-weight': '600' }));
    anchors.set(text(item.id), { x: dotX, y: cy });
  });
  addAnnotations(children, spec, width, height, anchors, style);
  return { plot: plotSvg(width, height, children, spec.alt), height };
}

function resolveAnnotationPoint(annotation: any, anchors: Map<string, Point>, width: number, height: number): Point | undefined {
  const at = annotation?.at;
  if (!at) return undefined;
  const candidates = [
    at.series != null && at.index != null ? `${String(at.series)}:${String(at.index)}` : '',
    at.series != null && at.x != null ? `${String(at.series)}:${String(at.x)}` : '',
    at.x != null ? String(at.x) : '',
  ].filter(Boolean);
  for (const key of candidates) {
    const point = anchors.get(key);
    if (point) return point;
  }
  if (isFiniteNumber(at.x) || isFiniteNumber(at.y)) {
    return {
      x: isFiniteNumber(at.x) ? clamp(at.x, 0, width) : width / 2,
      y: isFiniteNumber(at.y) ? clamp(at.y, 0, height) : height / 2,
    };
  }
  return undefined;
}

function addAnnotations(children: Mark[], spec: any, width: number, height: number, anchors: Map<string, Point>, style: MoneyStyle): void {
  const annotations = list<any>(spec.annotations);
  const pointAnnotations = annotations.map((annotation, index) => ({ annotation, index, point: resolveAnnotationPoint(annotation, anchors, width, height) })).filter(entry => entry.point) as Array<{ annotation: any; index: number; point: Point }>;
  const tones: Record<string, string> = { up: style.positive, down: style.negative, alert: style.negative, neutral: style.text };
  const placed = placeLabels(pointAnnotations.map(({ annotation, index, point }) => ({
    id: `annotation-${index}`,
    text: text(annotation.text) || (annotation.kind === 'peak' ? 'Peak' : ''),
    x: point.x,
    y: point.y,
    preferred: 'top' as const,
  })).filter(anchor => anchor.text), { x: 3, y: 3, width: Math.max(1, width - 6), height: Math.max(1, height - 6) }, [], style.tickFontSize);
  const byId = new Map(pointAnnotations.map(entry => [`annotation-${entry.index}`, entry.annotation]));
  placed.forEach(item => {
    const annotation = byId.get(item.id);
    const color = tones[text(annotation?.tone)] ?? style.text;
    if (annotation?.kind !== 'label') children.push(line(item.anchorX, item.anchorY, item.x + item.width / 2, item.y + item.height / 2, color, 1));
    children.push(rect(item.x, item.y, item.width, item.height, style.canvas, { stroke: color, 'stroke-width': '1', rx: '3', opacity: '0.96' }));
    children.push(label(item.x + 4, item.y + item.height - 5, truncate(item.text, item.width - 8, style.tickFontSize), style, { fill: color, 'font-size': n(style.tickFontSize), 'font-weight': '600' }));
  });
}
