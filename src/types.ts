export type NodeId = string;
export type Direction = 'TB' | 'LR';
export type OutputFormat = 'svg' | 'png' | 'html' | 'pptx';
export type NodeShape = 'rectangle' | 'rounded' | 'pill' | 'diamond' | 'circle';
export type EdgeStyle = 'solid' | 'dashed' | 'dotted';
export type NodeVariant = 'default' | 'icon';
export type DiagramType = 'flow' | 'gantt' | 'timeline' | 'quadrant';

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
  type?: DiagramType;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  direction?: Direction;
  title?: string;
  theme?: string | ThemeConfig;
  groups?: DiagramGroup[];
  rows?: string[][];
}

// --- Gantt ---

export interface GanttTask {
  id: string;
  label: string;
  start: string;
  end: string;
  color?: string;
  group?: string;
  dependencies?: string[];
  progress?: number; // 0-100
}

export interface GanttSpec {
  type: 'gantt';
  title?: string;
  theme?: string | ThemeConfig;
  tasks: GanttTask[];
}

// --- Timeline ---

export interface TimelineEvent {
  date: string;
  label: string;
  description?: string;
  icon?: string;
  iconDataUri?: string;
  color?: string;
}

export interface TimelineSpec {
  type: 'timeline';
  title?: string;
  theme?: string | ThemeConfig;
  direction?: Direction;
  events: TimelineEvent[];
}

// --- Quadrant ---

export interface QuadrantAxis {
  label: string;
  low: string;
  high: string;
}

export interface QuadrantDef {
  label: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  color?: string;
}

export interface QuadrantItem {
  label: string;
  x: number; // 0-1
  y: number; // 0-1
  color?: string;
}

export interface QuadrantSpec {
  type: 'quadrant';
  title?: string;
  theme?: string | ThemeConfig;
  xAxis: QuadrantAxis;
  yAxis: QuadrantAxis;
  quadrants?: QuadrantDef[];
  items: QuadrantItem[];
}

// Discriminated union of all spec types
export type AnyDiagramSpec = DiagramSpec | GanttSpec | TimelineSpec | QuadrantSpec;

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
  gantt?: GanttTheme;
  timeline?: TimelineTheme;
  quadrant?: QuadrantTheme;
}

export interface GanttTheme {
  barHeight: number;
  barRadius: number;
  barGap: number;
  headerHeight: number;
  gridLineColor: string;
  groupLabelColor: string;
  groupLabelFontSize: number;
  barLabelColor: string;
  barLabelFontSize: number;
  progressFillOpacity: number;
  dependencyArrowColor: string;
  dateHeaderColor: string;
  dateHeaderFontSize: number;
}

export interface TimelineTheme {
  lineColor: string;
  lineWidth: number;
  dotSize: number;
  cardWidth: number;
  cardGap: number;
  connectorLength: number;
  dateFontSize: number;
  dateColor: string;
  labelFontSize: number;
  descriptionFontSize: number;
}

export interface QuadrantTheme {
  gridSize: number;
  axisColor: string;
  axisWidth: number;
  axisLabelColor: string;
  axisLabelFontSize: number;
  quadrantOpacity: number;
  dotSize: number;
  dotLabelFontSize: number;
  dotLabelColor: string;
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

// --- New diagram layout results ---

export interface GanttLayoutResult {
  tasks: Array<{
    id: string;
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    progress: number;
    group?: string;
  }>;
  dependencies: Array<{ pathData: string }>;
  dateLabels: Array<{ label: string; x: number }>;
  groupLabels: Array<{ label: string; y: number }>;
  width: number;
  height: number;
  headerHeight: number;
}

export interface TimelineLayoutResult {
  events: Array<{
    date: string;
    label: string;
    description?: string;
    icon?: string;
    iconDataUri?: string;
    color?: string;
    dotX: number;
    dotY: number;
    cardX: number;
    cardY: number;
    connectorPath: string;
    side: 'left' | 'right' | 'top' | 'bottom';
  }>;
  linePath: string;
  width: number;
  height: number;
}

export interface QuadrantLayoutResult {
  items: Array<{
    label: string;
    x: number;
    y: number;
    color?: string;
  }>;
  quadrants: Array<{
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
  }>;
  gridOrigin: { x: number; y: number };
  gridSize: number;
  xAxis: QuadrantAxis;
  yAxis: QuadrantAxis;
  width: number;
  height: number;
}

// --- Satori element tree ---

export interface SatoriElement {
  type: string;
  props: Record<string, unknown> & {
    children?: SatoriElement | (SatoriElement | string)[] | string;
    style?: Record<string, unknown>;
  };
}
