import type { AnyDiagramSpec, DiagramSpec, GanttSpec, TimelineSpec, QuadrantSpec } from './types.js';

export function validate(spec: AnyDiagramSpec): string[] {
  const type = spec.type ?? 'flow';
  switch (type) {
    case 'gantt':
      return validateGantt(spec as GanttSpec);
    case 'timeline':
      return validateTimeline(spec as TimelineSpec);
    case 'quadrant':
      return validateQuadrant(spec as QuadrantSpec);
    case 'flow':
    default:
      return validateFlow(spec as DiagramSpec);
  }
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

  return errors;
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
    if (!task.end) errors.push(`Task "${task.id}" must have an end date`);

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

  return errors;
}

function validateTimeline(spec: TimelineSpec): string[] {
  const errors: string[] = [];

  if (!spec.events || spec.events.length === 0) {
    errors.push('Timeline must have at least one event');
  }

  for (const event of spec.events ?? []) {
    if (!event.date) errors.push('Every event must have a date');
    if (!event.label) errors.push(`Event at "${event.date}" must have a label`);
  }

  if (spec.direction && !['TB', 'LR'].includes(spec.direction)) {
    errors.push(`Invalid direction: "${spec.direction}". Must be "TB" or "LR"`);
  }

  return errors;
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

  return errors;
}
