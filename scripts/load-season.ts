/** Carga los JSON de la temporada desde disco (para scripts; la app usa src/data/index.ts). */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  calendarSchema, circuitSchema, driverSchema, raceFactsSchema, resultsSchema, staffSchema, teamSchema,
} from '../src/data/schemas.ts';
import { referenceLap, typicalSpeedKmh, type Entry } from '../src/engine/race/setup.ts';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string): unknown => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));

export function loadSeason(season = 2026) {
  const dir = `data/${season}`;
  const calendar = calendarSchema.parse(read(`${dir}/calendar.json`));
  const results = resultsSchema.parse(read(`${dir}/results.json`));
  const teams = z.array(teamSchema).parse(read(`${dir}/teams.json`));
  const drivers = z.array(driverSchema).parse(read(`${dir}/drivers.json`));
  const staff = z.array(staffSchema).parse(read(`${dir}/staff.json`));
  const facts = raceFactsSchema.parse(read(`${dir}/race-facts.json`)).rounds;
  const circuits = readdirSync(resolve(ROOT, 'data/circuits')).map((f) => circuitSchema.parse(read(`data/circuits/${f}`)));

  const roundOf = (circuitId: string) => calendar.rounds.find((r) => r.circuitId === circuitId)?.round;
  const typical = typicalSpeedKmh(circuits, facts, roundOf);

  return {
    calendar, results, teams, drivers, staff, facts, circuits,
    circuitOf: (round: number) => circuits.find((c) => c.id === calendar.rounds.find((r) => r.round === round)?.circuitId)!,
    factOf: (round: number) => facts.find((f) => f.round === round),
    refLapOf: (round: number) => referenceLap(circuits.find((c) => c.id === calendar.rounds.find((r) => r.round === round)?.circuitId)!, facts.find((f) => f.round === round), typical),
    /** Parrilla real de esa ronda (orden de salida de la carrera). */
    realGrid: (round: number): Entry[] => {
      const race = results.rounds.find((r) => r.round === round)?.race ?? [];
      return [...race]
        .sort((a, b) => (a.grid || 99) - (b.grid || 99) || a.position - b.position)
        .map((e) => ({ driverId: e.driverId, teamId: e.teamId }));
    },
  };
}
