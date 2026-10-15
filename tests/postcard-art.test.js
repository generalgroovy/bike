import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPostcardSVG } from '../src/postcard-art.js';

function fixture() {
  const game = {
    seed: 'BERLIN-1', startRegion: 'mitte',
    cityData: { regions: [{ id: 'mitte', bounds: { x1: 0, y1: 0, x2: 180, y2: 100 } }] },
    nodes: [{ id: 'a', x: 10, y: 10 }, { id: 'b', x: 60, y: 20 }, { id: 'c', x: 100, y: 80 }, { id: 'far', x: 1000000, y: 1000000 }],
    visualEdges: [{ id: 'street', roadClass: 'local', nodeIds: ['a', 'b', 'c'] }, { id: 'outside', roadClass: 'primary', a: 'c', b: 'far' }],
    deliveries: [{ id: 'd1', status: 'completed', pickupId: 'a', dropoffId: 'c', courierId: 'c0' },
      { id: 'd2', status: 'failed', pickupId: 'a', dropoffId: 'far', courierId: 'c1' }],
    actions: [], tick: 432, rng: { next() { throw new Error('Art cannot consume randomness'); } }
  };
  const postcard = { locality: 'Mitte', seed: 'BERLIN-1', mode: 'training', ruleset: 'berlin-dispatch-v8', completed: 1, target: 6, failed: 1, profit: 8,
    outcome: 'target-missed', headline: 'A few streets wiser.',
    stamps: [{ id: 'deliveries', label: 'Beat the shift', value: 1, target: 6, earned: false },
      { id: 'flow', label: 'Find the flow', value: 3, target: 3, earned: true }, { id: 'team', label: 'Whole crew', value: 1, target: 3, earned: false }],
    riders: [{ id: 'c0', name: 'Kira', color: '#d97551', completed: 1, line: 'One delivery. Clear calls, clear roads.' },
      { id: 'c1', name: 'Mauro', color: '#5398ac', completed: 0, line: 'A day for getting to know this pavement.' },
      { id: 'c2', name: 'Brian', color: '#af9a48', completed: 0, line: 'Room on the bike for next time.' }]
  };
  return { game, postcard };
}

test('standalone postcard contains accessible factual results and all three riders', () => {
  const { game, postcard } = fixture(), svg = renderPostcardSVG(game, postcard);
  assert.match(svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="960" height="640"/);
  assert.match(svg, /aria-labelledby="postcard-title postcard-description"/);
  assert.match(svg, /<title id="postcard-title">Send It — Mitte dispatch postcard<\/title>/);
  assert.match(svg, /1 of 6 deliveries; 1 missed deadlines; net earned €8/);
  for (const rider of postcard.riders) assert.ok(svg.includes(rider.line));
  assert.equal((svg.match(/data-stamp=/g) ?? []).length, 3);
  assert.match(svg, /data-stamp="flow" data-earned="true"/);
  assert.doesNotMatch(svg, /<script|<image|foreignObject|href=/i);
});

test('dynamic content cannot inject markup, URLs, attributes or invalid XML controls', () => {
  const { game, postcard } = fixture();
  postcard.seed = '\u0000<&"\'><script>alert(1)</script>\ud800';
  postcard.locality = '<Mitte & "friends">';
  postcard.riders[0].id = '" onload="evil';
  postcard.riders[0].color = 'red" onload="evil';
  postcard.riders[0].line = '<image href="https://evil.test"/> & \u0001 good';
  const svg = renderPostcardSVG(game, postcard);
  assert.match(svg, /&lt;Mitte &amp; &quot;friends&quot;&gt;/);
  assert.match(svg, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(svg, /data-rider="&quot; onload=&quot;evil"/);
  assert.doesNotMatch(svg, /<script|<image|stroke="red|[\u0000\u0001\ud800]/);
});

test('art is repeatable and does not write model or postcard state', () => {
  const { game, postcard } = fixture();
  const beforeGame = JSON.stringify(game), beforeCard = JSON.stringify(postcard);
  const svg = renderPostcardSVG(game, postcard);
  assert.equal(svg, renderPostcardSVG(game, postcard));
  assert.equal(JSON.stringify(game), beforeGame); assert.equal(JSON.stringify(postcard), beforeCard);
});

test('map retains intermediate street geometry, marks only completed stops and clips distant segments', () => {
  const { game, postcard } = fixture(), svg = renderPostcardSVG(game, postcard);
  assert.equal((svg.match(/data-stop="pickup"/g) ?? []).length, 1);
  assert.equal((svg.match(/data-stop="delivery"/g) ?? []).length, 1);
  assert.match(svg, /data-map="minor" d="M[\d.,]+L[\d.,]+L[\d.,]+"/);
  assert.match(svg, /clip-path="url\(#postcard-map-clip\)"/);
  assert.doesNotMatch(svg, /1000000|NaN|Infinity/);
  assert.match(svg, /not a record of traveled routes/);
});

test('empty shifts show the locality and no invented delivery points', () => {
  const { game, postcard } = fixture(); game.deliveries = []; postcard.completed = 0;
  const svg = renderPostcardSVG(game, postcard);
  assert.equal((svg.match(/data-stop=/g) ?? []).length, 0);
  assert.match(svg, /no completed stops/);
  assert.doesNotMatch(svg, /NaN|Infinity/);
});

test('large city detail and arbitrary long text have bounded export size', () => {
  const { game, postcard } = fixture();
  game.visualEdges = Array.from({ length: 45000 }, (_, i) => ({ roadClass: i % 3 ? 'local' : 'primary', nodeIds: ['a', 'b', 'c'] }));
  postcard.seed = 'Very long seed & <'.repeat(10000);
  postcard.riders[0].line = 'A very long rider line '.repeat(10000);
  const svg = renderPostcardSVG(game, postcard);
  assert.ok(Buffer.byteLength(svg) < 230000, `SVG was ${Buffer.byteLength(svg)} bytes`);
  assert.match(svg, /1 of 6 deliveries; 1 missed deadlines; net earned €8/);
  assert.match(svg, /not a record of traveled routes/);
  assert.equal((svg.match(/data-map="major" d="([^"]*)"/)?.[1].match(/M/g) ?? []).length, 400);
  assert.equal((svg.match(/data-map="minor" d="([^"]*)"/)?.[1].match(/M/g) ?? []).length, 700);
});

test('downloaded cards retain the map attribution for their city pack', () => {
  const { game, postcard } = fixture();
  postcard.city = 'berlin';
  assert.match(renderPostcardSVG(game, postcard), /Map: Berlin Open Data · dl-de-zero-2.0/);
  postcard.city = 'inner-ring';
  const svg = renderPostcardSVG(game, postcard);
  assert.match(svg, /© OpenStreetMap · Berlin Open Data/);
  assert.match(svg, /© OpenStreetMap contributors, ODbL 1.0/);
});
