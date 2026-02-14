import type { DiagramSpec, NodeId } from '../types.js';

/**
 * Order nodes within each rank to minimize edge crossings.
 * Uses barycenter heuristic. Back-edges are excluded from adjacency.
 */
export function orderNodes(
  spec: DiagramSpec,
  ranks: Map<NodeId, number>,
  backEdges: Set<number> = new Set(),
): NodeId[][] {
  const { edges } = spec;

  // Group nodes by rank
  const maxRank = Math.max(...ranks.values(), 0);
  const layers: NodeId[][] = Array.from({ length: maxRank + 1 }, () => []);
  for (const [id, rank] of ranks) {
    layers[rank].push(id);
  }

  // Build forward-only adjacency (exclude back-edges)
  const outgoing = new Map<NodeId, NodeId[]>();
  const incoming = new Map<NodeId, NodeId[]>();
  for (const [id] of ranks) {
    outgoing.set(id, []);
    incoming.set(id, []);
  }
  for (let i = 0; i < edges.length; i++) {
    if (backEdges.has(i)) continue;
    outgoing.get(edges[i].from)?.push(edges[i].to);
    incoming.get(edges[i].to)?.push(edges[i].from);
  }

  // Two passes: forward (top-down) then backward (bottom-up)
  for (let pass = 0; pass < 2; pass++) {
    if (pass === 0) {
      for (let r = 1; r <= maxRank; r++) {
        const prevLayer = layers[r - 1];
        const prevIndex = new Map(prevLayer.map((id, i) => [id, i]));

        layers[r].sort((a, b) => {
          return barycenter(a, incoming, prevIndex) - barycenter(b, incoming, prevIndex);
        });
      }
    } else {
      for (let r = maxRank - 1; r >= 0; r--) {
        const nextLayer = layers[r + 1];
        const nextIndex = new Map(nextLayer.map((id, i) => [id, i]));

        layers[r].sort((a, b) => {
          return barycenter(a, outgoing, nextIndex) - barycenter(b, outgoing, nextIndex);
        });
      }
    }
  }

  return layers;
}

function barycenter(
  nodeId: NodeId,
  adjacency: Map<NodeId, NodeId[]>,
  indexMap: Map<NodeId, number>,
): number {
  const neighbors = adjacency.get(nodeId) ?? [];
  const positions = neighbors
    .map(n => indexMap.get(n))
    .filter((p): p is number => p !== undefined);

  if (positions.length === 0) return 0;
  return positions.reduce((a, b) => a + b, 0) / positions.length;
}
