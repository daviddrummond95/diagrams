import type { LegendItem, SatoriElement } from '../../types.js';
import {
  avoidPointCollisions,
  buildCivicFrame,
  clamp,
  colorAt,
  extent,
  finite,
  placeLabels,
  resolveLegend,
  svgElement,
  svgText,
  type Box,
  type CivicDiagramResult,
  type CivicRenderContext,
  type LabelAnchor,
  type Point,
  type PlacedLabel,
} from './shared.js';

export const PLACE_TYPES = [
  'locator-map',
  'region-map',
  'choropleth',
  'corridor',
  'symbol-map',
  'zoning-map',
  'before-after-map',
] as const;

type PlaceType = typeof PLACE_TYPES[number];
type LonLat = { lon: number; lat: number };
type ProjectedGeometry = { polygons: LonLat[][]; lines: LonLat[][]; unresolved?: string };
type MapView = { project(point: LonLat): Point; bounds: Box; metersPerPixel: number };

const MAP_HEIGHT = 410;
const WEB_MERCATOR_MAX_LAT = 85.05112878;
const GAZETTEER: Record<string, { center: LonLat; delta: LonLat }> = {
  'terre-haute': { center: { lon: -87.41391, lat: 39.46670 }, delta: { lon: 0.075, lat: 0.055 } },
  'vigo-county': { center: { lon: -87.39, lat: 39.43 }, delta: { lon: 0.25, lat: 0.22 } },
  'otter-creek-township': { center: { lon: -87.35118, lat: 39.56144 }, delta: { lon: 0.075, lat: 0.055 } },
};

const MAP_COLORS = {
  land: '#f4f1e9',
  water: '#dcecf0',
  park: '#dfe8d8',
  street: '#d8d2c8',
  streetLabel: '#8d877f',
  boundary: '#77716b',
  pin: '#9b2335',
  ink: '#2c2926',
};

export function buildPlaceDiagram(spec: any, context: CivicRenderContext): CivicDiagramResult {
  const type = String(spec?.type ?? '') as PlaceType;
  switch (type) {
    case 'locator-map': return buildLocatorMap(spec, context);
    case 'region-map': return buildRegionMap(spec, context);
    case 'choropleth': return buildChoropleth(spec, context);
    case 'corridor': return buildCorridor(spec, context);
    case 'symbol-map': return buildSymbolMap(spec, context);
    case 'zoning-map': return buildZoningMap(spec, context);
    case 'before-after-map': return buildBeforeAfterMap(spec, context);
    default: return buildCivicFrame(spec ?? {}, emptyPlot(context, `Unsupported place type: ${type || 'unknown'}`), 160, context);
  }
}

function buildLocatorMap(spec: any, context: CivicRenderContext): CivicDiagramResult {
  const pins = array(spec.pins);
  const plotWidth = contentWidth(context);
  const plotBounds = insetBox({ x: 0, y: 0, width: plotWidth, height: MAP_HEIGHT }, 18);
  const lonLat = pins.map((pin: any) => validPoint(pin)).filter(Boolean) as LonLat[];
  const view = makeMapView(lonLat, spec.basemap, plotBounds);
  const radius = clamp(finite((context.theme as any).place?.pinRadius, 7), 4, 15);
  const raw = pins.map((pin: any, index: number) => ({
    id: String(pin.id ?? `pin-${index + 1}`),
    label: String(pin.label ?? pin.id ?? `Pin ${index + 1}`),
    color: pin.color ?? legendColor(spec, pin.kind ?? pin.label, index, MAP_COLORS.pin),
    ...view.project(validPoint(pin) ?? fallbackCenter(spec.basemap)),
  }));
  const attracted = avoidPointCollisions(raw, radius, plotBounds, 120, 0.055);
  const relaxed = avoidPointCollisions(attracted, radius, plotBounds, 80, 0);
  const occupied = relaxed.map(point => ({ x: point.x - radius, y: point.y - radius, width: radius * 2, height: radius * 2 }));
  const labels = fittedLabels(relaxed.map(point => ({ id: point.id, text: point.label, x: point.x, y: point.y })), plotBounds, occupied);
  const children = basemap(view.bounds, spec.basemap);
  children.push(...renderLeaders(labels));
  relaxed.forEach((point, index) => {
    children.push(circle(point.x, point.y, radius, point.color, '#ffffff', 2, {
      'data-role': 'map-marker', 'data-id': point.id, 'data-index': String(index),
    }));
  });
  children.push(...renderLabels(labels));
  children.push(...mapFurniture(plotBounds, view, spec.basemap));
  return buildCivicFrame(spec, svgElement(plotWidth, MAP_HEIGHT, children, spec.alt), MAP_HEIGHT, context, [
    { label: 'Location', color: MAP_COLORS.pin },
  ]);
}

function buildRegionMap(spec: any, context: CivicRenderContext): CivicDiagramResult {
  const plotWidth = contentWidth(context);
  const bounds = insetBox({ x: 0, y: 0, width: plotWidth, height: MAP_HEIGHT }, 18);
  const region = spec.region ?? {};
  const contexts = array(spec.context);
  const features = [region, ...contexts];
  const geometries = features.map(featureGeometry);
  const points = geometries.flatMap(allGeometryPoints);
  const view = makeMapView(points, spec.basemap, bounds);
  const children = basemap(bounds, spec.basemap);
  geometries.slice(1).forEach((geometry, index) => {
    children.push(...renderGeometry(geometry, view, 'none', contexts[index]?.color ?? MAP_COLORS.boundary, 1.5, 0));
  });
  const color = region.color ?? legendColor(spec, region.label, 0, colorAt(3));
  children.push(...renderGeometry(geometries[0] ?? emptyGeometry(), view, color, color, 2.2, 0.34));
  const anchor = geometryCentroid(geometries[0], view) ?? view.project(placeCenter(region.place) ?? fallbackCenter(spec.basemap));
  const labels = fittedLabels([{ id: String(region.id ?? 'region'), text: String(region.label ?? 'Region'), ...anchor }], bounds);
  children.push(...renderLeaders(labels), ...renderLabels(labels));
  children.push(...unresolvedNotices(geometries, bounds), ...mapFurniture(bounds, view, spec.basemap));
  return buildCivicFrame(spec, svgElement(plotWidth, MAP_HEIGHT, children, spec.alt), MAP_HEIGHT, context, [
    { label: String(region.label ?? 'Region'), color },
  ]);
}

function buildChoropleth(spec: any, context: CivicRenderContext): CivicDiagramResult {
  const plotWidth = contentWidth(context);
  const bounds = insetBox({ x: 0, y: 0, width: plotWidth, height: MAP_HEIGHT }, 18);
  const features = array(spec.features);
  const geometries = features.map(featureGeometry);
  const view = makeMapView(geometries.flatMap(allGeometryPoints), spec.basemap, bounds);
  const classifier = makeChoroplethClassifier(spec, features);
  const children = basemap(bounds, spec.basemap);
  const labelAnchors: LabelAnchor[] = [];
  features.forEach((feature: any, index: number) => {
    const geometry = geometries[index];
    const fill = classifier.color(feature.value, index);
    children.push(...renderGeometry(geometry, view, fill, '#ffffff', 1.5, feature.value == null ? 0.13 : 0.92, {
      'data-role': 'choropleth-feature', 'data-id': String(feature.id ?? index), 'data-value': String(feature.value ?? 'n/a'),
    }));
    const center = geometryCentroid(geometry, view);
    if (center) labelAnchors.push({ id: String(feature.id ?? index), text: `${feature.label ?? feature.id}: ${classifier.label(feature.value)}`, ...center });
  });
  const labels = fittedLabels(labelAnchors, bounds);
  children.push(...renderLeaders(labels), ...renderLabels(labels), ...unresolvedNotices(geometries, bounds), ...mapFurniture(bounds, view, spec.basemap));
  return buildCivicFrame(spec, svgElement(plotWidth, MAP_HEIGHT, children, spec.alt), MAP_HEIGHT, context, classifier.legend);
}

function buildCorridor(spec: any, context: CivicRenderContext): CivicDiagramResult {
  const plotWidth = contentWidth(context);
  const bounds = insetBox({ x: 0, y: 0, width: plotWidth, height: MAP_HEIGHT }, 18);
  const corridor = spec.corridor ?? {};
  const geometry = featureGeometry(corridor);
  const stops = array(spec.stops);
  const points = [...allGeometryPoints(geometry), ...stops.map((stop: any) => validPoint(stop)).filter(Boolean) as LonLat[]];
  const view = makeMapView(points, spec.basemap, bounds);
  const color = corridor.color ?? legendColor(spec, corridor.label, 0, colorAt(3));
  const widthPx = corridor.widthMeters == null ? 7 : clamp(finite(corridor.widthMeters) / Math.max(1, view.metersPerPixel), 4, 22);
  const children = basemap(bounds, spec.basemap);
  children.push(...renderGeometry(geometry, view, 'none', color, widthPx + 7, 0.12));
  children.push(...renderGeometry(geometry, view, 'none', color, widthPx, 1, {
    'data-role': 'corridor-path', 'data-id': String(corridor.id ?? 'corridor'),
  }));
  const stopPoints = stops.map((stop: any, index: number) => ({
    id: String(stop.id ?? `stop-${index + 1}`), label: String(stop.label ?? stop.id ?? `Stop ${index + 1}`),
    ...view.project(validPoint(stop) ?? fallbackCenter(spec.basemap)),
  }));
  const attracted = avoidPointCollisions(stopPoints, 5, bounds, 80, 0.12);
  const relaxed = avoidPointCollisions(attracted, 5, bounds, 60, 0);
  const labels = fittedLabels(relaxed.map(stop => ({ id: stop.id, text: stop.label, x: stop.x, y: stop.y })), bounds,
    relaxed.map(stop => ({ x: stop.x - 5, y: stop.y - 5, width: 10, height: 10 })));
  children.push(...renderLeaders(labels));
  relaxed.forEach(stop => children.push(circle(stop.x, stop.y, 5, '#ffffff', color, 2, { 'data-role': 'corridor-stop', 'data-id': stop.id })));
  children.push(...renderLabels(labels), ...unresolvedNotices([geometry], bounds), ...mapFurniture(bounds, view, spec.basemap));
  return buildCivicFrame(spec, svgElement(plotWidth, MAP_HEIGHT, children, spec.alt), MAP_HEIGHT, context, [
    { label: String(corridor.label ?? 'Corridor'), color },
  ]);
}

function buildSymbolMap(spec: any, context: CivicRenderContext): CivicDiagramResult {
  const plotWidth = contentWidth(context);
  const bounds = insetBox({ x: 0, y: 0, width: plotWidth, height: MAP_HEIGHT }, 18);
  const points = array(spec.points);
  const view = makeMapView(points.map((point: any) => validPoint(point)).filter(Boolean) as LonLat[], spec.basemap, bounds);
  const sizeKey = typeof spec.sizeBy === 'string' ? spec.sizeBy : undefined;
  const values = points.map((point: any) => Math.max(0, finite(sizeKey ? point[sizeKey] : 1, 0)));
  const [, maxValue] = extent(values, true);
  const radiusFor = (value: number) => sizeKey ? 5 + Math.sqrt(value / Math.max(maxValue, 1)) * 16 : 8;
  const raw = points.map((point: any, index: number) => ({
    id: String(point.id ?? `symbol-${index + 1}`), label: String(point.label ?? point.id ?? `Point ${index + 1}`),
    value: values[index], kind: String(spec.colorBy ? point[spec.colorBy] ?? '' : point.kind ?? ''),
    color: point.color ?? legendColor(spec, spec.colorBy ? point[spec.colorBy] : point.kind, index, colorAt(index)),
    ...view.project(validPoint(point) ?? fallbackCenter(spec.basemap)),
  }));
  const attracted = avoidPointCollisions(raw, point => radiusFor(point.value), bounds, 140, 0.045);
  const relaxed = avoidPointCollisions(attracted, point => radiusFor(point.value), bounds, 100, 0);
  const occupied = relaxed.map(point => {
    const radius = radiusFor(point.value);
    return { x: point.x - radius, y: point.y - radius, width: radius * 2, height: radius * 2 };
  });
  const labels = fittedLabels(relaxed.map(point => ({ id: point.id, text: point.label, x: point.x, y: point.y })), bounds, occupied);
  const children = basemap(bounds, spec.basemap);
  children.push(...renderLeaders(labels));
  relaxed.forEach(point => {
    const radius = radiusFor(point.value);
    children.push(circle(point.x, point.y, radius, point.color, '#ffffff', 1.8, {
      'data-role': 'symbol-marker', 'data-id': point.id, 'data-radius': round(radius), 'data-value': String(point.value),
    }));
  });
  children.push(...renderLabels(labels), ...mapFurniture(bounds, view, spec.basemap));
  const autoLegend = uniqueLegend(relaxed.map(point => ({ label: point.kind || 'Point', color: point.color })));
  if (sizeKey && values.length) {
    const sorted = [...values].sort((a, b) => a - b);
    [sorted[0], sorted[Math.floor((sorted.length - 1) / 2)], sorted[sorted.length - 1]].forEach(value => {
      autoLegend.push({ label: `${sizeKey}: ${value}`, color: '#87929b' });
    });
  }
  return buildCivicFrame(spec, svgElement(plotWidth, MAP_HEIGHT, children, spec.alt), MAP_HEIGHT, context, uniqueLegend(autoLegend));
}

function buildZoningMap(spec: any, context: CivicRenderContext): CivicDiagramResult {
  const plotWidth = contentWidth(context);
  const bounds = insetBox({ x: 0, y: 0, width: plotWidth, height: MAP_HEIGHT }, 18);
  const parcels = array(spec.parcels);
  const geometries = parcels.map(featureGeometry);
  const view = makeMapView(geometries.flatMap(allGeometryPoints), spec.basemap, bounds);
  const children = basemap(bounds, spec.basemap);
  const anchors: LabelAnchor[] = [];
  parcels.forEach((parcel: any, index: number) => {
    const color = legendColor(spec, parcel.code, index, colorAt(index));
    children.push(...renderGeometry(geometries[index], view, color, parcel.overlay ? colorAt(index + 3) : '#ffffff', parcel.overlay ? 3 : 1.5, 0.78, {
      'data-role': 'zoning-parcel', 'data-id': String(parcel.id ?? index), 'data-code': String(parcel.code ?? ''),
      'stroke-dasharray': parcel.overlay ? '5 3' : undefined,
    }));
    const center = geometryCentroid(geometries[index], view);
    if (center) anchors.push({ id: String(parcel.id ?? index), text: `${parcel.label ?? parcel.id} · ${parcel.code ?? ''}`, ...center });
  });
  const labels = fittedLabels(anchors, bounds);
  children.push(...renderLeaders(labels), ...renderLabels(labels), ...unresolvedNotices(geometries, bounds), ...mapFurniture(bounds, view, spec.basemap));
  const auto = uniqueLegend(parcels.map((parcel: any, index: number) => ({ label: String(parcel.code ?? 'Zone'), color: legendColor(spec, parcel.code, index, colorAt(index)) })));
  return buildCivicFrame(spec, svgElement(plotWidth, MAP_HEIGHT, children, spec.alt), MAP_HEIGHT, context, auto);
}

function buildBeforeAfterMap(spec: any, context: CivicRenderContext): CivicDiagramResult {
  const plotWidth = contentWidth(context);
  const outer = { x: 0, y: 0, width: plotWidth, height: MAP_HEIGHT };
  const before = array(spec.before?.parcels);
  const after = array(spec.after?.parcels);
  const beforeGeometry = before.map(featureGeometry);
  const afterGeometry = after.map(featureGeometry);
  const extentPoints = array(spec.extent).map((point: any) => validPoint(point)).filter(Boolean) as LonLat[];
  const union = extentPoints.length ? extentPoints : [...beforeGeometry, ...afterGeometry].flatMap(allGeometryPoints);
  const overlay = spec.layout === 'overlay';
  const gap = 18;
  const panelWidth = overlay ? plotWidth : (plotWidth - gap) / 2;
  const panelHeight = MAP_HEIGHT - 28;
  const panels = overlay
    ? [{ x: 0, y: 28, width: panelWidth, height: panelHeight }]
    : [{ x: 0, y: 28, width: panelWidth, height: panelHeight }, { x: panelWidth + gap, y: 28, width: panelWidth, height: panelHeight }];
  const children: SatoriElement[] = [];
  const renderPanel = (panel: Box, parcels: any[], geometries: ProjectedGeometry[], proposed: boolean) => {
    const mapBounds = insetBox(panel, 12);
    const view = makeMapView(union, spec.basemap, mapBounds);
    children.push(...basemap(mapBounds, spec.basemap));
    parcels.forEach((parcel: any, index: number) => {
      const color = legendColor(spec, parcel.code, index + (proposed ? before.length : 0), colorAt(index + (proposed ? 3 : 0)));
      children.push(...renderGeometry(geometries[index], view, proposed && overlay ? 'none' : color, color, proposed && overlay ? 3 : 1.5, proposed && overlay ? 0 : 0.72, {
        'data-role': proposed ? 'after-parcel' : 'before-parcel', 'data-id': String(parcel.id ?? index),
        'stroke-dasharray': proposed && overlay ? '7 4' : undefined,
      }));
    });
    children.push(...unresolvedNotices(geometries, mapBounds));
    return view;
  };
  if (overlay) {
    const furnitureView = renderPanel(panels[0], before, beforeGeometry, false);
    const view = makeMapView(union, spec.basemap, insetBox(panels[0], 12));
    after.forEach((parcel: any, index: number) => {
      const color = legendColor(spec, parcel.code, index + before.length, colorAt(index + 3));
      children.push(...renderGeometry(afterGeometry[index], view, 'none', color, 3, 0, {
        'data-role': 'after-parcel', 'data-id': String(parcel.id ?? index), 'stroke-dasharray': '7 4',
      }));
    });
    children.push(svgText(10, 18, `${spec.before?.label ?? 'CURRENT'} + ${spec.after?.label ?? 'PROPOSED'}`, labelStyle(11, '#5d5751', 600)));
    children.push(...mapFurniture(insetBox(panels[0], 12), furnitureView, spec.basemap));
  } else {
    const furnitureView = renderPanel(panels[0], before, beforeGeometry, false);
    renderPanel(panels[1], after, afterGeometry, true);
    children.push(svgText(panels[0].x + 10, 18, String(spec.before?.label ?? 'CURRENT').toUpperCase(), labelStyle(11, '#5d5751', 600)));
    children.push(svgText(panels[1].x + 10, 18, String(spec.after?.label ?? 'PROPOSED').toUpperCase(), labelStyle(11, '#5d5751', 600)));
    children.push(line(panels[0].x + panels[0].width + gap / 2, 8, panels[0].x + panels[0].width + gap / 2, MAP_HEIGHT - 8, '#cfc8bd', 1));
    children.push(...mapFurniture(insetBox(panels[0], 12), furnitureView, spec.basemap));
  }
  const allParcels = [...before, ...after];
  const auto = uniqueLegend(allParcels.map((parcel: any, index: number) => ({ label: String(parcel.code ?? 'Zone'), color: legendColor(spec, parcel.code, index, colorAt(index)) })));
  return buildCivicFrame(spec, svgElement(plotWidth, MAP_HEIGHT, children, spec.alt), MAP_HEIGHT, context, auto);
}

function makeMapView(points: LonLat[], basemapSpec: any, bounds: Box): MapView {
  const safe = points.filter(point => Number.isFinite(point.lon) && Number.isFinite(point.lat));
  const center = validPoint(basemapSpec?.center) ?? cityFrame(basemapSpec).center;
  let xMin: number;
  let xMax: number;
  let yMin: number;
  let yMax: number;
  if (Number.isFinite(basemapSpec?.zoom)) {
    const zoom = clamp(finite(basemapSpec.zoom, 12), 1, 22);
    const scale = 256 * 2 ** zoom;
    const c = mercator(center);
    const halfX = bounds.width / (2 * scale);
    const halfY = bounds.height / (2 * scale);
    xMin = c.x - halfX; xMax = c.x + halfX; yMin = c.y - halfY; yMax = c.y + halfY;
  } else {
    const projected = safe.map(mercator);
    if (projected.length) {
      xMin = Math.min(...projected.map(point => point.x));
      xMax = Math.max(...projected.map(point => point.x));
      yMin = Math.min(...projected.map(point => point.y));
      yMax = Math.max(...projected.map(point => point.y));
      // Keep a small real-world context window for coincident records without
      // forcing block-scale data into a city-scale camera.
      const xPad = Math.max((xMax - xMin) * 0.18, 0.0000015);
      const yPad = Math.max((yMax - yMin) * 0.18, 0.0000015);
      xMin -= xPad; xMax += xPad; yMin -= yPad; yMax += yPad;
    } else {
      const frame = cityFrame(basemapSpec);
      const nw = mercator({ lon: frame.center.lon - frame.delta.lon, lat: frame.center.lat + frame.delta.lat });
      const se = mercator({ lon: frame.center.lon + frame.delta.lon, lat: frame.center.lat - frame.delta.lat });
      xMin = nw.x; xMax = se.x; yMin = nw.y; yMax = se.y;
    }
  }
  const dx = Math.max(xMax - xMin, 1e-9);
  const dy = Math.max(yMax - yMin, 1e-9);
  const scale = Math.min(bounds.width / dx, bounds.height / dy);
  const usedWidth = dx * scale;
  const usedHeight = dy * scale;
  const ox = bounds.x + (bounds.width - usedWidth) / 2;
  const oy = bounds.y + (bounds.height - usedHeight) / 2;
  const centerLatitude = center.lat * Math.PI / 180;
  const earthCircumference = 40075016.686 * Math.cos(centerLatitude);
  return {
    bounds,
    project(point: LonLat): Point {
      const projected = mercator(point);
      return { x: ox + (projected.x - xMin) * scale, y: oy + (projected.y - yMin) * scale };
    },
    metersPerPixel: earthCircumference / Math.max(scale, 1),
  };
}

function mercator(point: LonLat): Point {
  const lon = clamp(finite(point.lon), -180, 180);
  const lat = clamp(finite(point.lat), -WEB_MERCATOR_MAX_LAT, WEB_MERCATOR_MAX_LAT);
  const radians = lat * Math.PI / 180;
  return {
    x: (lon + 180) / 360,
    y: (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2,
  };
}

function cityFrame(basemapSpec: any): { center: LonLat; delta: LonLat } {
  const key = slug(String(basemapSpec?.city ?? 'terre-haute'));
  const known = GAZETTEER[key] ?? GAZETTEER['terre-haute'];
  return { center: validPoint(basemapSpec?.center) ?? known.center, delta: known.delta };
}

function featureGeometry(feature: any): ProjectedGeometry {
  if (!feature) return emptyGeometry();
  if (Array.isArray(feature.ring)) return { polygons: [normalizeRing(feature.ring)], lines: [] };
  if (Array.isArray(feature.path)) return { polygons: [], lines: [normalizeLine(feature.path)] };
  if (feature.place && GAZETTEER[String(feature.place)]) {
    const known = GAZETTEER[String(feature.place)];
    const { center, delta } = known;
    return { polygons: [[
      { lon: center.lon - delta.lon, lat: center.lat - delta.lat },
      { lon: center.lon + delta.lon, lat: center.lat - delta.lat },
      { lon: center.lon + delta.lon, lat: center.lat + delta.lat },
      { lon: center.lon - delta.lon, lat: center.lat + delta.lat },
      { lon: center.lon - delta.lon, lat: center.lat - delta.lat },
    ]], lines: [] };
  }
  if (feature.geojson != null) return geoJsonGeometry(feature.geojson);
  return emptyGeometry();
}

function geoJsonGeometry(payload: unknown): ProjectedGeometry {
  let value: any = payload;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return { ...emptyGeometry(), unresolved: value };
    try { value = JSON.parse(trimmed); } catch { return { ...emptyGeometry(), unresolved: 'invalid inline GeoJSON' }; }
  }
  const polygons: LonLat[][] = [];
  const lines: LonLat[][] = [];
  const visit = (item: any) => {
    if (!item) return;
    if (item.type === 'FeatureCollection') return array(item.features).forEach(visit);
    if (item.type === 'Feature') return visit(item.geometry);
    if (item.type === 'GeometryCollection') return array(item.geometries).forEach(visit);
    if (item.type === 'Polygon') return array(item.coordinates).forEach((ring: any) => polygons.push(normalizeCoordinates(ring)));
    if (item.type === 'MultiPolygon') return array(item.coordinates).forEach((polygon: any) => array(polygon).forEach((ring: any) => polygons.push(normalizeCoordinates(ring))));
    if (item.type === 'LineString') lines.push(normalizeCoordinates(item.coordinates));
    if (item.type === 'MultiLineString') array(item.coordinates).forEach((path: any) => lines.push(normalizeCoordinates(path)));
    if (item.type === 'Point' && Array.isArray(item.coordinates)) lines.push(normalizeCoordinates([item.coordinates]));
  };
  visit(value);
  return { polygons: polygons.filter(ring => ring.length >= 3), lines: lines.filter(path => path.length >= 1) };
}

function normalizeCoordinates(value: any): LonLat[] {
  return array(value).map((coordinate: any) => Array.isArray(coordinate)
    ? ({ lon: finite(coordinate[0]), lat: finite(coordinate[1]) })
    : validPoint(coordinate)).filter(Boolean) as LonLat[];
}

function normalizeRing(value: any[]): LonLat[] {
  const ring = value.map(validPoint).filter(Boolean) as LonLat[];
  if (ring.length > 2 && (ring[0].lon !== ring[ring.length - 1].lon || ring[0].lat !== ring[ring.length - 1].lat)) ring.push({ ...ring[0] });
  return ring;
}

function normalizeLine(value: any[]): LonLat[] {
  return value.map(validPoint).filter(Boolean) as LonLat[];
}

function renderGeometry(
  geometry: ProjectedGeometry,
  view: MapView,
  fill: string,
  stroke: string,
  strokeWidth: number,
  fillOpacity: number,
  extra: Record<string, unknown> = {},
): SatoriElement[] {
  const elements: SatoriElement[] = [];
  const rings = geometry.polygons.filter(ring => ring.length >= 3);
  if (rings.length) {
    // One compound even-odd path preserves Polygon holes and works equally
    // for disjoint MultiPolygon components.
    const d = rings.map(ring => ring.map((point, pointIndex) => {
      const projected = view.project(point);
      return `${pointIndex ? 'L' : 'M'} ${round(projected.x)} ${round(projected.y)}`;
    }).join(' ') + ' Z').join(' ');
    elements.push(path(d, fill, stroke, strokeWidth, { 'fill-opacity': String(fillOpacity), 'fill-rule': 'evenodd', ...extra, 'data-part': 'polygons' }));
  }
  geometry.lines.forEach((linePoints, index) => {
    if (!linePoints.length) return;
    const d = linePoints.map((point, pointIndex) => {
      const projected = view.project(point);
      return `${pointIndex ? 'L' : 'M'} ${round(projected.x)} ${round(projected.y)}`;
    }).join(' ');
    elements.push(path(d, 'none', stroke, strokeWidth, { ...extra, 'data-part': String(index) }));
  });
  return elements;
}

function basemap(bounds: Box, basemapSpec: any): SatoriElement[] {
  const children: SatoriElement[] = [rect(bounds.x, bounds.y, bounds.width, bounds.height, MAP_COLORS.land, '#c8c1b6', 1, { 'data-role': 'basemap' })];
  const parkW = bounds.width * 0.18;
  const parkH = bounds.height * 0.13;
  children.push(rect(bounds.x + bounds.width * 0.7, bounds.y + bounds.height * 0.11, parkW, parkH, MAP_COLORS.park, 'none', 0));
  children.push(path(`M ${round(bounds.x + bounds.width * 0.08)} ${round(bounds.y)} C ${round(bounds.x + bounds.width * 0.18)} ${round(bounds.y + bounds.height * 0.28)}, ${round(bounds.x + bounds.width * 0.04)} ${round(bounds.y + bounds.height * 0.72)}, ${round(bounds.x + bounds.width * 0.16)} ${round(bounds.y + bounds.height)}`, 'none', MAP_COLORS.water, 9));
  for (let i = 1; i < 9; i += 1) {
    const x = bounds.x + bounds.width * i / 9;
    children.push(line(x, bounds.y, x, bounds.y + bounds.height, MAP_COLORS.street, i % 3 === 0 ? 1.5 : 0.7));
  }
  for (let i = 1; i < 7; i += 1) {
    const y = bounds.y + bounds.height * i / 7;
    children.push(line(bounds.x, y, bounds.x + bounds.width, y, MAP_COLORS.street, i % 3 === 0 ? 1.5 : 0.7));
  }
  children.push(svgText(bounds.x + 9, bounds.y + 17, String(basemapSpec?.city ?? 'Civic basemap'), labelStyle(10, MAP_COLORS.streetLabel, 500)));
  return children;
}

function mapFurniture(bounds: Box, view: MapView, basemapSpec: any): SatoriElement[] {
  const x = bounds.x + 13;
  const y = bounds.y + bounds.height - 14;
  const targetPixels = 58;
  const meters = niceDistance(view.metersPerPixel * targetPixels);
  const width = clamp(meters / Math.max(view.metersPerPixel, 0.001), 24, 90);
  return [
    line(x, y, x + width, y, '#4e4944', 2), line(x, y - 4, x, y + 4, '#4e4944', 1), line(x + width, y - 4, x + width, y + 4, '#4e4944', 1),
    svgText(x, y - 7, meters >= 1000 ? `${round(meters / 1000)} km` : `${round(meters)} m`, labelStyle(9, '#4e4944', 500)),
    line(bounds.x + bounds.width - 20, bounds.y + 28, bounds.x + bounds.width - 20, bounds.y + 9, '#4e4944', 1.5),
    path(`M ${round(bounds.x + bounds.width - 20)} ${round(bounds.y + 5)} L ${round(bounds.x + bounds.width - 25)} ${round(bounds.y + 14)} L ${round(bounds.x + bounds.width - 15)} ${round(bounds.y + 14)} Z`, '#4e4944', '#4e4944', 1),
    svgText(bounds.x + bounds.width - 24, bounds.y + 38, 'N', labelStyle(9, '#4e4944', 600)),
    svgText(bounds.x + bounds.width - 190, bounds.y + bounds.height - 8, `${basemapSpec?.county ? `${basemapSpec.county} · ` : ''}${basemapSpec?.state ?? ''}`, labelStyle(9, MAP_COLORS.streetLabel, 400)),
  ];
}

function fittedLabels(anchors: LabelAnchor[], bounds: Box, occupied: Box[] = []): PlacedLabel[] {
  const sanitized = anchors.map(anchor => ({ ...anchor, text: shorten(anchor.text, 30) }));
  const placed = placeLabels(sanitized, bounds, occupied, 10);
  // A deterministic last resort: assign crowded labels to alternating edge lanes.
  const result: PlacedLabel[] = [];
  placed.forEach((label, index) => {
    if (!result.some(existing => boxesOverlapLocal(label, existing, 1))) {
      result.push(label);
      return;
    }
    const laneWidth = clamp(label.width, 28, Math.min(190, bounds.width / 2 - 4));
    const left = index % 2 === 0;
    const laneLabels = result.filter(existing => left ? existing.x < bounds.x + bounds.width / 2 : existing.x >= bounds.x + bounds.width / 2);
    let y = bounds.y + 4;
    laneLabels.sort((a, b) => a.y - b.y).forEach(existing => {
      if (y < existing.y + existing.height + 2) y = existing.y + existing.height + 2;
    });
    y = clamp(y, bounds.y, bounds.y + bounds.height - label.height);
    result.push({ ...label, x: left ? bounds.x : bounds.x + bounds.width - laneWidth, y, width: laneWidth });
  });
  return result;
}

function renderLeaders(labels: PlacedLabel[]): SatoriElement[] {
  return labels.map(label => line(label.anchorX, label.anchorY, clamp(label.anchorX, label.x, label.x + label.width), clamp(label.anchorY, label.y, label.y + label.height), '#77716b', 0.8, {
    'data-role': 'label-leader', 'data-id': label.id,
  }));
}

function renderLabels(labels: PlacedLabel[]): SatoriElement[] {
  return labels.flatMap(label => [
    rect(label.x, label.y, label.width, label.height, '#fffdf8', '#d5cec3', 0.7, {
      rx: '3', 'data-role': 'label-box', 'data-id': label.id,
    }),
    svgText(label.x + 4, label.y + label.height - 5, label.text, { ...labelStyle(10, MAP_COLORS.ink, 500), 'data-role': 'map-label', 'data-id': label.id }),
  ]);
}

function makeChoroplethClassifier(spec: any, features: any[]): { color(value: unknown, index: number): string; label(value: unknown): string; legend: LegendItem[] } {
  const numeric = features.filter(feature => typeof feature.value === 'number' && Number.isFinite(feature.value));
  if (spec.breaks === 'categorical' || numeric.length !== features.filter(feature => feature.value != null).length) {
    const values = [...new Set(features.filter(feature => feature.value != null).map(feature => String(feature.value)))];
    const colors = new Map(values.map((value, index) => [value, legendColor(spec, value, index, colorAt(index))]));
    const legend: LegendItem[] = values.map(value => ({ label: value, color: colors.get(value) }));
    legend.push({ label: 'n/a', color: '#e4e1db', pattern: 'hatch' });
    return {
      color: (value, index) => value == null ? '#e4e1db' : colors.get(String(value)) ?? colorAt(index),
      label: value => value == null ? 'n/a' : String(value),
      legend,
    };
  }
  const values = numeric.map(feature => finite(feature.value));
  const [min, max] = extent(values);
  const classes = clamp(Math.round(finite(spec.classes, 5)), 2, 9);
  let thresholds: number[];
  if (spec.breaks === 'explicit' && Array.isArray(spec.breakValues)) {
    thresholds = [...spec.breakValues].map((value: unknown) => finite(value)).sort((a: number, b: number) => a - b);
  } else if (spec.breaks === 'quantile') {
    const sorted = [...values].sort((a, b) => a - b);
    thresholds = Array.from({ length: classes - 1 }, (_, index) => sorted[Math.min(sorted.length - 1, Math.ceil((index + 1) * sorted.length / classes) - 1)]);
  } else {
    thresholds = Array.from({ length: classes - 1 }, (_, index) => min + (max - min) * (index + 1) / classes);
  }
  thresholds = [...new Set(thresholds)];
  const signed = min < 0 && max > 0;
  const palette = Array.from({ length: thresholds.length + 1 }, (_, index) => sequentialColor(index, thresholds.length + 1, signed));
  const classIndex = (value: number) => thresholds.findIndex(threshold => value <= threshold) < 0 ? thresholds.length : thresholds.findIndex(threshold => value <= threshold);
  const legend: LegendItem[] = palette.map((color, index) => ({
    label: index === 0 ? `≤ ${formatNumber(thresholds[0] ?? max)}` : index === thresholds.length ? `> ${formatNumber(thresholds[index - 1])}` : `${formatNumber(thresholds[index - 1])}–${formatNumber(thresholds[index])}`,
    color,
  }));
  legend.push({ label: 'n/a', color: '#e4e1db', pattern: 'hatch' });
  return {
    color: value => value == null ? '#e4e1db' : palette[classIndex(finite(value))],
    label: value => value == null ? 'n/a' : formatNumber(finite(value)),
    legend,
  };
}

function sequentialColor(index: number, total: number, signed: boolean): string {
  const t = total <= 1 ? 1 : index / (total - 1);
  if (signed) {
    if (t < 0.5) return mixColor('#9b2335', '#f1eee7', t * 2);
    return mixColor('#f1eee7', '#2f6287', (t - 0.5) * 2);
  }
  return mixColor('#e8eee9', '#315b43', t);
}

function mixColor(a: string, b: string, t: number): string {
  const av = parseInt(a.slice(1), 16); const bv = parseInt(b.slice(1), 16);
  const parts = [16, 8, 0].map(shift => Math.round(((av >> shift) & 255) * (1 - t) + ((bv >> shift) & 255) * t));
  return `#${parts.map(value => value.toString(16).padStart(2, '0')).join('')}`;
}

function geometryCentroid(geometry: ProjectedGeometry | undefined, view: MapView): Point | undefined {
  if (!geometry) return undefined;
  const source = geometry.polygons.find(ring => ring.length) ?? geometry.lines.find(path => path.length);
  if (!source?.length) return undefined;
  const projected = source.map(view.project);
  if (geometry.polygons.length && projected.length >= 3) {
    let twiceArea = 0; let x = 0; let y = 0;
    for (let i = 0; i < projected.length - 1; i += 1) {
      const a = projected[i]; const b = projected[i + 1]; const cross = a.x * b.y - b.x * a.y;
      twiceArea += cross; x += (a.x + b.x) * cross; y += (a.y + b.y) * cross;
    }
    if (Math.abs(twiceArea) > 0.001) return { x: x / (3 * twiceArea), y: y / (3 * twiceArea) };
  }
  return { x: projected.reduce((sum, point) => sum + point.x, 0) / projected.length, y: projected.reduce((sum, point) => sum + point.y, 0) / projected.length };
}

function unresolvedNotices(geometries: ProjectedGeometry[], bounds: Box): SatoriElement[] {
  const refs = [...new Set(geometries.map(geometry => geometry.unresolved).filter(Boolean))] as string[];
  return refs.slice(0, 2).map((ref, index) => svgText(bounds.x + 8, bounds.y + bounds.height - 30 - index * 13, `Geometry ref: ${shorten(ref, 34)}`, labelStyle(9, '#7a332e', 500)));
}

function legendColor(spec: any, key: unknown, index: number, fallback: string): string {
  const normalized = String(key ?? '').toLowerCase();
  const items = resolveLegend(spec.legend, []);
  const exact = items.find(item => String(item.label).toLowerCase() === normalized);
  const partial = items.find(item => normalized && (String(item.label).toLowerCase().startsWith(normalized) || String(item.label).toLowerCase().includes(normalized)));
  return exact?.color ?? partial?.color ?? fallback ?? colorAt(index);
}

function uniqueLegend(items: LegendItem[]): LegendItem[] {
  const found = new Set<string>();
  return items.filter(item => {
    const key = `${item.label}:${item.color ?? ''}`;
    if (found.has(key)) return false;
    found.add(key); return true;
  });
}

function placeCenter(place: unknown): LonLat | undefined { return place ? GAZETTEER[String(place)]?.center : undefined; }
function fallbackCenter(basemapSpec: any): LonLat { return validPoint(basemapSpec?.center) ?? cityFrame(basemapSpec).center; }
function allGeometryPoints(geometry: ProjectedGeometry): LonLat[] { return [...geometry.polygons.flat(), ...geometry.lines.flat()]; }
function emptyGeometry(): ProjectedGeometry { return { polygons: [], lines: [] }; }
function validPoint(value: any): LonLat | undefined {
  if (!value || !Number.isFinite(Number(value.lon)) || !Number.isFinite(Number(value.lat))) return undefined;
  return { lon: clamp(Number(value.lon), -180, 180), lat: clamp(Number(value.lat), -90, 90) };
}
function contentWidth(context: CivicRenderContext): number { return Math.max(280, context.width - context.padding * 2); }
function insetBox(box: Box, amount: number): Box { return { x: box.x + amount, y: box.y + amount, width: Math.max(1, box.width - amount * 2), height: Math.max(1, box.height - amount * 2) }; }
function array<T = any>(value: unknown): T[] { return Array.isArray(value) ? value : []; }
function slug(value: string): string { return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function shorten(value: unknown, max: number): string { const text = String(value ?? ''); return text.length <= max ? text : `${text.slice(0, Math.max(1, max - 1))}…`; }
function formatNumber(value: number): string { return Math.abs(value) >= 1000 ? value.toLocaleString('en-US', { maximumFractionDigits: 1 }) : String(Math.round(value * 10) / 10); }
function niceDistance(value: number): number { const power = 10 ** Math.floor(Math.log10(Math.max(value, 1))); const normalized = value / power; return (normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1) * power; }
function round(value: number): string { return (Math.round(value * 100) / 100).toString(); }
function boxesOverlapLocal(a: Box, b: Box, gap = 0): boolean { return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y; }

function labelStyle(fontSize: number, fill: string, fontWeight: number): Record<string, unknown> {
  return { 'font-size': String(fontSize), 'font-family': 'Inter, sans-serif', 'font-weight': String(fontWeight), fill };
}
function element(type: string, props: Record<string, unknown>, children?: SatoriElement[] | string): SatoriElement {
  return { type, props: { ...props, ...(children === undefined ? {} : { children }) } };
}
function rect(x: number, y: number, width: number, height: number, fill: string, stroke: string, strokeWidth: number, extra: Record<string, unknown> = {}): SatoriElement {
  return element('rect', { x: round(x), y: round(y), width: round(width), height: round(height), fill, stroke, 'stroke-width': String(strokeWidth), ...extra });
}
function line(x1: number, y1: number, x2: number, y2: number, stroke: string, strokeWidth: number, extra: Record<string, unknown> = {}): SatoriElement {
  return element('line', { x1: round(x1), y1: round(y1), x2: round(x2), y2: round(y2), stroke, 'stroke-width': String(strokeWidth), ...extra });
}
function circle(cx: number, cy: number, r: number, fill: string, stroke: string, strokeWidth: number, extra: Record<string, unknown> = {}): SatoriElement {
  return element('circle', { cx: round(cx), cy: round(cy), r: round(r), fill, stroke, 'stroke-width': String(strokeWidth), ...extra });
}
function path(d: string, fill: string, stroke: string, strokeWidth: number, extra: Record<string, unknown> = {}): SatoriElement {
  return element('path', { d, fill, stroke, 'stroke-width': String(strokeWidth), 'stroke-linejoin': 'round', 'stroke-linecap': 'round', ...extra });
}
function emptyPlot(context: CivicRenderContext, message: string): SatoriElement {
  const width = contentWidth(context);
  return svgElement(width, 160, [rect(0, 0, width, 160, '#f5f3ef', '#d2cbc1', 1), svgText(18, 80, message, labelStyle(12, '#7a332e', 500))]);
}
