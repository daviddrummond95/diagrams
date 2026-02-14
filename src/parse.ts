import YAML from 'yaml';
import type { DiagramSpec } from './types.js';

export function parseSpec(input: string): DiagramSpec {
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
    throw new Error('Spec must be an object with nodes and edges');
  }

  const spec = raw as DiagramSpec;

  // Normalize: ensure arrays exist
  spec.nodes = spec.nodes ?? [];
  spec.edges = spec.edges ?? [];
  spec.direction = spec.direction ?? 'TB';
  spec.groups = spec.groups ?? [];
  spec.rows = spec.rows ?? [];

  return spec;
}
