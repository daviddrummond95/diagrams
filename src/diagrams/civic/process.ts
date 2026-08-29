import type { LegendItem, SatoriElement } from '../../types.js';
import {
  avoidPointCollisions,
  buildCivicFrame,
  clamp,
  colorAt,
  extent,
  finite,
  formatValue,
  placeLabels,
  resolveLegend,
  svgElement,
  svgText,
  type Box,
  type CivicDiagramResult,
  type CivicRenderContext,
  type LabelAnchor,
  type PlacedLabel,
  type Point,
} from './shared.js';

export const PROCESS_TYPES = [
  'agenda-states',
  'outcome-funnel',
  'org',
  'vote-matrix',
  'impact',
  'pipeline',
  'hemicycle',
  'heatmap-table',
  'network',
  'donut',
] as const;

type ProcessType = typeof PROCESS_TYPES[number];

const PROCESS_COLORS: Record<string, string> = {
  introduced: '#6f7780',
  approved: '#3d7050',
  deferred: '#a66c25',
  withdrawn: '#8b3c48',
  informational: '#52758d',
  forwarded: '#426b78',
  recessed: '#76658e',
  yea: '#3d7050',
  nay: '#9b3542',
  absent: '#d5d0c8',
  'present-not-voting': '#927441',
  excused: '#aaa39a',
  unknown: '#f2efe9',
  automated: '#426b78',
  human: '#9b5434',
  blocked: '#8b3c48',
  covered: '#3d7050',
  'not-yet': '#ede9e2',
};

const NETWORK_REL_COLORS: Record<string, string> = {
  'votes-with': '#6b5aa6',
  appoints: '#4d7190',
  funds: '#3d7050',
  abuts: '#b36b2c',
  represents: '#2f7b78',
  touches: '#8b8580',
};

const STATE_ORDER = ['introduced', 'forwarded', 'informational', 'deferred', 'recessed', 'approved', 'withdrawn'];

export function buildProcessDiagram(spec: any, context: CivicRenderContext): CivicDiagramResult {
  const type = String(spec?.type ?? '') as ProcessType;
  switch (type) {
    case 'agenda-states': return buildAgendaStates(spec, context);
    case 'outcome-funnel': return buildOutcomeFunnel(spec, context);
    case 'org': return buildOrg(spec, context);
    case 'vote-matrix': return buildVoteMatrix(spec, context);
    case 'impact': return buildImpact(spec, context);
    case 'pipeline': return buildPipeline(spec, context);
    case 'hemicycle': return buildHemicycle(spec, context);
    case 'heatmap-table': return buildHeatmapTable(spec, context);
    case 'network': return buildNetwork(spec, context);
    case 'donut': return buildDonut(spec, context);
    default: return buildCivicFrame(spec ?? {}, emptyPlot(context, `Unsupported process type: ${type || 'unknown'}`), 160, context);
  }
}

function buildAgendaStates(spec: any, context: CivicRenderContext): CivicDiagramResult {
  const width = contentWidth(context);
  const steps = array(spec.item?.steps);
  const margin = 18;
  const gap = 24;
  const minCard = 110;
  const columns = Math.max(1, Math.min(steps.length || 1, Math.floor((width - margin * 2 + gap) / (minCard + gap))));
  const cardWidth = Math.max(70, (width - margin * 2 - gap * (columns - 1)) / columns);
  const cardHeight = 70;
  const rows = Math.max(1, Math.ceil(steps.length / columns));
  const plotHeight = 28 + rows * (cardHeight + 30) + 12;
  const children: SatoriElement[] = [];
  const positions = steps.map((step: any, index: number) => ({
    x: margin + (index % columns) * (cardWidth + gap),
    y: 28 + Math.floor(index / columns) * (cardHeight + 30),
  }));
  for (let i = 0; i < positions.length - 1; i += 1) {
    const a = positions[i]; const b = positions[i + 1];
    const sameRow = Math.floor(i / columns) === Math.floor((i + 1) / columns);
    const d = sameRow
      ? `M ${round(a.x + cardWidth)} ${round(a.y + cardHeight / 2)} L ${round(b.x)} ${round(b.y + cardHeight / 2)}`
      : `M ${round(a.x + cardWidth / 2)} ${round(a.y + cardHeight)} C ${round(a.x + cardWidth / 2)} ${round(a.y + cardHeight + 18)}, ${round(b.x + cardWidth / 2)} ${round(b.y - 18)}, ${round(b.x + cardWidth / 2)} ${round(b.y)}`;
    children.push(path(d, 'none', '#9b958c', 1.5, { 'data-role': 'state-connector' }));
  }
  steps.forEach((step: any, index: number) => {
    const current = index === steps.length - 1;
    const color = stateColor(step.state, index);
    const position = positions[index];
    children.push(rect(position.x, position.y, cardWidth, cardHeight, current ? color : mixColor(color, '#ffffff', 0.76), color, current ? 2.5 : 1.3, {
      rx: '8', 'data-role': 'agenda-step', 'data-id': String(step.id ?? index), 'data-state': String(step.state ?? ''),
      'stroke-dasharray': current ? undefined : '4 2',
    }));
    children.push(svgText(position.x + cardWidth / 2, position.y + 27, shorten(step.label ?? titleCase(step.state), charsFor(cardWidth, 11)), centeredStyle(11, current ? '#ffffff' : '#34312e', 600)));
    children.push(svgText(position.x + cardWidth / 2, position.y + 50, shorten(step.date ?? '', charsFor(cardWidth, 9)), centeredStyle(9, current ? '#ffffff' : '#6f6963', 400)));
  });
  children.push(svgText(margin, 16, shorten(spec.item?.label ?? 'Agenda item', charsFor(width - margin * 2, 11)), textStyle(11, '#5d5751', 600)));
  const auto = uniqueLegend(steps.map((step: any, index: number) => ({ label: titleCase(step.state), color: stateColor(step.state, index) })));
  return frame(spec, context, width, plotHeight, children, auto);
}

function buildOutcomeFunnel(spec: any, context: CivicRenderContext): CivicDiagramResult {
  const width = contentWidth(context);
  const stages = [...array(spec.stages)].sort((a: any, b: any) => {
    const ai = STATE_ORDER.indexOf(String(a.state)); const bi = STATE_ORDER.indexOf(String(b.state));
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });
  const items = array(spec.items);
  const margin = 18;
  const labelWidth = clamp(width * 0.25, 90, 175);
  const maxBar = Math.max(40, width - labelWidth - margin * 2 - 50);
  const maxValue = Math.max(1, ...stages.map((stage: any) => finite(stage.value)));
  const rowHeight = 34;
  const tableRows = items.length ? items.length + 1 : 0;
  const plotHeight = 28 + stages.length * rowHeight + (tableRows ? 24 + tableRows * 24 : 8);
  const children: SatoriElement[] = [svgText(margin, 15, `${stages.reduce((sum: number, stage: any) => sum + Math.max(0, finite(stage.value)), 0)} items`, textStyle(10, '#6f6963', 500))];
  stages.forEach((stage: any, index: number) => {
    const y = 26 + index * rowHeight;
    const value = Math.max(0, finite(stage.value));
    const barWidth = value === 0 ? 2 : maxBar * value / maxValue;
    const color = stateColor(stage.state, index);
    children.push(svgText(margin + labelWidth - 8, y + 19, shorten(stage.label ?? stage.state, charsFor(labelWidth - 8, 10)), { ...textStyle(10, '#403c38', 500), 'text-anchor': 'end' }));
    children.push(rect(margin + labelWidth, y + 3, barWidth, 23, color, color, 1, {
      rx: '3', 'data-role': 'funnel-stage', 'data-id': String(stage.id ?? index), 'data-value': String(value),
    }));
    children.push(svgText(clamp(margin + labelWidth + barWidth + 7, 0, width - 18), y + 19, String(value), textStyle(10, '#403c38', 600)));
  });
  if (items.length) {
    const tableY = 26 + stages.length * rowHeight + 20;
    children.push(line(margin, tableY - 13, width - margin, tableY - 13, '#d5cfc6', 1));
    children.push(svgText(margin, tableY, 'ITEM', textStyle(9, '#77716b', 600)));
    children.push(svgText(width - margin, tableY, 'OUTCOME', { ...textStyle(9, '#77716b', 600), 'text-anchor': 'end' }));
    items.forEach((item: any, index: number) => {
      const y = tableY + 23 + index * 24;
      children.push(svgText(margin, y, shorten(item.label ?? item.id, charsFor(width * 0.68, 10)), textStyle(10, '#403c38', 400)));
      children.push(svgText(width - margin, y, titleCase(item.state), { ...textStyle(10, stateColor(item.state, index), 600), 'text-anchor': 'end' }));
    });
  }
  const auto = uniqueLegend(stages.map((stage: any, index: number) => ({ label: titleCase(stage.state), color: stateColor(stage.state, index) })));
  return frame(spec, context, width, plotHeight, children, auto);
}

function buildOrg(spec: any, context: CivicRenderContext): CivicDiagramResult {
  const width = contentWidth(context);
  const nodes = array(spec.nodes);
  const edges = array(spec.edges);
  const layout = hierarchicalLayout(nodes, edges, width, 32, 126, 64);
  const plotHeight = layout.height;
  const children: SatoriElement[] = [];
  const byId = new Map(layout.nodes.map(node => [node.id, node]));
  const edgeLabels: LabelAnchor[] = [];
  edges.forEach((edge: any, index: number) => {
    const from = byId.get(String(edge.from)); const to = byId.get(String(edge.to));
    if (!from || !to) return;
    const start = edgeBoundary(from, to); const end = edgeBoundary(to, from);
    const bendY = (start.y + end.y) / 2;
    const d = `M ${round(start.x)} ${round(start.y)} C ${round(start.x)} ${round(bendY)}, ${round(end.x)} ${round(bendY)}, ${round(end.x)} ${round(end.y)}`;
    children.push(path(d, 'none', '#918b83', 1.4, { 'data-role': 'org-edge', 'data-index': String(index), 'stroke-dasharray': edge.rel === 'recommends-to' ? '5 3' : undefined }));
    edgeLabels.push({ id: `edge-${index}`, text: titleCase(edge.rel), x: (start.x + end.x) / 2, y: bendY });
  });
  const occupied = layout.nodes.map(node => ({ x: node.x, y: node.y, width: node.width, height: node.height }));
  const placedEdges = processLabels(edgeLabels, { x: 2, y: 2, width: width - 4, height: plotHeight - 4 }, occupied, 9);
  children.push(...renderProcessLabelLeaders(placedEdges));
  layout.nodes.forEach((node, index) => {
    const source = nodes.find((candidate: any) => String(candidate.id) === node.id) ?? {};
    const color = source.color ?? legendColor(spec, source.kind, index, colorAt(index));
    const covered = source.coverage === 'covered';
    children.push(rect(node.x, node.y, node.width, node.height, covered ? mixColor(color, '#ffffff', 0.82) : '#fffdf9', color, covered ? 2.3 : 1.2, {
      rx: '8', 'data-role': 'org-node', 'data-id': node.id, 'data-kind': String(source.kind ?? ''),
      'stroke-dasharray': source.coverage === 'not-yet' ? '4 3' : undefined,
    }));
    children.push(svgText(node.x + node.width / 2, node.y + 27, shorten(source.label ?? node.id, charsFor(node.width - 12, 10)), centeredStyle(10, '#322f2c', 600)));
    children.push(svgText(node.x + node.width / 2, node.y + 47, `${titleCase(source.kind)}${source.coverage ? ` · ${source.coverage === 'covered' ? 'covered' : 'not yet'}` : ''}`, centeredStyle(8.5, '#716a64', 400)));
  });
  children.push(...renderProcessLabels(placedEdges));
  const auto = uniqueLegend(nodes.map((node: any, index: number) => ({ label: titleCase(node.kind), color: node.color ?? legendColor(spec, node.kind, index, colorAt(index)) })));
  return frame(spec, context, width, plotHeight, children, auto);
}

function buildVoteMatrix(spec: any, context: CivicRenderContext): CivicDiagramResult {
  const width = contentWidth(context);
  const members = array(spec.members);
  const items = array(spec.items);
  const cells = array(spec.cells);
  const margin = 8;
  const rowLabelWidth = clamp(width * 0.31, 100, 190);
  const itemWidth = Math.max(18, (width - margin * 2 - rowLabelWidth) / Math.max(1, items.length));
  const headerHeight = 66;
  const rowHeight = 31;
  const footerHeight = spec.summary ? 34 : 8;
  const plotHeight = headerHeight + members.length * rowHeight + footerHeight;
  const children: SatoriElement[] = [];
  children.push(rect(margin, 0, rowLabelWidth, headerHeight, '#f1eee8', '#d4cec5', 1));
  children.push(svgText(margin + 8, 20, shorten(spec.body ?? 'Member', charsFor(rowLabelWidth - 12, 10)), textStyle(10, '#514c47', 600)));
  children.push(svgText(margin + 8, 38, shorten(spec.date ?? '', charsFor(rowLabelWidth - 12, 9)), textStyle(9, '#77716b', 400)));
  items.forEach((item: any, column: number) => {
    const x = margin + rowLabelWidth + column * itemWidth;
    children.push(rect(x, 0, itemWidth, headerHeight, column % 2 ? '#f8f6f2' : '#f1eee8', '#d4cec5', 1, { 'data-role': 'vote-header', 'data-id': String(item.id ?? column) }));
    children.push(svgText(x + itemWidth / 2, 25, shorten(item.label ?? item.id, charsFor(itemWidth - 4, 8)), centeredStyle(8, '#514c47', 600)));
    const roles = [item.mover ? 'M' : '', item.seconder ? 'S' : ''].filter(Boolean).join('/');
    children.push(svgText(x + itemWidth / 2, 48, roles, centeredStyle(8, '#77716b', 500)));
  });
  const cellMap = new Map(cells.map((cell: any) => [`${cell.member}\u0000${cell.item}`, cell]));
  members.forEach((member: any, row: number) => {
    const y = headerHeight + row * rowHeight;
    children.push(rect(margin, y, rowLabelWidth, rowHeight, row % 2 ? '#fbfaf7' : '#ffffff', '#ded9d1', 1));
    children.push(svgText(margin + 7, y + 13, shorten(member.label ?? member.id, charsFor(rowLabelWidth - 12, 9.5)), textStyle(9.5, '#393633', 500)));
    children.push(svgText(margin + 7, y + 25, shorten(member.seat ?? '', charsFor(rowLabelWidth - 12, 8)), textStyle(8, '#77716b', 400)));
    items.forEach((item: any, column: number) => {
      const x = margin + rowLabelWidth + column * itemWidth;
      const cell: any = cellMap.get(`${member.id}\u0000${item.id}`);
      const vote = String(cell?.vote ?? 'unknown');
      const fill = cell ? stateColor(vote, column) : '#fffdf9';
      children.push(rect(x, y, itemWidth, rowHeight, fill, '#ded9d1', 1, {
        'data-role': 'vote-cell', 'data-member': String(member.id ?? row), 'data-item': String(item.id ?? column), 'data-vote': cell ? vote : 'omitted',
      }));
      const role = member.id === item.mover ? 'M' : member.id === item.seconder ? 'S' : '';
      const letter = cell ? voteLetter(vote) : '·';
      children.push(svgText(x + itemWidth / 2, y + 20, `${letter}${role}`, centeredStyle(10, cell && vote !== 'absent' && vote !== 'unknown' ? '#ffffff' : '#5f5a55', 600)));
    });
  });
  if (spec.summary) {
    const y = headerHeight + members.length * rowHeight + 23;
    children.push(svgText(margin, y, summaryText(spec.summary), textStyle(10, '#514c47', 600)));
  }
  return frame(spec, context, width, plotHeight, children, voteLegend());
}

function buildImpact(spec: any, context: CivicRenderContext): CivicDiagramResult {
  const width = contentWidth(context);
  const touches = array(spec.touches);
  const margin = 18;
  const hubWidth = clamp(width * 0.33, 130, 220);
  const hubHeight = 92;
  const gap = 26;
  const itemWidth = Math.max(105, width - margin * 2 - hubWidth - gap);
  const touchHeight = 54;
  const plotHeight = Math.max(180, 24 + Math.max(hubHeight, touches.length * (touchHeight + 10)) + 20);
  const hub = { x: margin, y: (plotHeight - hubHeight) / 2, width: hubWidth, height: hubHeight };
  const children: SatoriElement[] = [];
  touches.forEach((touch: any, index: number) => {
    const node = { x: margin + hubWidth + gap, y: 24 + index * (touchHeight + 10), width: itemWidth, height: touchHeight };
    const color = legendColor(spec, touch.kind, index, colorAt(index));
    children.push(path(`M ${round(hub.x + hub.width)} ${round(hub.y + hub.height / 2)} C ${round(hub.x + hub.width + gap / 2)} ${round(hub.y + hub.height / 2)}, ${round(node.x - gap / 2)} ${round(node.y + node.height / 2)}, ${round(node.x)} ${round(node.y + node.height / 2)}`, 'none', color, 1.5, { 'data-role': 'impact-edge' }));
    children.push(rect(node.x, node.y, node.width, node.height, mixColor(color, '#ffffff', 0.86), color, 1.4, { rx: '18', 'data-role': 'impact-touch', 'data-id': String(touch.id ?? index) }));
    children.push(svgText(node.x + 12, node.y + 23, shorten(touch.label ?? touch.id, charsFor(node.width - 24, 10)), textStyle(10, '#393633', 600)));
    children.push(svgText(node.x + 12, node.y + 40, titleCase(touch.kind), textStyle(8.5, '#716a64', 400)));
  });
  children.push(rect(hub.x, hub.y, hub.width, hub.height, '#f0ece4', '#6f6963', 2.2, { rx: '10', 'data-role': 'impact-hub', 'data-id': String(spec.item?.id ?? 'item') }));
  children.push(svgText(hub.x + hub.width / 2, hub.y + 30, shorten(spec.item?.label ?? 'Decision', charsFor(hub.width - 18, 10)), centeredStyle(10, '#322f2c', 600)));
  children.push(svgText(hub.x + hub.width / 2, hub.y + 52, shorten(spec.item?.action ?? '', charsFor(hub.width - 18, 8.5)), centeredStyle(8.5, '#6f6963', 500)));
  children.push(svgText(hub.x + hub.width / 2, hub.y + 72, shorten(spec.item?.date ?? '', charsFor(hub.width - 18, 8)), centeredStyle(8, '#77716b', 400)));
  const auto = uniqueLegend(touches.map((touch: any, index: number) => ({ label: titleCase(touch.kind), color: legendColor(spec, touch.kind, index, colorAt(index)) })));
  return frame(spec, context, width, plotHeight, children, auto);
}

function buildPipeline(spec: any, context: CivicRenderContext): CivicDiagramResult {
  const width = contentWidth(context);
  const stages = array(spec.stages);
  const edges = array(spec.edges);
  const margin = 14;
  const gap = 25;
  const minCard = 105;
  const columns = Math.max(1, Math.min(stages.length || 1, Math.floor((width - margin * 2 + gap) / (minCard + gap))));
  const cardWidth = Math.max(68, (width - margin * 2 - gap * (columns - 1)) / columns);
  const cardHeight = 74;
  const rowGap = 48;
  const rows = Math.max(1, Math.ceil(stages.length / columns));
  const plotHeight = 20 + rows * cardHeight + (rows - 1) * rowGap + 20;
  const nodes = stages.map((stage: any, index: number) => ({
    id: String(stage.id ?? index), x: margin + (index % columns) * (cardWidth + gap), y: 20 + Math.floor(index / columns) * (cardHeight + rowGap), width: cardWidth, height: cardHeight,
  }));
  const byId = new Map(nodes.map(node => [node.id, node]));
  const order = new Map(nodes.map((node, index) => [node.id, index]));
  const children: SatoriElement[] = [];
  edges.forEach((edge: any, index: number) => {
    const from = byId.get(String(edge.from)); const to = byId.get(String(edge.to));
    if (!from || !to) return;
    const reverse = (order.get(to.id) ?? 0) <= (order.get(from.id) ?? 0);
    const start = edgeBoundary(from, to); const end = edgeBoundary(to, from);
    const d = reverse
      ? `M ${round(start.x)} ${round(start.y)} C ${round(start.x)} ${round(plotHeight - 8)}, ${round(end.x)} ${round(plotHeight - 8)}, ${round(end.x)} ${round(end.y)}`
      : `M ${round(start.x)} ${round(start.y)} L ${round(end.x)} ${round(end.y)}`;
    children.push(path(d, 'none', reverse ? '#9b5434' : '#8e8982', 1.5, { 'data-role': 'pipeline-edge', 'data-index': String(index), 'stroke-dasharray': reverse ? '6 4' : undefined }));
    children.push(arrow(end, start, reverse ? '#9b5434' : '#8e8982'));
  });
  nodes.forEach((node, index) => {
    const stage = stages[index] ?? {};
    const color = stateColor(stage.gate, index);
    const human = stage.gate === 'human';
    children.push(rect(node.x, node.y, node.width, node.height, mixColor(color, '#ffffff', human ? 0.83 : 0.72), color, human ? 3 : 1.5, {
      rx: '8', 'data-role': 'pipeline-stage', 'data-id': node.id, 'data-gate': String(stage.gate ?? ''),
      'stroke-dasharray': stage.gate === 'blocked' ? '5 3' : undefined,
    }));
    children.push(svgText(node.x + node.width / 2, node.y + 25, shorten(stage.label ?? node.id, charsFor(node.width - 10, 10)), centeredStyle(10, '#322f2c', 600)));
    children.push(svgText(node.x + node.width / 2, node.y + 45, human ? 'HUMAN GATE' : String(stage.gate ?? '').toUpperCase(), centeredStyle(8, color, 700)));
    children.push(svgText(node.x + node.width / 2, node.y + 62, shorten(stage.description ?? '', charsFor(node.width - 10, 7.5)), centeredStyle(7.5, '#716a64', 400)));
  });
  const auto = uniqueLegend(stages.map((stage: any, index: number) => ({ label: titleCase(stage.gate), color: stateColor(stage.gate, index) })));
  return frame(spec, context, width, plotHeight, children, auto);
}

function buildHemicycle(spec: any, context: CivicRenderContext): CivicDiagramResult {
  const width = contentWidth(context);
  const seats = array(spec.seats);
  const plotHeight = clamp(210 + Math.ceil(seats.length / 12) * 45, 255, 390);
  const center = { x: width / 2, y: plotHeight - 36 };
  const rows = seats.length > 15 ? 3 : seats.length > 7 ? 2 : 1;
  const assignments: Array<{ seat: any; id: string; x: number; y: number; radius: number }> = [];
  let cursor = 0;
  for (let row = 0; row < rows; row += 1) {
    const remaining = seats.length - cursor;
    const rowsLeft = rows - row;
    const count = Math.ceil(remaining / rowsLeft);
    const radius = Math.min(width * 0.39, 110 + row * 48);
    for (let index = 0; index < count; index += 1) {
      const angle = count === 1 ? Math.PI / 2 : Math.PI * (0.08 + 0.84 * index / (count - 1));
      const seat = seats[cursor];
      assignments.push({ seat, id: String(seat?.id ?? cursor), x: center.x - Math.cos(angle) * radius, y: center.y - Math.sin(angle) * radius, radius: 11 });
      cursor += 1;
    }
  }
  const children: SatoriElement[] = [];
  assignments.forEach((assignment, index) => {
    const vote = String(assignment.seat?.vote ?? 'empty');
    const fill = vote === 'empty' ? '#ffffff' : stateColor(vote, index);
    children.push(circle(assignment.x, assignment.y, assignment.radius, fill, stateColor(vote, index), 1.8, {
      'data-role': 'hemicycle-seat', 'data-id': assignment.id, 'data-vote': vote,
    }));
    const badge = assignment.seat?.member === spec.mover || assignment.id === spec.mover ? 'M' : assignment.seat?.member === spec.seconder || assignment.id === spec.seconder ? 'S' : '';
    children.push(svgText(assignment.x, assignment.y + 3.5, badge || voteLetter(vote), centeredStyle(7.5, vote === 'absent' || vote === 'empty' ? '#5f5a55' : '#ffffff', 700)));
  });
  const named = assignments.filter(assignment => assignment.seat?.label).map(assignment => ({ id: assignment.id, text: String(assignment.seat.label), x: assignment.x, y: assignment.y }));
  const labels = processLabels(named, { x: 4, y: 4, width: width - 8, height: plotHeight - 40 }, assignments.map(seat => ({ x: seat.x - 12, y: seat.y - 12, width: 24, height: 24 })), 9);
  children.unshift(...renderProcessLabelLeaders(labels));
  children.push(...renderProcessLabels(labels));
  children.push(path(`M ${round(center.x - 38)} ${round(center.y)} Q ${round(center.x)} ${round(center.y - 25)} ${round(center.x + 38)} ${round(center.y)}`, 'none', '#aaa39a', 2));
  children.push(svgText(center.x, center.y + 18, shorten(spec.item?.label ?? 'Vote', charsFor(width * 0.6, 10)), centeredStyle(10, '#4a4642', 600)));
  if (spec.summary) children.push(svgText(center.x, plotHeight - 4, summaryText(spec.summary), centeredStyle(10, '#514c47', 600)));
  return frame(spec, context, width, plotHeight, children, voteLegend());
}

function buildHeatmapTable(spec: any, context: CivicRenderContext): CivicDiagramResult {
  const width = contentWidth(context);
  const rows = array(spec.rows);
  const columns = array(spec.columns);
  const cells = array(spec.cells);
  const margin = 8;
  const rowLabelWidth = clamp(width * 0.31, 105, 190);
  const columnWidth = Math.max(18, (width - margin * 2 - rowLabelWidth) / Math.max(1, columns.length));
  const headerHeight = 48;
  const rowHeight = 34;
  const plotHeight = headerHeight + rows.length * rowHeight + 8;
  const values = cells.map((cell: any) => finite(cell.value)).filter(Number.isFinite);
  const domain = spec.scale && Number.isFinite(spec.scale.min) && Number.isFinite(spec.scale.max)
    ? [finite(spec.scale.min), finite(spec.scale.max)] as [number, number]
    : extent(values, true);
  const cellMap = new Map(cells.map((cell: any) => [`${cell.row}\u0000${cell.column}`, cell]));
  const children: SatoriElement[] = [rect(margin, 0, rowLabelWidth, headerHeight, '#f1eee8', '#d4cec5', 1)];
  columns.forEach((column: any, index: number) => {
    const x = margin + rowLabelWidth + index * columnWidth;
    children.push(rect(x, 0, columnWidth, headerHeight, '#f1eee8', '#d4cec5', 1, { 'data-role': 'heat-header', 'data-id': String(column.id ?? index) }));
    children.push(svgText(x + columnWidth / 2, 28, shorten(column.label ?? column.id, charsFor(columnWidth - 4, 8)), centeredStyle(8, '#514c47', 600)));
  });
  rows.forEach((row: any, rowIndex: number) => {
    const y = headerHeight + rowIndex * rowHeight;
    children.push(rect(margin, y, rowLabelWidth, rowHeight, rowIndex % 2 ? '#fbfaf7' : '#ffffff', '#ded9d1', 1));
    children.push(svgText(margin + 7, y + 21, shorten(row.label ?? row.id, charsFor(rowLabelWidth - 12, 9.5)), textStyle(9.5, '#393633', 500)));
    columns.forEach((column: any, columnIndex: number) => {
      const x = margin + rowLabelWidth + columnIndex * columnWidth;
      const cell: any = cellMap.get(`${row.id}\u0000${column.id}`);
      const t = cell ? clamp((finite(cell.value) - domain[0]) / Math.max(domain[1] - domain[0], 1e-9), 0, 1) : -1;
      const fill = cell ? mixColor('#e8eee9', '#315b43', t) : '#f5f2ed';
      children.push(rect(x, y, columnWidth, rowHeight, fill, '#ded9d1', 1, {
        'data-role': 'heat-cell', 'data-row': String(row.id ?? rowIndex), 'data-column': String(column.id ?? columnIndex), 'data-value': cell ? String(cell.value) : 'omitted',
      }));
      if (cell) children.push(svgText(x + columnWidth / 2, y + 21, shorten(cell.label ?? formatValue(finite(cell.value), spec.unit), charsFor(columnWidth - 4, 9)), centeredStyle(9, t > 0.55 ? '#ffffff' : '#30342f', 600)));
    });
  });
  return frame(spec, context, width, plotHeight, children, [
    { label: `Low (${formatValue(domain[0], spec.unit)})`, color: '#e8eee9' },
    { label: `High (${formatValue(domain[1], spec.unit)})`, color: '#315b43' },
    { label: 'Not recorded', color: '#f5f2ed' },
  ]);
}

function buildNetwork(spec: any, context: CivicRenderContext): CivicDiagramResult {
  const width = contentWidth(context);
  const nodes = array(spec.nodes);
  const edges = array(spec.edges);
  const plotHeight = clamp(220 + nodes.length * 14, 300, 560);
  const bounds = { x: 24, y: 24, width: width - 48, height: plotHeight - 48 };
  const layout = forceLayout(nodes, edges, bounds);
  const byId = new Map(layout.map(node => [node.id, node]));
  const children: SatoriElement[] = [];
  const edgeAnchors: LabelAnchor[] = [];
  const dense = edges.length > 14;
  edges.forEach((edge: any, index: number) => {
    const from = byId.get(String(edge.from)); const to = byId.get(String(edge.to));
    if (!from || !to) return;
    const edgeColor = NETWORK_REL_COLORS[String(edge.rel)] ?? '#8b8580';
    children.push(line(from.x, from.y, to.x, to.y, edgeColor, dense ? 1.1 : 1.3, {
      opacity: dense ? '0.7' : '0.82', 'data-role': 'network-edge', 'data-index': String(index), 'data-rel': String(edge.rel ?? ''),
      'stroke-dasharray': edge.rel === 'votes-with' ? '5 3' : undefined,
    }));
    if (edge.directed) children.push(arrow(edgeBoundaryPoint(to, from, to.radius), edgeBoundaryPoint(from, to, from.radius), edgeColor));
    if (!dense) edgeAnchors.push({ id: `edge-${index}`, text: titleCase(edge.rel), x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 });
  });
  const occupied = layout.map(node => ({ x: node.x - node.width / 2, y: node.y - node.height / 2, width: node.width, height: node.height }));
  const edgeLabels = processLabels(edgeAnchors, { x: 2, y: 2, width: width - 4, height: plotHeight - 4 }, occupied, 8);
  children.push(...renderProcessLabelLeaders(edgeLabels));
  layout.forEach((node, index) => {
    const source = nodes[node.index] ?? {};
    const color = source.color ?? legendColor(spec, source.kind, index, colorAt(index));
    children.push(rect(node.x - node.width / 2, node.y - node.height / 2, node.width, node.height, mixColor(color, '#ffffff', 0.78), color, 1.8, {
      rx: '18', 'data-role': 'network-node', 'data-id': node.id, 'data-kind': String(source.kind ?? ''),
    }));
    children.push(svgText(node.x, node.y - 1, shorten(source.label ?? node.id, charsFor(node.width - 10, 9.5)), centeredStyle(9.5, '#322f2c', 600)));
    children.push(svgText(node.x, node.y + 13, titleCase(source.kind), centeredStyle(7.5, '#6f6963', 400)));
  });
  children.push(...renderProcessLabels(edgeLabels));
  const auto = uniqueLegend([
    ...nodes.map((node: any, index: number) => ({ label: titleCase(node.kind), color: node.color ?? legendColor(spec, node.kind, index, colorAt(index)) })),
    ...edges.map((edge: any) => ({ label: `Edge: ${titleCase(edge.rel)}`, color: NETWORK_REL_COLORS[String(edge.rel)] ?? '#8b8580' })),
  ]);
  return frame(spec, context, width, plotHeight, children, auto);
}

function buildDonut(spec: any, context: CivicRenderContext): CivicDiagramResult {
  const width = contentWidth(context);
  const slices = array(spec.slices);
  const plotHeight = clamp(width * 0.56, 250, 390);
  const center = { x: width / 2, y: plotHeight / 2 };
  const outerRadius = Math.min(width * 0.22, plotHeight * 0.38, 118);
  const innerRadius = outerRadius * 0.56;
  const total = slices.reduce((sum: number, slice: any) => sum + Math.max(0, finite(slice.value)), 0);
  const children: SatoriElement[] = [];
  const anchors: LabelAnchor[] = [];
  let angle = -Math.PI / 2;
  slices.forEach((slice: any, index: number) => {
    const value = Math.max(0, finite(slice.value));
    const sweep = total > 0 ? value / total * Math.PI * 2 : 0;
    const end = angle + sweep;
    const color = slice.color ?? legendColor(spec, slice.label, index, colorAt(index));
    if (sweep > 0) children.push(path(donutSegment(center, outerRadius, innerRadius, angle, Math.min(end, angle + Math.PI * 2 - 1e-5)), color, '#ffffff', 1.5, {
      'data-role': 'donut-slice', 'data-id': String(slice.id ?? index), 'data-value': String(value),
    }));
    const middle = sweep > 0 ? angle + sweep / 2 : -Math.PI / 2 + index * Math.PI * 2 / Math.max(1, slices.length);
    anchors.push({ id: String(slice.id ?? index), text: `${slice.label ?? slice.id} ${formatValue(value, spec.unit)}`, x: center.x + Math.cos(middle) * (outerRadius + 10), y: center.y + Math.sin(middle) * (outerRadius + 10), preferred: Math.cos(middle) < 0 ? 'left' : 'right' });
    angle = end;
  });
  if (total <= 0) children.push(circle(center.x, center.y, (outerRadius + innerRadius) / 2, 'none', '#d5d0c8', outerRadius - innerRadius, { 'data-role': 'donut-empty' }));
  const occupied = [{ x: center.x - outerRadius, y: center.y - outerRadius, width: outerRadius * 2, height: outerRadius * 2 }];
  const labels = processLabels(anchors, { x: 4, y: 4, width: width - 8, height: plotHeight - 8 }, occupied, 9);
  children.unshift(...renderProcessLabelLeaders(labels));
  children.push(...renderProcessLabels(labels));
  const centerLabel = String(spec.center?.label ?? `${formatValue(total, spec.unit)} total`);
  const centerLines = wrapWords(centerLabel, 18, 2);
  centerLines.forEach((text, index) => children.push(svgText(center.x, center.y + (index - (centerLines.length - 1) / 2) * 15 + 4, text, centeredStyle(index === 0 ? 11 : 9, '#3c3935', index === 0 ? 600 : 500))));
  const auto = slices.map((slice: any, index: number) => ({ label: String(slice.label ?? slice.id), color: slice.color ?? legendColor(spec, slice.label, index, colorAt(index)) }));
  return frame(spec, context, width, plotHeight, children, uniqueLegend(auto));
}

function hierarchicalLayout(nodes: any[], edges: any[], width: number, top: number, nodeWidth: number, nodeHeight: number): { nodes: Array<{ id: string; x: number; y: number; width: number; height: number }>; height: number } {
  const ids = nodes.map((node, index) => String(node.id ?? index));
  const parents = new Map(ids.map(id => [id, new Set<string>()]));
  edges.forEach((edge: any) => {
    const from = String(edge.from); const to = String(edge.to);
    if (!parents.has(from) || !parents.has(to)) return;
    if (edge.rel === 'reports-to') parents.get(from)?.add(to);
    else if (edge.rel === 'appoints' || edge.rel === 'oversees') parents.get(to)?.add(from);
  });
  const depth = new Map(ids.map(id => [id, 0]));
  for (let pass = 0; pass < ids.length; pass += 1) {
    ids.forEach(id => parents.get(id)?.forEach(parent => depth.set(id, Math.max(depth.get(id) ?? 0, (depth.get(parent) ?? 0) + 1))));
  }
  const maxDepth = Math.max(0, ...depth.values());
  const rows = Array.from({ length: maxDepth + 1 }, (_, d) => ids.filter(id => depth.get(id) === d).sort());
  const gapY = 72;
  const laidOut: Array<{ id: string; x: number; y: number; width: number; height: number }> = [];
  rows.forEach((row, d) => {
    const usable = width - 24;
    const gap = Math.max(8, (usable - row.length * nodeWidth) / Math.max(1, row.length + 1));
    const fittedWidth = row.length ? Math.min(nodeWidth, (usable - gap * (row.length + 1)) / row.length) : nodeWidth;
    row.forEach((id, index) => laidOut.push({ id, x: 12 + gap + index * (fittedWidth + gap), y: top + d * (nodeHeight + gapY), width: fittedWidth, height: nodeHeight }));
  });
  return { nodes: laidOut, height: top * 2 + (maxDepth + 1) * nodeHeight + maxDepth * gapY };
}

function forceLayout(nodes: any[], edges: any[], bounds: Box): Array<{ id: string; index: number; x: number; y: number; width: number; height: number; radius: number }> {
  const sorted = nodes.map((node, index) => ({ node, index, id: String(node.id ?? index) })).sort((a, b) => a.id.localeCompare(b.id));
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const orbit = Math.min(bounds.width, bounds.height) * 0.34;
  const points = sorted.map((entry, index) => {
    const width = clamp(String(entry.node.label ?? entry.id).length * 5.2 + 28, 74, 138);
    const height = 42;
    const angle = -Math.PI / 2 + index * Math.PI * 2 / Math.max(1, sorted.length);
    return { id: entry.id, index: entry.index, x: center.x + Math.cos(angle) * orbit, y: center.y + Math.sin(angle) * orbit, width, height, radius: Math.hypot(width / 2, height / 2) };
  });
  const byId = new Map(points.map(point => [point.id, point]));
  for (let iteration = 0; iteration < 180; iteration += 1) {
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const a = points[i]; const b = points[j];
        let dx = b.x - a.x; let dy = b.y - a.y; let distance = Math.hypot(dx, dy);
        if (distance < 0.001) { const angle = stableAngle(`${a.id}:${b.id}`); dx = Math.cos(angle); dy = Math.sin(angle); distance = 1; }
        const desired = a.radius + b.radius + 8;
        const force = distance < desired ? (desired - distance) * 0.08 : Math.min(0.35, 180 / (distance * distance));
        const ux = dx / distance; const uy = dy / distance;
        a.x -= ux * force; a.y -= uy * force; b.x += ux * force; b.y += uy * force;
      }
    }
    edges.forEach((edge: any) => {
      const a = byId.get(String(edge.from)); const b = byId.get(String(edge.to));
      if (!a || !b) return;
      const dx = b.x - a.x; const dy = b.y - a.y; const distance = Math.max(1, Math.hypot(dx, dy));
      const pull = (distance - Math.min(150, Math.max(85, bounds.width / 3))) * 0.012;
      const ux = dx / distance; const uy = dy / distance;
      a.x += ux * pull; a.y += uy * pull; b.x -= ux * pull; b.y -= uy * pull;
    });
    points.forEach(point => {
      point.x += (center.x - point.x) * 0.004;
      point.y += (center.y - point.y) * 0.004;
      point.x = clamp(point.x, bounds.x + point.width / 2, bounds.x + bounds.width - point.width / 2);
      point.y = clamp(point.y, bounds.y + point.height / 2, bounds.y + bounds.height - point.height / 2);
    });
  }
  const relaxed = avoidPointCollisions(points, point => Math.min(point.radius, Math.max(point.width, point.height) * 0.43), bounds, 140, 0.01);
  // Circular relaxation gives a good graph shape; this final pass enforces the
  // actual rectangular node footprint without introducing randomness.
  for (let iteration = 0; iteration < 260; iteration += 1) {
    let changed = false;
    for (let i = 0; i < relaxed.length; i += 1) {
      for (let j = i + 1; j < relaxed.length; j += 1) {
        const a = relaxed[i]; const b = relaxed[j];
        const overlapX = (a.width + b.width) / 2 + 4 - Math.abs(b.x - a.x);
        const overlapY = (a.height + b.height) / 2 + 4 - Math.abs(b.y - a.y);
        if (overlapX <= 0 || overlapY <= 0) continue;
        changed = true;
        if (overlapX < overlapY) {
          const sign = b.x === a.x ? (stableAngle(`${a.id}:${b.id}`) < Math.PI ? 1 : -1) : Math.sign(b.x - a.x);
          a.x -= sign * overlapX / 2; b.x += sign * overlapX / 2;
        } else {
          const sign = b.y === a.y ? (stableAngle(`${b.id}:${a.id}`) < Math.PI ? 1 : -1) : Math.sign(b.y - a.y);
          a.y -= sign * overlapY / 2; b.y += sign * overlapY / 2;
        }
        a.x = clamp(a.x, bounds.x + a.width / 2, bounds.x + bounds.width - a.width / 2);
        a.y = clamp(a.y, bounds.y + a.height / 2, bounds.y + bounds.height - a.height / 2);
        b.x = clamp(b.x, bounds.x + b.width / 2, bounds.x + bounds.width - b.width / 2);
        b.y = clamp(b.y, bounds.y + b.height / 2, bounds.y + bounds.height - b.height / 2);
      }
    }
    if (!changed) break;
  }
  if (hasNodeOverlaps(relaxed)) {
    // Dense graphs can pin several nodes against the same boundary. Allocate
    // the closest stable grid slot only as a last resort; this preserves the
    // force layout's ordering while making the collision guarantee explicit.
    const maxWidth = Math.max(1, ...relaxed.map(node => node.width));
    const columns = Math.max(1, Math.min(relaxed.length, Math.floor(bounds.width / (maxWidth + 6))));
    const rows = Math.ceil(relaxed.length / columns);
    const slots = Array.from({ length: relaxed.length }, (_, index) => ({
      x: bounds.x + (index % columns + 0.5) * bounds.width / columns,
      y: bounds.y + (Math.floor(index / columns) + 0.5) * bounds.height / rows,
      index,
    }));
    [...relaxed].sort((a, b) => a.id.localeCompare(b.id)).forEach(node => {
      slots.sort((a, b) => Math.hypot(a.x - node.x, a.y - node.y) - Math.hypot(b.x - node.x, b.y - node.y) || a.index - b.index);
      const slot = slots.shift()!;
      node.x = clamp(slot.x, bounds.x + node.width / 2, bounds.x + bounds.width - node.width / 2);
      node.y = clamp(slot.y, bounds.y + node.height / 2, bounds.y + bounds.height - node.height / 2);
    });
  }
  return relaxed;
}

function hasNodeOverlaps(nodes: Array<{ x: number; y: number; width: number; height: number }>): boolean {
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i]; const b = nodes[j];
      if (Math.abs(a.x - b.x) < (a.width + b.width) / 2 + 2 && Math.abs(a.y - b.y) < (a.height + b.height) / 2 + 2) return true;
    }
  }
  return false;
}

function processLabels(anchors: LabelAnchor[], bounds: Box, occupied: Box[] = [], fontSize = 9): PlacedLabel[] {
  const input = anchors.map(anchor => ({ ...anchor, text: shorten(anchor.text, 24) }));
  const labels = placeLabels(input, bounds, occupied, fontSize);
  const result: PlacedLabel[] = [];
  labels.forEach((label, index) => {
    if (!result.some(other => overlap(label, other, 1))) { result.push(label); return; }
    const left = index % 2 === 0;
    const x = left ? bounds.x : bounds.x + bounds.width - label.width;
    const sameLane = result.filter(other => left ? other.x < bounds.x + bounds.width / 2 : other.x >= bounds.x + bounds.width / 2).sort((a, b) => a.y - b.y);
    let y = bounds.y;
    sameLane.forEach(other => { if (y < other.y + other.height + 2) y = other.y + other.height + 2; });
    result.push({ ...label, x, y: clamp(y, bounds.y, bounds.y + bounds.height - label.height) });
  });
  return result;
}

function renderProcessLabelLeaders(labels: PlacedLabel[]): SatoriElement[] {
  return labels.map(label => line(label.anchorX, label.anchorY, clamp(label.anchorX, label.x, label.x + label.width), clamp(label.anchorY, label.y, label.y + label.height), '#8e8982', 0.7, { 'data-role': 'process-label-leader' }));
}

function renderProcessLabels(labels: PlacedLabel[]): SatoriElement[] {
  return labels.flatMap(label => [
    rect(label.x, label.y, label.width, label.height, '#fffdf9', '#d8d2c9', 0.7, { rx: '3', 'data-role': 'process-label-box', 'data-id': label.id }),
    svgText(label.x + 4, label.y + label.height - 5, label.text, { ...textStyle(9, '#4a4642', 500), 'data-role': 'process-label', 'data-id': label.id }),
  ]);
}

function frame(spec: any, context: CivicRenderContext, width: number, height: number, children: SatoriElement[], autoLegend: LegendItem[]): CivicDiagramResult {
  return buildCivicFrame(spec, svgElement(width, height, children, spec.alt), height, context, autoLegend);
}

function stateColor(state: unknown, index: number): string { return PROCESS_COLORS[String(state)] ?? colorAt(index); }
function voteLegend(): LegendItem[] { return ['yea', 'nay', 'absent', 'unknown'].map(label => ({ label: titleCase(label), color: stateColor(label, 0) })); }
function voteLetter(vote: string): string { return ({ yea: 'Y', nay: 'N', absent: 'A', 'present-not-voting': 'P', excused: 'E', unknown: '?' } as Record<string, string>)[vote] ?? '·'; }
function summaryText(summary: any): string {
  return ['yea', 'nay', 'present', 'absent'].filter(key => Number.isFinite(Number(summary?.[key]))).map(key => `${summary[key]} ${key}`).join(' · ');
}

function legendColor(spec: any, key: unknown, index: number, fallback: string): string {
  const normalized = String(key ?? '').toLowerCase();
  const items = resolveLegend(spec.legend, []);
  const match = items.find(item => String(item.label).toLowerCase() === normalized)
    ?? items.find(item => normalized && String(item.label).toLowerCase().includes(normalized));
  return match?.color ?? fallback ?? colorAt(index);
}

function uniqueLegend(items: LegendItem[]): LegendItem[] {
  const seen = new Set<string>();
  return items.filter(item => { const key = String(item.label); if (seen.has(key)) return false; seen.add(key); return true; });
}

function edgeBoundary(node: { x: number; y: number; width: number; height: number }, other: { x: number; y: number; width: number; height: number }): Point {
  return edgeBoundaryPoint({ x: node.x + node.width / 2, y: node.y + node.height / 2 }, { x: other.x + other.width / 2, y: other.y + other.height / 2 }, Math.min(node.width, node.height) / 2);
}
function edgeBoundaryPoint(node: Point, other: Point, radius: number): Point {
  const dx = other.x - node.x; const dy = other.y - node.y; const length = Math.max(1, Math.hypot(dx, dy));
  return { x: node.x + dx / length * radius, y: node.y + dy / length * radius };
}

function arrow(tip: Point, from: Point, color: string): SatoriElement {
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x); const size = 6;
  const a = { x: tip.x - Math.cos(angle - 0.55) * size, y: tip.y - Math.sin(angle - 0.55) * size };
  const b = { x: tip.x - Math.cos(angle + 0.55) * size, y: tip.y - Math.sin(angle + 0.55) * size };
  return element('polygon', { points: `${round(tip.x)},${round(tip.y)} ${round(a.x)},${round(a.y)} ${round(b.x)},${round(b.y)}`, fill: color });
}

function donutSegment(center: Point, outer: number, inner: number, start: number, end: number): string {
  const sweep = Math.max(0, end - start); const large = sweep > Math.PI ? 1 : 0;
  const a = polar(center, outer, start); const b = polar(center, outer, end); const c = polar(center, inner, end); const d = polar(center, inner, start);
  return `M ${round(a.x)} ${round(a.y)} A ${round(outer)} ${round(outer)} 0 ${large} 1 ${round(b.x)} ${round(b.y)} L ${round(c.x)} ${round(c.y)} A ${round(inner)} ${round(inner)} 0 ${large} 0 ${round(d.x)} ${round(d.y)} Z`;
}
function polar(center: Point, radius: number, angle: number): Point { return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius }; }

function wrapWords(value: string, max: number, maxLines: number): string[] {
  const words = value.split(/\s+/).filter(Boolean); const lines: string[] = [];
  words.forEach(word => {
    if (!lines.length || `${lines[lines.length - 1]} ${word}`.trim().length > max) lines.push(word);
    else lines[lines.length - 1] += ` ${word}`;
  });
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines); kept[maxLines - 1] = shorten([kept[maxLines - 1], ...lines.slice(maxLines)].join(' '), max);
  return kept;
}

function stableAngle(value: string): number { let hash = 2166136261; for (let i = 0; i < value.length; i += 1) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 16777619); } return (hash >>> 0) / 0xffffffff * Math.PI * 2; }
function overlap(a: Box, b: Box, gap = 0): boolean { return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y; }
function charsFor(width: number, fontSize: number): number { return Math.max(2, Math.floor(width / Math.max(fontSize * 0.56, 1))); }
function contentWidth(context: CivicRenderContext): number { return Math.max(280, context.width - context.padding * 2); }
function array<T = any>(value: unknown): T[] { return Array.isArray(value) ? value : []; }
function shorten(value: unknown, max: number): string { const text = String(value ?? ''); return text.length <= max ? text : `${text.slice(0, Math.max(1, max - 1))}…`; }
function titleCase(value: unknown): string { return String(value ?? '').replace(/[-_]/g, ' ').replace(/\b\w/g, character => character.toUpperCase()); }
function round(value: number): string { return (Math.round(value * 100) / 100).toString(); }

function mixColor(a: string, b: string, t: number): string {
  const av = parseInt(a.slice(1), 16); const bv = parseInt(b.slice(1), 16);
  const parts = [16, 8, 0].map(shift => Math.round(((av >> shift) & 255) * (1 - t) + ((bv >> shift) & 255) * t));
  return `#${parts.map(value => value.toString(16).padStart(2, '0')).join('')}`;
}
function textStyle(fontSize: number, fill: string, fontWeight: number): Record<string, unknown> { return { 'font-size': String(fontSize), 'font-family': 'Inter, sans-serif', 'font-weight': String(fontWeight), fill }; }
function centeredStyle(fontSize: number, fill: string, fontWeight: number): Record<string, unknown> { return { ...textStyle(fontSize, fill, fontWeight), 'text-anchor': 'middle' }; }
function element(type: string, props: Record<string, unknown>, children?: SatoriElement[] | string): SatoriElement { return { type, props: { ...props, ...(children === undefined ? {} : { children }) } }; }
function rect(x: number, y: number, width: number, height: number, fill: string, stroke: string, strokeWidth: number, extra: Record<string, unknown> = {}): SatoriElement { return element('rect', { x: round(x), y: round(y), width: round(width), height: round(height), fill, stroke, 'stroke-width': String(strokeWidth), ...extra }); }
function line(x1: number, y1: number, x2: number, y2: number, stroke: string, strokeWidth: number, extra: Record<string, unknown> = {}): SatoriElement { return element('line', { x1: round(x1), y1: round(y1), x2: round(x2), y2: round(y2), stroke, 'stroke-width': String(strokeWidth), ...extra }); }
function circle(cx: number, cy: number, r: number, fill: string, stroke: string, strokeWidth: number, extra: Record<string, unknown> = {}): SatoriElement { return element('circle', { cx: round(cx), cy: round(cy), r: round(r), fill, stroke, 'stroke-width': String(strokeWidth), ...extra }); }
function path(d: string, fill: string, stroke: string, strokeWidth: number, extra: Record<string, unknown> = {}): SatoriElement { return element('path', { d, fill, stroke, 'stroke-width': String(strokeWidth), 'stroke-linejoin': 'round', 'stroke-linecap': 'round', ...extra }); }
function emptyPlot(context: CivicRenderContext, message: string): SatoriElement { const width = contentWidth(context); return svgElement(width, 160, [rect(0, 0, width, 160, '#f5f3ef', '#d2cbc1', 1), svgText(18, 80, message, textStyle(12, '#7a332e', 500))]); }
