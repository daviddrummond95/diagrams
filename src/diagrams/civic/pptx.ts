import pptxgen from 'pptxgenjs';
import type { CivicBase, SatoriElement, ThemeConfig } from '../../types.js';
import { renderToSvg } from '../../render/rasterize.js';

const SLIDE_WIDTH = 13.333;
const SLIDE_HEIGHT = 7.5;
const MARGIN = 0.3;

/**
 * Civic charts share their tested SVG geometry with PPTX. Embedding that SVG
 * keeps dense map/flow collision decisions identical across every output path.
 */
export async function renderCivicToPptx(
  tree: SatoriElement,
  width: number,
  height: number,
  theme: ThemeConfig,
  spec: CivicBase,
): Promise<Buffer> {
  const svg = await renderToSvg(tree, width, height, { title: spec.title, alt: spec.alt });
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';
  const slide = pptx.addSlide();
  slide.background = { color: theme.canvas.background.replace(/^#/, '') };

  const availableWidth = SLIDE_WIDTH - MARGIN * 2;
  const availableHeight = SLIDE_HEIGHT - MARGIN * 2;
  const scale = Math.min(availableWidth / width, availableHeight / height);
  const imageWidth = width * scale;
  const imageHeight = height * scale;
  slide.addImage({
    data: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
    x: (SLIDE_WIDTH - imageWidth) / 2,
    y: (SLIDE_HEIGHT - imageHeight) / 2,
    w: imageWidth,
    h: imageHeight,
  });

  const output = await pptx.write({ outputType: 'nodebuffer' });
  return Buffer.from(output as ArrayBuffer);
}
