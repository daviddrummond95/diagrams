import YAML from 'yaml';
import type { AnyDiagramSpec, DiagramSpec, GanttSpec, TimelineSpec, QuadrantSpec } from './types.js';

export function parseSpec(input: string): AnyDiagramSpec {
  // Try JSON first, fall back to YAML
  const trimmed = input.trim();
  let raw: unknown;

  if (trimmed.startsWith('{')) {
    try {
      raw = JSON.parse(trimmed);
    } catch {
      throw new Error('Input looks like JSON but failed to parse');
    }
  } else {
    raw = YAML.parse(trimmed);
  }

  if (!raw || typeof raw !== 'object') {
    throw new Error('Spec must be an object');
  }

  const obj = raw as Record<string, unknown>;
  const type = (obj.type as string) ?? 'flow';

  switch (type) {
    case 'gantt':
      return normalizeGantt(obj as unknown as GanttSpec);
    case 'timeline':
      return normalizeTimeline(obj as unknown as TimelineSpec);
    case 'quadrant':
      return normalizeQuadrant(obj as unknown as QuadrantSpec);
    case 'flow':
    default:
      return normalizeFlow(obj as unknown as DiagramSpec);
  }
}

function normalizeFlow(spec: DiagramSpec): DiagramSpec {
  spec.type = 'flow';
  spec.nodes = spec.nodes ?? [];
  spec.edges = spec.edges ?? [];
  spec.direction = spec.direction ?? 'TB';
  spec.groups = spec.groups ?? [];
  spec.rows = spec.rows ?? [];
  return spec;
}

function normalizeGantt(spec: GanttSpec): GanttSpec {
  spec.type = 'gantt';
  spec.tasks = spec.tasks ?? [];
  return spec;
}

function normalizeTimeline(spec: TimelineSpec): TimelineSpec {
  spec.type = 'timeline';
  spec.events = spec.events ?? [];
  spec.direction = spec.direction ?? 'TB';
  return spec;
}

function normalizeQuadrant(spec: QuadrantSpec): QuadrantSpec {
  spec.type = 'quadrant';
  spec.items = spec.items ?? [];
  spec.quadrants = spec.quadrants ?? [];
  return spec;
}
