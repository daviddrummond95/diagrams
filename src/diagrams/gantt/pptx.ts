import pptxgen from 'pptxgenjs';
import type { GanttSpec, GanttLayoutResult, ThemeConfig } from '../../types.js';

const SLIDE_W = 13.33;
const SLIDE_H = 7.5;
const MARGIN = 0.5;
const PX_PER_INCH = 96;

function hex(color: string): string {
  return color.replace(/^#/, '');
}

function toInches(px: number, scale: number): number {
  return (px / PX_PER_INCH) * scale;
}

export async function renderGanttToPptx(
  spec: GanttSpec,
  layout: GanttLayoutResult,
  theme: ThemeConfig,
): Promise<Buffer> {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';

  const diagramW = layout.width / PX_PER_INCH;
  const diagramH = layout.height / PX_PER_INCH;
  const availW = SLIDE_W - MARGIN * 2;
  const availH = SLIDE_H - MARGIN * 2;
  const scale = Math.min(1, availW / diagramW, availH / diagramH);

  const scaledW = diagramW * scale;
  const scaledH = diagramH * scale;
  const offsetX = MARGIN + (availW - scaledW) / 2;
  const offsetY = MARGIN + (availH - scaledH) / 2;

  const px = (v: number) => toInches(v, scale);
  const x = (v: number) => offsetX + px(v);
  const y = (v: number) => offsetY + px(v);

  const slide = pptx.addSlide();
  slide.background = { color: hex(theme.canvas.background) };

  const gt = theme.gantt;
  const gridLineColor = hex(gt?.gridLineColor ?? (theme.name === 'dark' ? '#1E293B' : '#F1F5F9'));
  const labelWidth = 160;

  // Title
  if (spec.title) {
    slide.addText(spec.title, {
      x: 0, y: 0.15, w: SLIDE_W, h: 0.4,
      fontSize: 18, fontFace: theme.fontFamily,
      color: hex(theme.node.textColor), bold: true,
      align: 'center', valign: 'middle',
    });
  }

  // Vertical grid lines at date labels
  for (const dl of layout.dateLabels) {
    slide.addShape(pptx.ShapeType.line, {
      x: x(dl.x), y: y(layout.headerHeight),
      w: 0.01, h: px(layout.height - layout.headerHeight),
      line: { color: gridLineColor, width: 0.5 },
    });

    // Date header label
    slide.addText(dl.label, {
      x: x(dl.x) - px(20), y: y(layout.headerHeight - 22),
      w: px(40), h: 0.2,
      fontSize: gt?.dateHeaderFontSize ?? 11,
      fontFace: theme.fontFamily,
      color: hex(gt?.dateHeaderColor ?? theme.node.textColorSecondary),
      align: 'center', valign: 'middle',
    });
  }

  // Group labels
  for (const gl of layout.groupLabels) {
    slide.addText(gl.label, {
      x: x(8), y: y(gl.y) - px(18),
      w: px(labelWidth - 16), h: 0.2,
      fontSize: gt?.groupLabelFontSize ?? 11,
      fontFace: theme.fontFamily,
      color: hex(gt?.groupLabelColor ?? theme.node.textColorSecondary),
      bold: true, align: 'left', valign: 'middle',
    });
  }

  // Task bars
  const barRadius = toInches(gt?.barRadius ?? 6, scale);
  const progressOpacity = gt?.progressFillOpacity ?? 0.3;

  for (const task of layout.tasks) {
    // Task label
    slide.addText(task.label, {
      x: x(20), y: y(task.y),
      w: px(labelWidth - 28), h: px(task.height),
      fontSize: gt?.barLabelFontSize ?? 13,
      fontFace: theme.fontFamily,
      color: hex(gt?.barLabelColor ?? theme.node.textColor),
      bold: true, align: 'left', valign: 'middle',
    });

    // Bar background (lower opacity)
    slide.addShape(pptx.ShapeType.roundRect, {
      x: x(task.x), y: y(task.y),
      w: px(task.width), h: px(task.height),
      fill: { color: hex(task.color), transparency: (1 - progressOpacity) * 100 },
      rectRadius: barRadius,
    });

    // Progress fill
    if (task.progress > 0) {
      const progressWidth = (task.progress / 100) * task.width;
      slide.addShape(pptx.ShapeType.roundRect, {
        x: x(task.x), y: y(task.y),
        w: px(progressWidth), h: px(task.height),
        fill: { color: hex(task.color), transparency: 15 },
        rectRadius: barRadius,
      });
    }

    // Progress text
    if (task.progress > 0 && task.width > 50) {
      slide.addText(`${task.progress}%`, {
        x: x(task.x), y: y(task.y),
        w: px(task.width), h: px(task.height),
        fontSize: 10, fontFace: theme.fontFamily,
        color: 'FFFFFF', bold: true,
        align: 'center', valign: 'middle',
      });
    }
  }

  // Dependency arrows
  for (const dep of layout.dependencies) {
    const nums = dep.pathData.match(/-?[\d.]+/g)?.map(Number);
    if (!nums || nums.length < 4) continue;
    const sx = nums[0], sy = nums[1];
    const ex = nums[nums.length - 2], ey = nums[nums.length - 1];
    const lx = Math.min(sx, ex);
    const ly = Math.min(sy, ey);
    slide.addShape(pptx.ShapeType.line, {
      x: x(lx), y: y(ly),
      w: px(Math.abs(ex - sx)) || 0.01,
      h: px(Math.abs(ey - sy)) || 0.01,
      flipH: ex < sx, flipV: ey < sy,
      line: {
        color: hex(gt?.dependencyArrowColor ?? theme.edge.color),
        width: 1.5, dashType: 'dash',
        endArrowType: 'triangle',
      },
    });
  }

  const output = await pptx.write({ outputType: 'nodebuffer' });
  return Buffer.from(output as ArrayBuffer);
}
