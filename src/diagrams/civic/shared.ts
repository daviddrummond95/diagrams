import type {
  CivicBase,
  LegendItem,
  RenderOptions,
  SatoriElement,
  ThemeConfig,
  Unit,
  UnitFormat,
} from '../../types.js';

export interface CivicRenderContext {
  width: number;
  padding: number;
  theme: ThemeConfig;
  options: RenderOptions;
}

export interface CivicDiagramResult {
  tree: SatoriElement;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Box extends Point {
  width: number;
  height: number;
}

export interface LabelAnchor extends Point {
  id: string;
  text: string;
  preferred?: 'top' | 'right' | 'bottom' | 'left';
}

export interface PlacedLabel extends Box {
  id: string;
  text: string;
  anchorX: number;
  anchorY: number;
}

export const CIVIC_COLORS = [
  '#3d5a45',
  '#9b2335',
  '#2f6287',
  '#b66a2b',
  '#75619b',
  '#51806f',
  '#9a7840',
  '#5f6470',
] as const;

export const CIVIC_ICON_STARTER = [
  'civic:courthouse',
  'civic:sheriff',
  'civic:roads',
  'civic:fire',
  'civic:school',
  'civic:housing',
] as const;

export const CIVIC_ICON_ISOTYPE = [
  'civic:bed',
  'civic:camera',
  'civic:demolition',
  'civic:lot',
] as const;

export function formatValue(
  value: number,
  spec: Unit | UnitFormat | undefined,
): string {
  const options: UnitFormat = typeof spec === 'string'
    ? { unit: spec }
    : (spec ?? { unit: 'count' });
  const unit = options.unit;
  const compact = options.compact ?? (unit !== 'percent');
  const digits = options.digits ?? (compact ? 1 : 0);
  const scaled = unit === 'percent' && options.scale === 'ratio' ? value * 100 : value;
  const sign = options.sign ?? 'auto';
  const negative = scaled < 0;
  const absolute = Math.abs(scaled);

  let body: string;
  if (unit === 'percent') {
    body = `${trimFixed(absolute, digits)}%`;
  } else if (compact) {
    const [divisor, suffix] = absolute >= 1e9
      ? [1e9, 'B']
      : absolute >= 1e6
        ? [1e6, 'M']
        : absolute >= 1e3
          ? [1e3, 'k']
          : [1, ''];
    body = `${trimFixed(absolute / divisor, divisor === 1 ? 0 : digits)}${suffix}`;
  } else {
    body = absolute.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    });
  }

  if (unit === 'usd') body = `$${body}`;
  const prefix = sign === 'always' ? (negative ? '-' : '+') : sign === 'never' ? '' : negative ? '-' : '';
  return `${prefix}${body}`;
}

function trimFixed(value: number, digits: number): string {
  if (!Number.isFinite(value)) return 'n/a';
  const fixed = value.toFixed(Math.max(0, digits));
  return fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
}

export function colorAt(index: number): string {
  return CIVIC_COLORS[((index % CIVIC_COLORS.length) + CIVIC_COLORS.length) % CIVIC_COLORS.length];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function finite(value: unknown, fallback = 0): number {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function extent(values: number[], includeZero = false): [number, number] {
  const safe = values.filter(Number.isFinite);
  if (includeZero) safe.push(0);
  if (safe.length === 0) return [0, 1];
  let min = Math.min(...safe);
  let max = Math.max(...safe);
  if (min === max) {
    const delta = Math.abs(min || 1) * 0.1;
    min -= delta;
    max += delta;
  }
  return [min, max];
}

export function linearScale(domain: [number, number], range: [number, number]): (value: number) => number {
  const span = domain[1] - domain[0] || 1;
  const rangeSpan = range[1] - range[0];
  return value => range[0] + ((value - domain[0]) / span) * rangeSpan;
}

export function boxesOverlap(a: Box, b: Box, gap = 0): boolean {
  return a.x < b.x + b.width + gap
    && a.x + a.width + gap > b.x
    && a.y < b.y + b.height + gap
    && a.y + a.height + gap > b.y;
}

/**
 * Deterministic point relaxation used by maps, networks, and swarms. Stable IDs
 * break exact-coordinate ties, and every iteration clamps marks back to bounds.
 */
export function avoidPointCollisions<T extends Point & { id?: string }>(
  input: T[],
  radius: number | ((point: T) => number),
  bounds: Box,
  iterations = 80,
  attraction = 0.08,
): T[] {
  const origin = input.map(point => ({ x: point.x, y: point.y }));
  const points = input.map(point => ({ ...point }));
  const getRadius = (point: T): number => typeof radius === 'function' ? radius(point) : radius;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const a = points[i] as T;
        const b = points[j] as T;
        const minDistance = getRadius(a) + getRadius(b) + 2;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let distance = Math.hypot(dx, dy);
        if (distance >= minDistance) continue;
        if (distance < 0.001) {
          const key = `${a.id ?? i}:${b.id ?? j}`;
          const angle = hashString(key) * Math.PI * 2;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distance = 1;
        }
        const push = (minDistance - distance) / 2;
        const ux = dx / distance;
        const uy = dy / distance;
        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;
      }
    }

    for (let i = 0; i < points.length; i += 1) {
      const point = points[i] as T;
      const pointRadius = getRadius(point);
      point.x += (origin[i].x - point.x) * attraction;
      point.y += (origin[i].y - point.y) * attraction;
      point.x = clamp(point.x, bounds.x + pointRadius, bounds.x + bounds.width - pointRadius);
      point.y = clamp(point.y, bounds.y + pointRadius, bounds.y + bounds.height - pointRadius);
    }
  }
  return points as T[];
}

/** Greedy multi-candidate labels with a final vertical sweep for dense cases. */
export function placeLabels(
  anchors: LabelAnchor[],
  bounds: Box,
  occupied: Box[] = [],
  fontSize = 11,
): PlacedLabel[] {
  const placed: PlacedLabel[] = [];
  const sorted = [...anchors].sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
  for (const anchor of sorted) {
    const width = clamp(anchor.text.length * fontSize * 0.58 + 8, 28, Math.min(190, bounds.width));
    const height = fontSize + 8;
    const candidates = labelCandidates(anchor, width, height);
    let choice = candidates.find(candidate => inside(candidate, bounds)
      && !occupied.some(box => boxesOverlap(candidate, box, 2))
      && !placed.some(box => boxesOverlap(candidate, box, 2)));
    if (!choice) {
      choice = candidates
        .map(candidate => ({ candidate: clampBox(candidate, bounds), score: overlapArea(candidate, [...occupied, ...placed]) }))
        .sort((a, b) => a.score - b.score || a.candidate.y - b.candidate.y)[0].candidate;
    }
    placed.push({ ...choice, id: anchor.id, text: anchor.text, anchorX: anchor.x, anchorY: anchor.y });
  }

  // A dense candidate set can still choose a least-overlap position. Repack only
  // those labels on a deterministic grid; nearby placements win.
  const packed: PlacedLabel[] = [];
  for (const current of placed) {
    current.x = clamp(current.x, bounds.x, bounds.x + bounds.width - current.width);
    current.y = clamp(current.y, bounds.y, bounds.y + bounds.height - current.height);
    if (packed.some(other => boxesOverlap(current, other, 2))) {
      const alternatives: Array<{ x: number; y: number; distance: number }> = [];
      const yStep = current.height + 3;
      for (let y = bounds.y; y <= bounds.y + bounds.height - current.height; y += yStep) {
        for (let x = bounds.x; x <= bounds.x + bounds.width - current.width; x += 8) {
          const candidate = { ...current, x, y };
          if (packed.some(other => boxesOverlap(candidate, other, 2)) || occupied.some(other => boxesOverlap(candidate, other, 2))) continue;
          alternatives.push({ x, y, distance: (x - current.anchorX) ** 2 + (y - current.anchorY) ** 2 });
        }
      }
      alternatives.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
      if (alternatives.length) {
        current.x = alternatives[0].x;
        current.y = alternatives[0].y;
      }
    }
    packed.push(current);
  }
  return packed;
}

function labelCandidates(anchor: LabelAnchor, width: number, height: number): Box[] {
  const offset = 8;
  const candidates: Record<string, Box> = {
    top: { x: anchor.x - width / 2, y: anchor.y - height - offset, width, height },
    right: { x: anchor.x + offset, y: anchor.y - height / 2, width, height },
    bottom: { x: anchor.x - width / 2, y: anchor.y + offset, width, height },
    left: { x: anchor.x - width - offset, y: anchor.y - height / 2, width, height },
  };
  const order = [anchor.preferred ?? 'right', 'top', 'right', 'bottom', 'left'];
  return [...new Set(order)].map(key => candidates[key]);
}

function inside(inner: Box, outer: Box): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function clampBox(box: Box, bounds: Box): Box {
  return {
    ...box,
    x: clamp(box.x, bounds.x, bounds.x + bounds.width - box.width),
    y: clamp(box.y, bounds.y, bounds.y + bounds.height - box.height),
  };
}

function overlapArea(box: Box, others: Box[]): number {
  return others.reduce((total, other) => {
    const width = Math.max(0, Math.min(box.x + box.width, other.x + other.width) - Math.max(box.x, other.x));
    const height = Math.max(0, Math.min(box.y + box.height, other.y + other.height) - Math.max(box.y, other.y));
    return total + width * height;
  }, 0);
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

export function svgElement(
  width: number,
  height: number,
  children: SatoriElement[],
  alt?: string,
): SatoriElement {
  return {
    type: 'svg',
    props: {
      xmlns: 'http://www.w3.org/2000/svg',
      width: String(width),
      height: String(height),
      viewBox: `0 0 ${width} ${height}`,
      role: 'img',
      'aria-label': alt,
      style: { display: 'flex', width, height },
      children,
    },
  };
}

export function svgText(
  x: number,
  y: number,
  text: string,
  options: Record<string, unknown> = {},
): SatoriElement {
  return {
    type: 'text',
    props: {
      x: String(x),
      y: String(y),
      ...options,
      children: text,
    },
  };
}

export function buildCivicFrame(
  spec: CivicBase,
  plot: SatoriElement,
  plotHeight: number,
  context: CivicRenderContext,
  autoLegend: LegendItem[] = [],
): CivicDiagramResult {
  const { width, padding, theme, options } = context;
  const contentWidth = width - padding * 2;
  const textColor = theme.node.textColor;
  const secondary = theme.node.textColorSecondary;
  const blocks: SatoriElement[] = [];
  let height = padding;

  const addText = (text: string | undefined, fontSize: number, style: Record<string, unknown> = {}) => {
    if (!text) return;
    const lineHeight = Math.ceil(fontSize * 1.35);
    const lineCount = Math.max(1, Math.ceil(text.length / Math.max(12, Math.floor(contentWidth / (fontSize * 0.58)))));
    const blockHeight = lineHeight * lineCount;
    blocks.push({
      type: 'div',
      props: {
        style: {
          display: 'flex',
          width: contentWidth,
          minHeight: blockHeight,
          fontSize,
          lineHeight: 1.25,
          color: textColor,
          fontFamily: theme.fontFamily,
          ...style,
        },
        children: text,
      },
    });
    height += blockHeight + finite(style.marginTop, 0) + finite(style.marginBottom, 0);
  };

  if (options.showTitle !== false) addText(spec.title, 20, { fontWeight: 600, marginBottom: 4 });
  addText(spec.caption, theme.node.descriptionFontSize || 13, { color: secondary, marginBottom: 12 });

  const stats = spec.stats?.length ? spec.stats : spec.stat ? [spec.stat] : [];
  if (stats.length) {
    const statHeight = 68;
    blocks.push({
      type: 'div',
      props: {
        style: { display: 'flex', width: contentWidth, height: statHeight, marginBottom: 12 },
        children: stats.map((stat, index) => ({
          type: stat.href ? 'a' : 'div',
          props: {
            href: stat.href,
            style: {
              display: 'flex', flexDirection: 'column', flex: 1, padding: '8px 12px',
              borderLeft: index === 0 ? `2px solid ${colorAt(index)}` : `1px solid ${theme.group.border}`,
              color: textColor, textDecoration: stat.href ? 'underline' : 'none',
            },
            children: [
              { type: 'div', props: { style: { display: 'flex', fontSize: 25, fontWeight: 600 }, children: stat.display ?? (stat.value == null ? '' : formatValue(stat.value, stat.unit ?? spec.unit)) } },
              { type: 'div', props: { style: { display: 'flex', fontSize: 11, color: secondary }, children: stat.label ?? '' } },
            ],
          },
        })),
      },
    });
    height += statHeight + 12;
  }

  blocks.push({
    type: 'div',
    props: {
      style: { display: 'flex', width: contentWidth, height: plotHeight },
      children: plot,
    },
  });
  height += plotHeight;

  const legendItems = resolveLegend(spec.legend, autoLegend);
  if (legendItems.length) {
    const rows = Math.ceil(legendItems.length / 4);
    const legendHeight = rows * 25 + 12;
    blocks.push({
      type: 'div',
      props: {
        style: { display: 'flex', flexWrap: 'wrap', width: contentWidth, minHeight: legendHeight, paddingTop: 10, gap: 14, color: secondary, fontSize: 11 },
        children: legendItems.map((item, index) => ({
          type: 'div',
          props: {
            style: { display: 'flex', alignItems: 'center', gap: 5, minWidth: 100 },
            children: [
              { type: 'div', props: { style: legendSwatchStyle(item, index), children: '' } },
              { type: 'div', props: { style: { display: 'flex' }, children: item.label } },
            ],
          },
        })),
      },
    });
    height += legendHeight;
  }

  const sources = spec.source ? (Array.isArray(spec.source) ? spec.source : [spec.source]) : [];
  if (sources.length) {
    const sourceHeight = Math.ceil((theme.node.descriptionFontSize || 12) * 1.35) + 4;
    blocks.push({
      type: 'div',
      props: {
        style: { display: 'flex', flexWrap: 'wrap', width: contentWidth, minHeight: sourceHeight, marginTop: 8, fontSize: 11, color: secondary, gap: 4 },
        children: [
          { type: 'div', props: { style: { display: 'flex' }, children: 'Source:' } },
          ...sources.flatMap((source, index) => [
            ...(index ? [{ type: 'div', props: { style: { display: 'flex' }, children: ' · ' } } as SatoriElement] : []),
            { type: source.href ? 'a' : 'div', props: { href: source.href, style: { display: 'flex', color: secondary, textDecoration: source.href ? 'underline' : 'none' }, children: source.label } } as SatoriElement,
          ]),
        ],
      },
    });
    height += sourceHeight + 8;
  }
  if (spec.footnote) addText(spec.footnote, 10, { color: secondary, marginTop: 4 });
  height += padding;

  const background = options.background === 'transparent' ? undefined : (options.background ?? theme.canvas.background);
  return {
    width,
    height,
    tree: {
      type: 'div',
      props: {
        role: 'img',
        'aria-label': spec.alt ?? spec.title,
        style: {
          display: 'flex', flexDirection: 'column', width, height, padding,
          backgroundColor: background, color: textColor, fontFamily: theme.fontFamily,
        },
        children: blocks,
      },
    },
  };
}

export function resolveLegend(legend: CivicBase['legend'], auto: LegendItem[]): LegendItem[] {
  if (legend === false || legend == null) return [];
  if (legend === true) return auto;
  if (Array.isArray(legend)) return legend;
  if (legend.items?.length) return legend.items;
  return legend.auto ? auto : [];
}

function legendSwatchStyle(item: LegendItem, index: number): Record<string, unknown> {
  const color = item.color ?? colorAt(index);
  const base: Record<string, unknown> = {
    display: 'flex', width: 13, height: 13, border: `1px solid ${color}`,
    backgroundColor: item.pattern === 'hatch' || item.pattern === 'stripes' ? 'transparent' : color,
  };
  if (item.pattern === 'dots') base.borderRadius = 7;
  if (item.pattern === 'hatch') base.borderLeftWidth = 4;
  if (item.pattern === 'stripes') base.borderTopWidth = 4;
  return base;
}
