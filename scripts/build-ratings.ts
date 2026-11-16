/**
 * npm run build-ratings
 *
 * Calcula las valoraciones de juego (coches, pilotos, staff) a partir de los
 * resultados reales y de los datos base curados en data/<año>/base/.
 * Escribe teams.json, drivers.json y staff.json. La fórmula está documentada
 * en docs/RATINGS.md: si cambias algo aquí, actualiza ese documento.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  circuitSchema,
  calendarSchema,
  driverSchema,
  resultsSchema,
  staffSchema,
  teamSchema,
  type CarRatings,
  type Driver,
  type DriverAttributes,
  type RaceEntry,
  type Staff,
  type StaffRole,
  type Team,
} from '../src/data/schemas.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SEASON = 2026;
const dir = resolve(ROOT, 'data', String(SEASON));
const read = (p: string): unknown => JSON.parse(readFileSync(p, 'utf8'));

const calendar = calendarSchema.parse(read(resolve(dir, 'calendar.json')));
const results = resultsSchema.parse(read(resolve(dir, 'results.json')));
const teamsBase = z.array(teamSchema.omit({ car: true })).parse(read(resolve(dir, 'base/teams.base.json')));
const driversBase = z
  .array(driverSchema.omit({ attributes: true, attributesEstimated: true }))
  .parse(read(resolve(dir, 'base/drivers.base.json')));
const staffBase = z
  .array(staffSchema.omit({ id: true, rating: true, generated: true }))
  .parse(read(resolve(dir, 'base/staff.base.json')));

const downforceOf = new Map(
  calendar.rounds.map((r) => [
    r.round,
    circuitSchema.parse(read(resolve(ROOT, 'data/circuits', `${r.circuitId}.json`))).downforceLevel,
  ]),
);

// ------------------------------------------------------------ Utilidades

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};
const std = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};
/** "1:19.507" → segundos. */
const seconds = (t: string | null | undefined): number | null => {
  if (!t) return null;
  const parts = t.split(':').map(Number);
  if (parts.some(Number.isNaN)) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
};
const classified = (e: RaceEntry) => /^\d+$/.test(e.positionText);
/** Posiciones ganadas, corregidas por la regresión a la media según la parrilla. */
const adjustedGain = (e: RaceEntry) => e.grid - e.position - 0.3 * (e.grid - 11.5);
/** Diferencia porcentual con la referencia → valoración 0–100. */
const paceRating = (gapPct: number) => clamp(99 - 11 * gapPct, 35, 99);

// ------------------------------------------------------------ Coches

interface TeamPace {
  overall: number;
  byLevel: Record<'low' | 'medium' | 'high', number>;
  raceLap: number;
}

function teamPace(): Map<string, TeamPace> {
  const qualiGaps = new Map<string, { gap: number; level: 'low' | 'medium' | 'high' }[]>();
  const raceGaps = new Map<string, number[]>();

  for (const round of results.rounds) {
    const level = downforceOf.get(round.round) ?? 'medium';

    const best = new Map<string, number>();
    for (const q of round.qualifying) {
      const times = [seconds(q.q1), seconds(q.q2), seconds(q.q3)].filter((t): t is number => t !== null);
      if (!times.length) continue;
      best.set(q.teamId, Math.min(best.get(q.teamId) ?? Infinity, ...times));
    }
    const pole = Math.min(...best.values());
    for (const [teamId, t] of best) {
      const list = qualiGaps.get(teamId) ?? [];
      list.push({ gap: (t / pole - 1) * 100, level });
      qualiGaps.set(teamId, list);
    }

    const fastest = new Map<string, number>();
    for (const e of round.race) {
      const t = seconds(e.fastestLap?.time);
      if (t !== null) fastest.set(e.teamId, Math.min(fastest.get(e.teamId) ?? Infinity, t));
    }
    const bestLap = Math.min(...fastest.values());
    for (const [teamId, t] of fastest) {
      const list = raceGaps.get(teamId) ?? [];
      list.push((t / bestLap - 1) * 100);
      raceGaps.set(teamId, list);
    }
  }

  const out = new Map<string, TeamPace>();
  for (const team of teamsBase) {
    const gaps = qualiGaps.get(team.id) ?? [];
    const overall = paceRating(median(gaps.map((g) => g.gap)));
    const level = (l: 'low' | 'medium' | 'high') => {
      const xs = gaps.filter((g) => g.level === l).map((g) => g.gap);
      return xs.length ? paceRating(median(xs)) : overall;
    };
    out.set(team.id, {
      overall,
      byLevel: { low: level('low'), medium: level('medium'), high: level('high') },
      raceLap: paceRating(median(raceGaps.get(team.id) ?? [])),
    });
  }
  return out;
}

const pace = teamPace();

function carRatings(team: (typeof teamsBase)[number]): CarRatings {
  const p = pace.get(team.id)!;
  const samePu = teamsBase.filter((t) => t.powerUnit === team.powerUnit).map((t) => pace.get(t.id)!.byLevel.low);
  const enginePower = 0.6 * Math.max(...samePu) + 0.4 * mean(samePu);

  const entries = results.rounds.flatMap((r) => r.race.filter((e) => e.teamId === team.id));
  const failures = entries.filter((e) => !classified(e)).length;
  const finishers = entries.filter((e) => classified(e) && e.grid > 0);

  const r = (v: number, lo = 35, hi = 99) => Math.round(clamp(v, lo, hi));
  return {
    downforceHigh: r(p.byLevel.high),
    downforceMedium: r(p.byLevel.medium),
    downforceLow: r(p.byLevel.low),
    straightEfficiency: r(0.5 * p.byLevel.low + 0.5 * enginePower + 0.5 * (p.byLevel.low - p.byLevel.high)),
    enginePower: r(enginePower),
    energyDeployment: r(0.5 * enginePower + 0.5 * p.raceLap),
    reliability: r(100 - 160 * (entries.length ? failures / entries.length : 0), 40, 99),
    tyreWear: r(68 + 4 * mean(finishers.map(adjustedGain)), 40, 95),
    // Sin datos públicos de peso por coche: se asume que acompaña al nivel general.
    weight: r(50 + 0.5 * (p.overall - 50)),
  };
}

// ------------------------------------------------------------ Pilotos

interface DriverSeason {
  entries: number;
  qualiSigned: number[];
  h2hWins: number;
  h2hTotal: number;
  gains: number[];
  mateGains: number[];
  notLost: number;
  finishes: number[];
  retirements: number;
  points: number;
  teamPoints: number;
  wins: number;
  podiums: number;
  teamIds: Map<string, number>;
}

function driverSeason(driverId: string): DriverSeason {
  const s: DriverSeason = {
    entries: 0, qualiSigned: [], h2hWins: 0, h2hTotal: 0, gains: [], mateGains: [], notLost: 0,
    finishes: [], retirements: 0, points: 0, teamPoints: 0, wins: 0, podiums: 0, teamIds: new Map(),
  };
  for (const round of results.rounds) {
    const me = round.race.find((e) => e.driverId === driverId);
    const sprintMe = round.sprint?.find((e) => e.driverId === driverId);
    if (sprintMe) s.points += sprintMe.points;
    if (!me) continue;
    s.entries++;
    s.points += me.points;
    s.teamIds.set(me.teamId, (s.teamIds.get(me.teamId) ?? 0) + 1);
    const mate = round.race.find((e) => e.teamId === me.teamId && e.driverId !== driverId);
    s.teamPoints += me.points + (mate?.points ?? 0);

    if (classified(me)) {
      s.finishes.push(me.position);
      if (me.position === 1) s.wins++;
      if (me.position <= 3) s.podiums++;
      if (me.grid > 0) {
        s.gains.push(adjustedGain(me));
        if (me.position <= me.grid) s.notLost++;
      }
    } else s.retirements++;

    if (mate && classified(mate) && mate.grid > 0) s.mateGains.push(adjustedGain(mate));
    if (mate && classified(me) && classified(mate)) {
      s.h2hTotal++;
      if (me.position < mate.position) s.h2hWins++;
    }

    const qMe = round.qualifying.find((q) => q.driverId === driverId);
    const qMate = round.qualifying.find((q) => q.teamId === qMe?.teamId && q.driverId !== driverId);
    if (qMe && qMate) {
      // Se compara en la última sesión en la que ambos marcaron tiempo.
      for (const k of ['q3', 'q2', 'q1'] as const) {
        const a = seconds(qMe[k]);
        const b = seconds(qMate[k]);
        if (a !== null && b !== null) {
          s.qualiSigned.push(clamp(((a - b) / b) * 100, -1.5, 1.5));
          break;
        }
      }
    }
  }
  return s;
}

const seasonEnd = new Date(`${SEASON}-12-31T00:00:00Z`).getTime();
const ageAtSeasonEnd = (dob: string) => Math.floor((seasonEnd - new Date(`${dob}T00:00:00Z`).getTime()) / (365.25 * 86400000));

/** Mínimo de carreras en 2026 para que los atributos salgan de resultados. */
const MIN_ENTRIES = 5;

function driverAttributes(d: (typeof driversBase)[number]): { attributes: DriverAttributes; estimated: boolean } {
  const s = driverSeason(d.id);
  const starts = d.careerStartsBefore2026 + s.entries;
  const experience = 30 + 68 * (1 - Math.exp(-starts / 110));
  const age = ageAtSeasonEnd(d.dateOfBirth);
  const r = (v: number, lo = 40, hi = 99) => Math.round(clamp(v, lo, hi));
  const withPotential = (a: Omit<DriverAttributes, 'potential'>): DriverAttributes => {
    if (age > 25) return a;
    const overall = mean([a.qualifyingPace, a.racePace, a.tyreManagement, a.overtaking, a.defending, a.consistency]);
    return { ...a, potential: r(overall + Math.max(0, 26 - age) * 1.8, 40, 99) };
  };

  if (s.entries < MIN_ENTRIES) {
    // Sin muestra suficiente en 2026: nivel base según la experiencia en F1.
    const base = 66 + 10 * (1 - Math.exp(-starts / 60));
    return {
      estimated: true,
      attributes: withPotential({
        qualifyingPace: r(base), racePace: r(base), tyreManagement: r(base), overtaking: r(base - 1),
        defending: r(base - 1), wetWeather: r(base), consistency: r(base + 2), energyManagement: r(base - 2),
        technicalFeedback: r(45 + 0.5 * experience), experience: r(experience, 30, 99),
        marketability: r(45 + 0.25 * experience), morale: 65,
      }),
    };
  }

  const mainTeam = [...s.teamIds.entries()].sort((a, b) => b[1] - a[1])[0]![0];
  const prior = 0.3 * (pace.get(mainTeam)!.overall - 75);
  const q = mean(s.qualiSigned);
  const h = s.h2hTotal ? s.h2hWins / s.h2hTotal : 0.5;
  const myGain = mean(s.gains);

  const qualifyingPace = clamp(82 - 14 * q + prior, 50, 99);
  const racePace = clamp(82 + 14 * (h - 0.5) - 5 * q + prior, 50, 99);
  const consistency = clamp(96 - 70 * (s.retirements / s.entries) - 1.5 * std(s.finishes), 45, 97);

  return {
    estimated: false,
    attributes: withPotential({
      qualifyingPace: r(qualifyingPace),
      racePace: r(racePace),
      tyreManagement: r(78 + 2.5 * (myGain - mean(s.mateGains)), 55, 96),
      overtaking: r(74 + 3.5 * myGain, 55, 96),
      defending: r(58 + 38 * (s.gains.length ? s.notLost / s.gains.length : 0.5), 50, 96),
      // Jolpica no publica el clima de cada sesión: lluvia y energía son derivados, no medidos.
      wetWeather: r(0.5 * racePace + 0.3 * qualifyingPace + 0.2 * experience),
      consistency: r(consistency),
      energyManagement: r(0.5 * racePace + 0.25 * consistency + 0.25 * experience),
      technicalFeedback: r(45 + 0.5 * experience),
      experience: r(experience, 30, 99),
      marketability: r(45 + 0.25 * experience + 1.5 * s.wins + 0.5 * s.podiums + 0.03 * s.points),
      morale: r(65 + 24 * (h - 0.5) + 10 * ((s.teamPoints ? s.points / s.teamPoints : 0.5) - 0.5), 35, 95),
    }),
  };
}

// ------------------------------------------------------------ Staff

/** RNG determinista (mulberry32) con semilla derivada de un texto. */
function rng(seedText: string): () => number {
  let a = 2166136261;
  for (const ch of seedText) a = Math.imul(a ^ ch.charCodeAt(0), 16777619);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Marta', 'Henrik', 'Tobias', 'Lucía', 'Owen', 'Inés', 'Callum', 'Sofia', 'Matteo', 'Elena', 'Jonas', 'Priya', 'Daniel', 'Amélie', 'Rhys', 'Noor', 'Stefan', 'Clara', 'Hugo', 'Keiko', 'Bruno', 'Freya'];
const LAST = ['Lindqvist', 'Ferreira', 'Ashdown', 'Marchetti', 'Okafor', 'Varga', 'Whitlock', 'Delacroix', 'Brandt', 'Soler', 'Kowalczyk', 'Hargreaves', 'Nakamura', 'Petrov', 'Rinaldi', 'Thornbury', 'Vasquez', 'Eklund', 'Morreale', 'Castellanos', 'Dufresne', 'Halloran'];

const slug = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

function buildStaff(drivers: Driver[]): Staff[] {
  const out: Staff[] = [];
  const usedNames = new Set(staffBase.map((s) => s.name));
  const teamLevel = (teamId: string) => 55 + 0.42 * pace.get(teamId)!.overall;

  for (const s of staffBase) {
    const driver = drivers.find((d) => d.id === s.driverId);
    const rating = s.role === 'raceEngineer' && driver ? 0.5 * teamLevel(s.teamId) + 0.5 * driver.attributes.racePace : teamLevel(s.teamId);
    out.push({ id: slug(s.name), ...s, rating: Math.round(clamp(rating, 40, 99)), generated: false });
  }

  const needed: StaffRole[] = ['technicalDirector', 'headOfAero', 'headOfStrategy', 'chiefMechanic', 'headOfAcademy'];
  for (const team of teamsBase) {
    for (const role of needed) {
      if (out.some((s) => s.teamId === team.id && s.role === role)) continue;
      const rand = rng(`${team.id}:${role}`);
      let name: string;
      do name = `${FIRST[Math.floor(rand() * FIRST.length)]} ${LAST[Math.floor(rand() * LAST.length)]}`;
      while (usedNames.has(name));
      usedNames.add(name);
      out.push({
        id: slug(name), name, teamId: team.id, role,
        rating: Math.round(clamp(teamLevel(team.id) + (rand() - 0.5) * 12, 40, 99)),
        generated: true,
      });
    }
  }
  return out;
}

// ------------------------------------------------------------ Main

const teams: Team[] = teamsBase.map((t) => teamSchema.parse({ ...t, car: carRatings(t) }));
const drivers: Driver[] = driversBase.map((d) => {
  const { attributes, estimated } = driverAttributes(d);
  return driverSchema.parse({ ...d, attributes, attributesEstimated: estimated });
});
const staff = z.array(staffSchema).parse(buildStaff(drivers));

const lines = (rows: unknown[]) => '[\n' + rows.map((r) => '  ' + JSON.stringify(r)).join(',\n') + '\n]\n';
writeFileSync(resolve(dir, 'teams.json'), lines(teams));
writeFileSync(resolve(dir, 'drivers.json'), lines(drivers));
writeFileSync(resolve(dir, 'staff.json'), lines(staff));

console.log(`Valoraciones calculadas con ${results.rounds.length} rondas.\n`);
console.log('COCHE          DfH DfM DfL Rec Mot Ene Fia Neu Pes');
for (const t of teams) {
  const c = t.car;
  console.log(t.id.padEnd(14), [c.downforceHigh, c.downforceMedium, c.downforceLow, c.straightEfficiency, c.enginePower, c.energyDeployment, c.reliability, c.tyreWear, c.weight].map((v) => String(v).padStart(3)).join(' '));
}
console.log('\nPILOTO           Q   R  Neu Ade Def Llu Con Ene Fee Exp Mkt Mor Pot');
for (const d of drivers) {
  const a = d.attributes;
  console.log((d.code + (d.attributesEstimated ? '*' : '')).padEnd(15), [a.qualifyingPace, a.racePace, a.tyreManagement, a.overtaking, a.defending, a.wetWeather, a.consistency, a.energyManagement, a.technicalFeedback, a.experience, a.marketability, a.morale, a.potential ?? '—'].map((v) => String(v).padStart(3)).join(' '));
}
console.log(`\n* = atributos estimados (menos de ${MIN_ENTRIES} carreras en ${SEASON}).`);
console.log(`Staff: ${staff.length} personas (${staff.filter((s) => s.generated).length} generadas).`);
