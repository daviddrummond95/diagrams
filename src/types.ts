export type NodeId = string;
export type Direction = 'TB' | 'LR';
export type OutputFormat = 'svg' | 'png' | 'html';
export type NodeShape = 'rectangle' | 'rounded' | 'pill' | 'diamond' | 'circle';
export type EdgeStyle = 'solid' | 'dashed' | 'dotted';
export type NodeVariant = 'default' | 'icon';

export interface NodeStyleOverrides {
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  iconBorderRadius?: number;
}

export interface DiagramNode {
  id: NodeId;
  label: string;
  description?: string;
  shape?: NodeShape;
  variant?: NodeVariant;
  icon?: string;
  iconDataUri?: string;
  style?: NodeStyleOverrides;
}

export interface DiagramEdge {
  from: NodeId;
  to: NodeId;
  label?: string;
  style?: EdgeStyle;
  color?: string;
}

export interface GroupStyleOverrides {
  backgroundColor?: string;
  borderColor?: string;
  labelColor?: string;
}

export interface DiagramGroup {
  id: string;
  label?: string;
  members: NodeId[];
  direction?: Direction;
  style?: GroupStyleOverrides;
}

export interface DiagramSpec {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  direction?: Direction;
  title?: string;
  theme?: string | ThemeConfig;
  groups?: DiagramGroup[];
  rows?: string[][];
}

export interface RenderOptions {
  format?: OutputFormat;
  width?: number;
  scale?: number;
  background?: string;
  padding?: number;
}

// --- Theme ---

export interface ThemeConfig {
  name: string;
  canvas: {
    background: string;
  };
  node: {
    background: string;
    border: string;
    borderWidth: number;
    borderRadius: number;
    textColor: string;
    textColorSecondary: string;
    fontSize: number;
    fontWeight: number;
    descriptionFontSize: number;
    paddingX: number;
    paddingY: number;
    minWidth: number;
    maxWidth: number;
    shadow: string;
    icon: {
      size: number;
      marginBottom: number;
      dominantSize: number;
      dominantMarginBottom: number;
      dominantLabelFontSize: number;
    };
  };
  edge: {
    color: string;
    width: number;
    arrowSize: number;
    labelColor: string;
    labelFontSize: number;
    labelBackground: string;
  };
  spacing: {
    rankSep: number;
    nodeSep: number;
  };
  group: {
    background: string;
    border: string;
    borderWidth: number;
    borderRadius: number;
    paddingX: number;
    paddingY: number;
    labelFontSize: number;
    labelColor: string;
    labelMarginBottom: number;
    gap: number;
  };
  fontFamily: string;
}

// --- Layout ---

export interface LayoutNode {
  id: NodeId;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EdgeRoute {
  from: NodeId;
  to: NodeId;
  pathData: string;
  labelX?: number;
  labelY?: number;
  arrowPoints: string; // SVG polygon points for arrowhead
}

export interface GroupLayout {
  id: string;
  label?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  style?: GroupStyleOverrides;
}

export interface LayoutResult {
  nodes: Map<NodeId, LayoutNode>;
  edges: EdgeRoute[];
  width: number;
  height: number;
  groups?: GroupLayout[];
}

// --- Satori element tree ---

export interface SatoriElement {
  type: string;
  props: Record<string, unknown> & {
    children?: SatoriElement | SatoriElement[] | string;
    style?: Record<string, unknown>;
  };
}
