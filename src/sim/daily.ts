import { closeDay, emptyLedger } from './economy/economy';
import type { GameState } from './state';
import { assignJobs, connectedOpenJobs } from './citizens/jobs';
import { migrate } from './citizens/migration';
import { roadDistancesFromEntrance } from './citizens/housing';
import { staffedWells } from './services/coverage';
import { consumeFood, produceFood } from './resources/food';

const NO_MIGRATION: GameState['economy']['today']['migration'] = { arrived: 0, left: { hunger: 0, unemployment: 0, homeless: 0 } };

/** Runs the six daily systems in their approved, deterministic order. */
export function runDaily(state: GameState, day: number): void {
  const foodProduced = produceFood(state.buildings, state.citizens);
  state.food += foodProduced;
  const consumed = consumeFood(state.food, state.citizens);
  state.food = consumed.food;

  const closed = closeDay(state.economy.today, day, state.treasury, state.buildings, state.world, state.citizens, foodProduced, consumed.eaten, NO_MIGRATION);
  state.treasury = closed.treasury;

  const distances = roadDistancesFromEntrance(state.world);
  assignJobs(state.citizens, state.buildings, state.world);
  const result = migrate(
    state.citizens, state.buildings, state.world, staffedWells(state.buildings, state.citizens), distances,
    state.treasury, connectedOpenJobs(state.buildings, state.citizens), state.food, state.nextCitizenId,
  );
  state.nextCitizenId = result.nextCitizenId;
  closed.report.migration = result.summary;
  state.economy.lastDay = closed.report;
  state.economy.today = emptyLedger();
}
