import type { GroupLayout, ThemeConfig, SatoriElement } from '../types.js';

/**
 * Render a group card as a Satori element (background container with optional label).
 */
export function renderGroupCard(group: GroupLayout, theme: ThemeConfig): SatoriElement {
  const gt = theme.group;
  const bg = group.style?.backgroundColor ?? gt.background;
  const border = group.style?.borderColor ?? gt.border;
  const labelColor = group.style?.labelColor ?? gt.labelColor;

  const labelEl: SatoriElement | undefined = group.label ? {
    type: 'div',
    props: {
      style: {
        position: 'absolute' as const,
        top: gt.paddingY * 0.6,
        left: gt.paddingX,
        fontSize: gt.labelFontSize,
        fontWeight: 600,
        color: labelColor,
        fontFamily: theme.fontFamily,
      },
      children: group.label,
    },
  } : undefined;

  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute' as const,
        display: 'flex' as const,
        left: group.x,
        top: group.y,
        width: group.width,
        height: group.height,
        backgroundColor: bg,
        border: `${gt.borderWidth}px solid ${border}`,
        borderRadius: gt.borderRadius,
      },
      children: labelEl,
    },
  };
}
