import { describe, expect, it } from 'vitest';
import { results, teams } from '../../src/data/index.ts';
import type { RaceEntry, RoundResult } from '../../src/data/schemas.ts';
import { racePoints, sprintPoints } from '../../src/engine/season/points.ts';
import { constructorStandings, driverStandings } from '../../src/engine/season/standings.ts';

/**
 * Clasificación oficial tras la ronda 20 (Brasil), copiada de los endpoints
 * driverstandings y constructorstandings de Jolpica el 15-11-2026.
 */
const OFFICIAL_DRIVERS: Record<string, number> = {
  antonelli: 390, max_verstappen: 279, russell: 262, hamilton: 261, leclerc: 249, norris: 246, piastri: 152,
  hadjar: 122, lawson: 89, gasly: 42, arvid_lindblad: 38, colapinto: 27, bearman: 23, bortoleto: 14,
  hulkenberg: 14, ocon: 7, alonso: 7, sainz: 7, albon: 5, tsunoda: 1, ryo_hirakawa: 1, stroll: 0, bottas: 0,
  perez: 0, rafael_camara: 0,
};
const OFFICIAL_CONSTRUCTORS: [string, number][] = [
  ['mercedes', 652], ['ferrari', 510], ['red_bull', 415], ['mclaren', 398], ['rb', 114], ['alpine', 69],
  ['haas', 31], ['audi', 28], ['williams', 12], ['aston_martin', 7], ['cadillac', 0],
];

describe('clasificaciones con datos reales', () => {
  it('pilotos: coincide con la clasificación oficial tras la ronda 20', () => {
    const table = driverStandings(results.rounds, 20);
    expect(Object.fromEntries(table.map((r) => [r.id, r.points]))).toEqual(OFFICIAL_DRIVERS);
    expect(table[0]).toMatchObject({ id: 'antonelli', position: 1, wins: 9, teamId: 'mercedes' });
  });

  it('constructores: coincide en puntos y en orden', () => {
    const table = constructorStandings(results.rounds, 20, teams.map((t) => t.id));
    expect(table.map((r) => [r.id, r.points])).toEqual(OFFICIAL_CONSTRUCTORS);
  });

  it('permite cortar en cualquier ronda (para empezar la partida desde ahí)', () => {
    expect(driverStandings(results.rounds, 0)).toEqual([]);
    const afterOne = driverStandings(results.rounds, 1);
    const winner = results.rounds[0]!.race[0]!;
    expect(afterOne[0]).toMatchObject({ id: winner.driverId, points: winner.points, wins: 1 });
    let previous = 0;
    for (let round = 1; round <= results.lastRound; round++) {
      const total = driverStandings(results.rounds, round).reduce((s, r) => s + r.points, 0);
      expect(total).toBeGreaterThan(previous);
      previous = total;
    }
  });

  it('un piloto que cambia de equipo suma para cada constructor por separado', () => {
    // Lawson corrió las rondas 12–14 con Red Bull y el resto con Racing Bulls.
    const lawsonAtRedBull = results.rounds
      .flatMap((r) => [...r.race, ...(r.sprint ?? [])])
      .filter((e) => e.driverId === 'lawson' && e.teamId === 'red_bull');
    expect(lawsonAtRedBull.length).toBeGreaterThan(0);
    expect(driverStandings(results.rounds, 13).find((r) => r.id === 'lawson')?.teamId).toBe('red_bull');
    expect(driverStandings(results.rounds, 20).find((r) => r.id === 'lawson')?.teamId).toBe('rb');
  });

  it('la tabla de puntos del reglamento reproduce los puntos reales', () => {
    for (const round of results.rounds) {
      for (const e of round.race) if (/^\d+$/.test(e.positionText)) expect(e.points, `ronda ${round.round} P${e.position}`).toBe(racePoints(e.position));
      for (const e of round.sprint ?? []) if (/^\d+$/.test(e.positionText)) expect(e.points, `sprint ${round.round} P${e.position}`).toBe(sprintPoints(e.position));
    }
  });
});

describe('desempates', () => {
  const entry = (driverId: string, position: number, points: number): RaceEntry => ({
    position, positionText: String(position), driverId, teamId: `team_${driverId}`, grid: position, laps: 50,
    status: 'Finished', points, time: null, fastestLap: null,
  });
  const round = (n: number, race: RaceEntry[]): RoundResult => ({ round: n, qualifying: [], sprint: null, race });

  it('a igualdad de puntos gana quien tiene más victorias', () => {
    const rounds = [round(1, [entry('a', 1, 25), entry('b', 2, 18)]), round(2, [entry('b', 2, 18), entry('a', 5, 11)])];
    // a: 36 con una victoria · b: 36 con dos segundos
    expect(driverStandings(rounds, 2).map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('si también empatan a victorias, cuentan los segundos puestos', () => {
    const rounds = [round(1, [entry('a', 1, 25), entry('b', 1, 25)]), round(2, [entry('a', 3, 15), entry('b', 2, 15)])];
    expect(driverStandings(rounds, 2).map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('un abandono no cuenta como posición final', () => {
    const dnf: RaceEntry = { ...entry('a', 20, 0), positionText: 'R', status: 'Retired' };
    const [row] = driverStandings([round(1, [dnf])], 1);
    expect(row).toMatchObject({ wins: 0, podiums: 0, finishes: [] });
  });
});
