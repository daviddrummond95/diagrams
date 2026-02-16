import pptxgen from 'pptxgenjs';
import type { TimelineSpec, TimelineLayoutResult, ThemeConfig, RenderOptions } from '../../types.js';

const SLIDE_W = 13.33;
const SLIDE_H = 7.5;
const MARGIN = 0.3;
const PX_PER_INCH = 96;

function hex(color: string): string {
  return color.replace(/^#/, '');
}

function toInches(px: number, scale: number): number {
  return (px / PX_PER_INCH) * scale;
}

export async function renderTimelineToPptx(
  spec: TimelineSpec,
  layout: TimelineLayoutResult,
  theme: ThemeConfig,
  options: RenderOptions = {},
): Promise<Buffer> {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';

  const diagramW = layout.width / PX_PER_INCH;
  const diagramH = layout.height / PX_PER_INCH;
  const availW = SLIDE_W - MARGIN * 2;
  const availH = SLIDE_H - MARGIN * 2;
  const scale = Math.min(1.5, availW / diagramW, availH / diagramH);

  const scaledW = diagramW * scale;
  const scaledH = diagramH * scale;
  const offsetX = MARGIN + (availW - scaledW) / 2;
  const offsetY = MARGIN + (availH - scaledH) / 2;

  const px = (v: number) => toInches(v, scale);
  const x = (v: number) => offsetX + px(v);
  const y = (v: number) => offsetY + px(v);

  const isTransparent = options.background === 'transparent';
  const showTitle = options.showTitle !== false;

  const slide = pptx.addSlide();
  if (!isTransparent) {
    slide.background = { color: hex(theme.canvas.background) };
  }

  const tt = theme.timeline;
  const lineColor = hex(tt?.lineColor ?? theme.edge.color);
  const dotSize = tt?.dotSize ?? 14;

  // Title
  if (spec.title && showTitle) {
    slide.addText(spec.title, {
      x: 0, y: 0.15, w: SLIDE_W, h: 0.4,
      fontSize: 18, fontFace: theme.fontFamily,
      color: hex(theme.node.textColor), bold: true,
      align: 'center', valign: 'middle',
    });
  }

  // Main line - parse the path to get start/end
  const lineNums = layout.linePath.match(/-?[\d.]+/g)?.map(Number);
  if (lineNums && lineNums.length >= 4) {
    const [sx, sy, ex, ey] = [lineNums[0], lineNums[1], lineNums[lineNums.length - 2], lineNums[lineNums.length - 1]];
    const lx = Math.min(sx, ex);
    const ly = Math.min(sy, ey);
    const lw = Math.abs(ex - sx);
    const lh = Math.abs(ey - sy);
    slide.addShape(pptx.ShapeType.line, {
      x: x(lx), y: y(ly),
      w: px(lw) || 0.01, h: px(lh) || 0.01,
      flipH: ex < sx, flipV: ey < sy,
      line: { color: lineColor, width: 3 },
    });
  }

  // Events: dots, connector lines, cards
  for (const evt of layout.events) {
    const accentColor = hex(evt.color ?? tt?.lineColor ?? theme.edge.color);

    // Connector line
    const connNums = evt.connectorPath.match(/-?[\d.]+/g)?.map(Number);
    if (connNums && connNums.length >= 4) {
      const [cx1, cy1, cx2, cy2] = [connNums[0], connNums[1], connNums[connNums.length - 2], connNums[connNums.length - 1]];
      const clx = Math.min(cx1, cx2);
      const cly = Math.min(cy1, cy2);
      slide.addShape(pptx.ShapeType.line, {
        x: x(clx), y: y(cly),
        w: px(Math.abs(cx2 - cx1)) || 0.01, h: px(Math.abs(cy2 - cy1)) || 0.01,
        flipH: cx2 < cx1, flipV: cy2 < cy1,
        line: { color: lineColor, width: 1.5, dashType: 'dash' },
      });
    }

    // Dot
    slide.addShape(pptx.ShapeType.ellipse, {
      x: x(evt.dotX) - px(dotSize / 2), y: y(evt.dotY) - px(dotSize / 2),
      w: px(dotSize), h: px(dotSize),
      fill: { color: accentColor },
      line: { color: hex(theme.canvas.background), width: 2 },
    });

    // Card background
    const cardW = px(220);
    const cardH = px(70);
    slide.addShape(pptx.ShapeType.roundRect, {
      x: x(evt.cardX), y: y(evt.cardY),
      w: cardW, h: cardH,
      fill: { color: hex(theme.node.background) },
      line: { color: hex(theme.node.border), width: 1.5 },
      rectRadius: toInches(10, scale),
    });

    // Accent bar on left of card
    slide.addShape(pptx.ShapeType.rect, {
      x: x(evt.cardX), y: y(evt.cardY),
      w: px(3), h: cardH,
      fill: { color: accentColor },
    });

    // Card text (date + label + description)
    const textLines: pptxgen.TextProps[] = [];
    textLines.push({
      text: evt.date,
      options: {
        fontSize: tt?.dateFontSize ?? 11,
        fontFace: theme.fontFamily,
        color: hex(tt?.dateColor ?? theme.node.textColorSecondary),
      },
    });
    textLines.push({ text: '\n', options: { fontSize: 4 } });
    textLines.push({
      text: evt.label,
      options: {
        fontSize: tt?.labelFontSize ?? 14,
        fontFace: theme.fontFamily,
        color: hex(theme.node.textColor),
        bold: true,
      },
    });
    textLines.push({ text: '\n', options: { fontSize: 4 } });
    if (evt.description) {
      textLines.push({
        text: evt.description,
        options: {
          fontSize: tt?.descriptionFontSize ?? 12,
          fontFace: theme.fontFamily,
          color: hex(theme.node.textColorSecondary),
        },
      });
    }

    slide.addText(textLines, {
      x: x(evt.cardX) + px(10), y: y(evt.cardY) + px(4),
      w: cardW - px(16), h: cardH - px(8),
      valign: 'top', margin: 0,
    });
  }

  const output = await pptx.write({ outputType: 'nodebuffer' });
  return Buffer.from(output as ArrayBuffer);
}
