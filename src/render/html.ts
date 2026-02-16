import type { SatoriElement, RenderOptions } from '../types.js';

/**
 * Serialize the Satori element tree to a standalone HTML file.
 */
export function renderToHTML(tree: SatoriElement, options: RenderOptions = {}): string {
  const isTransparent = options.background === 'transparent';
  const bodyBg = isTransparent ? 'transparent' : '#f1f5f9';
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background: ${bodyBg};
    font-family: 'Inter', system-ui, sans-serif;
  }
</style>
</head>
<body>
${serializeElement(tree)}
</body>
</html>`;
}

function serializeElement(el: SatoriElement | string, indent: number = 0): string {
  if (typeof el === 'string') return escapeHtml(el);

  const pad = '  '.repeat(indent);
  const { type, props } = el;
  const { children, style, ...rest } = props;

  const attrs: string[] = [];

  // Style
  if (style && typeof style === 'object') {
    const css = Object.entries(style as Record<string, unknown>)
      .map(([k, v]) => `${camelToKebab(k)}: ${v}${typeof v === 'number' && needsUnit(k) ? 'px' : ''}`)
      .join('; ');
    if (css) attrs.push(`style="${escapeAttr(css)}"`);
  }

  // Other attributes
  for (const [key, val] of Object.entries(rest)) {
    if (val === undefined || val === null) continue;
    if (key === 'xmlns') {
      attrs.push(`xmlns="${val}"`);
    } else {
      attrs.push(`${key}="${escapeAttr(String(val))}"`);
    }
  }

  const open = attrs.length > 0 ? `${pad}<${type} ${attrs.join(' ')}>` : `${pad}<${type}>`;

  // Self-closing tags
  if (['path', 'polygon', 'rect', 'circle', 'line', 'img', 'br', 'hr'].includes(type)) {
    return attrs.length > 0 ? `${pad}<${type} ${attrs.join(' ')} />` : `${pad}<${type} />`;
  }

  if (children === undefined || children === null) {
    return `${open}</${type}>`;
  }

  if (typeof children === 'string') {
    return `${open}${escapeHtml(children)}</${type}>`;
  }

  if (Array.isArray(children)) {
    const inner = children
      .map(c => serializeElement(c as SatoriElement, indent + 1))
      .join('\n');
    return `${open}\n${inner}\n${pad}</${type}>`;
  }

  // Single child element
  const inner = serializeElement(children as SatoriElement, indent + 1);
  return `${open}\n${inner}\n${pad}</${type}>`;
}

function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function needsUnit(prop: string): boolean {
  const unitless = new Set([
    'fontWeight', 'opacity', 'zIndex', 'flex', 'flexGrow', 'flexShrink', 'order',
    'lineHeight',
  ]);
  return !unitless.has(prop);
}
