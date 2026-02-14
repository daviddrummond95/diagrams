import type { DiagramSpec, RenderOptions, ThemeConfig } from '../types.js';
import { layoutWithGroups } from '../layout/groups.js';
import { getTheme } from '../themes/index.js';
import { resolveIcon } from '../icons.js';
import { buildTree } from './tree.js';
import { renderToSvg, renderToPng } from './rasterize.js';
import { renderToHTML } from './html.js';

export async function renderDiagram(
  spec: DiagramSpec,
  options: RenderOptions = {},
): Promise<string | Buffer> {
  const format = options.format ?? 'png';
  const padding = options.padding ?? 40;
  const scale = options.scale ?? 2;

  const theme: ThemeConfig = getTheme(spec.theme);

  // Resolve icons to data URIs
  await Promise.all(spec.nodes.map(async node => {
    if (node.icon) node.iconDataUri = await resolveIcon(node.icon);
  }));

  // Layout (handles groups if present, falls back to flat layout otherwise)
  const result = layoutWithGroups(spec, theme, padding);

  // Use specified width or auto-computed width
  const width = options.width ?? result.width;
  const height = result.height;

  // Build element tree
  const tree = buildTree(spec, result, theme);

  switch (format) {
    case 'html':
      return renderToHTML(tree);
    case 'svg':
      return renderToSvg(tree, width, height);
    case 'png':
      return renderToPng(tree, width, height, scale);
    default:
      throw new Error(`Unknown format: "${format}"`);
  }
}
