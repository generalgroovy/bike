export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function buildAdjacency(nodes, edges) {
  const adjacency = new Map(nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    adjacency.get(edge.a)?.push({ to: edge.b, edge });
    adjacency.get(edge.b)?.push({ to: edge.a, edge });
  }
  return adjacency;
}

export function shortestPath(nodes, edges, startId, goalId, costFn = defaultCost) {
  if (startId === goalId) return [startId];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  if (!byId.has(startId) || !byId.has(goalId)) return [];
  const adjacency = buildAdjacency(nodes, edges);
  const dist = new Map(nodes.map((node) => [node.id, Infinity]));
  const previous = new Map();
  const open = new Set(nodes.map((node) => node.id));
  dist.set(startId, 0);

  while (open.size) {
    let current = null;
    let best = Infinity;
    for (const id of open) {
      const value = dist.get(id);
      if (value < best) {
        best = value;
        current = id;
      }
    }
    if (current === null || best === Infinity) break;
    if (current === goalId) break;
    open.delete(current);
    for (const { to, edge } of adjacency.get(current) ?? []) {
      if (!open.has(to)) continue;
      const candidate = best + costFn(edge, byId.get(current), byId.get(to));
      if (candidate < dist.get(to)) {
        dist.set(to, candidate);
        previous.set(to, current);
      }
    }
  }

  if (!previous.has(goalId)) return [];
  const path = [goalId];
  while (path[0] !== startId) path.unshift(previous.get(path[0]));
  return path;
}

export function defaultCost(edge) {
  return edge.distance / Math.max(0.1, edge.speed ?? 1);
}
