import type { DiagramSpec } from './types.js';

export function validate(spec: DiagramSpec): string[] {
  const errors: string[] = [];

  if (!spec.nodes || spec.nodes.length === 0) {
    errors.push('Diagram must have at least one node');
  }

  const nodeIds = new Set(spec.nodes?.map(n => n.id) ?? []);

  // Check for duplicate node IDs
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

  // Check edges reference valid nodes
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

  // Validate groups
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

    // Validate rows
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
