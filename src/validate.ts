import type { AnyDiagramSpec, DiagramSpec, GanttSpec, TimelineSpec, QuadrantSpec } from './types.js';

export function validate(spec: AnyDiagramSpec): string[] {
  const type = spec.type ?? 'flow';
  let errors: string[];
  switch (type) {
    case 'gantt':
      errors = validateGantt(spec as GanttSpec);
      break;
    case 'timeline':
      errors = validateTimeline(spec as TimelineSpec);
      break;
    case 'quadrant':
      errors = validateQuadrant(spec as QuadrantSpec);
      break;
    case 'flow':
      errors = validateFlow(spec as DiagramSpec);
      break;
    default:
      errors = validateCivic(spec as unknown as Record<string, any>);
  }
  validateHrefValues(spec, 'spec', errors);
  return errors;
}

function validateFlow(spec: DiagramSpec): string[] {
  const errors: string[] = [];

  if (!spec.nodes || spec.nodes.length === 0) {
    errors.push('Diagram must have at least one node');
  }

  const nodeIds = new Set(spec.nodes?.map(n => n.id) ?? []);

  const seen = new Set<string>();
  for (const node of spec.nodes ?? []) {
    if (!node.id) errors.push('Every node must have an id');
    if (!node.label) errors.push(`Node "${node.id}" must have a label`);
    if (seen.has(node.id)) errors.push(`Duplicate node id: "${node.id}"`);
    seen.add(node.id);

    if (node.variant && node.variant !== 'default' && node.variant !== 'icon') {
      errors.push(`Node "${node.id}" has invalid variant: "${node.variant}". Must be "default" or "icon"`);
    }
    if (node.variant === 'icon' && !node.icon) {
      errors.push(`Node "${node.id}" uses variant "icon" but has no icon specified`);
    }
    if (node.style?.iconBorderRadius != null) {
      if (typeof node.style.iconBorderRadius !== 'number' || node.style.iconBorderRadius < 0) {
        errors.push(`Node "${node.id}" has invalid iconBorderRadius: must be a non-negative number`);
      }
    }
  }

  for (const edge of spec.edges ?? []) {
    if (!nodeIds.has(edge.from)) {
      errors.push(`Edge references unknown node: "${edge.from}"`);
    }
    if (!nodeIds.has(edge.to)) {
      errors.push(`Edge references unknown node: "${edge.to}"`);
    }
    if (edge.from === edge.to) {
      errors.push(`Self-loop on node "${edge.from}" is not supported`);
    }
  }

  if (spec.direction && !['TB', 'LR'].includes(spec.direction)) {
    errors.push(`Invalid direction: "${spec.direction}". Must be "TB" or "LR"`);
  }

  if (spec.groups && spec.groups.length > 0) {
    const groupIds = new Set<string>();
    const assignedNodes = new Set<string>();

    for (const group of spec.groups) {
      if (!group.id) errors.push('Every group must have an id');
      if (groupIds.has(group.id)) errors.push(`Duplicate group id: "${group.id}"`);
      groupIds.add(group.id);

      if (!group.members || group.members.length === 0) {
        errors.push(`Group "${group.id}" must have at least one member`);
      }

      for (const member of group.members ?? []) {
        if (!nodeIds.has(member)) {
          errors.push(`Group "${group.id}" references unknown node: "${member}"`);
        }
        if (assignedNodes.has(member)) {
          errors.push(`Node "${member}" belongs to multiple groups`);
        }
        assignedNodes.add(member);
      }

      if (group.direction && !['TB', 'LR'].includes(group.direction)) {
        errors.push(`Group "${group.id}" has invalid direction: "${group.direction}"`);
      }
    }

    if (spec.rows && spec.rows.length > 0) {
      for (const row of spec.rows) {
        for (const groupId of row) {
          if (!groupIds.has(groupId)) {
            errors.push(`Row references unknown group: "${groupId}"`);
          }
        }
      }
    }
  }

  return [...validateChrome(spec as unknown as Record<string, any>), ...errors];
}

function validateGantt(spec: GanttSpec): string[] {
  const errors: string[] = [];

  if (!spec.tasks || spec.tasks.length === 0) {
    errors.push('Gantt chart must have at least one task');
  }

  const taskIds = new Set<string>();
  for (const task of spec.tasks ?? []) {
    if (!task.id) errors.push('Every task must have an id');
    if (!task.label) errors.push(`Task "${task.id}" must have a label`);
    if (!task.start) errors.push(`Task "${task.id}" must have a start date`);
    if (!task.end && task.kind !== 'milestone' && !task.open) {
      errors.push(`Task "${task.id}" must have an end date unless it is a milestone or open`);
    }

    if (task.start && task.end) {
      const start = new Date(task.start);
      const end = new Date(task.end);
      if (isNaN(start.getTime())) errors.push(`Task "${task.id}" has invalid start date: "${task.start}"`);
      if (isNaN(end.getTime())) errors.push(`Task "${task.id}" has invalid end date: "${task.end}"`);
      if (start >= end) errors.push(`Task "${task.id}" start must be before end`);
    }

    if (task.progress != null && (task.progress < 0 || task.progress > 100)) {
      errors.push(`Task "${task.id}" progress must be 0-100`);
    }

    if (taskIds.has(task.id)) errors.push(`Duplicate task id: "${task.id}"`);
    taskIds.add(task.id);
  }

  // Validate dependency refs
  for (const task of spec.tasks ?? []) {
    for (const dep of task.dependencies ?? []) {
      if (!taskIds.has(dep)) {
        errors.push(`Task "${task.id}" depends on unknown task: "${dep}"`);
      }
    }
  }

  return [...validateChrome(spec as unknown as Record<string, any>), ...errors];
}

function validateTimeline(spec: TimelineSpec): string[] {
  const errors: string[] = [];

  if (!spec.events || spec.events.length === 0) {
    errors.push('Timeline must have at least one event');
  }

  for (const event of spec.events ?? []) {
    if (!event.date) errors.push('Every event must have a date');
    if (!event.label) errors.push(`Event at "${event.date}" must have a label`);
    if (event.date && !isISODate(event.date)) errors.push(`Event "${event.label}" has invalid date: "${event.date}"`);
  }

  if (spec.direction && !['TB', 'LR'].includes(spec.direction)) {
    errors.push(`Invalid direction: "${spec.direction}". Must be "TB" or "LR"`);
  }

  return [...validateChrome(spec as unknown as Record<string, any>), ...errors];
}

function validateQuadrant(spec: QuadrantSpec): string[] {
  const errors: string[] = [];

  if (!spec.xAxis) errors.push('Quadrant must have an xAxis');
  if (!spec.yAxis) errors.push('Quadrant must have a yAxis');

  if (spec.xAxis) {
    if (!spec.xAxis.label) errors.push('xAxis must have a label');
    if (!spec.xAxis.low) errors.push('xAxis must have a low label');
    if (!spec.xAxis.high) errors.push('xAxis must have a high label');
  }

  if (spec.yAxis) {
    if (!spec.yAxis.label) errors.push('yAxis must have a label');
    if (!spec.yAxis.low) errors.push('yAxis must have a low label');
    if (!spec.yAxis.high) errors.push('yAxis must have a high label');
  }

  if (!spec.items || spec.items.length === 0) {
    errors.push('Quadrant must have at least one item');
  }

  for (const item of spec.items ?? []) {
    if (!item.label) errors.push('Every item must have a label');
    if (item.x == null || item.x < 0 || item.x > 1) {
      errors.push(`Item "${item.label}" x must be between 0 and 1`);
    }
    if (item.y == null || item.y < 0 || item.y > 1) {
      errors.push(`Item "${item.label}" y must be between 0 and 1`);
    }
  }

  const validPositions = new Set(['top-left', 'top-right', 'bottom-left', 'bottom-right']);
  for (const q of spec.quadrants ?? []) {
    if (!q.label) errors.push('Every quadrant must have a label');
    if (!validPositions.has(q.position)) {
      errors.push(`Quadrant "${q.label}" has invalid position: "${q.position}"`);
    }
  }

  return [...validateChrome(spec as unknown as Record<string, any>), ...errors];
}

const PLACE_TYPES = new Set(['locator-map', 'region-map', 'choropleth', 'corridor', 'symbol-map', 'zoning-map', 'before-after-map']);
const PROCESS_TYPES = new Set(['agenda-states', 'outcome-funnel', 'org', 'vote-matrix', 'impact', 'pipeline', 'hemicycle', 'heatmap-table', 'network', 'donut']);
const TIME_TYPES = new Set(['weekstrip', 'entity-timeline', 'calendar-heatmap', 'sparkline']);
const COMPOSITION_TYPES = new Set(['waffle', 'isotype', 'small-multiples', 'scorecard', 'beeswarm', 'connected-dot', 'data-table']);
const MONEY_TYPES = new Set(['sankey', 'waterfall', 'delta', 'bar', 'grouped-bar', 'stacked-bar', 'treemap', 'bullet', 'slope', 'alluvial', 'range-plot', 'line', 'stacked-area', 'histogram', 'dot-plot']);

function validateCivic(spec: Record<string, any>): string[] {
  const errors = validateChrome(spec);
  const type = spec.type as string;
  if (type === 'stat') {
    if (!spec.stat && !Array.isArray(spec.stats)) errors.push('Stat diagram must have stat or stats');
    return errors;
  }
  if (MONEY_TYPES.has(type)) errors.push(...validateMoney(spec));
  else if (PLACE_TYPES.has(type)) errors.push(...validatePlace(spec));
  else if (PROCESS_TYPES.has(type)) errors.push(...validateProcess(spec));
  else if (TIME_TYPES.has(type)) errors.push(...validateTime(spec));
  else if (COMPOSITION_TYPES.has(type)) errors.push(...validateComposition(spec));
  else errors.push(`Unknown diagram type: "${type}"`);
  return errors;
}

function validateChrome(spec: Record<string, any>): string[] {
  const errors: string[] = [];
  if (spec.unit != null) {
    const unit = typeof spec.unit === 'string' ? spec.unit : spec.unit?.unit;
    if (!['usd', 'percent', 'count'].includes(unit)) errors.push(`Invalid unit: "${unit}"`);
  }
  const sources = spec.source == null ? [] : Array.isArray(spec.source) ? spec.source : [spec.source];
  sources.forEach((source: any, index: number) => {
    if (!source || typeof source.label !== 'string' || !source.label.trim()) errors.push(`source[${index}] must have a label`);
  });
  if (Array.isArray(spec.legend) && spec.legend.some((item: any) => !item?.label)) {
    errors.push('Every legend item must have a label');
  }
  if (spec.legend && !Array.isArray(spec.legend) && typeof spec.legend === 'object') {
    if (!spec.legend.auto && !spec.legend.items?.length) errors.push('LegendSpec must have items or auto: true');
  }
  for (const [index, annotation] of (spec.annotations ?? []).entries()) {
    if (!['callout', 'peak', 'range', 'label'].includes(annotation.kind)) errors.push(`annotations[${index}] has invalid kind`);
    if (annotation.kind === 'range' && (!annotation.from || !annotation.to)) errors.push(`annotations[${index}] range requires from and to`);
    if (annotation.kind !== 'range' && !annotation.at) errors.push(`annotations[${index}] requires at`);
  }
  if (spec.dataTable) {
    if (!Array.isArray(spec.dataTable.columns) || !spec.dataTable.columns.length) errors.push('dataTable.columns must not be empty');
    if (!Array.isArray(spec.dataTable.records)) errors.push('dataTable.records must be an array');
    for (const [index, row] of (spec.dataTable.records ?? []).entries()) {
      if (!Array.isArray(row) || row.length !== spec.dataTable.columns.length) errors.push(`dataTable.records[${index}] must match columns length`);
    }
  }
  return errors;
}

function validateMoney(spec: Record<string, any>): string[] {
  const errors: string[] = [];
  const type = spec.type;
  if (type === 'sankey' || type === 'alluvial') {
    requireArray(spec, 'nodes', errors);
    requireArray(spec, 'links', errors);
    uniqueIds(spec.nodes, 'node', errors);
    const ids = new Set((spec.nodes ?? []).map((node: any) => node.id));
    for (const [index, link] of (spec.links ?? []).entries()) {
      if (!ids.has(link.from) || !ids.has(link.to)) errors.push(`${type}.links[${index}] references an unknown node`);
      if (!finiteNumber(link.value) || link.value < 0) errors.push(`${type}.links[${index}].value must be finite and >= 0`);
      if (link.from === link.to) errors.push(`${type}.links[${index}] must not be a self-loop`);
    }
    const connected = new Set((spec.links ?? []).flatMap((link: any) => [link.from, link.to]));
    for (const node of spec.nodes ?? []) if (!connected.has(node.id)) errors.push(`${type} node "${node.id}" is orphaned`);
    if (hasDirectedCycle(spec.nodes ?? [], spec.links ?? [])) errors.push(`${type} links must be acyclic`);
    if (type === 'alluvial') {
      requireArray(spec, 'stages', errors);
      for (const node of spec.nodes ?? []) if (!spec.stages?.includes(node.stage)) errors.push(`Alluvial node "${node.id}" has unknown stage`);
    }
  } else if (type === 'waterfall') {
    requireArray(spec, 'steps', errors); uniqueIds(spec.steps, 'step', errors);
    for (const [i, step] of (spec.steps ?? []).entries()) if (!finiteNumber(step.value)) errors.push(`steps[${i}].value must be finite`);
  } else if (type === 'delta') {
    if (!finiteNumber(spec.from?.value) || !finiteNumber(spec.to?.value)) errors.push('Delta from.value and to.value must be finite');
  } else if (['bar', 'dot-plot'].includes(type)) {
    requireArray(spec, 'items', errors); uniqueIds(spec.items, 'item', errors); finiteFields(spec.items, ['value'], 'items', errors);
  } else if (['grouped-bar', 'stacked-bar', 'line', 'stacked-area'].includes(type)) {
    const categories = spec.categories ?? spec.periods;
    if (!Array.isArray(categories) || !categories.length) errors.push(`${type} requires categories/periods`);
    requireArray(spec, 'series', errors); uniqueIds(spec.series, 'series', errors);
    for (const [i, series] of (spec.series ?? []).entries()) {
      if (!Array.isArray(series.values) || series.values.length !== categories?.length) errors.push(`series[${i}].values must match categories/periods length`);
      if (series.values?.some((value: any) => !finiteNumber(value))) errors.push(`series[${i}].values must be finite`);
      if (type === 'stacked-area' && series.values?.some((value: number) => value < 0)) errors.push('stacked-area values must be >= 0');
    }
    if (['stacked-bar'].includes(type) && (spec.legend == null || spec.legend === false)) errors.push(`${type} requires a legend`);
  } else if (type === 'treemap') {
    requireArray(spec, 'nodes', errors);
    const visit = (nodes: any[]) => nodes?.forEach((node, i) => {
      if (!node.id || !node.label) errors.push(`treemap node[${i}] requires id and label`);
      if (!node.children?.length && (!finiteNumber(node.value) || node.value < 0)) errors.push(`Treemap leaf "${node.id}" needs value >= 0`);
      visit(node.children);
    });
    visit(spec.nodes);
  } else if (type === 'bullet') {
    requireArray(spec, 'items', errors); uniqueIds(spec.items, 'item', errors); finiteFields(spec.items, ['actual'], 'items', errors);
  } else if (type === 'slope') {
    requireArray(spec, 'items', errors); uniqueIds(spec.items, 'item', errors); finiteFields(spec.items, ['from', 'to'], 'items', errors);
  } else if (type === 'range-plot') {
    requireArray(spec, 'items', errors); uniqueIds(spec.items, 'item', errors); finiteFields(spec.items, ['min', 'max'], 'items', errors);
    for (const item of spec.items ?? []) if (item.min > item.max) errors.push(`Range item "${item.id}" min must be <= max`);
  } else if (type === 'histogram') {
    if (!!spec.values === !!spec.bins) errors.push('Histogram requires exactly one of values or bins');
    if (spec.values?.some((value: any) => !finiteNumber(value))) errors.push('Histogram values must be finite');
    for (const bin of spec.bins ?? []) if (!finiteNumber(bin.start) || !finiteNumber(bin.end) || !finiteNumber(bin.count) || bin.start >= bin.end || bin.count < 0) errors.push('Histogram bins require start < end and count >= 0');
  }
  return errors;
}

function validatePlace(spec: Record<string, any>): string[] {
  const errors: string[] = [];
  if (!spec.basemap?.city) errors.push(`${spec.type} requires basemap.city`);
  if (spec.legend == null || spec.legend === false) errors.push(`${spec.type} requires a legend`);
  const collections = [spec.pins, spec.points, spec.features, spec.parcels, spec.context, spec.before?.parcels, spec.after?.parcels].filter(Array.isArray);
  collections.forEach((items: any[]) => uniqueIds(items, 'feature', errors));
  walkPlace(spec, 'spec', errors);
  const cityName = String(spec.basemap?.city ?? '').toLowerCase();
  const countyName = String(spec.basemap?.county ?? '').toLowerCase();
  if (cityName.includes('terre haute') || countyName.includes('vigo')) {
    const coordinates: Array<{ lon: number; lat: number; field: string }> = [];
    collectCoordinates(spec, 'spec', coordinates);
    for (const coordinate of coordinates) {
      if (Math.abs(coordinate.lon - (-87.4139)) > 0.8 || Math.abs(coordinate.lat - 39.4667) > 0.8) {
        errors.push(`${coordinate.field} is outside the Terre Haute/Vigo city frame (check lon/lat order)`);
      }
    }
  }
  if (spec.type === 'locator-map') requireArray(spec, 'pins', errors);
  if (spec.type === 'symbol-map') requireArray(spec, 'points', errors);
  if (spec.type === 'choropleth') requireArray(spec, 'features', errors);
  if (spec.type === 'zoning-map') requireArray(spec, 'parcels', errors);
  if (spec.type === 'corridor' && !spec.corridor?.path && !spec.corridor?.geojson) errors.push('corridor requires path or geojson');
  if (spec.type === 'region-map' && !spec.region) errors.push('region-map requires region');
  if (spec.type === 'before-after-map' && (!spec.before || !spec.after)) errors.push('before-after-map requires before and after');
  return errors;
}

function walkPlace(value: any, field: string, errors: string[]): void {
  if (!value || typeof value !== 'object') return;
  if (finiteNumber(value.lon) || finiteNumber(value.lat)) {
    if (!finiteNumber(value.lon) || value.lon < -180 || value.lon > 180) errors.push(`${field}.lon must be -180..180`);
    if (!finiteNumber(value.lat) || value.lat < -90 || value.lat > 90) errors.push(`${field}.lat must be -90..90`);
  }
  if (Array.isArray(value.ring) && value.ring.length < 3) errors.push(`${field}.ring must have at least 3 points`);
  if (Array.isArray(value.path) && value.path.length < 2) errors.push(`${field}.path must have at least 2 points`);
  if (typeof value.geojson === 'string') {
    const reference = value.geojson.trim();
    if (reference.startsWith('{') || reference.startsWith('[')) {
      try { JSON.parse(reference); } catch { errors.push(`${field}.geojson contains invalid inline JSON`); }
    } else if (
      /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(reference)
      || reference.startsWith('/')
      || /(?:^|[\\/])\.\.(?:[\\/]|$)/.test(reference)
      || !/\.(geo)?json$/i.test(reference)
    ) {
      errors.push(`${field}.geojson must be an in-root relative .json/.geojson path`);
    }
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === 'theme' || key === 'dataTable') continue;
    if (Array.isArray(child)) child.forEach((entry, index) => walkPlace(entry, `${field}.${key}[${index}]`, errors));
    else if (child && typeof child === 'object') walkPlace(child, `${field}.${key}`, errors);
  }
}

function validateProcess(spec: Record<string, any>): string[] {
  const errors: string[] = [];
  switch (spec.type) {
    case 'agenda-states':
      if (!spec.item) errors.push('agenda-states requires item');
      requireArray(spec.item ?? {}, 'steps', errors); uniqueIds(spec.item?.steps, 'step', errors);
      for (const step of spec.item?.steps ?? []) if (!isISODate(step.date)) errors.push(`Agenda step "${step.id}" has invalid date`);
      break;
    case 'outcome-funnel': requireArray(spec, 'stages', errors); uniqueIds(spec.stages, 'stage', errors); finiteFields(spec.stages, ['value'], 'stages', errors); break;
    case 'org': case 'network': case 'pipeline': {
      requireArray(spec, spec.type === 'pipeline' ? 'stages' : 'nodes', errors); requireArray(spec, 'edges', errors);
      const nodes = spec.type === 'pipeline' ? spec.stages : spec.nodes;
      uniqueIds(nodes, 'node', errors);
      const ids = new Set((nodes ?? []).map((node: any) => node.id));
      for (const edge of spec.edges ?? []) if (!ids.has(edge.from) || !ids.has(edge.to)) errors.push(`${spec.type} edge references unknown node`);
      break;
    }
    case 'vote-matrix':
      requireArray(spec, 'members', errors); requireArray(spec, 'items', errors); requireArray(spec, 'cells', errors);
      uniqueIds(spec.members, 'member', errors); uniqueIds(spec.items, 'item', errors);
      {
        const members = new Set((spec.members ?? []).map((member: any) => member.id));
        const items = new Set((spec.items ?? []).map((item: any) => item.id));
        for (const [index, cell] of (spec.cells ?? []).entries()) {
          if (!members.has(cell.member) || !items.has(cell.item)) errors.push(`vote-matrix cells[${index}] references an unknown member or item`);
        }
      }
      break;
    case 'impact': if (!spec.item) errors.push('impact requires item'); requireArray(spec, 'touches', errors); uniqueIds(spec.touches, 'touch', errors); break;
    case 'hemicycle': if (!spec.item) errors.push('hemicycle requires item'); requireArray(spec, 'seats', errors); uniqueIds(spec.seats, 'seat', errors); break;
    case 'heatmap-table':
      requireArray(spec, 'rows', errors); requireArray(spec, 'columns', errors); requireArray(spec, 'cells', errors);
      uniqueIds(spec.rows, 'row', errors); uniqueIds(spec.columns, 'column', errors); finiteFields(spec.cells, ['value'], 'cells', errors);
      break;
    case 'donut':
      requireArray(spec, 'slices', errors); uniqueIds(spec.slices, 'slice', errors); finiteFields(spec.slices, ['value'], 'slices', errors);
      if ((spec.slices?.length ?? 0) > 5) errors.push('Donut supports 2-5 slices');
      if ((spec.slices?.length ?? 0) < 2) errors.push('Donut supports 2-5 slices');
      if (spec.slices?.some((slice: any) => slice.value < 0)) errors.push('Donut values must be >= 0');
      break;
  }
  return errors;
}

function validateTime(spec: Record<string, any>): string[] {
  const errors: string[] = [];
  if (spec.type === 'weekstrip') {
    dateField(spec.from, 'from', errors); dateField(spec.to, 'to', errors); requireArray(spec, 'marks', errors);
    (spec.marks ?? []).forEach((mark: any, i: number) => dateField(mark.date, `marks[${i}].date`, errors));
    if (isISODate(spec.from) && isISODate(spec.to) && civilTime(spec.from) > civilTime(spec.to)) errors.push('weekstrip from must be before or equal to to');
  } else if (spec.type === 'entity-timeline') {
    requireArray(spec, 'lanes', errors); requireArray(spec, 'events', errors); uniqueIds(spec.lanes, 'lane', errors);
    const lanes = new Set((spec.lanes ?? []).map((lane: any) => lane.id));
    (spec.events ?? []).forEach((event: any, i: number) => { dateField(event.date, `events[${i}].date`, errors); if (!lanes.has(event.lane)) errors.push(`events[${i}] has unknown lane`); });
  } else if (spec.type === 'calendar-heatmap') {
    dateField(spec.from, 'from', errors); dateField(spec.to, 'to', errors); requireArray(spec, 'cells', errors);
    (spec.cells ?? []).forEach((cell: any, i: number) => { dateField(cell.date, `cells[${i}].date`, errors); if (!finiteNumber(cell.value) || cell.value < 0) errors.push(`cells[${i}].value must be >= 0`); });
    if (isISODate(spec.from) && isISODate(spec.to) && civilTime(spec.from) > civilTime(spec.to)) errors.push('calendar-heatmap from must be before or equal to to');
  } else if (spec.type === 'sparkline') {
    if (!Array.isArray(spec.values) || spec.values.length < 2 || spec.values.some((value: any) => !finiteNumber(value))) errors.push('Sparkline values must contain at least two finite numbers');
    if (spec.dates && spec.dates.length !== spec.values?.length) errors.push('Sparkline dates must match values length');
    (spec.dates ?? []).forEach((date: string, i: number) => dateField(date, `dates[${i}]`, errors));
  }
  return errors;
}

function validateComposition(spec: Record<string, any>): string[] {
  const errors: string[] = [];
  if (spec.type === 'waffle' || spec.type === 'isotype') {
    requireArray(spec, 'categories', errors); uniqueIds(spec.categories, 'category', errors); finiteFields(spec.categories, ['value'], 'categories', errors);
    if (spec.categories?.some((item: any) => item.value < 0 || !Number.isInteger(item.value))) errors.push(`${spec.type} category values must be non-negative integers`);
    if (spec.type === 'waffle' && (spec.legend == null || spec.legend === false)) errors.push('waffle requires a legend');
    if (spec.type === 'isotype' && spec.scale?.unitsPerIcon != null && (!Number.isInteger(spec.scale.unitsPerIcon) || spec.scale.unitsPerIcon < 1)) errors.push('isotype scale.unitsPerIcon must be an integer >= 1');
  } else if (spec.type === 'small-multiples') {
    requireArray(spec, 'panels', errors); uniqueIds(spec.panels, 'panel', errors);
  } else if (spec.type === 'scorecard') {
    requireArray(spec, 'rows', errors); uniqueIds(spec.rows, 'row', errors);
    for (const row of spec.rows ?? []) if (!finiteNumber(row.promised?.value) || !finiteNumber(row.delivered?.value)) errors.push(`Scorecard row "${row.id}" needs finite promised and delivered values`);
  } else if (spec.type === 'beeswarm') {
    requireArray(spec, 'items', errors); uniqueIds(spec.items, 'item', errors); finiteFields(spec.items, ['value'], 'items', errors);
    if (spec.log && spec.items?.some((item: any) => item.value <= 0)) errors.push('Log beeswarm values must be > 0');
  } else if (spec.type === 'connected-dot') {
    requireArray(spec, 'rows', errors); uniqueIds(spec.rows, 'row', errors);
    for (const row of spec.rows ?? []) if (!finiteNumber(row.from?.value) || !finiteNumber(row.to?.value)) errors.push(`Connected-dot row "${row.id}" needs finite values`);
  } else if (spec.type === 'data-table') {
    requireArray(spec, 'columns', errors); requireArray(spec, 'rows', errors); uniqueIds(spec.columns, 'column', errors);
    if (spec.sort && !(spec.columns ?? []).some((column: any) => column.id === spec.sort.column)) errors.push(`data-table sort references unknown column "${spec.sort.column}"`);
    const columns = new Map((spec.columns ?? []).map((column: any) => [column.id, column]));
    for (const [rowIndex, row] of (spec.rows ?? []).entries()) for (const [key, value] of Object.entries(row)) {
      const column: any = columns.get(key);
      if (!column) continue;
      if (column.encode === 'sparkline' && (!Array.isArray(value) || value.some((item: any) => !finiteNumber(item)))) errors.push(`rows[${rowIndex}].${key} must be a numeric array`);
      if (['bar', 'heat'].includes(column.encode) && !finiteNumber(value)) errors.push(`rows[${rowIndex}].${key} must be numeric`);
    }
  }
  return errors;
}

function requireArray(spec: Record<string, any>, field: string, errors: string[]): void {
  if (!Array.isArray(spec[field]) || spec[field].length === 0) errors.push(`${spec.type ?? 'Spec'} ${field} must not be empty`);
}

function uniqueIds(items: any[] | undefined, label: string, errors: string[]): void {
  const seen = new Set<string>();
  for (const [index, item] of (items ?? []).entries()) {
    if (!item?.id) errors.push(`Every ${label} must have an id (${index})`);
    else if (seen.has(item.id)) errors.push(`Duplicate ${label} id: "${item.id}"`);
    else seen.add(item.id);
  }
}

function finiteFields(items: any[] | undefined, fields: string[], label: string, errors: string[]): void {
  for (const [index, item] of (items ?? []).entries()) for (const field of fields) {
    if (!finiteNumber(item?.[field])) errors.push(`${label}[${index}].${field} must be finite`);
  }
}

function finiteNumber(value: any): value is number { return typeof value === 'number' && Number.isFinite(value); }
function hasDirectedCycle(nodes: any[], edges: any[]): boolean {
  const adjacency = new Map(nodes.map(node => [node.id, [] as string[]]));
  for (const edge of edges) adjacency.get(edge.from)?.push(edge.to);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const next of adjacency.get(id) ?? []) if (visit(next)) return true;
    visiting.delete(id); visited.add(id); return false;
  };
  return nodes.some(node => visit(node.id));
}
function collectCoordinates(value: any, field: string, output: Array<{ lon: number; lat: number; field: string }>): void {
  if (!value || typeof value !== 'object') return;
  if (finiteNumber(value.lon) && finiteNumber(value.lat)) output.push({ lon: value.lon, lat: value.lat, field });
  for (const [key, child] of Object.entries(value)) {
    if (key === 'theme' || key === 'dataTable' || key === 'geojson') continue;
    if (Array.isArray(child)) child.forEach((entry, index) => collectCoordinates(entry, `${field}.${key}[${index}]`, output));
    else if (child && typeof child === 'object') collectCoordinates(child, `${field}.${key}`, output);
  }
}
function isISODate(value: any): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}(?:-\d{2})?(?:T\d{2}:\d{2}(?::\d{2})?)?$/.test(value)) return false;
  const match = value.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (!match) return false;
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3] ?? 1);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
function dateField(value: any, field: string, errors: string[]): void { if (!isISODate(value)) errors.push(`${field} must be an ISO civil date`); }
function civilTime(value: string): number {
  const match = value.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/)!;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3] ?? 1));
}

/** Safe for generated links in SVG/HTML publication output. */
export function isSafeHref(href: string): boolean {
  const value = href.trim();
  if (!value || /[\u0000-\u001f\u007f]/.test(value) || value.startsWith('//')) return false;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) return true;
  try {
    return ['http:', 'https:', 'mailto:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function validateHrefValues(value: unknown, field: string, errors: string[]): void {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const childField = `${field}.${key}`;
    if (key === 'href' && (typeof child !== 'string' || !isSafeHref(child))) {
      errors.push(`${childField} must use http, https, mailto, or a relative URL`);
    }
    validateHrefValues(child, childField, errors);
  }
}
