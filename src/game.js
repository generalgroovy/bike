import { Game as CoreGame } from './game-core.js';
import './game-radio.js';
import './game-riders.js';
import './game-events.js';
import './game-event-demand.js';
import './game-pacing.js';
import './game-cargo.js';
import './game-cargo-motion.js';
import './game-availability.js';
import './game-progression.js';
import './game-tools.js';
import './game-review.js';
export class Game extends CoreGame{
  static lastInstance=null;
  constructor(options){super(options);Game.lastInstance=this;}
}
export * from './game-data.js';
export * from './game-cargo.js';
