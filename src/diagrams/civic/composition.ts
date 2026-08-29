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
} from './shared.js';

export const COMPOSITION_TYPES = [
  'waffle',
  'isotype',
  'small-multiples',
  'scorecard',
  'beeswarm',
  'connected-dot',
  'data-table',
  'category-mix',
  'per-body-count',
] as const;

export function buildCompositionDiagram(spec: any, context: CivicRenderContext): CivicDiagramResult {
  switch (spec.type) {
    case 'waffle': return buildWaffle(spec, context);
    case 'isotype': return buildIsotype(spec, context);
    case 'small-multiples': return buildSmallMultiples(spec, context);
    case 'scorecard': return buildScorecard(spec, context);
    case 'beeswarm': return buildBeeswarm(spec, context);
    case 'connected-dot': return buildConnectedDot(spec, context);
    case 'data-table': return buildDataTable(spec, context);
    case 'category-mix': return buildCategoryMix(spec, context);
    case 'per-body-count': return buildPerBodyCount(spec, context);
    default: throw new Error(`Unsupported composition diagram type: ${String(spec.type)}`);
  }
}

function buildWaffle(spec: any, context: CivicRenderContext): CivicDiagramResult {
  const width = innerWidth(context);
  const categories = Array.isArray(spec.categories) ? spec.categories : [];
  const columns = Math.max(1, Math.floor(Number(spec.columns ?? 10)));
  const filled = categories.reduce((sum: number, category: any) => sum + Math.max(0, Math.floor(Number(category.value) || 0)), 0);
  const capacity = spec.mode === 'percent' ? Math.max(100, filled) : filled;
  if (capacity <= 0) return framedEmpty(spec, context, 'No cells');
  const rows = Math.ceil(capacity / columns);
  const gap = columns > width / 4 ? 0.5 : 2;
  const cell = clamp((width - gap * Math.max(0, columns - 1)) / columns, 1, 22);
  const gridWidth = columns * cell + (columns - 1) * gap;
  const startX = Math.max(0, (width - gridWidth) / 2);
  const height = rows * (cell + gap) - gap + 4;
  const children: SatoriElement[] = [];
  let categoryIndex = 0;
  let remaining = categories.length ? Math.max(0, Math.floor(Number(categories[0].value) || 0)) : 0;
  for (let index = 0; index < capacity; index += 1) {
    while (remaining <= 0 && categoryIndex < categories.length - 1) {
      categoryIndex += 1;
      remaining = Math.max(0, Math.floor(Number(categories[categoryIndex].value) || 0));
    }
    const occupied = index < filled && remaining > 0;
    const category = categories[categoryIndex];
    const x = startX + (index % columns) * (cell + gap);
    const y = Math.floor(index / columns) * (cell + gap);
    children.push(rect(x, y, cell, cell, occupied ? (category?.color ?? colorAt(categoryIndex)) : 'transparent', occupied ? undefined : context.theme.group.border, occupied ? 0 : 1, Math.min(2, cell / 5), 'cell'));
    if (occupied) remaining -= 1;
  }
  const autoLegend = categories.map((category: any, index: number) => ({
    label: `${category.approximate ? '~' : ''}${String(category.label ?? category.id ?? '')}`,
    color: category.color ?? colorAt(index),
  }));
  return buildCivicFrame(spec, svgElement(width, height, children, spec.alt), height, context, autoLegend);
}

function buildIsotype(spec: any, context: CivicRenderContext): CivicDiagramResult {
  const width = innerWidth(context);
  const categories = Array.isArray(spec.categories) ? spec.categories : [];
  const units = Math.max(1, Math.floor(Number(spec.scale?.unitsPerIcon ?? 1)));
  const marks: Array<{ category: any; categoryIndex: number; icon: string }> = [];
  categories.forEach((category: any, categoryIndex: number) => {
    const count = Math.ceil(Math.max(0, Number(category.value) || 0) / units);
    for (let index = 0; index < count; index += 1) marks.push({ category, categoryIndex, icon: String(category.icon ?? spec.icon ?? 'civic:unknown') });
  });
  if (!marks.length) return framedEmpty(spec, context, 'No icons');
  const size = clamp(Number((context.theme as any).isotype?.iconSize ?? 18), 8, 26);
  const gap = Math.max(3, Number((context.theme as any).isotype?.gap ?? 4));
  const columns = Math.max(1, Math.floor((width + gap) / (size + gap)));
  const rows = Math.ceil(marks.length / columns);
  const gridWidth = Math.min(columns, marks.length) * (size + gap) - gap;
  const startX = Math.max(0, (width - gridWidth) / 2);
  const height = rows * (size + gap) - gap + 4;
  const children = marks.flatMap((mark, index) => civicUnitMark(
    mark.icon,
    startX + (index % columns) * (size + gap),
    Math.floor(index / columns) * (size + gap),
    size,
    mark.category.color ?? colorAt(mark.categoryIndex),
  ));
  const autoLegend = categories.map((category: any, index: number) => ({
    label: `${category.approximate ? '~' : ''}${String(category.label ?? category.id ?? '')}${units > 1 ? ` (1 = ${units})` : ''}`,
    color: category.color ?? colorAt(index),
  }));
  return buildCivicFrame(spec, svgElement(width, height, children, spec.alt), height, context, autoLegend);
}

function buildSmallMultiples(spec: any, context: CivicRenderContext): CivicDiagramResult {
  const width = innerWidth(context);
  const panels = Array.isArray(spec.panels) ? spec.panels : [];
  if (!panels.length) return framedEmpty(spec, context, 'No panels');
  const requestedColumns = Math.max(1, Math.floor(Number(spec.columns ?? Math.min(panels.length, 3))));
  const columns = Math.min(requestedColumns, panels.length);
  const gap = 8;
  const effectiveColumns = Math.min(columns, Math.max(1, Math.floor((width + gap) / 72)));
  const panelWidth = Math.max(20, (width - gap * (effectiveColumns - 1)) / effectiveColumns);
  const panelHeight = Math.max(94, Number((context.theme as any).smallMultiples?.panelHeight ?? 112));
  const rows = Math.ceil(panels.length / effectiveColumns);
  const height = rows * panelHeight + Math.max(0, rows - 1) * gap;
  const sharedExtent = numericExtent(panels.map((panel: any) => panel.spec));
  const children: SatoriElement[] = [];
  panels.forEach((panel: any, index: number) => {
    const col = index % effectiveColumns;
    const row = Math.floor(index / effectiveColumns);
    const x = col * (panelWidth + gap);
    const y = row * (panelHeight + gap);
    children.push(rect(x, y, panelWidth, panelHeight, context.theme.node.background, context.theme.group.border, 1, Math.min(7, context.theme.group.borderRadius)));
    children.push(svgText(x + 7, y + 16, truncate(String(panel.label ?? panel.id ?? ''), Math.max(5, Math.floor((panelWidth - 14) / 6))), { fill: context.theme.node.textColor, fontSize: 10, fontWeight: 600 }));
    children.push(...compactPanel(String(spec.panelType), panel.spec ?? {}, x + 7, y + 25, panelWidth - 14, panelHeight - 32, spec, context, spec.shareScale ? sharedExtent : undefined));
  });
  return buildCivicFrame(spec, svgElement(width, height, children, spec.alt), height, context);
}

function compactPanel(type: string, inner: any, x: number, y: number, width: number, height: number, outer: any, context: CivicRenderContext, shared?: [number, number]): SatoriElement[] {
  const children: SatoriElement[] = [];
  if (type === 'sparkline') {
    const values = Array.isArray(inner.values) ? inner.values.map(Number).filter(Number.isFinite) : [];
    if (values.length >= 2) {
      const ys = linearScale(shared ?? extent(values), [y + height - 5, y + 5]);
      const d = values.map((value: number, index: number) => `${index ? 'L' : 'M'} ${x + index / (values.length - 1) * width} ${ys(value)}`).join(' ');
      children.push(path(d, 'none', inner.stroke ?? colorAt(0), 2));
    }
  } else if (type === 'delta') {
    const from = Number(inner.from?.value ?? 0); const to = Number(inner.to?.value ?? 0);
    const label = from === 0 && to === 0 ? 'Held · n/a' : `${formatValue(from, outer.unit)} → ${formatValue(to, outer.unit)}`;
    children.push(svgText(x + width / 2, y + height / 2 + 4, truncate(label, Math.floor(width / 6)), { fill: context.theme.node.textColor, fontSize: 11, fontWeight: 600, textAnchor: 'middle' }));
  } else if (type === 'bar') {
    const items = Array.isArray(inner.items) ? inner.items : [];
    const values = items.map((item: any) => Number(item.value)).filter(Number.isFinite);
    const domain = shared ?? extent(values, true);
    const scale = linearScale(domain, [0, width]);
    items.slice(0, 4).forEach((item: any, index: number) => children.push(rect(x, y + index * Math.max(8, height / 5), Math.max(1, scale(Number(item.value)) - scale(0)), 6, item.color ?? colorAt(index))));
  } else if (type === 'waffle' || type === 'isotype') {
    const total = (Array.isArray(inner.categories) ? inner.categories : []).reduce((sum: number, category: any) => sum + Math.max(0, Number(category.value) || 0), 0);
    const dots = Math.min(48, Math.ceil(total / Math.max(1, Number(inner.scale?.unitsPerIcon ?? 1))));
    const columns = Math.max(1, Math.floor(width / 10));
    for (let index = 0; index < dots; index += 1) {
      const px = x + (index % columns) * 9; const py = y + Math.floor(index / columns) * 9;
      children.push(type === 'isotype' ? circle(px + 3, py + 3, 3, colorAt(0)) : rect(px, py, 6, 6, colorAt(0), undefined, 0, 1));
    }
  } else if (type === 'scorecard') {
    const rows = Array.isArray(inner.rows) ? inner.rows : [];
    rows.slice(0, 3).forEach((row: any, index: number) => {
      const value = Number(row.promised?.value ?? 0) === 0 ? 'n/a' : `${formatValue(Number(row.promised.value), outer.unit)} / ${formatValue(Number(row.delivered?.value ?? 0), outer.unit)}`;
      children.push(svgText(x, y + 13 + index * 19, truncate(String(row.label ?? row.id), Math.floor(width * 0.45 / 5.5)), { fill: context.theme.node.textColor, fontSize: 8 }));
      children.push(svgText(x + width, y + 13 + index * 19, truncate(value, Math.floor(width * 0.5 / 5.5)), { fill: context.theme.node.textColorSecondary, fontSize: 8, textAnchor: 'end' }));
    });
  } else if (type === 'beeswarm') {
    const values = Array.isArray(inner.items) ? inner.items.map((item: any) => Number(item.value)).filter(Number.isFinite) : [];
    const domain = shared ?? extent(values);
    const scale = linearScale(domain, [x + 5, x + width - 5]);
    values.slice(0, 24).forEach((value: number, index: number) => children.push(circle(scale(value), y + height / 2 + ((index % 3) - 1) * 8, 3, colorAt(index))));
  } else if (type === 'connected-dot') {
    const rows = Array.isArray(inner.rows) ? inner.rows : [];
    const values = rows.flatMap((row: any) => [Number(row.from?.value), Number(row.to?.value)]).filter((value: number) => Number.isFinite(value) && value !== 0);
    const scale = linearScale(shared ?? extent(values), [x + 4, x + width - 4]);
    rows.slice(0, 3).forEach((row: any, index: number) => {
      const py = y + 10 + index * Math.min(18, height / 3);
      const a = Number(row.from?.value); const b = Number(row.to?.value);
      if (a !== 0) { children.push(line(scale(a), py, scale(b), py, row.color ?? (b < a ? '#9b2335' : '#3d5a45'), 2)); children.push(circle(scale(a), py, 3, row.color ?? '#6b7280')); }
      children.push(circle(scale(b), py, 3, row.color ?? colorAt(index)));
    });
  } else {
    children.push(svgText(x + width / 2, y + height / 2, truncate(type, Math.floor(width / 6)), { fill: context.theme.node.textColorSecondary, fontSize: 10, textAnchor: 'middle' }));
  }
  return children;
}

function buildScorecard(spec: any, context: CivicRenderContext): CivicDiagramResult {
  const width = innerWidth(context);
  const rows = Array.isArray(spec.rows) ? spec.rows : [];
  if (!rows.length) return framedEmpty(spec, context, 'No scorecard rows');
  const labelWidth = width * 0.32;
  const numericWidth = width * 0.14;
  const statusWidth = width * 0.18;
  const noteWidth = width - labelWidth - numericWidth * 3 - statusWidth;
  const headerHeight = 28;
  const rowHeight = 48;
  const height = headerHeight + rows.length * rowHeight + 1;
  const xPromised = labelWidth;
  const xDelivered = xPromised + numericWidth;
  const xGap = xDelivered + numericWidth;
  const xStatus = xGap + numericWidth;
  const xNote = xStatus + statusWidth;
  const children: SatoriElement[] = [rect(0, 0, width, headerHeight, context.theme.group.background, context.theme.group.border, 1)];
  const headers = [['Agreement', 3], ['Promised', xPromised + 3], ['Delivered', xDelivered + 3], ['Gap', xGap + 3], ['Status', xStatus + 3], ['Note', xNote + 3]] as const;
  headers.forEach(([label, x]) => children.push(svgText(x, 18, label, { fill: context.theme.node.textColor, fontSize: 9, fontWeight: 600 })));
  rows.forEach((row: any, index: number) => {
    const y = headerHeight + index * rowHeight;
    const promised = Number(row.promised?.value ?? 0);
    const delivered = Number(row.delivered?.value ?? 0);
    const unknown = promised === 0;
    const status = unknown ? 'unknown' : delivered >= promised ? 'met' : row.kept ? 'kept-short' : 'clawed-back';
    const statusColor = status === 'met' ? '#3d5a45' : status === 'unknown' ? '#6b7280' : status === 'kept-short' ? '#b66a2b' : '#9b2335';
    children.push(rect(0, y, width, rowHeight, index % 2 ? 'rgba(127,127,127,0.035)' : 'transparent', context.theme.group.border, 1));
    children.push(svgText(3, y + 18, truncate(String(row.label ?? row.id ?? ''), Math.max(5, Math.floor((labelWidth - 6) / 6))), { fill: context.theme.node.textColor, fontSize: 10, fontWeight: 600 }));
    children.push(svgText(xPromised + 3, y + 18, unknown ? 'n/a' : formatValue(promised, spec.unit), { fill: context.theme.node.textColor, fontSize: 9 }));
    children.push(svgText(xDelivered + 3, y + 18, formatValue(delivered, spec.unit), { fill: context.theme.node.textColor, fontSize: 9 }));
    children.push(svgText(xGap + 3, y + 18, unknown ? '—' : formatSigned(delivered - promised, spec.unit), { fill: statusColor, fontSize: 9, fontWeight: 600 }));
    children.push(rect(xStatus + 3, y + 7, Math.max(26, statusWidth - 7), 17, withAlpha(statusColor, 0.14), statusColor, 1, 8));
    children.push(svgText(xStatus + statusWidth / 2, y + 19, truncate(status, Math.floor((statusWidth - 10) / 5.2)), { fill: statusColor, fontSize: 8, fontWeight: 600, textAnchor: 'middle' }));
    const note = row.reportedError != null ? `${row.note ?? ''} (${formatValue(Number(row.reportedError), spec.unit)} corrected)` : String(row.note ?? '');
    children.push(svgText(xNote + 3, y + 18, truncate(note, Math.max(3, Math.floor((noteWidth - 6) / 5))), { fill: context.theme.node.textColorSecondary, fontSize: 8 }));
    if (row.promised?.label) children.push(svgText(3, y + 35, truncate(String(row.promised.label), Math.max(5, Math.floor((labelWidth - 6) / 5.2))), { fill: context.theme.node.textColorSecondary, fontSize: 8 }));
  });
  return buildCivicFrame(spec, svgElement(width, height, children, spec.alt), height, context);
}

function buildBeeswarm(spec: any, context: CivicRenderContext): CivicDiagramResult {
  const width = innerWidth(context);
  const items = (Array.isArray(spec.items) ? spec.items : []).map((item: any, index: number) => ({ ...item, _index: index, _value: Number(item.value) }));
  if (!items.length) return framedEmpty(spec, context, 'No observations');
  const radius = clamp(Number(spec.dotSize ?? (context.theme as any).beeswarm?.dotSize ?? 12) / 2, 3, 14);
  const minDistance = radius * 2 + 2;
  const annotations = (Array.isArray(spec.annotations) ? spec.annotations : []).filter((annotation: any) => annotation?.at?.x != null && (annotation.kind === 'callout' || annotation.kind === 'peak'));
  const positiveValues = items.map((item: any) => item._value).filter((value: number) => value > 0);
  const autoLog = spec.log == null && positiveValues.length === items.length
    && Math.max(...positiveValues) / Math.max(Number.MIN_VALUE, Math.min(...positiveValues)) >= 10_000;
  const useLog = spec.log === true || autoLog;
  const transformed = items.map((item: any) => useLog ? Math.log10(Math.max(Number.MIN_VALUE, item._value)) : item._value);
  const domain = extent(transformed);
  const axisHorizontal = spec.axis !== 'y';
  const valueLength = axisHorizontal ? width - 24 : 220;
  const valueScale = linearScale(domain, [12, 12 + valueLength]);
  const ordered = items.map((item: any, index: number) => ({ ...item, coordinate: valueScale(transformed[index]) }))
    .sort((a: any, b: any) => a.coordinate - b.coordinate || String(a.id).localeCompare(String(b.id)));
  const placed: any[] = [];
  let minLane = 0; let maxLane = 0;
  const laneOrder = (limit: number) => { const lanes = [0]; for (let i = 1; i <= limit; i += 1) lanes.push(i, -i); return lanes; };
  for (const item of ordered) {
    let lane = 0;
    for (const candidate of laneOrder(placed.length + 1)) {
      const okay = placed.every(other => {
        const dx = item.coordinate - other.coordinate;
        const dy = (candidate - other.lane) * minDistance;
        return Math.hypot(dx, dy) >= minDistance - 0.01;
      });
      if (okay) { lane = candidate; break; }
    }
    item.lane = lane; placed.push(item); minLane = Math.min(minLane, lane); maxLane = Math.max(maxLane, lane);
  }
  const labelItems = [
    ...annotations.map((annotation: any, index: number) => ({ id: `annotation-${index}`, text: String(annotation.text ?? ''), value: Number(annotation.at.x) })),
    ...items.filter((item: any) => item.highlight).map((item: any) => ({ id: `highlight-${item.id}`, text: String(item.label ?? ''), value: item._value })),
  ];
  const labelRows: Array<Array<{ x: number; width: number }>> = [];
  const labels = labelItems.map(label => {
    const transformedValue = useLog ? Math.log10(Math.max(Number.MIN_VALUE, label.value)) : label.value;
    const anchor = clamp(valueScale(transformedValue), 12, 12 + valueLength);
    const labelWidth = clamp(label.text.length * 5.6 + 8, 42, 165);
    const x = clamp(anchor - labelWidth / 2, 0, width - labelWidth);
    let row = labelRows.findIndex(existing => !existing.some(other => intervalsOverlap(x, labelWidth, other.x, other.width, 4)));
    if (row < 0) { row = labelRows.length; labelRows.push([]); }
    labelRows[row].push({ x, width: labelWidth });
    return { ...label, anchor, x, width: labelWidth, row };
  });
  const labelBand = labelRows.length * 18;
  const swarmCross = (maxLane - minLane) * minDistance + radius * 2 + 12;
  const axisBand = 28;
  const plotHeight = axisHorizontal ? labelBand + swarmCross + axisBand : labelBand + valueLength + 22;
  const children: SatoriElement[] = [];
  if (axisHorizontal) {
    const swarmTop = labelBand + 5;
    const axisY = swarmTop + (0 - minLane) * minDistance + radius;
    children.push(line(12, plotHeight - 20, width - 12, plotHeight - 20, context.theme.group.border, 1));
    for (const item of placed) {
      item.x = item.coordinate; item.y = axisY + item.lane * minDistance;
      children.push(circle(item.x, item.y, radius, item.color ?? colorAt(item._index), context.theme.canvas.background, 1));
    }
    labels.forEach(label => {
      const y = 11 + label.row * 18;
      children.push(line(label.anchor, y + 3, label.anchor, swarmTop, context.theme.group.border, 1));
      children.push(svgText(label.x + 3, y, truncate(label.text, Math.floor((label.width - 6) / 5.6)), { fill: context.theme.node.textColor, fontSize: 9 }));
    });
    axisLabels(children, 12, width - 12, plotHeight - 6, domain, spec.unit, useLog, context);
    if (autoLog) children.push(svgText(width / 2, plotHeight - 6, 'log scale', { fill: context.theme.node.textColorSecondary, fontSize: 8, textAnchor: 'middle' }));
  } else {
    const crossCenter = clamp(width * 0.48, 80, width - 80);
    for (const item of placed) {
      item.x = crossCenter + item.lane * minDistance; item.y = item.coordinate + labelBand;
      children.push(circle(item.x, item.y, radius, item.color ?? colorAt(item._index), context.theme.canvas.background, 1));
    }
    children.push(line(crossCenter, labelBand + 12, crossCenter, labelBand + valueLength + 12, context.theme.group.border, 1));
    labels.forEach(label => {
      const y = 11 + label.row * 18;
      children.push(svgText(label.x + 3, y, truncate(label.text, Math.floor((label.width - 6) / 5.6)), { fill: context.theme.node.textColor, fontSize: 9 }));
    });
    if (autoLog) children.push(svgText(width - 4, labelBand + valueLength + 18, 'log scale', { fill: context.theme.node.textColorSecondary, fontSize: 8, textAnchor: 'end' }));
  }
  const groups: Array<{ label: string; color: string }> = uniqueBy(
    items.filter((item: any) => item.group).map((item: any) => ({ label: String(item.group), color: item.color ?? colorAt(item._index) })),
    (item: { label: string; color: string }) => item.label,
  );
  return buildCivicFrame(spec, svgElement(width, plotHeight, children, spec.alt), plotHeight, context, groups);
}

function buildConnectedDot(spec: any, context: CivicRenderContext): CivicDiagramResult {
  const width = innerWidth(context);
  const rows = Array.isArray(spec.rows) ? spec.rows : [];
  if (!rows.length) return framedEmpty(spec, context, 'No connected-dot rows');
  const labelWidth = clamp(width * 0.25, 100, 190);
  const chartLeft = labelWidth + 8;
  const chartRight = width - 12;
  const values = rows.flatMap((row: any) => [Number(row.from?.value), Number(row.to?.value)]).filter((value: number) => Number.isFinite(value) && value !== 0);
  const domain = extent(values);
  const scale = linearScale(domain, [chartLeft, chartRight]);
  const header = 28;
  const rowHeight = 58;
  const height = header + rows.length * rowHeight;
  const children: SatoriElement[] = [line(chartLeft, 19, chartRight, 19, context.theme.group.border, 1)];
  axisLabels(children, chartLeft, chartRight, 13, domain, spec.unit, false, context);
  rows.forEach((row: any, index: number) => {
    const y = header + index * rowHeight + rowHeight / 2;
    const from = Number(row.from?.value ?? 0); const to = Number(row.to?.value ?? 0);
    const color = row.color ?? (from !== 0 && to < from ? '#9b2335' : '#3d5a45');
    children.push(rect(0, header + index * rowHeight, width, rowHeight, index % 2 ? 'rgba(127,127,127,0.035)' : 'transparent'));
    children.push(svgText(2, y + 4, truncate(String(row.label ?? row.id ?? ''), Math.max(6, Math.floor((labelWidth - 5) / 6))), { fill: context.theme.node.textColor, fontSize: 10, fontWeight: 600 }));
    const xTo = scale(to);
    if (from === 0) {
      children.push(svgText(chartLeft, y - 11, 'n/a', { fill: context.theme.node.textColorSecondary, fontSize: 9 }));
      children.push(circle(xTo, y + 3, 6, color, context.theme.canvas.background, 1));
      children.push(svgText(clamp(xTo, chartLeft + 20, chartRight - 20), y + 21, formatValue(to, spec.unit), { fill: color, fontSize: 9, textAnchor: 'middle' }));
    } else {
      const xFrom = scale(from);
      children.push(line(xFrom, y, xTo, y, color, 4));
      const equal = Math.abs(xFrom - xTo) < 12;
      children.push(circle(xFrom, y - (equal ? 4 : 0), 6, color, context.theme.canvas.background, 1));
      children.push(circle(xTo, y + (equal ? 4 : 0), 6, color, context.theme.canvas.background, 1));
      children.push(svgText(clamp(xFrom, chartLeft + 20, chartRight - 20), y - 11, formatValue(from, spec.unit), { fill: color, fontSize: 9, textAnchor: 'middle' }));
      children.push(svgText(clamp(xTo, chartLeft + 20, chartRight - 20), y + 21, formatValue(to, spec.unit), { fill: color, fontSize: 9, textAnchor: 'middle' }));
    }
  });
  return buildCivicFrame(spec, svgElement(width, height, children, spec.alt), height, context);
}

function buildDataTable(spec: any, context: CivicRenderContext): CivicDiagramResult {
  const width = innerWidth(context);
  const columns = Array.isArray(spec.columns) ? spec.columns : [];
  let rows = Array.isArray(spec.rows) ? [...spec.rows] : [];
  if (!columns.length || !rows.length) return framedEmpty(spec, context, 'No table rows');
  if (spec.sort?.column) {
    const id = String(spec.sort.column); const direction = spec.sort.direction === 'asc' ? 1 : -1;
    rows.sort((a: any, b: any) => compareCells(a[id], b[id]) * direction);
  }
  const weights: number[] = columns.map((column: any) => {
    const contentLength = Math.max(String(column.label ?? column.id ?? '').length, ...rows.slice(0, 60).map((row: any) => displayCell(row[column.id], column, spec).length));
    return clamp(contentLength, 7, 24);
  });
  const totalWeight = weights.reduce((sum: number, value: number) => sum + value, 0);
  const widths: number[] = weights.map((value: number) => width * value / totalWeight);
  const starts: number[] = [];
  widths.reduce((cursor: number, value: number, index: number) => { starts[index] = cursor; return cursor + value; }, 0);
  const headerHeight = 30;
  const rowHeight = 38;
  const height = headerHeight + rows.length * rowHeight;
  const domains = new Map<string, [number, number]>();
  columns.forEach((column: any) => {
    const values = rows.map((row: any) => Number(row[column.id])).filter(Number.isFinite);
    domains.set(String(column.id), extent(values, column.encode === 'bar'));
  });
  const children: SatoriElement[] = [rect(0, 0, width, headerHeight, context.theme.group.background, context.theme.group.border, 1)];
  columns.forEach((column: any, index: number) => children.push(svgText(starts[index] + 5, 19, truncate(String(column.label ?? column.id ?? ''), Math.max(3, Math.floor((widths[index] - 10) / 5.7))), { fill: context.theme.node.textColor, fontSize: 9, fontWeight: 600 })));
  rows.forEach((row: any, rowIndex: number) => {
    const y = headerHeight + rowIndex * rowHeight;
    children.push(rect(0, y, width, rowHeight, rowIndex % 2 ? 'rgba(127,127,127,0.035)' : 'transparent', context.theme.group.border, 1));
    columns.forEach((column: any, columnIndex: number) => {
      const x = starts[columnIndex]; const cellWidth = widths[columnIndex]; const value = row[column.id];
      const encode = column.encode ?? 'text';
      if (encode === 'bar' && typeof value === 'number') {
        const domain = domains.get(String(column.id)) ?? [0, 1];
        const scale = linearScale(domain, [0, Math.max(1, cellWidth - 10)]);
        const zero = scale(0); const edge = scale(value);
        children.push(rect(x + 5 + Math.min(zero, edge), y + 8, Math.max(1, Math.abs(edge - zero)), rowHeight - 16, withAlpha(colorAt(columnIndex), 0.28), undefined, 0, 2));
      } else if (encode === 'heat' && typeof value === 'number') {
        const domain = domains.get(String(column.id)) ?? [0, 1];
        const ratio = clamp((value - domain[0]) / (domain[1] - domain[0] || 1), 0, 1);
        children.push(rect(x + 2, y + 2, cellWidth - 4, rowHeight - 4, withAlpha(colorAt(columnIndex), 0.08 + ratio * 0.5), undefined, 0, 2));
      } else if (encode === 'sparkline' && Array.isArray(value) && value.length >= 2) {
        children.push(...tableSparkline(value.map(Number), x + 5, y + 7, cellWidth - 10, rowHeight - 14, colorAt(columnIndex)));
      }
      if (encode !== 'sparkline') children.push(svgText(x + 5, y + 23, truncate(displayCell(value, column, spec), Math.max(3, Math.floor((cellWidth - 10) / 5.7))), { fill: context.theme.node.textColor, fontSize: 9 }));
    });
  });
  return buildCivicFrame(spec, svgElement(width, height, children, spec.alt), height, context);
}

function buildCategoryMix(spec: any, context: CivicRenderContext): CivicDiagramResult {
  const width = innerWidth(context);
  const categories = Array.isArray(spec.categories) ? spec.categories : [];
  const series = Array.isArray(spec.series) ? spec.series : [];
  if (!categories.length || !series.length) return framedEmpty(spec, context, 'No category mix');
  const labelBand = 28;
  const chartHeight = 180;
  const height = chartHeight + labelBand;
  const maxTotal = Math.max(1, ...categories.map((_: unknown, index: number) => series.reduce((sum: number, item: any) => sum + Math.max(0, Number(item.values?.[index]) || 0), 0)));
  const scale = linearScale([0, maxTotal], [0, chartHeight - 16]);
  const slot = width / categories.length;
  const barWidth = clamp(slot * 0.64, 8, 54);
  const children: SatoriElement[] = [line(0, chartHeight, width, chartHeight, context.theme.group.border, 1)];
  categories.forEach((category: unknown, categoryIndex: number) => {
    let cursor = chartHeight;
    series.forEach((item: any, seriesIndex: number) => {
      const value = Math.max(0, Number(item.values?.[categoryIndex]) || 0);
      const segmentHeight = scale(value);
      cursor -= segmentHeight;
      children.push(rect(categoryIndex * slot + (slot - barWidth) / 2, cursor, barWidth, segmentHeight, item.color ?? colorAt(seriesIndex), context.theme.canvas.background, 0.5));
    });
    children.push(svgText(categoryIndex * slot + slot / 2, chartHeight + 17, truncate(String(category), Math.max(3, Math.floor(slot / 6))), { fill: context.theme.node.textColorSecondary, fontSize: 9, textAnchor: 'middle' }));
  });
  const autoLegend = series.map((item: any, index: number) => ({ label: String(item.label ?? item.id ?? ''), color: item.color ?? colorAt(index) }));
  return buildCivicFrame(spec, svgElement(width, height, children, spec.alt), height, context, autoLegend);
}

function buildPerBodyCount(spec: any, context: CivicRenderContext): CivicDiagramResult {
  const width = innerWidth(context);
  let items = Array.isArray(spec.items) ? [...spec.items] : [];
  if (!items.length) return framedEmpty(spec, context, 'No body counts');
  if (spec.sort === 'desc') items.sort((a: any, b: any) => Number(b.value) - Number(a.value));
  if (spec.sort === 'asc') items.sort((a: any, b: any) => Number(a.value) - Number(b.value));
  const labelWidth = clamp(width * 0.32, 105, 220);
  const chartLeft = labelWidth + 8;
  const chartWidth = width - chartLeft - 10;
  const max = Math.max(1, ...items.map((item: any) => Math.max(0, Number(item.value) || 0)));
  const rowHeight = 31;
  const height = items.length * rowHeight + 8;
  const children: SatoriElement[] = [];
  items.forEach((item: any, index: number) => {
    const y = index * rowHeight + 5;
    const barWidth = Math.max(1, Math.max(0, Number(item.value) || 0) / max * chartWidth);
    children.push(svgText(2, y + 16, truncate(String(item.label ?? item.id ?? ''), Math.max(4, Math.floor((labelWidth - 5) / 6))), { fill: context.theme.node.textColor, fontSize: 10 }));
    children.push(rect(chartLeft, y, barWidth, 22, item.color ?? colorAt(index), undefined, 0, 3));
    const inside = barWidth > 35;
    children.push(svgText(inside ? chartLeft + barWidth - 5 : chartLeft + barWidth + 5, y + 15, formatValue(Number(item.value), spec.unit), { fill: inside ? '#ffffff' : context.theme.node.textColor, fontSize: 9, fontWeight: 600, textAnchor: inside ? 'end' : 'start' }));
  });
  return buildCivicFrame(spec, svgElement(width, height, children, spec.alt), height, context);
}

function civicUnitMark(icon: string, x: number, y: number, size: number, color: string): SatoriElement[] {
  // A simple non-square civic glyph. Locked civic unit slugs stay visibly distinct
  // from waffle cells even when an external icon asset is unavailable.
  const cx = x + size / 2; const top = y + size * 0.12; const bottom = y + size * 0.86;
  const roof = icon.includes('bed') ? `M ${x + 2} ${y + size * 0.58} H ${x + size - 2} V ${bottom} H ${x + 2} Z`
    : icon.includes('camera') ? `M ${x + 2} ${y + size * 0.3} H ${x + size - 2} V ${bottom} H ${x + 2} Z`
      : `M ${cx} ${top} L ${x + size - 2} ${y + size * 0.42} V ${bottom} H ${x + 2} V ${y + size * 0.42} Z`;
  return [path(roof, color), circle(cx, y + size * 0.55, Math.max(1.5, size * 0.12), contextThemeBackground(color))];
}

function tableSparkline(values: number[], x: number, y: number, width: number, height: number, color: string): SatoriElement[] {
  const safe = values.filter(Number.isFinite);
  if (safe.length < 2) return [];
  const scale = linearScale(extent(safe), [y + height, y]);
  const d = safe.map((value, index) => `${index ? 'L' : 'M'} ${x + index / (safe.length - 1) * width} ${scale(value)}`).join(' ');
  return [path(d, 'none', color, 1.5)];
}

function displayCell(value: unknown, column: any, spec: any): string {
  if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite).join(', ');
  if (typeof value === 'number') return formatValue(value, column.unit === null ? undefined : column.unit ?? spec.unit);
  return value == null ? '' : String(value);
}

function compareCells(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a ?? '').localeCompare(String(b ?? ''), 'en-US', { numeric: true });
}

function numericExtent(values: unknown[]): [number, number] {
  const numbers: number[] = [];
  const visit = (value: unknown) => {
    if (typeof value === 'number' && Number.isFinite(value)) numbers.push(value);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value as Record<string, unknown>).forEach(visit);
  };
  values.forEach(visit);
  return extent(numbers, true);
}

function axisLabels(children: SatoriElement[], start: number, end: number, y: number, domain: [number, number], unit: any, log: boolean, context: CivicRenderContext): void {
  const leftValue = log ? 10 ** domain[0] : domain[0];
  const rightValue = log ? 10 ** domain[1] : domain[1];
  children.push(svgText(start, y, formatValue(leftValue, unit), { fill: context.theme.node.textColorSecondary, fontSize: 8, textAnchor: 'start' }));
  children.push(svgText(end, y, formatValue(rightValue, unit), { fill: context.theme.node.textColorSecondary, fontSize: 8, textAnchor: 'end' }));
}

function formatSigned(value: number, unit: any): string {
  if (value === 0) return formatValue(0, unit);
  return `${value > 0 ? '+' : '−'}${formatValue(Math.abs(value), unit)}`;
}

function framedEmpty(spec: any, context: CivicRenderContext, label: string): CivicDiagramResult {
  const width = innerWidth(context);
  const height = 42;
  return buildCivicFrame(spec, svgElement(width, height, [svgText(width / 2, 24, label, { fill: context.theme.node.textColorSecondary, fontSize: 11, textAnchor: 'middle' })], spec.alt), height, context);
}

function innerWidth(context: CivicRenderContext): number {
  return Math.max(80, context.width - context.padding * 2);
}

function line(x1: number, y1: number, x2: number, y2: number, stroke: string, strokeWidth = 1): SatoriElement {
  return { type: 'line', props: { x1: String(x1), y1: String(y1), x2: String(x2), y2: String(y2), stroke, strokeWidth: String(strokeWidth), strokeLinecap: 'round' } };
}

function rect(x: number, y: number, width: number, height: number, fill: string, stroke?: string, strokeWidth = 0, rx = 0, className?: string): SatoriElement {
  return { type: 'rect', props: { x: String(x), y: String(y), width: String(Math.max(0, width)), height: String(Math.max(0, height)), fill, ...(stroke ? { stroke, strokeWidth: String(strokeWidth) } : {}), ...(rx ? { rx: String(rx) } : {}), ...(className ? { className } : {}) } };
}

function circle(cx: number, cy: number, r: number, fill: string, stroke?: string, strokeWidth = 0): SatoriElement {
  return { type: 'circle', props: { cx: String(cx), cy: String(cy), r: String(Math.max(0, r)), fill, ...(stroke ? { stroke, strokeWidth: String(strokeWidth) } : {}) } };
}

function path(d: string, fill = 'none', stroke?: string, strokeWidth = 0): SatoriElement {
  return { type: 'path', props: { d, fill, ...(stroke ? { stroke, strokeWidth: String(strokeWidth), strokeLinecap: 'round', strokeLinejoin: 'round' } : {}) } };
}

function truncate(value: string, limit: number): string {
  const safe = Math.max(1, Math.floor(limit));
  return value.length <= safe ? value : `${value.slice(0, Math.max(1, safe - 1))}…`;
}

function intervalsOverlap(a: number, aw: number, b: number, bw: number, gap = 0): boolean {
  return a < b + bw + gap && a + aw + gap > b;
}

function withAlpha(color: string, alpha: number): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    const r = parseInt(color.slice(1, 3), 16); const g = parseInt(color.slice(3, 5), 16); const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}

function contextThemeBackground(color: string): string {
  return withAlpha(color, 0.18);
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter(item => { const value = key(item); if (seen.has(value)) return false; seen.add(value); return true; });
}
