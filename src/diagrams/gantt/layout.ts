import type { GanttSpec, GanttLayoutResult, ThemeConfig } from '../../types.js';

const DEFAULT_COLORS = [
  '#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#14B8A6',
];

export function layoutGantt(spec: GanttSpec, theme: ThemeConfig, padding: number): GanttLayoutResult {
  const gt = theme.gantt;
  const barHeight = gt?.barHeight ?? 28;
  const barGap = gt?.barGap ?? 8;
  const headerHeight = gt?.headerHeight ?? 40;
  const labelWidth = 160;
  const titleOffset = spec.title ? 40 : 0;

  // Parse all dates to find global range
  const allDates = spec.tasks.flatMap(t => [new Date(t.start), new Date(t.end)]);
  const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
  const totalDays = Math.max(1, (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));

  // Chart area
  const chartLeft = padding + labelWidth;
  const chartWidth = Math.max(400, totalDays * 8); // ~8px per day
  const totalWidth = chartLeft + chartWidth + padding;

  // Group tasks
  const groups = new Map<string, typeof spec.tasks>();
  const ungrouped: typeof spec.tasks = [];
  for (const task of spec.tasks) {
    if (task.group) {
      if (!groups.has(task.group)) groups.set(task.group, []);
      groups.get(task.group)!.push(task);
    } else {
      ungrouped.push(task);
    }
  }

  // Build ordered list: ungrouped first, then each group
  const orderedTasks: Array<{ task: typeof spec.tasks[0]; group?: string }> = [];
  for (const task of ungrouped) orderedTasks.push({ task });
  for (const [groupName, tasks] of groups) {
    for (const task of tasks) orderedTasks.push({ task, group: groupName });
  }

  // Layout tasks as horizontal bars
  let currentY = padding + titleOffset + headerHeight;
  const taskPositions = new Map<string, { x: number; y: number; width: number; height: number }>();
  const groupLabels: Array<{ label: string; y: number }> = [];
  const seenGroups = new Set<string>();
  let colorIndex = 0;

  const layoutTasks = orderedTasks.map(({ task, group }) => {
    // Add group label if first in group — add vertical gap for label
    if (group && !seenGroups.has(group)) {
      seenGroups.add(group);
      currentY += 18; // extra space for group label above first task
      groupLabels.push({ label: group, y: currentY });
    }

    const startDays = (new Date(task.start).getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
    const endDays = (new Date(task.end).getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
    const x = chartLeft + (startDays / totalDays) * chartWidth;
    const width = Math.max(4, ((endDays - startDays) / totalDays) * chartWidth);
    const y = currentY;
    const color = task.color ?? DEFAULT_COLORS[colorIndex % DEFAULT_COLORS.length];
    colorIndex++;

    const pos = { x, y, width, height: barHeight };
    taskPositions.set(task.id, pos);

    currentY += barHeight + barGap;

    return {
      id: task.id,
      label: task.label,
      x,
      y,
      width,
      height: barHeight,
      color,
      progress: task.progress ?? 0,
      group,
    };
  });

  // Generate date labels along the header
  const dateLabels: Array<{ label: string; x: number }> = [];
  const labelInterval = Math.max(1, Math.ceil(totalDays / 12)); // ~12 labels max
  for (let d = 0; d <= totalDays; d += labelInterval) {
    const date = new Date(minDate.getTime() + d * 24 * 60 * 60 * 1000);
    const label = `${date.getMonth() + 1}/${date.getDate()}`;
    const x = chartLeft + (d / totalDays) * chartWidth;
    dateLabels.push({ label, x });
  }

  // Dependency arrows
  const dependencies: Array<{ pathData: string }> = [];
  for (const task of spec.tasks) {
    for (const dep of task.dependencies ?? []) {
      const from = taskPositions.get(dep);
      const to = taskPositions.get(task.id);
      if (from && to) {
        const startX = from.x + from.width;
        const startY = from.y + from.height / 2;
        const endX = to.x;
        const endY = to.y + to.height / 2;
        const midX = (startX + endX) / 2;
        const pathData = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
        dependencies.push({ pathData });
      }
    }
  }

  const totalHeight = currentY + padding;

  return {
    tasks: layoutTasks,
    dependencies,
    dateLabels,
    groupLabels,
    width: totalWidth,
    height: totalHeight,
    headerHeight: padding + titleOffset + headerHeight,
  };
}
