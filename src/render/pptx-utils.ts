/**
 * Shared helpers for converting SVG path data to pptxgenjs custom geometry points.
 *
 * Key insight: pptxgenjs custGeom points are in inches, relative to the shape's
 * bounding box origin (0,0). You MUST specify x, y, w, h on the shape, and
 * points range from (0,0) to (w,h).
 */

export interface PptxPoint {
  x: number;
  y: number;
  moveTo?: boolean;
  close?: boolean;
  curve?: {
    type: 'cubic';
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

export interface PptxCurveShape {
  /** Shape x position on slide (inches) */
  x: number;
  /** Shape y position on slide (inches) */
  y: number;
  /** Shape width (inches) */
  w: number;
  /** Shape height (inches) */
  h: number;
  /** Points relative to (0,0) origin of the bounding box */
  points: PptxPoint[];
}

interface PathCommand {
  type: 'M' | 'L' | 'C' | 'Q' | 'Z';
  coords: number[];
}

/**
 * Parse an SVG path `d` attribute into a list of commands.
 * Supports M, L, C, Q, Z (uppercase only — our layout engine emits absolute coords).
 */
export function parseSvgPath(pathData: string): PathCommand[] {
  const commands: PathCommand[] = [];
  const re = /([MLCQZ])\s*((?:-?[\d.]+[\s,]*)*)/gi;
  let match: RegExpExecArray | null;

  while ((match = re.exec(pathData)) !== null) {
    const type = match[1].toUpperCase() as PathCommand['type'];
    const coordStr = match[2].trim();
    const coords = coordStr
      ? coordStr.split(/[\s,]+/).map(Number).filter(n => !isNaN(n))
      : [];
    commands.push({ type, coords });
  }

  return commands;
}

/**
 * Collect all x,y coordinates from an SVG path to compute the bounding box.
 */
function getPathBounds(commands: PathCommand[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  function track(px: number, py: number) {
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }

  for (const cmd of commands) {
    const c = cmd.coords;
    switch (cmd.type) {
      case 'M':
      case 'L':
        for (let i = 0; i + 1 < c.length; i += 2) track(c[i], c[i + 1]);
        break;
      case 'C':
        // Track control points AND endpoints for bounding box
        for (let i = 0; i + 5 < c.length; i += 6) {
          track(c[i], c[i + 1]);     // cp1
          track(c[i + 2], c[i + 3]); // cp2
          track(c[i + 4], c[i + 5]); // endpoint
        }
        break;
      case 'Q':
        for (let i = 0; i + 3 < c.length; i += 4) {
          track(c[i], c[i + 1]);     // control point
          track(c[i + 2], c[i + 3]); // endpoint
        }
        break;
    }
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Convert SVG path data into a pptxgenjs custom geometry shape with proper
 * bounding box and relative points.
 *
 * `toSlideX` / `toSlideY` convert from pixel coordinates to absolute slide inches.
 * `pxToInches` converts a pixel distance to inches (without offset).
 */
export function svgPathToPptxShape(
  pathData: string,
  toSlideX: (px: number) => number,
  toSlideY: (px: number) => number,
  pxToInches: (px: number) => number,
): PptxCurveShape | null {
  const commands = parseSvgPath(pathData);
  if (commands.length === 0) return null;

  // Get bounding box in pixel space
  const bounds = getPathBounds(commands);
  if (!isFinite(bounds.minX)) return null;

  // Add small padding to avoid zero-width/height (e.g., perfectly vertical/horizontal lines)
  const PAD = 2; // pixels
  const bMinX = bounds.minX - PAD;
  const bMinY = bounds.minY - PAD;
  const bMaxX = bounds.maxX + PAD;
  const bMaxY = bounds.maxY + PAD;

  // Bounding box on the slide in inches
  const shapeX = toSlideX(bMinX);
  const shapeY = toSlideY(bMinY);
  const shapeW = pxToInches(bMaxX - bMinX);
  const shapeH = pxToInches(bMaxY - bMinY);

  // Helper: convert pixel coord to inches relative to bounding box origin
  const relX = (px: number) => pxToInches(px - bMinX);
  const relY = (px: number) => pxToInches(px - bMinY);

  const points: PptxPoint[] = [];

  for (const cmd of commands) {
    const c = cmd.coords;

    switch (cmd.type) {
      case 'M':
        if (c.length >= 2) {
          points.push({ x: relX(c[0]), y: relY(c[1]), moveTo: true });
        }
        break;

      case 'L':
        for (let i = 0; i + 1 < c.length; i += 2) {
          points.push({ x: relX(c[i]), y: relY(c[i + 1]) });
        }
        break;

      case 'C':
        for (let i = 0; i + 5 < c.length; i += 6) {
          points.push({
            x: relX(c[i + 4]),
            y: relY(c[i + 5]),
            curve: {
              type: 'cubic',
              x1: relX(c[i]),
              y1: relY(c[i + 1]),
              x2: relX(c[i + 2]),
              y2: relY(c[i + 3]),
            },
          });
        }
        break;

      case 'Q':
        for (let i = 0; i + 3 < c.length; i += 4) {
          const prev = points.length > 0 ? points[points.length - 1] : { x: 0, y: 0 };
          const qx = relX(c[i]);
          const qy = relY(c[i + 1]);
          const endX = relX(c[i + 2]);
          const endY = relY(c[i + 3]);
          points.push({
            x: endX,
            y: endY,
            curve: {
              type: 'cubic',
              x1: prev.x + (2 / 3) * (qx - prev.x),
              y1: prev.y + (2 / 3) * (qy - prev.y),
              x2: endX + (2 / 3) * (qx - endX),
              y2: endY + (2 / 3) * (qy - endY),
            },
          });
        }
        break;

      case 'Z':
        points.push({ x: 0, y: 0, close: true });
        break;
    }
  }

  if (points.length < 2) return null;

  return { x: shapeX, y: shapeY, w: shapeW, h: shapeH, points };
}

/**
 * Extract start/end coordinates from SVG path data (raw pixel values).
 * Returns [startX, startY, endX, endY] or null if path is invalid.
 */
export function getPathEndpoints(pathData: string): [number, number, number, number] | null {
  const commands = parseSvgPath(pathData);
  if (commands.length === 0) return null;

  let startX = 0, startY = 0, endX = 0, endY = 0;

  for (const cmd of commands) {
    const c = cmd.coords;
    switch (cmd.type) {
      case 'M':
        if (c.length >= 2) { startX = c[0]; startY = c[1]; endX = c[0]; endY = c[1]; }
        break;
      case 'L':
        if (c.length >= 2) { endX = c[c.length - 2]; endY = c[c.length - 1]; }
        break;
      case 'C':
        if (c.length >= 6) { endX = c[c.length - 2]; endY = c[c.length - 1]; }
        break;
      case 'Q':
        if (c.length >= 4) { endX = c[c.length - 2]; endY = c[c.length - 1]; }
        break;
    }
  }

  return [startX, startY, endX, endY];
}
