const TAU = Math.PI * 2;
const RIDING_PHASES = new Set(['pickup', 'dropoff', 'coasting']);

// Display-only motion: sampling never advances the rider or the simulation clock.
// Distance drives the wheels and crank, so a stopped bicycle cannot keep pedalling.
export function sampleBikeMotion(rider, elapsed, previous = null, { paused = false, reduced = false } = {}) {
  const x = Number.isFinite(rider.x) ? rider.x : 0, y = Number.isFinite(rider.y) ? rider.y : 0;
  const time = Number.isFinite(elapsed) ? elapsed : 0, dt = previous ? time - previous.time : 0;
  const distance = previous ? Math.hypot(x - previous.x, y - previous.y) : 0;
  const riding = RIDING_PHASES.has(rider.phase), moving = !paused && !reduced && riding && dt > 0 && dt <= 1 && distance > .00001;
  // A restored shift or a new rider at the same ID starts without an invented spin.
  const reset = !previous || dt < 0 || dt > 1;
  const wheelAngle = ((reset ? 0 : previous.wheelAngle) + (moving ? distance * .95 : 0)) % TAU;
  const pedalAngle = ((reset ? 0 : previous.pedalAngle) + (moving ? distance * .48 : 0)) % TAU;
  const faceLeft = Number.isFinite(rider.heading) ? Math.sin(rider.heading) < -.05 : previous?.faceLeft ?? false;
  return { x, y, time, moving, riding, faceLeft, wheelAngle, pedalAngle };
}

// Retain the whole current leg as quiet ink; its completed portion stays visible.
export function bikeRouteSegments(game, rider) {
  const path = rider.path ?? [], index = Math.max(0, Math.min(path.length, rider.pathIndex ?? 0));
  const at = { x: rider.x, y: rider.y }, nodes = path.map(id => game.nodeById(id)).filter(Boolean);
  const travelled = path.slice(0, index).map(id => game.nodeById(id)).filter(Boolean);
  if (travelled.length) travelled.push(at);
  const upcoming = [at, ...path.slice(index).map(id => game.nodeById(id)).filter(Boolean)];
  return { whole: nodes, travelled, upcoming };
}
