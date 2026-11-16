import { calendar, drivers, entriesFor, findCircuit, referenceLapFor, staff, teams } from '../../../src/data/index.ts';
import { buildRaceConfig, type RaceSetupInput } from '../../../src/engine/race/setup.ts';
import type { RaceConfig } from '../../../src/engine/race/types.ts';

export const MONZA = calendar.rounds.find((r) => r.circuitId === 'monza')!.round;
export const SEPANG = calendar.rounds.find((r) => r.circuitId === 'sepang')!.round;
export const MONACO = calendar.rounds.find((r) => r.circuitId === 'monaco')!.round;

export function setupInput(round: number, overrides: Partial<RaceSetupInput> = {}): Omit<RaceSetupInput, 'seed'> {
  const circuit = findCircuit(calendar.rounds.find((r) => r.round === round)!.circuitId)!;
  return { dt: 1, circuit, refLapS: referenceLapFor(round).seconds, grid: entriesFor(round).entries, teams, drivers, staff, weather: 'dry', ...overrides };
}

export function config(round: number, seed: number, overrides: Partial<RaceSetupInput> = {}): RaceConfig {
  return buildRaceConfig({ ...setupInput(round, overrides), seed });
}
