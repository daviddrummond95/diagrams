import type { DiagramSpec, NodeId } from '../types.js';

export interface RankResult {
  ranks: Map<NodeId, number>;
  /** Indices into spec.edges that are back-edges (cycle-forming) */
  backEdges: Set<number>;
}

/**
 * Assign each node to a rank (layer).
 * Detects back-edges (cycle-forming) via DFS and excludes them from ranking.
 */
export function assignRanks(spec: DiagramSpec): RankResult {
  const { nodes, edges } = spec;

  // Build adjacency
  const outgoing = new Map<NodeId, { to: NodeId; idx: number }[]>();
  for (const n of nodes) {
    outgoing.set(n.id, []);
  }
  for (let i = 0; i < edges.length; i++) {
    outgoing.get(edges[i].from)?.push({ to: edges[i].to, idx: i });
  }

  // DFS to find back-edges
  const backEdges = new Set<number>();
  const visited = new Set<NodeId>();
  const inStack = new Set<NodeId>();

  function dfs(nodeId: NodeId) {
    visited.add(nodeId);
    inStack.add(nodeId);

    for (const { to, idx } of outgoing.get(nodeId) ?? []) {
      if (inStack.has(to)) {
        // Back-edge: target is an ancestor in the current DFS path
        backEdges.add(idx);
      } else if (!visited.has(to)) {
        dfs(to);
      }
    }

    inStack.delete(nodeId);
  }

  for (const n of nodes) {
    if (!visited.has(n.id)) dfs(n.id);
  }

  // Build forward-only adjacency (excluding back-edges)
  const incoming = new Map<NodeId, NodeId[]>();
  const forwardOut = new Map<NodeId, NodeId[]>();
  for (const n of nodes) {
    incoming.set(n.id, []);
    forwardOut.set(n.id, []);
  }
  for (let i = 0; i < edges.length; i++) {
    if (backEdges.has(i)) continue;
    incoming.get(edges[i].to)!.push(edges[i].from);
    forwardOut.get(edges[i].from)!.push(edges[i].to);
  }

  // Kahn's algorithm on forward edges only
  const ranks = new Map<NodeId, number>();
  const inDegree = new Map<NodeId, number>();
  for (const n of nodes) {
    inDegree.set(n.id, incoming.get(n.id)!.length);
  }

  const queue: NodeId[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) {
      queue.push(id);
      ranks.set(id, 0);
    }
  }

  while (queue.length > 0) {
    const id = queue.shift()!;
    const rank = ranks.get(id)!;

    for (const next of forwardOut.get(id)!) {
      const currentRank = ranks.get(next);
      if (currentRank === undefined || rank + 1 > currentRank) {
        ranks.set(next, rank + 1);
      }
      inDegree.set(next, inDegree.get(next)! - 1);
      if (inDegree.get(next) === 0) {
        queue.push(next);
      }
    }
  }

  // Fallback for any still-unranked nodes
  for (const n of nodes) {
    if (!ranks.has(n.id)) ranks.set(n.id, 0);
  }

  return { ranks, backEdges };
}
