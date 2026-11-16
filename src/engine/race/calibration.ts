/**
 * Calibración: simula muchas veces una carrera con IA en todos los coches y
 * resume lo que sale, para compararlo con la carrera real.
 * Lo usan scripts/calibrate.ts (todas las rondas) y el test rápido de calibración.
 */
import { buildRaceConfig, type RaceSetupInput } from './setup.ts';
import { classification, createRace, runToEnd } from './sim.ts';

export interface CalibrationStats {
  runs: number;
  /** Vuelta rápida media de la carrera, en segundos. */
  fastestLapS: number;
  /** Tiempo medio por vuelta del ganador (incluye paradas y neutralizaciones). */
  winnerAvgLapS: number;
  /** Paradas medias de los coches que terminan. */
  stops: number;
  overtakes: number;
  retirements: number;
  /** Fracción de carreras con al menos un safety car. */
  safetyCarRate: number;
  /** Diferencia media del décimo con el ganador, en segundos (solo si acaba en la misma vuelta). */
  gapP10S: number;
  /** Coches que terminan en la vuelta del ganador. */
  leadLapFinishers: number;
}

export function calibrateRound(input: Omit<RaceSetupInput, 'seed'>, runs: number, firstSeed = 1): CalibrationStats {
  const sum = { fl: 0, avg: 0, stops: 0, overtakes: 0, out: 0, sc: 0, gap: 0, gapN: 0, lead: 0 };
  for (let i = 0; i < runs; i++) {
    const race = runToEnd(createRace(buildRaceConfig({ ...input, seed: firstSeed + i, weather: 'dry' })));
    const rows = classification(race);
    const finishers = rows.filter((r) => r.status === 'finished');
    const winner = rows[0]!;
    sum.fl += race.state.fastestLap?.timeS ?? 0;
    sum.avg += (winner.timeS ?? 0) / winner.laps;
    sum.stops += finishers.reduce((a, r) => a + r.pitStops, 0) / Math.max(1, finishers.length);
    sum.overtakes += race.state.overtakes;
    sum.out += rows.length - finishers.length;
    if (race.state.events.some((e) => e.type === 'flag' && e.flag === 'sc')) sum.sc++;
    const tenth = rows[9];
    if (tenth?.timeS != null) {
      sum.gap += tenth.timeS;
      sum.gapN++;
    }
    sum.lead += finishers.filter((r) => r.lapsBehind === 0).length;
  }
  return {
    runs,
    fastestLapS: sum.fl / runs,
    winnerAvgLapS: sum.avg / runs,
    stops: sum.stops / runs,
    overtakes: sum.overtakes / runs,
    retirements: sum.out / runs,
    safetyCarRate: sum.sc / runs,
    gapP10S: sum.gapN ? sum.gap / sum.gapN : NaN,
    leadLapFinishers: sum.lead / runs,
  };
}
