import type { AnyDiagramSpec, RenderOptions, ThemeConfig } from '../../types.js';
import { COMPOSITION_TYPES, buildCompositionDiagram } from './composition.js';
import { MONEY_TYPES, buildMoneyDiagram } from './money.js';
import { PLACE_TYPES, buildPlaceDiagram } from './place.js';
import { PROCESS_TYPES, buildProcessDiagram } from './process.js';
import { buildStatDiagram } from './stat.js';
import { TIME_TYPES, buildTimeDiagram } from './time.js';
import type { CivicDiagramResult, CivicRenderContext } from './shared.js';

const money = new Set<string>(MONEY_TYPES);
const place = new Set<string>(PLACE_TYPES);
const process = new Set<string>(PROCESS_TYPES);
const time = new Set<string>(TIME_TYPES);
const composition = new Set<string>(COMPOSITION_TYPES);

export const CIVIC_RENDER_TYPES = new Set<string>([
  'stat', ...MONEY_TYPES, ...PLACE_TYPES, ...PROCESS_TYPES, ...TIME_TYPES, ...COMPOSITION_TYPES,
]);

export function buildCivicDiagram(
  spec: AnyDiagramSpec,
  theme: ThemeConfig,
  options: RenderOptions,
): CivicDiagramResult {
  const type = spec.type ?? 'flow';
  const padding = Math.max(0, options.padding ?? 40);
  const width = Math.max(320, options.width ?? 900, padding * 2 + 240);
  const context: CivicRenderContext = { width, padding, theme, options };
  if (type === 'stat') return buildStatDiagram(spec as any, context);
  if (money.has(type)) return buildMoneyDiagram(spec, context);
  if (place.has(type)) return buildPlaceDiagram(spec, context);
  if (process.has(type)) return buildProcessDiagram(spec, context);
  if (time.has(type)) return buildTimeDiagram(spec, context);
  if (composition.has(type)) return buildCompositionDiagram(spec, context);
  throw new Error(`No civic renderer for diagram type: "${type}"`);
}

export { parseISODate, positionOnAxis } from './time.js';
