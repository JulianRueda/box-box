/**
 * Foto del estado de la carrera para la interfaz: solo lo que se enseña en pantalla.
 * No incluye el plan real de lluvia ni los planes de los rivales.
 */
import type { Race } from './sim.ts';
import { STATIONARY_S } from './strategy.ts';
import { CLIFF, wearPerLap } from './tyres.ts';
import type { CarState, CarStatus, Compound, EnergyMode, Flag, ForecastSlot, Level, RaceEvent, StintRecord, TeamOrder } from './types.ts';
import { forecast } from './weather.ts';

export interface PitProjection {
  /** Posición en la que saldría si entra a boxes en esta vuelta. */
  position: number;
  aheadId: string | null;
  behindId: string | null;
  /** Punto de la pista (0–1) donde estaría ahora un coche con ese retraso. */
  s: number;
  lossS: number;
}

export interface CarSnap {
  id: string;
  status: CarStatus;
  lap: number;
  s: number;
  /** Fracción de vuelta por segundo de simulación. */
  rate: number;
  position: number;
  gapToLeaderS: number | null;
  intervalS: number | null;
  lapsBehind: number;
  compound: Compound;
  wear: number;
  tyreAge: number;
  heat: number;
  /** Vueltas que le quedan al neumático antes del acantilado, al ritmo actual. */
  lapsToCliff: number;
  fuelKg: number;
  fuelLaps: number;
  soc: number;
  clipping: boolean;
  damage: number;
  paceMode: Level;
  engineMode: Level;
  energyMode: EnergyMode;
  defend: boolean;
  teamOrder: TeamOrder;
  autoStrategy: boolean;
  pitRequest: Compound | null;
  pitStops: number;
  stints: StintRecord[];
  lastLapS: number | null;
  bestLapS: number | null;
  lastSectors: (number | null)[];
  bestSectors: (number | null)[];
  overtakeActive: boolean;
  puncture: boolean;
  outReason: CarState['outReason'];
  penaltyS: number;
  player: boolean;
  /** Solo para los coches del jugador. */
  pitProjection: PitProjection | null;
}

export interface RaceSnapshot {
  t: number;
  tick: number;
  flag: Flag;
  /** Vuelta en curso del líder (1 = primera). */
  lap: number;
  totalLaps: number;
  wetness: number;
  rain: number;
  trackTempC: number;
  forecast: ForecastSlot[];
  chequered: boolean;
  finished: boolean;
  fastestLap: { id: string; timeS: number } | null;
  bestSectors: (number | null)[];
  overtakes: number;
  /** Posición del coche de seguridad en la vuelta, o null. */
  safetyCarS: number | null;
  /** En orden de carrera. */
  cars: CarSnap[];
  /** Eventos ocurridos desde la foto anterior. */
  events: RaceEvent[];
}

function projection(race: Race, car: CarState): PitProjection | null {
  if (car.status !== 'racing' || car.gapToLeaderS === null) return null;
  const lossS = race.config.circuit.pit.timeLossS + STATIONARY_S;
  const mine = car.gapToLeaderS + lossS;
  const lapS = race.config.refLapS;
  // Diferencia con el líder en segundos, contando las vueltas perdidas.
  const gapOf = (c: CarState) => (c.gapToLeaderS ?? 0) + (c.lapsBehind - car.lapsBehind) * lapS;
  const others = race.state.cars
    .filter((c) => c.id !== car.id && (c.status === 'racing' || c.status === 'pit') && c.gapToLeaderS !== null)
    .sort((a, b) => gapOf(a) - gapOf(b));
  const aheadCars = others.filter((c) => gapOf(c) <= mine);
  const s = car.s - lossS / Math.max(car.potentialS, 1);
  return {
    position: aheadCars.length + 1,
    aheadId: aheadCars.at(-1)?.id ?? null,
    behindId: others[aheadCars.length]?.id ?? null,
    s: s - Math.floor(s),
    lossS,
  };
}

export function takeSnapshot(race: Race, events: RaceEvent[]): RaceSnapshot {
  const { state, config } = race;
  const circuit = config.circuit;
  const byId = new Map(state.cars.map((c) => [c.id, c]));
  const cars = state.order.map((id): CarSnap => {
    const c = byId.get(id)!;
    const setup = race.setups.get(id)!;
    const wpl = wearPerLap(c.tyre.compound, circuit.lengthKm, circuit.tyreWear, setup.carTyreWear, setup.tyreManagement);
    const fuelPerLap = circuit.lengthKm * 0.245;
    return {
      id,
      status: c.status,
      lap: c.lap,
      s: c.s,
      rate: c.rate,
      position: c.position,
      gapToLeaderS: c.gapToLeaderS,
      intervalS: c.intervalS,
      lapsBehind: c.lapsBehind,
      compound: c.tyre.compound,
      wear: c.tyre.wear,
      tyreAge: c.tyre.age,
      heat: c.tyre.heat,
      lapsToCliff: Math.max(0, (CLIFF - c.tyre.wear) / wpl),
      fuelKg: c.fuelKg,
      fuelLaps: c.fuelKg / fuelPerLap,
      soc: c.soc,
      clipping: c.clipping,
      damage: c.damage,
      paceMode: c.paceMode,
      engineMode: c.engineMode,
      energyMode: c.energyMode,
      defend: c.defend,
      teamOrder: c.teamOrder,
      autoStrategy: c.autoStrategy,
      pitRequest: c.pitRequest?.compound ?? null,
      pitStops: c.pitStops,
      stints: c.stints.map((s) => ({ ...s })),
      lastLapS: c.lastLapS,
      bestLapS: c.bestLapS,
      lastSectors: [...c.lastSectors],
      bestSectors: [...c.bestSectors],
      overtakeActive: c.overtakeActive,
      puncture: c.puncture,
      outReason: c.outReason,
      penaltyS: c.penaltyS,
      player: setup.player,
      pitProjection: setup.player ? projection(race, c) : null,
    };
  });
  const sc = state.safetyCar;
  return {
    t: state.t,
    tick: state.tick,
    flag: state.flag,
    lap: Math.min(config.laps, Math.max(1, state.leaderLap + 1)),
    totalLaps: config.laps,
    wetness: state.weather.wetness,
    rain: state.weather.rain,
    trackTempC: state.weather.trackTempC,
    forecast: forecast(state.weather, state.t, config.seed, circuit.rainProbability),
    chequered: state.chequered,
    finished: state.finished,
    fastestLap: state.fastestLap,
    bestSectors: [...state.bestSectors],
    overtakes: state.overtakes,
    safetyCarS: sc ? sc.dist - Math.floor(sc.dist) : null,
    cars,
    events,
  };
}
