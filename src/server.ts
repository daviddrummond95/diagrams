import { createHash } from 'node:crypto';
import type { AnyDiagramSpec, CivicBase, RenderOptions } from './types.js';
import { detectIconType, type IconType } from './icons.js';
import { validate } from './validate.js';
import { buildDiagramTree } from './render/build.js';
import { renderToSvg } from './render/svg.js';

/** Bump whenever identical inputs may produce materially different hosted SVG. */
export const HOSTED_SVG_RENDERER_VERSION = '1';

export interface HostedSvgLimits {
  maxSpecBytes: number;
  maxDepth: number;
  maxArrayLength: number;
  maxTotalItems: number;
  maxStringLength: number;
  minWidth: number;
  maxWidth: number;
  maxHeight: number;
  maxPadding: number;
  maxOutputBytes: number;
}

export const DEFAULT_HOSTED_SVG_LIMITS: Readonly<HostedSvgLimits> = Object.freeze({
  maxSpecBytes: 256 * 1024,
  maxDepth: 32,
  maxArrayLength: 500,
  maxTotalItems: 5_000,
  maxStringLength: 20_000,
  minWidth: 64,
  maxWidth: 2_400,
  maxHeight: 4_000,
  maxPadding: 160,
  maxOutputBytes: 2 * 1024 * 1024,
});

const DEFAULT_ALLOWED_ICON_TYPES: readonly IconType[] = ['none', 'civic', 'geist', 'named'];

export interface HostedSvgOptions {
  width?: number;
  padding?: number;
  background?: string;
  showTitle?: boolean;
  /** Defaults to true. Publication surfaces must carry a text alternative. */
  requireAlt?: boolean;
  /** Defaults to true. Publication surfaces must carry the underlying data. */
  requireDataTable?: boolean;
  /** Remote and install-time cloud icons are denied by default. */
  allowedIconTypes?: readonly IconType[];
  limits?: Partial<HostedSvgLimits>;
}

export interface HostedSvgResult {
  svg: string;
  width: number;
  height: number;
  /** Stable SHA-256 key for an HTTP ETag/cache key. */
  contentHash: string;
  rendererVersion: typeof HOSTED_SVG_RENDERER_VERSION;
}

export class HostedSvgValidationError extends Error {
  readonly errors: readonly string[];

  constructor(errors: readonly string[]) {
    super(`Hosted SVG validation failed:\n  ${errors.join('\n  ')}`);
    this.name = 'HostedSvgValidationError';
    this.errors = errors;
  }
}

/**
 * Validate an untrusted JSON-shaped spec before it reaches layout, filesystem,
 * icon, font, or rasterization code.
 */
export function validateHostedSvg(
  spec: unknown,
  options: HostedSvgOptions = {},
): string[] {
  const limits = hostedLimits(options.limits);
  const errors: string[] = [];
  if (!isRecord(spec)) return ['Diagram spec must be a JSON object'];

  let serialized = '';
  try {
    serialized = JSON.stringify(spec);
    if (typeof serialized !== 'string') throw new Error('not JSON');
  } catch {
    errors.push('Diagram spec must be JSON-serializable and acyclic');
    return errors;
  }
  if (Buffer.byteLength(serialized, 'utf8') > limits.maxSpecBytes) {
    return [`Diagram spec exceeds ${limits.maxSpecBytes} bytes`];
  }

  inspectValue(spec, 'spec', 0, limits, { totalItems: 0 }, new Set<object>(), errors);
  if (errors.length) return unique(errors);
  inspectHostedResources(spec, 'spec', new Set(options.allowedIconTypes ?? DEFAULT_ALLOWED_ICON_TYPES), errors);

  const width = options.width;
  if (width != null && (!Number.isFinite(width) || width < limits.minWidth || width > limits.maxWidth)) {
    errors.push(`width must be between ${limits.minWidth} and ${limits.maxWidth}`);
  }
  const padding = options.padding;
  if (padding != null && (!Number.isFinite(padding) || padding < 0 || padding > limits.maxPadding)) {
    errors.push(`padding must be between 0 and ${limits.maxPadding}`);
  }

  if (options.requireAlt !== false && (typeof spec.alt !== 'string' || !spec.alt.trim())) {
    errors.push('alt must be a non-empty string for hosted SVG');
  }
  if (options.requireDataTable !== false) {
    const table = spec.dataTable;
    if (!isRecord(table) || !Array.isArray(table.columns) || table.columns.length === 0 || !Array.isArray(table.records)) {
      errors.push('dataTable with columns and records is required for hosted SVG');
    }
  }

  try {
    errors.push(...validate(spec as AnyDiagramSpec));
  } catch {
    errors.push('Diagram spec has an invalid structure');
  }
  return unique(errors);
}

/**
 * Render a deterministic, publication-safe SVG without loading HTML, PNG, or
 * PPTX output code. HTTP auth, rate/concurrency limiting, and response headers
 * remain the responsibility of the hosting service.
 */
export async function renderHostedSvg(
  spec: unknown,
  options: HostedSvgOptions = {},
): Promise<HostedSvgResult> {
  const limits = hostedLimits(options.limits);
  const errors = validateHostedSvg(spec, options);
  if (errors.length) throw new HostedSvgValidationError(errors);

  const renderOptions: RenderOptions = {
    width: options.width,
    padding: options.padding,
    background: options.background,
    showTitle: options.showTitle,
    allowRemoteIcons: (options.allowedIconTypes ?? DEFAULT_ALLOWED_ICON_TYPES).some(type => type === 'emoji' || type === 'favicon'),
  };
  const result = await buildDiagramTree(spec as AnyDiagramSpec, renderOptions);
  if (!Number.isFinite(result.width) || result.width < limits.minWidth || result.width > limits.maxWidth) {
    throw new HostedSvgValidationError([`rendered width must be between ${limits.minWidth} and ${limits.maxWidth}`]);
  }
  if (!Number.isFinite(result.height) || result.height <= 0 || result.height > limits.maxHeight) {
    throw new HostedSvgValidationError([`rendered height must be between 1 and ${limits.maxHeight}`]);
  }

  const metadata = spec as CivicBase;
  const svg = await renderToSvg(result.tree, result.width, result.height, {
    title: metadata.title,
    alt: metadata.alt,
  });
  const outputBytes = Buffer.byteLength(svg, 'utf8');
  if (outputBytes > limits.maxOutputBytes) {
    throw new HostedSvgValidationError([`rendered SVG exceeds ${limits.maxOutputBytes} bytes`]);
  }

  return {
    svg,
    width: result.width,
    height: result.height,
    contentHash: hostedSvgContentHash(spec, options),
    rendererVersion: HOSTED_SVG_RENDERER_VERSION,
  };
}

export function hostedSvgContentHash(spec: unknown, options: HostedSvgOptions = {}): string {
  const renderOptions = {
    allowedIconTypes: [...(options.allowedIconTypes ?? DEFAULT_ALLOWED_ICON_TYPES)].sort(),
    background: options.background ?? null,
    padding: options.padding ?? null,
    showTitle: options.showTitle ?? null,
    width: options.width ?? null,
  };
  return createHash('sha256')
    .update(stableJson({ rendererVersion: HOSTED_SVG_RENDERER_VERSION, spec, options: renderOptions }))
    .digest('hex');
}

function hostedLimits(overrides: Partial<HostedSvgLimits> | undefined): HostedSvgLimits {
  return { ...DEFAULT_HOSTED_SVG_LIMITS, ...overrides };
}

function inspectValue(
  value: unknown,
  path: string,
  depth: number,
  limits: HostedSvgLimits,
  state: { totalItems: number },
  ancestors: Set<object>,
  errors: string[],
): void {
  if (depth > limits.maxDepth) {
    errors.push(`${path} exceeds maximum depth ${limits.maxDepth}`);
    return;
  }
  if (typeof value === 'string' && value.length > limits.maxStringLength) {
    errors.push(`${path} exceeds maximum string length ${limits.maxStringLength}`);
    return;
  }
  if (value == null || typeof value !== 'object') return;
  if (ancestors.has(value)) {
    errors.push(`${path} contains a cycle`);
    return;
  }

  ancestors.add(value);
  const entries = Array.isArray(value) ? value.map((child, index) => [String(index), child] as const) : Object.entries(value);
  if (Array.isArray(value) && value.length > limits.maxArrayLength) {
    errors.push(`${path} exceeds maximum array length ${limits.maxArrayLength}`);
  }
  state.totalItems += entries.length;
  if (state.totalItems > limits.maxTotalItems) {
    errors.push(`Diagram spec exceeds maximum total items ${limits.maxTotalItems}`);
    ancestors.delete(value);
    return;
  }
  for (const [key, child] of entries) inspectValue(child, `${path}.${key}`, depth + 1, limits, state, ancestors, errors);
  ancestors.delete(value);
}

function inspectHostedResources(
  value: unknown,
  path: string,
  allowedIconTypes: Set<IconType>,
  errors: string[],
): void {
  if (value == null || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (key === 'geojson' && typeof child === 'string') {
      errors.push(`${childPath} must be inline JSON; hosted SVG cannot read filesystem paths`);
    }
    if (key === 'icon' && typeof child === 'string') {
      const type = detectIconType(child);
      if (!allowedIconTypes.has(type)) errors.push(`${childPath} uses disallowed ${type} icon resolution`);
    }
    inspectHostedResources(child, childPath, allowedIconTypes, errors);
  }
}

function stableJson(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') return Number.isFinite(value) ? JSON.stringify(value) : 'null';
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(null);
}

function isRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
