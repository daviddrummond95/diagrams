import type { ThemeConfig } from '../types.js';
import { defaultTheme } from './default.js';

/**
 * Factory: merges partial overrides onto the default theme base,
 * then derives gantt / timeline / quadrant sub-themes from the core colors.
 */
function theme(
  name: string,
  overrides: {
    canvas?: Partial<ThemeConfig['canvas']>;
    node?: Partial<ThemeConfig['node']>;
    edge?: Partial<ThemeConfig['edge']>;
    spacing?: Partial<ThemeConfig['spacing']>;
    group?: Partial<ThemeConfig['group']>;
    fontFamily?: string;
  },
): ThemeConfig {
  const base = structuredClone(defaultTheme);
  base.name = name;

  if (overrides.canvas) Object.assign(base.canvas, overrides.canvas);
  if (overrides.node) Object.assign(base.node, overrides.node);
  if (overrides.edge) Object.assign(base.edge, overrides.edge);
  if (overrides.spacing) Object.assign(base.spacing, overrides.spacing);
  if (overrides.group) Object.assign(base.group, overrides.group);
  if (overrides.fontFamily) base.fontFamily = overrides.fontFamily;

  // Derive sub-themes from the resolved core colors
  base.gantt = {
    barHeight: 28,
    barRadius: 6,
    barGap: 8,
    headerHeight: 40,
    gridLineColor: base.group.background,
    groupLabelColor: base.node.textColorSecondary,
    groupLabelFontSize: 11,
    barLabelColor: base.node.textColor,
    barLabelFontSize: 13,
    progressFillOpacity: 0.3,
    dependencyArrowColor: base.edge.color,
    dateHeaderColor: base.node.textColorSecondary,
    dateHeaderFontSize: 11,
  };
  base.timeline = {
    lineColor: base.edge.color,
    lineWidth: 3,
    dotSize: 14,
    cardWidth: 220,
    cardGap: 24,
    connectorLength: 40,
    dateFontSize: 11,
    dateColor: base.node.textColorSecondary,
    labelFontSize: 14,
    descriptionFontSize: 12,
  };
  base.quadrant = {
    gridSize: 400,
    axisColor: base.group.border,
    axisWidth: 1.5,
    axisLabelColor: base.node.textColorSecondary,
    axisLabelFontSize: 13,
    quadrantOpacity: 0.15,
    dotSize: 12,
    dotLabelFontSize: 11,
    dotLabelColor: base.node.textColor,
  };

  return base;
}

// ---------------------------------------------------------------------------
// Earthy / Warm
// ---------------------------------------------------------------------------

export const oceanTheme = theme('ocean', {
  canvas: { background: '#0C1222' },
  node: { background: '#162032', border: '#1E3A5F', textColor: '#E0F2FE', textColorSecondary: '#7DD3FC', shadow: '0 2px 8px rgba(0,100,200,0.2)' },
  edge: { color: '#0EA5E9', labelColor: '#7DD3FC', labelBackground: '#162032' },
  group: { background: '#0F2744', border: '#1E3A5F', labelColor: '#38BDF8' },
});

export const sunsetTheme = theme('sunset', {
  canvas: { background: '#FFF7ED' },
  node: { background: '#FFFFFF', border: '#FED7AA', textColor: '#9A3412', textColorSecondary: '#C2410C', shadow: '0 1px 4px rgba(234,88,12,0.1)' },
  edge: { color: '#FB923C', labelColor: '#EA580C', labelBackground: '#FFF7ED' },
  group: { background: '#FFEDD5', border: '#FDBA74', labelColor: '#C2410C' },
});

export const forestTheme = theme('forest', {
  canvas: { background: '#F0FDF4' },
  node: { background: '#FFFFFF', border: '#86EFAC', textColor: '#14532D', textColorSecondary: '#166534', shadow: '0 1px 4px rgba(22,163,74,0.12)' },
  edge: { color: '#4ADE80', labelColor: '#15803D', labelBackground: '#F0FDF4' },
  group: { background: '#DCFCE7', border: '#86EFAC', labelColor: '#166534' },
});

export const lavenderTheme = theme('lavender', {
  canvas: { background: '#FAF5FF' },
  node: { background: '#FFFFFF', border: '#D8B4FE', textColor: '#3B0764', textColorSecondary: '#6B21A8', shadow: '0 1px 4px rgba(147,51,234,0.1)' },
  edge: { color: '#C084FC', labelColor: '#7C3AED', labelBackground: '#FAF5FF' },
  group: { background: '#F3E8FF', border: '#D8B4FE', labelColor: '#7C3AED' },
});

export const roseTheme = theme('rose', {
  canvas: { background: '#FFF1F2' },
  node: { background: '#FFFFFF', border: '#FECDD3', textColor: '#881337', textColorSecondary: '#BE123C', shadow: '0 1px 4px rgba(225,29,72,0.1)' },
  edge: { color: '#FB7185', labelColor: '#E11D48', labelBackground: '#FFF1F2' },
  group: { background: '#FFE4E6', border: '#FECDD3', labelColor: '#BE123C' },
});

// ---------------------------------------------------------------------------
// Professional / Corporate
// ---------------------------------------------------------------------------

export const corporateTheme = theme('corporate', {
  canvas: { background: '#FFFFFF' },
  node: { background: '#F8FAFC', border: '#CBD5E1', borderRadius: 8, textColor: '#0F172A', textColorSecondary: '#475569', shadow: '0 1px 2px rgba(0,0,0,0.05)' },
  edge: { color: '#64748B', width: 2, labelColor: '#334155', labelBackground: '#FFFFFF' },
  group: { background: '#F1F5F9', border: '#CBD5E1', borderRadius: 8, labelColor: '#334155' },
});

export const midnightTheme = theme('midnight', {
  canvas: { background: '#020617' },
  node: { background: '#0F172A', border: '#1E293B', textColor: '#F8FAFC', textColorSecondary: '#94A3B8', shadow: '0 2px 8px rgba(0,0,0,0.4)' },
  edge: { color: '#334155', labelColor: '#94A3B8', labelBackground: '#0F172A' },
  group: { background: '#0F172A', border: '#1E293B', labelColor: '#64748B' },
});

export const nordTheme = theme('nord', {
  canvas: { background: '#2E3440' },
  node: { background: '#3B4252', border: '#434C5E', textColor: '#ECEFF4', textColorSecondary: '#D8DEE9', shadow: '0 2px 6px rgba(0,0,0,0.25)' },
  edge: { color: '#81A1C1', labelColor: '#88C0D0', labelBackground: '#3B4252' },
  group: { background: '#3B4252', border: '#4C566A', labelColor: '#88C0D0' },
});

export const solarizedLightTheme = theme('solarized-light', {
  canvas: { background: '#FDF6E3' },
  node: { background: '#EEE8D5', border: '#93A1A1', textColor: '#073642', textColorSecondary: '#586E75', shadow: '0 1px 3px rgba(0,0,0,0.08)' },
  edge: { color: '#93A1A1', labelColor: '#657B83', labelBackground: '#FDF6E3' },
  group: { background: '#EEE8D5', border: '#93A1A1', labelColor: '#586E75' },
});

export const solarizedDarkTheme = theme('solarized-dark', {
  canvas: { background: '#002B36' },
  node: { background: '#073642', border: '#586E75', textColor: '#FDF6E3', textColorSecondary: '#93A1A1', shadow: '0 2px 6px rgba(0,0,0,0.3)' },
  edge: { color: '#586E75', labelColor: '#839496', labelBackground: '#073642' },
  group: { background: '#073642', border: '#586E75', labelColor: '#839496' },
});

// ---------------------------------------------------------------------------
// Vibrant / Bold
// ---------------------------------------------------------------------------

export const neonTheme = theme('neon', {
  canvas: { background: '#0A0A0A' },
  node: { background: '#1A1A2E', border: '#00FF88', borderWidth: 2, textColor: '#00FF88', textColorSecondary: '#00CC6A', shadow: '0 0 12px rgba(0,255,136,0.15)' },
  edge: { color: '#FF006E', width: 2, labelColor: '#FF006E', labelBackground: '#1A1A2E' },
  group: { background: '#16162A', border: '#00FF88', borderWidth: 1, labelColor: '#00FF88' },
});

export const cyberpunkTheme = theme('cyberpunk', {
  canvas: { background: '#0D0221' },
  node: { background: '#1A0A3E', border: '#FF2975', borderWidth: 2, textColor: '#FF2975', textColorSecondary: '#F222FF', shadow: '0 0 15px rgba(255,41,117,0.2)' },
  edge: { color: '#F222FF', width: 2, labelColor: '#01CDFE', labelBackground: '#1A0A3E' },
  group: { background: '#150835', border: '#F222FF', borderWidth: 1, labelColor: '#01CDFE' },
});

export const draculaTheme = theme('dracula', {
  canvas: { background: '#282A36' },
  node: { background: '#44475A', border: '#6272A4', textColor: '#F8F8F2', textColorSecondary: '#BD93F9', shadow: '0 2px 6px rgba(0,0,0,0.3)' },
  edge: { color: '#6272A4', labelColor: '#FF79C6', labelBackground: '#44475A' },
  group: { background: '#383A59', border: '#6272A4', labelColor: '#8BE9FD' },
});

export const monokaiTheme = theme('monokai', {
  canvas: { background: '#272822' },
  node: { background: '#3E3D32', border: '#75715E', textColor: '#F8F8F2', textColorSecondary: '#A6E22E', shadow: '0 2px 6px rgba(0,0,0,0.3)' },
  edge: { color: '#75715E', labelColor: '#E6DB74', labelBackground: '#3E3D32' },
  group: { background: '#3E3D32', border: '#75715E', labelColor: '#66D9EF' },
});

// ---------------------------------------------------------------------------
// Minimal / Clean
// ---------------------------------------------------------------------------

export const monochromeTheme = theme('monochrome', {
  canvas: { background: '#FFFFFF' },
  node: { background: '#FAFAFA', border: '#D4D4D4', textColor: '#171717', textColorSecondary: '#525252', shadow: 'none' },
  edge: { color: '#A3A3A3', labelColor: '#525252', labelBackground: '#FFFFFF' },
  group: { background: '#F5F5F5', border: '#D4D4D4', labelColor: '#525252' },
});

export const blueprintTheme = theme('blueprint', {
  canvas: { background: '#1E3A5F' },
  node: { background: '#1E3A5F', border: '#FFFFFF', borderWidth: 1.5, textColor: '#FFFFFF', textColorSecondary: '#93C5FD', shadow: 'none' },
  edge: { color: '#60A5FA', width: 1, labelColor: '#FFFFFF', labelBackground: '#1E3A5F' },
  group: { background: '#1E3A5F', border: '#60A5FA', borderWidth: 1, labelColor: '#93C5FD' },
});

export const inkTheme = theme('ink', {
  canvas: { background: '#FFFBEB' },
  node: { background: '#FFFBEB', border: '#1C1917', borderWidth: 2, borderRadius: 4, textColor: '#1C1917', textColorSecondary: '#57534E', shadow: 'none' },
  edge: { color: '#1C1917', width: 1.5, labelColor: '#1C1917', labelBackground: '#FFFBEB' },
  group: { background: '#FEF3C7', border: '#1C1917', borderWidth: 1.5, borderRadius: 4, labelColor: '#44403C' },
});

export const pastelTheme = theme('pastel', {
  canvas: { background: '#FEFCE8' },
  node: { background: '#FEF9C3', border: '#FDE68A', textColor: '#713F12', textColorSecondary: '#A16207', shadow: '0 1px 3px rgba(0,0,0,0.05)' },
  edge: { color: '#FBBF24', labelColor: '#92400E', labelBackground: '#FEF9C3' },
  group: { background: '#FEF3C7', border: '#FDE68A', labelColor: '#A16207' },
});

// ---------------------------------------------------------------------------
// High Contrast
// ---------------------------------------------------------------------------

export const highContrastTheme = theme('high-contrast', {
  canvas: { background: '#000000' },
  node: { background: '#000000', border: '#FFFFFF', borderWidth: 2, textColor: '#FFFFFF', textColorSecondary: '#FFFFFF', shadow: 'none' },
  edge: { color: '#FFFFFF', width: 2, labelColor: '#FFFFFF', labelBackground: '#000000' },
  group: { background: '#1A1A1A', border: '#FFFFFF', borderWidth: 2, labelColor: '#FFFFFF' },
});

export const highContrastLightTheme = theme('high-contrast-light', {
  canvas: { background: '#FFFFFF' },
  node: { background: '#FFFFFF', border: '#000000', borderWidth: 2, textColor: '#000000', textColorSecondary: '#000000', shadow: 'none' },
  edge: { color: '#000000', width: 2, labelColor: '#000000', labelBackground: '#FFFFFF' },
  group: { background: '#F5F5F5', border: '#000000', borderWidth: 2, labelColor: '#000000' },
});
