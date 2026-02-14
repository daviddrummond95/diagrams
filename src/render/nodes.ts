import type { DiagramNode, ThemeConfig, LayoutNode, SatoriElement } from '../types.js';

/**
 * Render a single node as a Satori element tree.
 */
export function renderNode(
  node: DiagramNode,
  pos: LayoutNode,
  theme: ThemeConfig,
): SatoriElement {
  const overrides = node.style ?? {};
  const shape = node.shape ?? 'rounded';
  const isIconVariant = node.variant === 'icon' && node.iconDataUri;

  let borderRadius: number | string = theme.node.borderRadius;
  if (shape === 'pill') borderRadius = pos.height / 2;
  else if (shape === 'rectangle') borderRadius = 4;
  else if (shape === 'circle') borderRadius = pos.width / 2;

  const children: (SatoriElement | string)[] = [];

  if (node.iconDataUri) {
    const iconSize = isIconVariant ? theme.node.icon.dominantSize : theme.node.icon.size;
    const iconMargin = isIconVariant ? theme.node.icon.dominantMarginBottom : theme.node.icon.marginBottom;
    const iconStyle: Record<string, unknown> = {
      width: iconSize,
      height: iconSize,
      marginBottom: iconMargin,
    };
    if (overrides.iconBorderRadius != null) {
      iconStyle.borderRadius = overrides.iconBorderRadius;
      iconStyle.overflow = 'hidden';
    }
    children.push({
      type: 'img',
      props: {
        src: node.iconDataUri,
        style: iconStyle,
      },
    } as unknown as SatoriElement);
  }

  const labelFontSize = isIconVariant ? theme.node.icon.dominantLabelFontSize : theme.node.fontSize;
  const labelFontWeight = isIconVariant ? 400 : theme.node.fontWeight;

  children.push({
    type: 'div',
    props: {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: labelFontSize,
        fontWeight: labelFontWeight,
        color: overrides.textColor ?? theme.node.textColor,
        fontFamily: theme.fontFamily,
      },
      children: node.label,
    },
  });

  if (node.description) {
    children.push({
      type: 'div',
      props: {
        style: {
          fontSize: theme.node.descriptionFontSize,
          color: theme.node.textColorSecondary,
          marginTop: 4,
          fontFamily: theme.fontFamily,
        },
        children: node.description,
      },
    });
  }

  // Diamond shape: rotate container 45deg, counter-rotate content
  if (shape === 'diamond') {
    return {
      type: 'div',
      props: {
        style: {
          position: 'absolute' as const,
          left: pos.x,
          top: pos.y,
          width: pos.width,
          height: pos.height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
        children: {
          type: 'div',
          props: {
            style: {
              width: pos.width * 0.7,
              height: pos.height * 0.7,
              backgroundColor: overrides.backgroundColor ?? theme.node.background,
              border: `${theme.node.borderWidth}px solid ${overrides.borderColor ?? theme.node.border}`,
              borderRadius: 4,
              transform: 'rotate(45deg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: theme.node.shadow,
            },
            children: {
              type: 'div',
              props: {
                style: {
                  transform: 'rotate(-45deg)',
                  display: 'flex',
                  flexDirection: 'column' as const,
                  alignItems: 'center',
                },
                children,
              },
            },
          },
        },
      },
    };
  }

  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute' as const,
        left: pos.x,
        top: pos.y,
        width: pos.width,
        height: pos.height,
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: overrides.backgroundColor ?? theme.node.background,
        border: `${theme.node.borderWidth}px solid ${overrides.borderColor ?? theme.node.border}`,
        borderRadius,
        boxShadow: theme.node.shadow,
        fontFamily: theme.fontFamily,
      },
      children,
    },
  };
}
