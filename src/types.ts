export type NodeId = string;
export type Direction = 'TB' | 'LR';
export type OutputFormat = 'svg' | 'png' | 'html' | 'pptx';
export type NodeShape = 'rectangle' | 'rounded' | 'pill' | 'diamond' | 'circle';
export type EdgeStyle = 'solid' | 'dashed' | 'dotted';
export type NodeVariant = 'default' | 'icon';
export type DiagramType =
  | 'flow' | 'gantt' | 'timeline' | 'quadrant' | 'stat'
  | 'sankey' | 'waterfall' | 'delta' | 'bar' | 'grouped-bar' | 'stacked-bar'
  | 'treemap' | 'bullet' | 'slope' | 'alluvial' | 'range-plot' | 'line'
  | 'stacked-area' | 'histogram' | 'dot-plot'
  | 'locator-map' | 'region-map' | 'choropleth' | 'corridor' | 'symbol-map'
  | 'zoning-map' | 'before-after-map'
  | 'agenda-states' | 'outcome-funnel' | 'org' | 'vote-matrix' | 'impact'
  | 'pipeline' | 'hemicycle' | 'heatmap-table' | 'network' | 'donut'
  | 'weekstrip' | 'entity-timeline' | 'calendar-heatmap' | 'sparkline'
  | 'waffle' | 'isotype' | 'small-multiples' | 'scorecard' | 'beeswarm'
  | 'connected-dot' | 'data-table';

// --- Civic/editorial chrome ---

export type Unit = 'usd' | 'percent' | 'count';

export interface UnitFormat {
  unit: Unit;
  compact?: boolean;
  digits?: number;
  sign?: 'auto' | 'never' | 'always';
  scale?: 'ratio' | 'points';
}

export interface SourceRef { label: string; href?: string }
export type LegendPattern = 'solid' | 'hatch' | 'dots' | 'stripes';
export type LegendPlacement = 'bottom' | 'right' | 'top';
export interface LegendItem {
  label: string;
  color?: string;
  pattern?: LegendPattern;
  size?: 'sm' | 'md' | 'lg' | number;
  icon?: string;
}
export interface LegendSpec {
  items?: LegendItem[];
  auto?: boolean;
  placement?: LegendPlacement;
  title?: string;
}
export type Legend = boolean | LegendItem[] | LegendSpec;
export interface Comparator {
  value: number;
  unit?: Unit | UnitFormat;
  label?: string;
  direction?: 'up' | 'down' | 'flat';
}
export interface StatSpec {
  value?: number;
  unit?: Unit | UnitFormat;
  label?: string;
  comparator?: Comparator;
  display?: string;
  href?: string;
  icon?: string;
}
export type AnnotationKind = 'callout' | 'peak' | 'range' | 'label';
export interface AnnotationAnchor { series?: string; index?: number; x?: string | number; y?: number }
export interface Annotation {
  kind: AnnotationKind;
  text?: string;
  at?: AnnotationAnchor;
  from?: AnnotationAnchor;
  to?: AnnotationAnchor;
  href?: string;
  tone?: 'neutral' | 'up' | 'down' | 'alert';
}
export interface DataTable {
  columns: string[];
  records: Array<Array<string | number | null>>;
  summary?: string;
}
export interface DiagramChrome {
  caption?: string;
  source?: SourceRef | SourceRef[];
  legend?: Legend;
  stat?: StatSpec;
  stats?: StatSpec[];
  annotations?: Annotation[];
  unit?: Unit | UnitFormat;
  alt?: string;
  dataTable?: DataTable;
  footnote?: string;
}
export interface CivicBase extends DiagramChrome {
  title?: string;
  theme?: string | ThemeConfig;
}
export interface StatDiagramSpec extends CivicBase {
  type: 'stat';
  stat: StatSpec;
}

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

export interface DiagramSpec extends CivicBase {
  type?: DiagramType;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  direction?: Direction;
  groups?: DiagramGroup[];
  rows?: string[][];
}

// --- Gantt ---

export interface GanttTask {
  id: string;
  label: string;
  start: string;
  end?: string;
  kind?: 'range' | 'milestone';
  open?: boolean;
  href?: string;
  color?: string;
  group?: string;
  dependencies?: string[];
  progress?: number; // 0-100
}

export interface GanttSpec extends CivicBase {
  type: 'gantt';
  now?: string;
  fyStartMonth?: number;
  scale?: 'auto' | 'day' | 'week' | 'month' | 'quarter';
  tasks: GanttTask[];
}

// --- Timeline ---

export interface TimelineEvent {
  id?: string;
  date: string;
  label: string;
  body?: string;
  description?: string;
  href?: string;
  icon?: string;
  iconDataUri?: string;
  color?: string;
}

export interface TimelineSpec extends CivicBase {
  type: 'timeline';
  now?: string;
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

export interface QuadrantSpec extends CivicBase {
  type: 'quadrant';
  xAxis: QuadrantAxis;
  yAxis: QuadrantAxis;
  quadrants?: QuadrantDef[];
  items: QuadrantItem[];
}

// --- Money ---

export interface MoneySeries { id: string; label: string; values: number[]; color?: string }
export interface SankeyNode { id: string; label: string; color?: string }
export interface SankeyLink { from: string; to: string; value: number; label?: string; color?: string }
export interface SankeySpec extends CivicBase { type: 'sankey'; nodes: SankeyNode[]; links: SankeyLink[] }
export interface WaterfallStep { id: string; label: string; value: number; color?: string }
export interface WaterfallSpec extends CivicBase {
  type: 'waterfall';
  start?: { label: string; value: number };
  steps: WaterfallStep[];
  end?: { label: string };
}
export interface DeltaSpec extends CivicBase {
  type: 'delta';
  from: { label: string; value: number };
  to: { label: string; value: number };
}
export interface BarItem { id: string; label: string; value: number; color?: string }
export interface BarSpec extends CivicBase {
  type: 'bar'; orientation?: 'horizontal' | 'vertical'; sort?: 'desc' | 'asc' | 'none'; items: BarItem[];
}
export interface GroupedBarSpec extends CivicBase {
  type: 'grouped-bar'; orientation?: 'horizontal' | 'vertical'; categories: string[]; series: MoneySeries[];
}
export interface StackedBarSpec extends CivicBase {
  type: 'stacked-bar'; orientation?: 'horizontal' | 'vertical'; categories: string[]; series: MoneySeries[];
}
export interface TreemapNode { id: string; label: string; value?: number; color?: string; children?: TreemapNode[] }
export interface TreemapSpec extends CivicBase { type: 'treemap'; nodes: TreemapNode[] }
export interface BulletItem { id: string; label: string; actual: number; target?: number; ranges?: number[] }
export interface BulletSpec extends CivicBase { type: 'bullet'; items: BulletItem[] }
export interface SlopeItem { id: string; label: string; from: number; to: number; color?: string }
export interface SlopeSpec extends CivicBase {
  type: 'slope'; columns: { from: string; to: string }; items: SlopeItem[];
}
export interface AlluvialNode { id: string; stage: string; label: string; color?: string }
export interface AlluvialLink { from: string; to: string; value: number; label?: string; color?: string }
export interface AlluvialSpec extends CivicBase {
  type: 'alluvial'; stages: string[]; nodes: AlluvialNode[]; links: AlluvialLink[];
}
export interface RangeItem { id: string; label: string; min: number; max: number; mid?: number }
export interface RangePlotSpec extends CivicBase {
  type: 'range-plot'; orientation?: 'horizontal' | 'vertical'; items: RangeItem[];
}
export interface LineSpec extends CivicBase { type: 'line'; periods: string[]; series: MoneySeries[] }
export interface StackedAreaSpec extends CivicBase { type: 'stacked-area'; periods: string[]; series: MoneySeries[] }
export interface HistogramBin { start: number; end: number; count: number }
export interface HistogramSpec extends CivicBase {
  type: 'histogram'; values?: number[]; binWidth?: number; bins?: HistogramBin[];
}
export interface DotItem { id: string; label: string; value: number; color?: string }
export interface DotPlotSpec extends CivicBase {
  type: 'dot-plot'; orientation?: 'horizontal' | 'vertical'; sort?: 'desc' | 'asc' | 'none'; items: DotItem[];
}

// --- Place ---

export interface LonLat { lon: number; lat: number }
export interface PlaceBasemap { city: string; county?: string; state?: string; center?: LonLat; zoom?: number }
export type PlaceGeometry =
  | { ring: LonLat[]; path?: never; geojson?: never }
  | { path: LonLat[]; ring?: never; geojson?: never }
  | { geojson: string | Record<string, unknown>; ring?: never; path?: never };
export interface PlaceSpecBase extends CivicBase { legend: Legend; basemap: PlaceBasemap }
export interface LocatorPin extends LonLat { id: string; label: string; note?: string; color?: string; icon?: string }
export interface LocatorMapSpec extends PlaceSpecBase { type: 'locator-map'; pins: LocatorPin[] }
export interface RegionFeature {
  id: string; label: string; place?: string; ring?: LonLat[]; geojson?: string | Record<string, unknown>; color?: string;
}
export interface RegionMapSpec extends PlaceSpecBase { type: 'region-map'; region: RegionFeature; context?: RegionFeature[] }
export interface ChoroplethFeature {
  id: string; label: string; value: number | string; place?: string; ring?: LonLat[]; geojson?: string | Record<string, unknown>;
}
export interface ChoroplethSpec extends PlaceSpecBase {
  type: 'choropleth'; breaks: 'categorical' | 'quantile' | 'equal' | 'explicit'; breakValues?: number[]; classes?: number;
  valueKey?: string; features: ChoroplethFeature[];
}
export interface CorridorStop extends LonLat { id: string; label: string; note?: string }
export interface CorridorSpec extends PlaceSpecBase {
  type: 'corridor';
  corridor: { id: string; label: string; path?: LonLat[]; geojson?: string | Record<string, unknown>; widthMeters?: number; color?: string };
  stops?: CorridorStop[];
}
export interface SymbolPoint extends LonLat {
  id: string; label: string; kind?: string; count?: number; note?: string; color?: string; [key: string]: unknown;
}
export interface SymbolMapSpec extends PlaceSpecBase { type: 'symbol-map'; sizeBy?: string; colorBy?: string; points: SymbolPoint[] }
export interface ZoningParcel {
  id: string; label: string; code: string; ring?: LonLat[]; geojson?: string | Record<string, unknown>; overlay?: string; note?: string;
}
export interface ZoningMapSpec extends PlaceSpecBase { type: 'zoning-map'; parcels: ZoningParcel[] }
export interface BeforeAfterPanel { label: string; parcels: ZoningParcel[] }
export interface BeforeAfterMapSpec extends PlaceSpecBase {
  type: 'before-after-map'; layout?: 'split' | 'overlay'; extent?: LonLat[]; before: BeforeAfterPanel; after: BeforeAfterPanel;
}

// --- Power and process ---

export type CivicState = 'introduced' | 'approved' | 'deferred' | 'withdrawn' | 'informational' | 'forwarded' | 'recessed';
export interface AgendaStep { id: string; state: CivicState; date: string; label?: string }
export interface AgendaItem { id: string; label: string; body: string; icon?: string; steps: AgendaStep[] }
export interface AgendaStatesSpec extends CivicBase { type: 'agenda-states'; item: AgendaItem }
export interface FunnelStage { id: string; label: string; state: CivicState; value: number }
export interface FunnelItem { id: string; label: string; state: CivicState }
export interface OutcomeFunnelSpec extends CivicBase { type: 'outcome-funnel'; stages: FunnelStage[]; items?: FunnelItem[] }
export type OrgKind = 'legislative' | 'executive' | 'appointed' | 'committee' | 'advisory';
export type OrgCoverage = 'covered' | 'not-yet';
export type OrgRel = 'appoints' | 'reports-to' | 'recommends-to' | 'forwards-to' | 'oversees';
export interface OrgNode { id: string; label: string; kind: OrgKind; coverage?: OrgCoverage; color?: string }
export interface OrgEdge { from: string; to: string; rel: OrgRel }
export interface OrgSpec extends CivicBase { type: 'org'; nodes: OrgNode[]; edges: OrgEdge[] }
export type Vote = 'yea' | 'nay' | 'absent' | 'present-not-voting' | 'excused' | 'unknown';
export interface VoteMember { id: string; label: string; seat?: string }
export interface VoteItem { id: string; label: string; mover?: string; seconder?: string; result?: string }
export interface VoteCell { member: string; item: string; vote: Vote }
export interface VoteMatrixSpec extends CivicBase {
  type: 'vote-matrix'; body: string; date: string; members: VoteMember[]; items: VoteItem[]; cells: VoteCell[];
  summary?: { yea?: number; nay?: number; absent?: number; present?: number };
}
export type TouchKind = 'residents' | 'taxpayers' | 'neighborhood' | 'employees' | 'program' | 'place';
export interface ImpactItem { id: string; label: string; body: string; date: string; action: string }
export interface ImpactTouch { id: string; label: string; kind: TouchKind; note?: string }
export interface ImpactSpec extends CivicBase { type: 'impact'; item: ImpactItem; touches: ImpactTouch[] }
export type PipelineGate = 'automated' | 'human' | 'blocked';
export interface PipelineStage { id: string; label: string; gate: PipelineGate; description?: string }
export interface PipelineEdge { from: string; to: string }
export interface PipelineSpec extends CivicBase { type: 'pipeline'; stages: PipelineStage[]; edges: PipelineEdge[] }
export type HemiVote = 'yea' | 'nay' | 'absent' | 'empty';
export interface HemiSeat { id: string; label?: string; member?: string; vote?: HemiVote; seat?: string }
export interface HemicycleSpec extends CivicBase {
  type: 'hemicycle'; item: { id: string; label: string; body?: string; date?: string }; seats: HemiSeat[];
  mover?: string; seconder?: string; summary?: { yea?: number; nay?: number; absent?: number; present?: number };
}
export interface HeatRow { id: string; label: string }
export interface HeatCol { id: string; label: string }
export interface HeatCell { row: string; column: string; value: number; label?: string }
export interface HeatmapTableSpec extends CivicBase {
  type: 'heatmap-table'; rows: HeatRow[]; columns: HeatCol[]; cells: HeatCell[]; scale?: { min: number; max: number };
}
export type NetworkKind = 'body' | 'member' | 'developer' | 'neighborhood' | 'district' | 'fund' | 'resident-group' | 'place';
export type NetworkRel = 'votes-with' | 'appoints' | 'funds' | 'abuts' | 'represents' | 'touches';
export interface NetworkNode { id: string; label: string; kind: NetworkKind; color?: string }
export interface NetworkEdge { from: string; to: string; rel: NetworkRel; directed?: boolean; item?: string }
export interface NetworkSpec extends CivicBase { type: 'network'; nodes: NetworkNode[]; edges: NetworkEdge[] }
export interface DonutSlice { id: string; label: string; value: number; color?: string }
export interface DonutSpec extends CivicBase { type: 'donut'; slices: DonutSlice[]; center?: { label: string; value?: string | number } }

// --- Time ---

export interface TimeSpecBase extends CivicBase { now?: string }
export interface WeekstripMark { date: string; label?: string; tag?: string; href?: string; count?: number }
export interface WeekstripSpec extends TimeSpecBase { type: 'weekstrip'; from: string; to: string; marks: WeekstripMark[]; colorBy?: 'tag' | 'none' }
export interface EntityLane { id: string; label: string; color?: string }
export interface EntityEvent {
  date: string; label: string; lane: string; description?: string; href?: string; edition?: string; amount?: number;
}
export interface EntityTimelineSpec extends TimeSpecBase {
  type: 'entity-timeline'; entity: { name: string; kind?: 'project' | 'person' | 'fund' | 'body' }; lanes: EntityLane[]; events: EntityEvent[];
}
export interface CalendarHeatmapCell { date: string; value: number; label?: string; href?: string }
export interface CalendarHeatmapSpec extends TimeSpecBase {
  type: 'calendar-heatmap'; from: string; to: string; weekStart?: 'sun' | 'mon'; cells: CalendarHeatmapCell[];
}
export interface SparklineSpec extends CivicBase {
  type: 'sparkline'; values: number[]; dates?: string[]; stroke?: string; fill?: boolean; showEndValue?: boolean;
}

// --- Composition and comparison ---

export interface WaffleCategory { id: string; label: string; value: number; color?: string; approximate?: boolean }
export interface WaffleSpec extends CivicBase { type: 'waffle'; mode: 'n' | 'percent'; columns?: number; categories: WaffleCategory[] }
export interface IsotypeScale { unitsPerIcon: number }
export interface IsotypeCategory { id: string; label: string; value: number; icon?: string; color?: string; approximate?: boolean }
export interface IsotypeSpec extends CivicBase { type: 'isotype'; icon?: string; scale?: IsotypeScale; categories: IsotypeCategory[] }
export type SmallMultiplesPanelType = 'bar' | 'delta' | 'sparkline' | 'waffle' | 'scorecard' | 'isotype' | 'beeswarm' | 'connected-dot';
export interface SmallMultiplesPanel { id: string; label: string; spec: Record<string, unknown> }
export interface SmallMultiplesSpec extends CivicBase {
  type: 'small-multiples'; panelType: SmallMultiplesPanelType; columns?: number; shareScale?: boolean; panels: SmallMultiplesPanel[];
}
export interface ScorecardBound { label?: string; value: number }
export interface ScorecardRow {
  id: string; label: string; promised: ScorecardBound; delivered: ScorecardBound; kept?: boolean; reportedError?: number; note?: string;
}
export interface ScorecardSpec extends CivicBase { type: 'scorecard'; rows: ScorecardRow[] }
export interface BeeswarmItem { id: string; label: string; value: number; group?: string; color?: string; highlight?: boolean }
export interface BeeswarmSpec extends CivicBase { type: 'beeswarm'; axis?: 'x' | 'y'; log?: boolean; dotSize?: number; items: BeeswarmItem[] }
export interface ConnectedDotBound { label?: string; value: number }
export interface ConnectedDotRow { id: string; label: string; from: ConnectedDotBound; to: ConnectedDotBound; color?: string }
export interface ConnectedDotSpec extends CivicBase { type: 'connected-dot'; rows: ConnectedDotRow[] }
export type DataTableEncode = 'text' | 'bar' | 'heat' | 'sparkline';
export type DataTableCell = string | number | number[];
export interface DataTableColumn { id: string; label: string; unit?: Unit | UnitFormat | null; encode?: DataTableEncode }
export interface DataTableSpec extends CivicBase {
  type: 'data-table'; columns: DataTableColumn[]; rows: Array<Record<string, DataTableCell>>; sort?: { column: string; direction: 'asc' | 'desc' };
}

// Discriminated union of all spec types
export type AnyDiagramSpec =
  | DiagramSpec | GanttSpec | TimelineSpec | QuadrantSpec | StatDiagramSpec
  | SankeySpec | WaterfallSpec | DeltaSpec | BarSpec | GroupedBarSpec | StackedBarSpec
  | TreemapSpec | BulletSpec | SlopeSpec | AlluvialSpec | RangePlotSpec | LineSpec
  | StackedAreaSpec | HistogramSpec | DotPlotSpec
  | LocatorMapSpec | RegionMapSpec | ChoroplethSpec | CorridorSpec | SymbolMapSpec
  | ZoningMapSpec | BeforeAfterMapSpec
  | AgendaStatesSpec | OutcomeFunnelSpec | OrgSpec | VoteMatrixSpec | ImpactSpec
  | PipelineSpec | HemicycleSpec | HeatmapTableSpec | NetworkSpec | DonutSpec
  | WeekstripSpec | EntityTimelineSpec | CalendarHeatmapSpec | SparklineSpec
  | WaffleSpec | IsotypeSpec | SmallMultiplesSpec | ScorecardSpec | BeeswarmSpec
  | ConnectedDotSpec | DataTableSpec;

export interface RenderOptions {
  format?: OutputFormat;
  width?: number;
  scale?: number;
  background?: string;
  padding?: number;
  showTitle?: boolean;
  /** Base directory for relative GeoJSON references in place specs. */
  baseDir?: string;
  /** Disable emoji/favicon network fetches at hosted render boundaries. */
  allowRemoteIcons?: boolean;
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
  money?: MoneyTheme;
  place?: PlaceTheme;
  time?: TimeTheme;
}

export interface MoneyTheme {
  positive: string;
  negative: string;
  zero: string;
  barRadius: number;
  barGap: number;
  axisColor: string;
  axisFontSize: number;
  tickFontSize: number;
  valueFontSize: number;
  gridLineColor: string;
}

export interface PlaceTheme {
  land: string;
  water: string;
  park: string;
  street: string;
  streetLabel: string;
  boundaryStroke: string;
  boundaryWidth: number;
  pinFill: string;
  pinStroke: string;
  pinRadius: number;
  highlightFill: string;
  highlightStroke: string;
}

export interface TimeTheme {
  axisColor: string;
  axisFontSize: number;
  tickFontSize: number;
  cardWidth: number;
  cardHeight: number;
  cardGap: number;
  connectorLength: number;
  dotSize: number;
  fyTickColor: string;
  nowColor: string;
  openRangeFade: string;
  heatmapRamp: string[];
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
