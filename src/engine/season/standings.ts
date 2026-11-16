/**
 * Clasificaciones de pilotos y constructores acumuladas hasta una ronda.
 * Código puro: sin React ni DOM. Los puntos se toman de los resultados
 * (la tabla de puntos del reglamento vive en points.ts y se usa para simular).
 */
import type { RaceEntry, RoundResult } from '../../data/schemas.ts';

export interface StandingRow {
  position: number;
  /** driverId o teamId. */
  id: string;
  points: number;
  wins: number;
  podiums: number;
  /** finishes[p] = veces que terminó en la posición p+1 (para desempates). */
  finishes: number[];
}

export interface DriverStandingRow extends StandingRow {
  /** Equipo con el que corrió su última carrera hasta esa ronda. */
  teamId: string;
}

const isClassified = (e: RaceEntry) => /^\d+$/.test(e.positionText);

function emptyRow(id: string): StandingRow {
  return { position: 0, id, points: 0, wins: 0, podiums: 0, finishes: [] };
}

function addRace(row: StandingRow, e: RaceEntry): void {
  row.points += e.points;
  if (!isClassified(e)) return;
  row.finishes[e.position - 1] = (row.finishes[e.position - 1] ?? 0) + 1;
  if (e.position === 1) row.wins++;
  if (e.position <= 3) row.podiums++;
}

/** Más puntos primero; a igualdad, quien tenga más victorias, luego más segundos puestos, etc. */
function rank<T extends StandingRow>(rows: T[]): T[] {
  const sorted = [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const len = Math.max(a.finishes.length, b.finishes.length);
    for (let i = 0; i < len; i++) {
      const diff = (b.finishes[i] ?? 0) - (a.finishes[i] ?? 0);
      if (diff !== 0) return diff;
    }
    return a.id.localeCompare(b.id);
  });
  sorted.forEach((row, i) => (row.position = i + 1));
  return sorted;
}

const upTo = (rounds: RoundResult[], round: number) => rounds.filter((r) => r.round <= round).sort((a, b) => a.round - b.round);

export function driverStandings(rounds: RoundResult[], upToRound: number): DriverStandingRow[] {
  const rows = new Map<string, DriverStandingRow>();
  const row = (e: RaceEntry) => {
    let r = rows.get(e.driverId);
    if (!r) rows.set(e.driverId, (r = { ...emptyRow(e.driverId), teamId: e.teamId }));
    r.teamId = e.teamId;
    return r;
  };
  for (const round of upTo(rounds, upToRound)) {
    for (const e of round.sprint ?? []) row(e).points += e.points;
    for (const e of round.race) addRace(row(e), e);
  }
  return rank([...rows.values()]);
}

export function constructorStandings(rounds: RoundResult[], upToRound: number, teamIds: string[] = []): StandingRow[] {
  const rows = new Map<string, StandingRow>(teamIds.map((id) => [id, emptyRow(id)]));
  const row = (teamId: string) => {
    let r = rows.get(teamId);
    if (!r) rows.set(teamId, (r = emptyRow(teamId)));
    return r;
  };
  for (const round of upTo(rounds, upToRound)) {
    for (const e of round.sprint ?? []) row(e.teamId).points += e.points;
    for (const e of round.race) addRace(row(e.teamId), e);
  }
  return rank([...rows.values()]);
}
