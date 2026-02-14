import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import type { SatoriElement } from '../types.js';
import { loadFonts } from '../fonts.js';

export async function renderToSvg(
  tree: SatoriElement,
  width: number,
  height: number,
): Promise<string> {
  const fonts = await loadFonts();
  return await satori(tree as any, { width, height, fonts });
}

export async function renderToPng(
  tree: SatoriElement,
  width: number,
  height: number,
  scale: number = 2,
): Promise<Buffer> {
  const svg = await renderToSvg(tree, width, height);
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width' as const, value: width * scale },
  });
  const rendered = resvg.render();
  return Buffer.from(rendered.asPng());
}
