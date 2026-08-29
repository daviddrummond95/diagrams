import type { CivicBase, SatoriElement, RenderOptions } from '../types.js';
import { formatValue } from '../diagrams/civic/shared.js';

/**
 * Serialize the Satori element tree to a standalone HTML file.
 */
export function renderToHTML(
  tree: SatoriElement,
  options: RenderOptions = {},
  accessibility?: Pick<CivicBase, 'alt' | 'dataTable' | 'unit'>,
): string {
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
  .visually-hidden {
    position: absolute !important;
    width: 1px !important;
    height: 1px !important;
    padding: 0 !important;
    margin: -1px !important;
    overflow: hidden !important;
    clip: rect(0, 0, 0, 0) !important;
    white-space: nowrap !important;
    border: 0 !important;
  }
</style>
</head>
<body>
${serializeElement(tree)}
${serializeAccessibility(accessibility)}
</body>
</html>`;
}

function serializeAccessibility(accessibility?: Pick<CivicBase, 'alt' | 'dataTable' | 'unit'>): string {
  if (!accessibility?.alt && !accessibility?.dataTable) return '';
  const parts = ['<section class="visually-hidden" aria-label="Accessible diagram data">'];
  if (accessibility.alt) parts.push(`<p>${escapeHtml(accessibility.alt)}</p>`);
  if (accessibility.dataTable) {
    const table = accessibility.dataTable;
    if (table.summary) parts.push(`<p>${escapeHtml(table.summary)}</p>`);
    parts.push('<table><thead><tr>');
    for (const column of table.columns) parts.push(`<th scope="col">${escapeHtml(column)}</th>`);
    parts.push('</tr></thead><tbody>');
    for (const record of table.records) {
      parts.push('<tr>');
      for (const value of record) {
        const display = typeof value === 'number' ? formatValue(value, accessibility.unit) : (value ?? '');
        parts.push(`<td>${escapeHtml(String(display))}</td>`);
      }
      parts.push('</tr>');
    }
    parts.push('</tbody></table>');
  }
  parts.push('</section>');
  return parts.join('');
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
