import { Resvg } from '@resvg/resvg-js';
import type { SatoriElement } from '../types.js';
import { renderToSvg } from './svg.js';

export { renderToSvg } from './svg.js';

export async function renderToPng(
  tree: SatoriElement,
  width: number,
  height: number,
  scale: number = 2,
  metadata?: { title?: string; alt?: string },
): Promise<Buffer> {
  const svg = await renderToSvg(tree, width, height, metadata);
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width' as const, value: width * scale },
  });
  const rendered = resvg.render();
  return Buffer.from(rendered.asPng());
}
