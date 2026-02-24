import pptxgen from 'pptxgenjs';
import type { DiagramSpec, LayoutResult, ThemeConfig, RenderOptions } from '../types.js';
import { svgPathToPptxShape } from './pptx-utils.js';

const SLIDE_W = 13.33;
const SLIDE_H = 7.5;
const MARGIN = 0.3;
const PX_PER_INCH = 96;

/** Strip leading '#' from hex colors (pptxgenjs wants bare hex). */
function hex(color: string): string {
  return color.replace(/^#/, '');
}

/** Convert pixel value to inches, applying uniform scale. */
function toInches(px: number, scale: number): number {
  return (px / PX_PER_INCH) * scale;
}

/** Map our edge style names to pptxgenjs dash types. */
function dashType(style?: string): 'solid' | 'dash' | 'sysDot' {
  if (style === 'dashed') return 'dash';
  if (style === 'dotted') return 'sysDot';
  return 'solid';
}

/** Map our node shape names to pptxgenjs ShapeType keys. */
function shapeType(
  pptx: pptxgen,
  shape: string | undefined,
): pptxgen.ShapeType {
  switch (shape) {
    case 'rectangle':
      return pptx.ShapeType.rect;
    case 'pill':
      return pptx.ShapeType.roundRect;
    case 'circle':
      return pptx.ShapeType.ellipse;
    case 'diamond':
      return pptx.ShapeType.diamond;
    case 'rounded':
    default:
      return pptx.ShapeType.roundRect;
  }
}

export async function renderToPptx(
  spec: DiagramSpec,
  layout: LayoutResult,
  theme: ThemeConfig,
  options: RenderOptions = {},
): Promise<Buffer> {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 inches

  // Compute uniform scale to fit diagram within slide margins
  const diagramW = layout.width / PX_PER_INCH;
  const diagramH = layout.height / PX_PER_INCH;
  const availW = SLIDE_W - MARGIN * 2;
  const availH = SLIDE_H - MARGIN * 2;
  const scale = Math.min(1.5, availW / diagramW, availH / diagramH);

  // Offset to center diagram on slide
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

  // --- Title ---
  if (spec.title && showTitle) {
    slide.addText(spec.title, {
      x: 0,
      y: 0.15,
      w: SLIDE_W,
      h: 0.4,
      fontSize: 18,
      fontFace: theme.fontFamily,
      color: hex(theme.node.textColor),
      bold: true,
      align: 'center',
      valign: 'middle',
    });
  }

  // --- Groups ---
  if (layout.groups) {
    for (const group of layout.groups) {
      const gStyle = group.style ?? {};
      const bgColor = hex(gStyle.backgroundColor ?? theme.group.background);
      const borderColor = hex(gStyle.borderColor ?? theme.group.border);

      slide.addShape(pptx.ShapeType.roundRect, {
        x: x(group.x),
        y: y(group.y),
        w: px(group.width),
        h: px(group.height),
        fill: { color: bgColor },
        line: { color: borderColor, width: theme.group.borderWidth },
        rectRadius: toInches(theme.group.borderRadius, scale),
      });

      if (group.label) {
        const labelColor = hex(gStyle.labelColor ?? theme.group.labelColor);
        slide.addText(group.label, {
          x: x(group.x) + toInches(theme.group.paddingX, scale),
          y: y(group.y) + toInches(6, scale),
          w: px(group.width) - toInches(theme.group.paddingX * 2, scale),
          h: toInches(theme.group.labelFontSize + 8, scale),
          fontSize: theme.group.labelFontSize,
          fontFace: theme.fontFamily,
          color: labelColor,
          bold: true,
          align: 'left',
          valign: 'top',
        });
      }
    }
  }

  // --- Edges (curved bezier paths) ---
  const edgeByKey = new Map(
    spec.edges.map(e => [`${e.from}->${e.to}`, e]),
  );

  for (const route of layout.edges) {
    const edgeSpec = edgeByKey.get(`${route.from}->${route.to}`);
    const edgeColor = hex(edgeSpec?.color ?? theme.edge.color);
    const edgeDash = dashType(edgeSpec?.style);

    const shape = svgPathToPptxShape(route.pathData, x, y, px);
    if (!shape) continue;

    slide.addShape('custGeom' as any, {
      x: shape.x,
      y: shape.y,
      w: shape.w,
      h: shape.h,
      points: shape.points as any,
      line: {
        color: edgeColor,
        width: theme.edge.width,
        dashType: edgeDash,
        endArrowType: 'triangle',
      },
      fill: { type: 'none' },
    });

    // Edge label
    if (edgeSpec?.label && route.labelX != null && route.labelY != null) {
      const labelW = toInches(edgeSpec.label.length * 8 + 16, scale);
      const labelH = toInches(20, scale);
      slide.addText(edgeSpec.label, {
        x: x(route.labelX) - labelW / 2,
        y: y(route.labelY) - labelH / 2,
        w: labelW,
        h: labelH,
        fontSize: theme.edge.labelFontSize,
        fontFace: theme.fontFamily,
        color: hex(theme.edge.labelColor),
        fill: { color: hex(theme.edge.labelBackground) },
        align: 'center',
        valign: 'middle',
      });
    }
  }

  // --- Nodes ---
  const nodeMap = new Map(spec.nodes.map(n => [n.id, n]));

  for (const [id, pos] of layout.nodes) {
    const node = nodeMap.get(id);
    if (!node) continue;

    const overrides = node.style ?? {};
    const shape = node.shape ?? 'rounded';
    const isIconVariant = node.variant === 'icon' && node.iconDataUri;

    const bgColor = hex(overrides.backgroundColor ?? theme.node.background);
    const borderColor = hex(overrides.borderColor ?? theme.node.border);
    const textColor = hex(overrides.textColor ?? theme.node.textColor);

    // Compute rectRadius for rounded/pill shapes
    let rectRadius = toInches(theme.node.borderRadius, scale);
    if (shape === 'pill') rectRadius = px(pos.height) / 2;
    else if (shape === 'rectangle') rectRadius = toInches(4, scale);

    // Build text lines
    const textLines: pptxgen.TextProps[] = [];

    const labelFontSize = isIconVariant
      ? theme.node.icon.dominantLabelFontSize
      : theme.node.fontSize;

    textLines.push({
      text: node.label,
      options: {
        fontSize: labelFontSize,
        fontFace: theme.fontFamily,
        color: textColor,
        bold: !isIconVariant,
        align: 'center',
        breakLine: !!node.description,
      },
    });

    if (node.description) {
      textLines.push({
        text: node.description,
        options: {
          fontSize: theme.node.descriptionFontSize,
          fontFace: theme.fontFamily,
          color: hex(theme.node.textColorSecondary),
          align: 'center',
        },
      });
    }

    if (node.iconDataUri) {
      const iconSize = isIconVariant
        ? theme.node.icon.dominantSize
        : theme.node.icon.size;
      const iconW = toInches(iconSize, scale);
      const iconH = toInches(iconSize, scale);
      const iconX = x(pos.x) + px(pos.width) / 2 - iconW / 2;

      const iconMargin = isIconVariant
        ? theme.node.icon.dominantMarginBottom
        : theme.node.icon.marginBottom;
      const textBlockH = toInches(
        labelFontSize + (node.description ? theme.node.descriptionFontSize + 8 : 0),
        scale,
      );
      const totalContentH = iconH + toInches(iconMargin, scale) + textBlockH;
      const contentStartY = y(pos.y) + px(pos.height) / 2 - totalContentH / 2;

      // Shape first (background)
      slide.addShape(shapeType(pptx, shape), {
        x: x(pos.x),
        y: y(pos.y),
        w: px(pos.width),
        h: px(pos.height),
        fill: { color: bgColor },
        line: { color: borderColor, width: theme.node.borderWidth },
        rectRadius: (shape === 'diamond' || shape === 'circle') ? undefined : rectRadius,
      });

      // Icon on top of shape
      slide.addImage({
        data: node.iconDataUri,
        x: iconX,
        y: contentStartY,
        w: iconW,
        h: iconH,
      });

      // Text below icon
      const textY = contentStartY + iconH + toInches(iconMargin, scale);
      slide.addText(textLines, {
        x: x(pos.x),
        y: textY,
        w: px(pos.width),
        h: textBlockH,
        valign: 'top',
        align: 'center',
        margin: 0,
      });
    } else {
      // No icon — shape with embedded text
      slide.addText(textLines, {
        x: x(pos.x),
        y: y(pos.y),
        w: px(pos.width),
        h: px(pos.height),
        shape: shapeType(pptx, shape),
        fill: { color: bgColor },
        line: { color: borderColor, width: theme.node.borderWidth },
        rectRadius: (shape === 'diamond' || shape === 'circle') ? undefined : rectRadius,
        valign: 'middle',
        align: 'center',
        margin: [4, 8, 4, 8],
      });
    }
  }

  const output = await pptx.write({ outputType: 'nodebuffer' });
  return Buffer.from(output as ArrayBuffer);
}

