// A self-contained keepsake, drawn from facts already present in the shift.
// Street geometry is a backdrop; only completed pickup/delivery points are
// marked. The card never reconstructs or invents a courier's traveled route.
const INK = '#193b35', PAPER = '#f4eddb', RED = '#ad422e', GOLD = '#b18a39';
const MAP = Object.freeze({ x: 40, y: 128, width: 514, height: 292 });
const validPoint = point => point && Number.isFinite(point.x) && Number.isFinite(point.y);
const number = value => Number.isFinite(value) ? value : 0;
const textValue = (value, limit = 220) => [...String(value ?? '')
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/gu, '')]
  .filter(char => !(char.length === 1 && /[\ud800-\udfff]/u.test(char)))
  .slice(0, limit).join('');
const xml = value => textValue(value, 4000).replace(/[&<>"']/g,
  char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
const short = (value, length) => {
  const clean = textValue(value).replace(/\s+/g, ' ').trim();
  return [...clean].length > length ? [...clean].slice(0, length - 1).join('') + '…' : clean;
};
const color = value => /^#[a-f\d]{6}$/i.test(value ?? '') ? value : INK;
const at = value => Number(value.toFixed(1));

function lines(value, width, limit) {
  const words = textValue(value).replace(/\s+/g, ' ').trim().split(' '), result = [];
  let line = '';
  for (const word of words) {
    if (line && `${line} ${word}`.length > width) { result.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) result.push(line);
  if (result.length > limit) result[limit - 1] = short(result.slice(limit - 1).join(' '), width);
  return result.slice(0, limit).map(line => short(line, width));
}

function label(value, x, y, { size = 14, fill = INK, weight = 400, anchor = 'start', tracking = 0, family = 'Arial, Helvetica, sans-serif' } = {}) {
  return `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${tracking}">${xml(value)}</text>`;
}

function wrapped(value, x, y, width, limit, options = {}) {
  return lines(value, width, limit).map((line, i) => label(line, x, y + i * (options.leading ?? 20), options)).join('');
}

function boundsFor(game, points) {
  let bounds;
  if (points.length) {
    bounds = points.reduce((b, p) => ({ x1: Math.min(b.x1, p.x), y1: Math.min(b.y1, p.y), x2: Math.max(b.x2, p.x), y2: Math.max(b.y2, p.y) }),
      { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity });
  } else {
    const regions = game.cityData?.regions ?? game.districts ?? [];
    bounds = regions.find(region => region.id === game.startRegion)?.bounds ?? game.cityData?.metadata?.bounds;
    if (!bounds && validPoint(game.couriers?.[0])) {
      const { x, y } = game.couriers[0]; bounds = { x1: x - 120, y1: y - 120, x2: x + 120, y2: y + 120 };
    }
  }
  if (!bounds || !['x1', 'y1', 'x2', 'y2'].every(key => Number.isFinite(bounds[key])) || bounds.x2 < bounds.x1 || bounds.y2 < bounds.y1)
    bounds = { x1: 0, y1: 0, x2: 300, y2: 180 };
  const cx = (bounds.x1 + bounds.x2) / 2, cy = (bounds.y1 + bounds.y2) / 2;
  const height = Math.max(80, bounds.y2 - bounds.y1, (bounds.x2 - bounds.x1) * MAP.height / MAP.width) * 1.2;
  const width = height * MAP.width / MAP.height;
  return { x1: cx - width / 2, y1: cy - height / 2, x2: cx + width / 2, y2: cy + height / 2 };
}

// Liang-Barsky clipping also prevents far-away city coordinates inflating an
// exported SVG. Every output line remains part of an actual street segment.
function clipped(a, b, bounds) {
  const dx = b.x - a.x, dy = b.y - a.y;
  let enter = 0, exit = 1;
  for (const [p, q] of [[-dx, a.x - bounds.x1], [dx, bounds.x2 - a.x], [-dy, a.y - bounds.y1], [dy, bounds.y2 - a.y]]) {
    if (p === 0) { if (q < 0) return null; }
    else {
      const t = q / p;
      if (p < 0) enter = Math.max(enter, t); else exit = Math.min(exit, t);
      if (enter > exit) return null;
    }
  }
  return [{ x: a.x + enter * dx, y: a.y + enter * dy }, { x: a.x + exit * dx, y: a.y + exit * dy }];
}

// Deterministic reservoir selection keeps overview detail bounded without
// favoring whichever borough happens to appear first in the source file.
// Samples contain contiguous street pieces, preserving a legible street
// pattern instead of scattering unrelated little segments across the map.
function sample(bucket, segment, limit) {
  bucket.seen++;
  if (bucket.items.length < limit) bucket.items.push(segment);
  else {
    let hash = bucket.seen >>> 0;
    hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
    hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
    const index = ((hash ^ (hash >>> 16)) >>> 0) % bucket.seen;
    if (index < limit) bucket.items[index] = segment;
  }
}

function mapArt(game, postcard) {
  const cache = new Map(), fallback = typeof game.nodeById === 'function' ? null : new Map((game.nodes ?? []).map(node => [node.id, node]));
  const node = id => {
    if (!cache.has(id)) cache.set(id, fallback ? fallback.get(id) : game.nodeById(id));
    return cache.get(id);
  };
  const completed = (game.deliveries ?? []).filter(job => job.status === 'completed');
  const stops = completed.flatMap(job => ['pickupId', 'dropoffId'].map(key => ({ point: node(job[key]), kind: key === 'pickupId' ? 'pickup' : 'delivery', rider: job.courierId })))
    .filter(stop => validPoint(stop.point));
  const bounds = boundsFor(game, stops.map(stop => stop.point));
  const project = point => ({ x: at(MAP.x + (point.x - bounds.x1) / (bounds.x2 - bounds.x1) * MAP.width),
    y: at(MAP.y + (point.y - bounds.y1) / (bounds.y2 - bounds.y1) * MAP.height) });
  const minor = { seen: 0, items: [] }, major = { seen: 0, items: [] };
  for (const edge of game.visualEdges ?? []) {
    if (edge.roadClass === 'connector') continue;
    const ids = edge.nodeIds?.length > 1 ? edge.nodeIds : [edge.a, edge.b];
    const main = ['arterial', 'primary', 'secondary', 'bridge'].includes(edge.roadClass);
    let piece = '', segments = 0, previous = null;
    const flush = () => {
      if (piece) sample(main ? major : minor, piece, main ? 400 : 700);
      piece = ''; segments = 0; previous = null;
    };
    for (let i = 1; i < ids.length; i++) {
      const a = node(ids[i - 1]), b = node(ids[i]);
      if (!validPoint(a) || !validPoint(b)) { flush(); continue; }
      const segment = clipped(a, b, bounds);
      if (!segment) { flush(); continue; }
      const [p, q] = segment.map(project);
      if (Math.hypot(p.x - q.x, p.y - q.y) < .25) { flush(); continue; }
      piece += `${previous && p.x === previous.x && p.y === previous.y ? '' : `M${p.x},${p.y}`}L${q.x},${q.y}`;
      previous = q;
      if (++segments === 12) flush();
    }
    flush();
  }
  const pins = stops.slice(0, 256).map(stop => {
    const point = project(stop.point), ink = color(postcard.riders?.find(rider => rider.id === stop.rider)?.color);
    return `<circle data-stop="${stop.kind}" cx="${point.x}" cy="${point.y}" r="${stop.kind === 'pickup' ? 4 : 3.1}" fill="${stop.kind === 'pickup' ? PAPER : ink}" stroke="${ink}" stroke-width="1.5"/>`;
  }).join('');
  return `<rect x="40" y="128" width="514" height="292" fill="#e8e5cf"/>
  <g clip-path="url(#postcard-map-clip)">
  <path data-map="minor" d="${minor.items.join('')}" fill="none" stroke="#b7baa3" stroke-width=".85"/>
  <path data-map="major" d="${major.items.join('')}" fill="none" stroke="#849888" stroke-width="1.4"/>
  ${pins}</g>
  <path d="M528 163V141m-5 7 5-7 5 7" fill="none" stroke="${INK}" stroke-width="1.5"/>
  ${label('N', 528, 180, { size: 10, anchor: 'middle', weight: 700 })}
  <rect x="40" y="128" width="514" height="292" fill="none" stroke="${INK}" stroke-width="1"/>
  ${label('THE CITY UNDER YOUR WHEELS', 52, 148, { size: 9, weight: 700, tracking: 1 })}
  <circle cx="46" cy="439" r="4" fill="${PAPER}" stroke="${INK}" stroke-width="1.5"/>
  ${label('pickup', 57, 443, { size: 11 })}<circle cx="119" cy="439" r="3.1" fill="${INK}"/>
  ${label('delivered', 130, 443, { size: 11 })}
  ${label(stops.length ? 'Street map · completed stops' : 'Street map · no completed stops', 542, 443, { size: 11, anchor: 'end' })}`;
}

function stampArt(stamp, index) {
  const x = 583 + index * 112, y = 303, ink = stamp.earned ? [RED, INK, GOLD][index] : '#8b8b78';
  const rotate = [-3, 2, -2][index];
  const mark = stamp.earned ? '<path d="m-8 0 5 5 11-12" fill="none" stroke="currentColor" stroke-width="3"/>'
    : '<circle cx="0" cy="0" r="5" fill="none" stroke="currentColor" stroke-width="1.5"/>';
  return `<g data-stamp="${xml(stamp.id)}" data-earned="${Boolean(stamp.earned)}" transform="rotate(${rotate} ${x + 48} ${y + 51})">
  <rect x="${x}" y="${y}" width="98" height="105" rx="3" fill="${stamp.earned ? '#ede3ca' : 'none'}" stroke="${ink}" stroke-width="${stamp.earned ? 2 : 1}" stroke-dasharray="${stamp.earned ? 'none' : '3 3'}"/>
  <rect x="${x + 5}" y="${y + 5}" width="88" height="95" rx="1" fill="none" stroke="${ink}" opacity=".5"/>
  <g transform="translate(${x + 49} ${y + 24})" color="${ink}">${mark}</g>
  ${wrapped(stamp.label, x + 49, y + 49, 15, 2, { size: 12, weight: 700, anchor: 'middle', fill: ink, leading: 15 })}
  ${label(`${number(stamp.value)} / ${number(stamp.target)}`, x + 49, y + 88, { size: 12, weight: 700, anchor: 'middle', fill: ink })}</g>`;
}

/** Return a standalone 960×640 SVG. It reads model facts but makes no changes. */
export function renderPostcardSVG(game, postcard) {
  const card = postcard ?? {}, riders = (card.riders ?? []).slice(0, 3), stamps = (card.stamps ?? []).slice(0, 3);
  const locality = short(card.locality ?? 'Berlin', 42), seed = short(card.seed ?? game.seed, 56);
  const inner = card.city === 'inner-ring';
  const attribution = inner ? '© OpenStreetMap · Berlin Open Data' : 'Map: Berlin Open Data · dl-de-zero-2.0';
  const outcome = card.outcome === 'success' ? 'TARGET REACHED' : card.outcome ? 'SHIFT FILED' : 'SHIFT IN PROGRESS';
  const description = `${textValue(card.locality ?? 'Berlin', 100)} shift ${textValue(card.seed ?? game.seed, 256)}. ${number(card.completed)} of ${number(card.target)} deliveries; ${number(card.failed)} missed deadlines; net earned €${number(card.profit)}. ` +
    stamps.map(stamp => `${stamp.label}: ${number(stamp.value)} of ${number(stamp.target)}, ${stamp.earned ? 'earned' : 'not earned'}.`).join(' ') + ' ' +
    riders.map(rider => `${textValue(rider.name, 60)}: ${textValue(rider.line, 240)}`).join(' ') + ' Map shows real street segments and completed pickup and delivery points, not a record of traveled routes. ' +
    (inner ? 'Map sources: © OpenStreetMap contributors, ODbL 1.0; Berlin Open Data, dl-de-zero-2.0.' : 'Map source: Berlin Open Data, dl-de-zero-2.0.');
  const riderArt = riders.map((rider, i) => {
    const x = 40 + i * 300, ink = color(rider.color);
    return `<g data-rider="${xml(rider.id)}"><rect x="${x}" y="476" width="26" height="4" fill="${ink}"/>
      ${label(short(rider.name, 12), x, 506, { size: 23, family: 'Georgia, serif' })}
      ${label(`${number(rider.completed)} DELIVERED`, x + 274, 504, { size: 10, weight: 700, anchor: 'end', tracking: .7 })}
      ${wrapped(rider.line, x, 530, 38, 3, { size: 13, leading: 19 })}</g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640" role="img" aria-labelledby="postcard-title postcard-description">
  <title id="postcard-title">${xml(`Send It — ${locality} dispatch postcard`)}</title>
  <desc id="postcard-description">${xml(description)}</desc>
  <defs><clipPath id="postcard-map-clip"><rect x="40" y="128" width="514" height="292"/></clipPath>
  <pattern id="postcard-paper" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".45" fill="${INK}" opacity=".09"/></pattern></defs>
  <rect width="960" height="640" fill="${PAPER}"/><rect width="960" height="640" fill="url(#postcard-paper)"/>
  <rect x="17" y="17" width="926" height="606" fill="none" stroke="${INK}" stroke-width="1.4"/>
  <path d="M29 28h23M29 28v23m902-23h-23m23 0v23M29 612h23m-23 0v-23m902 23h-23m23 0v-23" stroke="${RED}" fill="none" stroke-width="3"/>
  ${label('SEND IT', 40, 76, { size: 43, weight: 900, tracking: -2 })}
  ${label('POSTCARDS FROM THE BERLIN DESK', 253, 46, { size: 10, weight: 700, tracking: 1.7 })}
  ${label(locality, 252, 81, { size: locality.length > 30 ? 22 : 29, family: 'Georgia, serif' })}
  <g transform="translate(865 66) rotate(-9)" stroke="${RED}" fill="none"><circle r="35" stroke-width="2"/><circle r="30" stroke-width=".8"/>
  <circle cx="-13" cy="5" r="8" stroke-width="1.5"/><circle cx="14" cy="5" r="8" stroke-width="1.5"/>
  <path d="m-13 5 9-15 9 15h-18m9-15 11-1 7 16M3-16h7m-19 3h8" stroke-width="1.7"/>
  ${label('BERLIN', 0, 24, { size: 7, weight: 700, anchor: 'middle', tracking: 1.5, fill: RED })}</g>
  <path d="M40 106H920" stroke="${INK}" stroke-width="2"/>
  ${mapArt(game, card)}
  ${label(outcome, 585, 145, { size: 10, weight: 700, tracking: 1.7, fill: RED })}
  ${wrapped(card.headline ?? 'A day on two wheels.', 583, 178, 25, 2, { size: 24, family: 'Georgia, serif', leading: 27 })}
  ${label(`${number(card.completed)} / ${number(card.target)}`, 585, 255, { size: 30, weight: 700 })}
  ${label('DELIVERED', 585, 275, { size: 9, weight: 700, tracking: 1 })}
  ${label(number(card.failed), 722, 255, { size: 30, weight: 700 })}
  ${label('MISSED', 722, 275, { size: 9, weight: 700, tracking: 1 })}
  ${label(`€${number(card.profit)}`, 916, 255, { size: 30, weight: 700, anchor: 'end' })}
  ${label('NET EARNED', 916, 275, { size: 9, weight: 700, tracking: 1, anchor: 'end' })}
  ${stamps.map(stampArt).join('')}
  ${label(attribution, 750, 443, { size: 9, anchor: 'middle' })}
  <path d="M40 462H920" stroke="${INK}" stroke-dasharray="2 5"/>
  ${riderArt}
  <path d="M40 586H920" stroke="${INK}" stroke-width="1"/>
  ${label(`SHIFT ${seed}`, 40, 606, { size: 10, weight: 700, tracking: .4 })}
  ${label(`${card.mode === 'standard' ? '9 MIN' : '3 MIN'} · ${short(card.ruleset, 26)}`, 920, 606, { size: 10, anchor: 'end' })}
  </svg>`;
}
