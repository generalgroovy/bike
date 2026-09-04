import { Game as CoreGame } from './game-core.js';
import './game-radio.js';
import './game-riders.js';
import './game-events.js';
import './game-event-demand.js';
import './game-pacing.js';
import './game-cargo.js';
import './game-cargo-motion.js';
import './game-availability.js';
import './game-scheduled.js';
import './game-feasibility.js';
import './game-progression.js';
import './game-expansion-policy.js';
import './game-tools.js';
import './game-event-options.js';
import './game-strategic-upgrades.js';
import './game-review.js';
import './game-telemetry.js';
import './game-insight.js';
import './game-client-hubs.js';
import './game-service-pressure.js';
export class Game extends CoreGame{
  static lastInstance=null;
  constructor(options){super(options);Game.lastInstance=this;}
}
export * from './game-data.js';
export * from './game-cargo.js';
export { CLIENT_HUB_TYPES } from './game-client-hubs.js';
export { EXPANSION_POLICIES } from './game-expansion-policy.js';
export { SCHEDULED_SPECIAL } from './game-scheduled.js';