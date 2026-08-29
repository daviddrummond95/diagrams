import satori from 'satori';
import type { SatoriElement } from '../types.js';
import { loadFonts } from '../fonts.js';

export async function renderToSvg(
  tree: SatoriElement,
  width: number,
  height: number,
  metadata?: { title?: string; alt?: string },
): Promise<string> {
  const fonts = await loadFonts();
  const compatibleTree = prepareForSatori(tree);
  const svg = await satori(compatibleTree as any, { width, height, fonts: fonts as any });
  if (!metadata?.title && !metadata?.alt) return svg;
  const accessible = `${metadata.title ? `<title>${escapeXml(metadata.title)}</title>` : ''}${metadata.alt ? `<desc>${escapeXml(metadata.alt)}</desc>` : ''}`;
  return svg.replace(/(<svg\b[^>]*>)/, `$1${accessible}`);
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Satori supports SVG geometry but rejects SVG <text>. Civic renderers keep
 * their geometry in SVG coordinates, so convert only text marks to positioned
 * HTML layers immediately before Satori. The authored tree stays SVG-native
 * for standalone HTML and geometry tests.
 */
function prepareForSatori(element: SatoriElement | string): SatoriElement | string {
  if (typeof element === 'string') return element;
  const props = withoutUndefined(element.props);
  const children = normalizeChildren(props.children).map(child => prepareForSatori(child));
  if (element.type !== 'svg') return { ...element, props: { ...props, children } };

  const textChildren = children.filter(child => typeof child !== 'string' && child.type === 'text') as SatoriElement[];
  if (!textChildren.length) return { ...element, props: { ...props, children } };
  const geometry = children.filter(child => typeof child === 'string' || child.type !== 'text');
  const width = numeric(props.width, numeric((props.style as any)?.width, 1));
  const height = numeric(props.height, numeric((props.style as any)?.height, 1));
  const { role, 'aria-label': ariaLabel, style: originalStyle, ...svgProps } = props;

  return {
    type: 'div',
    props: {
      role,
      'aria-label': ariaLabel,
      style: {
        display: 'flex',
        position: 'relative',
        width,
        height,
        flexShrink: 0,
      },
      children: [
        {
          type: 'svg',
          props: {
            ...svgProps,
            width: String(width),
            height: String(height),
            'aria-hidden': 'true',
            style: { ...(originalStyle as Record<string, unknown> ?? {}), display: 'flex', position: 'absolute', left: 0, top: 0, width, height },
            children: geometry,
          },
        },
        ...textChildren.map(textToOverlay),
      ],
    },
  };
}

function textToOverlay(element: SatoriElement): SatoriElement {
  const props = element.props as Record<string, any>;
  const content = typeof props.children === 'string' ? props.children : String(props.children ?? '');
  const fontSize = numeric(props['font-size'], numeric(props.fontSize, 11));
  const fontWeight = props['font-weight'] ?? props.fontWeight ?? 400;
  const anchor = props['text-anchor'] ?? props.textAnchor ?? 'start';
  const x = numeric(props.x, 0);
  const y = numeric(props.y, 0);
  const estimatedWidth = Math.max(2, content.length * fontSize * 0.61 + 4);
  const left = anchor === 'middle' ? x - estimatedWidth / 2 : anchor === 'end' ? x - estimatedWidth : x;
  const passthrough = Object.fromEntries(Object.entries(props).filter(([key]) => key.startsWith('data-')));
  const style: Record<string, unknown> = {
    display: 'flex',
    position: 'absolute',
    left,
    top: y - fontSize * 0.86,
    width: estimatedWidth,
    height: Math.ceil(fontSize * 1.25),
    alignItems: 'center',
    justifyContent: anchor === 'middle' ? 'center' : anchor === 'end' ? 'flex-end' : 'flex-start',
    color: props.fill ?? '#111111',
    fontSize,
    fontWeight,
    lineHeight: 1,
    whiteSpace: 'nowrap',
  };
  if (props['font-family'] && props['font-family'] !== 'inherit') style.fontFamily = props['font-family'];
  return {
    type: 'div',
    props: {
      ...passthrough,
      style,
      children: content,
    },
  };
}

function normalizeChildren(children: unknown): Array<SatoriElement | string> {
  if (children == null) return [];
  return Array.isArray(children) ? children as Array<SatoriElement | string> : [children as SatoriElement | string];
}

function numeric(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function withoutUndefined(value: Record<string, any>): Record<string, any> {
  const output = Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined));
  if (output.style && typeof output.style === 'object' && !Array.isArray(output.style)) {
    output.style = Object.fromEntries(Object.entries(output.style).filter(([, child]) => child !== undefined));
  }
  return output;
}
