/**
 * Construye la configuración de una carrera a partir de los datos de la temporada.
 * Puro: recibe los datos por parámetro, así sirve igual en la app, los tests y los scripts.
 */
import type { Circuit, Driver, RaceFact, Staff, Team } from '../../data/schemas.ts';
import type { CarSetup, RaceConfig, StrategyPlan } from './types.ts';

/**
 * Relación entre la vuelta rápida real de carrera y la vuelta de referencia del modelo
 * (coche y piloto de referencia, blando nuevo, sin combustible, modos estándar).
 * Ajustada con `npm run calibrate`.
 */
export const REF_FROM_FASTEST_LAP = 1.0102;
const RACE_GAP_SCALE = 0.85;
/** Relación típica vuelta rápida / pole en las carreras secas de 2026 (mediana). */
const FASTEST_LAP_FROM_POLE = 1.042;

export interface ReferenceLap {
  seconds: number;
  /** true si el circuito aún no tiene carrera de 2026 y la vuelta sale de la velocidad media de los demás. */
  estimated: boolean;
}

/** Vuelta rápida "en seco" de una carrera real: si llovió, se acota con la pole. */
export function dryFastestLap(fact: RaceFact): number {
  return fact.wet ? Math.min(fact.fastestLapS, fact.poleS * FASTEST_LAP_FROM_POLE) : fact.fastestLapS;
}

export function referenceLap(circuit: Pick<Circuit, 'lengthKm'>, fact: RaceFact | undefined, typicalKmh: number): ReferenceLap {
  if (fact) return { seconds: dryFastestLap(fact) * REF_FROM_FASTEST_LAP, estimated: false };
  return { seconds: ((circuit.lengthKm / typicalKmh) * 3600) * REF_FROM_FASTEST_LAP, estimated: true };
}

/** Velocidad media (km/h) de la vuelta rápida en los circuitos ya disputados: referencia para los que faltan. */
export function typicalSpeedKmh(circuits: Circuit[], facts: RaceFact[], roundOfCircuit: (circuitId: string) => number | undefined): number {
  const speeds: number[] = [];
  for (const c of circuits) {
    const fact = facts.find((f) => f.round === roundOfCircuit(c.id));
    if (fact) speeds.push((c.lengthKm / dryFastestLap(fact)) * 3600);
  }
  if (!speeds.length) return 215;
  speeds.sort((a, b) => a - b);
  return speeds[speeds.length >> 1]!;
}

/** Diferencia de ritmo del coche con el de referencia en ese circuito (inversa de la fórmula de RATINGS.md). */
export function carGap(team: Team, circuit: Pick<Circuit, 'downforceLevel'>): number {
  const aero = circuit.downforceLevel === 'high' ? team.car.downforceHigh : circuit.downforceLevel === 'low' ? team.car.downforceLow : team.car.downforceMedium;
  const gapPct = (rating: number) => Math.max(0, 99 - rating) / 11;
  // En carrera las diferencias entre coches son algo menores que a una vuelta.
  return (RACE_GAP_SCALE * (0.75 * gapPct(aero) + 0.25 * gapPct(team.car.energyDeployment))) / 100;
}

export interface Entry {
  driverId: string;
  teamId: string;
}

export interface RaceSetupInput {
  seed: number;
  dt?: number;
  circuit: Circuit;
  laps?: number;
  refLapS: number;
  /** En orden de parrilla. */
  grid: Entry[];
  teams: Team[];
  drivers: Driver[];
  staff: Staff[];
  playerTeamId?: string;
  weather?: 'auto' | 'dry';
  plans?: Record<string, StrategyPlan>;
}

export function buildCarSetup(entry: Entry, input: Pick<RaceSetupInput, 'teams' | 'drivers' | 'staff' | 'circuit' | 'playerTeamId'>): CarSetup {
  const driver = input.drivers.find((d) => d.id === entry.driverId);
  const team = input.teams.find((t) => t.id === entry.teamId);
  if (!driver || !team) throw new Error(`Inscripción inválida: ${entry.driverId} / ${entry.teamId}`);
  const staffOf = (role: Staff['role']) => input.staff.find((s) => s.teamId === team.id && s.role === role)?.rating ?? 75;
  const a = driver.attributes;
  return {
    id: driver.id,
    code: driver.code,
    number: driver.number,
    teamId: team.id,
    color: team.colors.primary,
    carGap: carGap(team, input.circuit),
    racePace: a.racePace,
    tyreManagement: a.tyreManagement,
    overtaking: a.overtaking,
    defending: a.defending,
    wetWeather: a.wetWeather,
    consistency: a.consistency,
    energyManagement: a.energyManagement,
    carTyreWear: team.car.tyreWear,
    reliability: team.car.reliability,
    energyDeployment: team.car.energyDeployment,
    pitCrew: staffOf('chiefMechanic'),
    strategist: staffOf('headOfStrategy'),
    player: team.id === input.playerTeamId,
  };
}

export function buildRaceConfig(input: RaceSetupInput): RaceConfig {
  const c = input.circuit;
  return {
    seed: input.seed,
    dt: input.dt ?? 0.2,
    circuit: {
      id: c.id,
      lengthKm: c.lengthKm,
      track: c.track,
      sectors: c.sectors,
      overtakeZones: c.overtakeZones,
      pit: c.pit,
      tyreWear: c.tyreWear,
      overtakingDifficulty: c.overtakingDifficulty,
      safetyCarProbability: c.safetyCarProbability,
      rainProbability: c.rainProbability,
    },
    laps: input.laps ?? c.laps,
    refLapS: input.refLapS,
    cars: input.grid.map((entry) => buildCarSetup(entry, input)),
    weather: input.weather ?? 'auto',
    plans: input.plans,
  };
}

/**
 * Parrilla simulada para circuitos sin clasificación real: ordena por ritmo a una vuelta
 * (coche + piloto) con un poco de ruido determinista.
 */
export function simulatedGrid(entries: Entry[], input: Pick<RaceSetupInput, 'teams' | 'drivers' | 'circuit'>, noise: (i: number) => number): Entry[] {
  const score = (e: Entry, i: number) => {
    const team = input.teams.find((t) => t.id === e.teamId)!;
    const driver = input.drivers.find((d) => d.id === e.driverId)!;
    return carGap(team, input.circuit) + ((92 - driver.attributes.qualifyingPace) / 14) * 0.01 * 0.55 + (noise(i) - 0.5) * 0.004;
  };
  return entries.map((e, i) => ({ e, s: score(e, i) })).sort((a, b) => a.s - b.s).map((x) => x.e);
}
