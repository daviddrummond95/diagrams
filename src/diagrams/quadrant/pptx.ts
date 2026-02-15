import pptxgen from 'pptxgenjs';
import type { QuadrantSpec, QuadrantLayoutResult, ThemeConfig } from '../../types.js';

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

export async function renderQuadrantToPptx(
  spec: QuadrantSpec,
  layout: QuadrantLayoutResult,
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

  // Title
  if (spec.title) {
    slide.addText(spec.title, {
      x: 0, y: 0.15, w: SLIDE_W, h: 0.4,
      fontSize: 18, fontFace: theme.fontFamily,
      color: hex(theme.node.textColor), bold: true,
      align: 'center', valign: 'middle',
    });
  }

  const qt = theme.quadrant;
  const quadrantOpacity = (qt?.quadrantOpacity ?? 0.15) * 100;

  // Quadrant backgrounds
  for (const q of layout.quadrants) {
    slide.addShape(pptx.ShapeType.rect, {
      x: x(q.x), y: y(q.y), w: px(q.width), h: px(q.height),
      fill: { color: hex(q.color), transparency: 100 - quadrantOpacity },
    });

    if (q.label) {
      slide.addText(q.label, {
        x: x(q.x), y: y(q.y), w: px(q.width), h: px(q.height),
        fontSize: qt?.axisLabelFontSize ?? 13,
        fontFace: theme.fontFamily,
        color: hex(qt?.axisLabelColor ?? theme.node.textColorSecondary),
        align: 'center', valign: 'middle',
      });
    }
  }

  // Grid border
  const gx = layout.gridOrigin.x;
  const gy = layout.gridOrigin.y;
  const gs = layout.gridSize;
  slide.addShape(pptx.ShapeType.rect, {
    x: x(gx), y: y(gy), w: px(gs), h: px(gs),
    fill: { type: 'none' },
    line: { color: hex(qt?.axisColor ?? theme.edge.color), width: 1.5 },
  });

  // Center lines (vertical)
  slide.addShape(pptx.ShapeType.line, {
    x: x(gx + gs / 2), y: y(gy), w: 0.01, h: px(gs),
    line: { color: hex(qt?.axisColor ?? theme.edge.color), width: 1, dashType: 'dash' },
  });
  // Center lines (horizontal)
  slide.addShape(pptx.ShapeType.line, {
    x: x(gx), y: y(gy + gs / 2), w: px(gs), h: 0.01,
    line: { color: hex(qt?.axisColor ?? theme.edge.color), width: 1, dashType: 'dash' },
  });

  // Axis labels
  const axisColor = hex(qt?.axisLabelColor ?? theme.node.textColorSecondary);
  const axisFontSize = 11;

  // X-axis: low, label, high
  slide.addText(layout.xAxis.low, {
    x: x(gx), y: y(gy + gs + 8), w: px(gs / 3), h: 0.25,
    fontSize: axisFontSize, fontFace: theme.fontFamily, color: axisColor, align: 'left',
  });
  slide.addText(layout.xAxis.label, {
    x: x(gx + gs / 3), y: y(gy + gs + 8), w: px(gs / 3), h: 0.25,
    fontSize: qt?.axisLabelFontSize ?? 13, fontFace: theme.fontFamily, color: axisColor, bold: true, align: 'center',
  });
  slide.addText(layout.xAxis.high, {
    x: x(gx + gs * 2 / 3), y: y(gy + gs + 8), w: px(gs / 3), h: 0.25,
    fontSize: axisFontSize, fontFace: theme.fontFamily, color: axisColor, align: 'right',
  });

  // Y-axis: high, label, low
  slide.addText(layout.yAxis.high, {
    x: x(gx - 46), y: y(gy), w: px(40), h: 0.25,
    fontSize: axisFontSize, fontFace: theme.fontFamily, color: axisColor, align: 'center',
  });
  slide.addText(layout.yAxis.label, {
    x: x(gx - 46), y: y(gy + gs / 2 - 10), w: px(40), h: 0.25,
    fontSize: qt?.axisLabelFontSize ?? 13, fontFace: theme.fontFamily, color: axisColor, bold: true, align: 'center',
  });
  slide.addText(layout.yAxis.low, {
    x: x(gx - 46), y: y(gy + gs - 20), w: px(40), h: 0.25,
    fontSize: axisFontSize, fontFace: theme.fontFamily, color: axisColor, align: 'center',
  });

  // Item dots + labels
  const dotSize = qt?.dotSize ?? 12;
  for (const item of layout.items) {
    const color = hex(item.color ?? theme.node.textColor);
    slide.addShape(pptx.ShapeType.ellipse, {
      x: x(item.x) - px(dotSize / 2), y: y(item.y) - px(dotSize / 2),
      w: px(dotSize), h: px(dotSize),
      fill: { color },
    });
    slide.addText(item.label, {
      x: x(item.x) + px(dotSize / 2 + 4), y: y(item.y) - px(7),
      w: 1.5, h: 0.2,
      fontSize: qt?.dotLabelFontSize ?? 11,
      fontFace: theme.fontFamily,
      color: hex(qt?.dotLabelColor ?? theme.node.textColor),
      bold: true, align: 'left', valign: 'middle',
    });
  }

  const output = await pptx.write({ outputType: 'nodebuffer' });
  return Buffer.from(output as ArrayBuffer);
}
