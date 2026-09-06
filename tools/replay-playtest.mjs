import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { replayRun } from '../src/game-berlin-playtest.js';

try {
  if (process.argv.length !== 3) throw new Error('Usage: node tools/replay-playtest.mjs path/to/shift.json');
  const record = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const replay = replayRun(record).exportRun();
  if (!isDeepStrictEqual(replay, record)) throw new Error('Replay differs from the recorded result; check the ruleset implementation.');
  console.log(JSON.stringify({ verified: true, ruleset: replay.ruleset, seed: replay.seed, ...replay.review }, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
