import type { GanttSpec, GanttLayoutResult, ThemeConfig, SatoriElement } from '../../types.js';

export function buildGanttTree(
  spec: GanttSpec,
  layout: GanttLayoutResult,
  theme: ThemeConfig,
): SatoriElement {
  const gt = theme.gantt;
  const barRadius = gt?.barRadius ?? 6;
  const gridLineColor = gt?.gridLineColor ?? (theme.name === 'dark' ? '#1E293B' : '#F1F5F9');
  const groupLabelColor = gt?.groupLabelColor ?? theme.node.textColorSecondary;
  const groupLabelFontSize = gt?.groupLabelFontSize ?? 11;
  const barLabelColor = gt?.barLabelColor ?? theme.node.textColor;
  const barLabelFontSize = gt?.barLabelFontSize ?? 13;
  const progressFillOpacity = gt?.progressFillOpacity ?? 0.3;
  const depArrowColor = gt?.dependencyArrowColor ?? theme.edge.color;
  const dateHeaderColor = gt?.dateHeaderColor ?? theme.node.textColorSecondary;
  const dateHeaderFontSize = gt?.dateHeaderFontSize ?? 11;

  const children: SatoriElement[] = [];
  const labelWidth = 160;

  // Grid lines SVG (vertical date lines + horizontal task lines)
  const svgChildren: SatoriElement[] = [];

  // Vertical grid lines at each date label
  for (const dl of layout.dateLabels) {
    svgChildren.push({
      type: 'line',
      props: {
        x1: String(dl.x),
        y1: String(layout.headerHeight),
        x2: String(dl.x),
        y2: String(layout.height),
        stroke: gridLineColor,
        'stroke-width': '1',
      },
    });
  }

  // Horizontal grid lines per task
  for (const task of layout.tasks) {
    svgChildren.push({
      type: 'line',
      props: {
        x1: String(labelWidth),
        y1: String(task.y + task.height + 4),
        x2: String(layout.width),
        y2: String(task.y + task.height + 4),
        stroke: gridLineColor,
        'stroke-width': '0.5',
      },
    });
  }

  // Dependency arrows
  for (const dep of layout.dependencies) {
    svgChildren.push({
      type: 'path',
      props: {
        d: dep.pathData,
        fill: 'none',
        stroke: depArrowColor,
        'stroke-width': '1.5',
        'stroke-dasharray': '4,3',
      },
    });
  }

  children.push({
    type: 'svg',
    props: {
      xmlns: 'http://www.w3.org/2000/svg',
      width: String(layout.width),
      height: String(layout.height),
      viewBox: `0 0 ${layout.width} ${layout.height}`,
      style: { position: 'absolute' as const, top: 0, left: 0 },
      children: svgChildren,
    },
  });

  // Date header labels
  for (const dl of layout.dateLabels) {
    children.push({
      type: 'div',
      props: {
        style: {
          position: 'absolute' as const,
          left: dl.x - 20,
          top: layout.headerHeight - 22,
          width: 40,
          display: 'flex' as const,
          justifyContent: 'center',
          fontSize: dateHeaderFontSize,
          color: dateHeaderColor,
          fontFamily: theme.fontFamily,
        },
        children: dl.label,
      },
    });
  }

  // Group labels (left side)
  for (const gl of layout.groupLabels) {
    children.push({
      type: 'div',
      props: {
        style: {
          position: 'absolute' as const,
          left: 8,
          top: gl.y - groupLabelFontSize / 2 - 12,
          width: labelWidth - 16,
          display: 'flex' as const,
          fontSize: groupLabelFontSize,
          fontWeight: 600,
          color: groupLabelColor,
          fontFamily: theme.fontFamily,
          letterSpacing: '0.05em',
        },
        children: gl.label,
      },
    });
  }

  // Task bars with labels
  for (const task of layout.tasks) {
    // Task label (left of bar)
    children.push({
      type: 'div',
      props: {
        style: {
          position: 'absolute' as const,
          left: 20,
          top: task.y,
          width: labelWidth - 28,
          height: task.height,
          display: 'flex' as const,
          alignItems: 'center',
          fontSize: barLabelFontSize,
          fontWeight: 500,
          color: barLabelColor,
          fontFamily: theme.fontFamily,
          overflow: 'hidden',
        },
        children: task.label,
      },
    });

    // Bar background (full width, lower opacity)
    children.push({
      type: 'div',
      props: {
        style: {
          position: 'absolute' as const,
          left: task.x,
          top: task.y,
          width: task.width,
          height: task.height,
          borderRadius: barRadius,
          backgroundColor: task.color,
          opacity: progressFillOpacity,
          display: 'flex' as const,
        },
        children: '',
      },
    });

    // Bar progress fill (front portion, full opacity)
    if (task.progress > 0) {
      const progressWidth = (task.progress / 100) * task.width;
      children.push({
        type: 'div',
        props: {
          style: {
            position: 'absolute' as const,
            left: task.x,
            top: task.y,
            width: progressWidth,
            height: task.height,
            borderRadius: barRadius,
            backgroundColor: task.color,
            opacity: 0.85,
            display: 'flex' as const,
          },
          children: '',
        },
      });
    }

    // Progress text on bar
    if (task.progress > 0 && task.width > 50) {
      children.push({
        type: 'div',
        props: {
          style: {
            position: 'absolute' as const,
            left: task.x,
            top: task.y,
            width: task.width,
            height: task.height,
            display: 'flex' as const,
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 600,
            color: '#FFFFFF',
            fontFamily: theme.fontFamily,
          },
          children: `${task.progress}%`,
        },
      });
    }
  }

  // Title
  if (spec.title) {
    children.unshift({
      type: 'div',
      props: {
        style: {
          position: 'absolute' as const,
          top: 8,
          left: 0,
          width: layout.width,
          display: 'flex' as const,
          justifyContent: 'center',
          fontSize: 18,
          fontWeight: 600,
          color: theme.node.textColor,
          fontFamily: theme.fontFamily,
        },
        children: spec.title,
      },
    });
  }

  return {
    type: 'div',
    props: {
      style: {
        position: 'relative' as const,
        display: 'flex' as const,
        width: layout.width,
        height: layout.height,
        backgroundColor: theme.canvas.background,
        fontFamily: theme.fontFamily,
      },
      children,
    },
  };
}
