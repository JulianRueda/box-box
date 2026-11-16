/**
 * Núcleo de la simulación de carrera.
 *
 * createRace() prepara el estado; step() lo avanza `dt` segundos. Es determinista:
 * la misma semilla, el mismo dt y las mismas órdenes en los mismos ticks dan la misma carrera.
 * Sin React ni DOM: se ejecuta igual en el worker, en los tests y en el script de calibración.
 */
import { decide, nextPlannedStop, pickPlan, replan, type AiView } from '../ai/raceAi.ts';
import { rand, randNormal, randRange } from '../rng.ts';
import { fuelForRace, fuelLossS, FUEL_KG_PER_KM, type StrategyContext } from './strategy.ts';
import { buildTrack, inSpan, progressRate, sampleIndex, timeBetween, zoneAt, type Track } from './track.ts';
import {
  CLIFF, compoundOffset, heatLoss, isDry, newTyre, warmUp, wearLoss, wearPerLap, wetCompoundFor, wetLoss, wetTyreWearFactor,
} from './tyres.ts';
import type {
  CarSetup, CarState, Command, Compound, DryCompound, EnergyMode, Level, RaceConfig, RaceEvent, RaceState,
} from './types.ts';
import { createWeather, forecast, stepWeather } from './weather.ts';

// ------------------------------------------------------------ Parámetros de juego

/** Puntos de control por vuelta para medir diferencias de tiempo, como los minisectores reales. */
const CHECKPOINTS = 20;
const GRID_SLOT_M = 8;
const LIGHTS_OUT_S = 3;
/** Distancia mínima, en segundos, a la que un coche puede seguir a otro. */
const FOLLOW_GAP_S = 0.22;
const SC_QUEUE_GAP_S = 0.5;
const SC_LAP_FACTOR = 1.5;
const SC_CATCH_FACTOR = 1.2;
const VSC_FACTOR = 1.38;
const OVERTAKE_DETECTION_S = 1.0;
const OVERTAKE_COST = 0.045;

const PACE: Record<Level, number> = { conserve: 0.006, standard: 0, push: -0.003, max: -0.005 };
const PACE_WEAR: Record<Level, number> = { conserve: 0.8, standard: 1, push: 1.25, max: 1.6 };
const PACE_ERROR: Record<Level, number> = { conserve: 0.6, standard: 1, push: 1.6, max: 2.6 };
const ENGINE: Record<Level, number> = { conserve: 0.003, standard: 0, push: -0.0015, max: -0.003 };
const ENGINE_BURN: Record<Level, number> = { conserve: 0.94, standard: 1, push: 1.04, max: 1.08 };
const ENGINE_STRESS: Record<Level, number> = { conserve: 0.7, standard: 1, push: 1.4, max: 2.2 };
const ENERGY: Record<EnergyMode, number> = { save: 0.004, balanced: 0, attack: -0.003, overtake: -0.001 };
/** Batería gastada por vuelta en cada modo (la recuperada ronda 0,30). */
const ENERGY_DEPLOY: Record<EnergyMode, number> = { save: 0.2, balanced: 0.3, attack: 0.41, overtake: 0.33 };

export interface Race {
  config: RaceConfig;
  track: Track;
  state: RaceState;
  setups: Map<string, CarSetup>;
  contexts: Map<string, StrategyContext>;
  /** Instante de paso por cada punto de control: passT[id][índice global]. */
  passT: Map<string, Float64Array>;
  /** Fracción de vuelta entre coches en la parrilla. */
  gridSpacing: number;
}

export interface ClassificationRow {
  id: string;
  position: number;
  laps: number;
  /** Tiempo total del ganador, o diferencia con él para los de su misma vuelta. */
  timeS: number | null;
  lapsBehind: number;
  status: 'finished' | 'out';
  outReason: CarState['outReason'];
  penaltyS: number;
  pitStops: number;
  bestLapS: number | null;
}

const dist = (car: CarState) => car.lap + car.s;
const emit = (race: Race, event: RaceEvent) => void race.state.events.push(event);
const setupOf = (race: Race, id: string) => race.setups.get(id)!;

// ------------------------------------------------------------ Creación

export function createRace(config: RaceConfig): Race {
  const track = buildTrack(config.circuit);
  const state: RaceState = {
    rng: config.seed >>> 0,
    t: 0,
    tick: 0,
    flag: 'green',
    flagUntilT: 0,
    safetyCar: null,
    weather: { rain: 0, wetness: 0, trackTempC: 35, plan: [], everWet: false },
    cars: [],
    order: config.cars.map((c) => c.id),
    leaderLap: -1,
    chequered: false,
    finished: false,
    fastestLap: null,
    bestSectors: [null, null, null],
    overtakes: 0,
    events: [],
  };
  state.weather = createWeather(state, config.circuit.rainProbability, config.laps * config.refLapS * 1.06, config.weather);

  const race: Race = {
    config, track, state,
    setups: new Map(config.cars.map((c) => [c.id, c])),
    contexts: new Map(),
    passT: new Map(),
    gridSpacing: GRID_SLOT_M / track.lengthM,
  };

  const wetStart = wetCompoundFor(state.weather.wetness);
  config.cars.forEach((setup, slot) => {
    const ctx: StrategyContext = {
      laps: config.laps,
      lengthKm: config.circuit.lengthKm,
      circuitWear: config.circuit.tyreWear,
      pitLossS: config.circuit.pit.timeLossS,
      refLapS: config.refLapS,
      carTyreWear: setup.carTyreWear,
      tyreManagement: setup.tyreManagement,
    };
    race.contexts.set(setup.id, ctx);
    race.passT.set(setup.id, new Float64Array((config.laps + 3) * CHECKPOINTS).fill(-1));

    // Los sorteos van siempre en el mismo orden para que la carrera sea reproducible.
    const aiPlan = pickPlan(state, ctx, setup.strategist);
    const reaction = Math.abs(0.22 + randNormal(state) * 0.07);
    const badStart = rand(state) < 0.04 ? randRange(state, 0.5, 1.3) : 0;
    const wetThreshold = 0.15 + (rand(state) - 0.3) * ((95 - setup.strategist) / 100) * 0.3;
    const noise = lapNoise(race, setup);

    let plan = config.plans?.[setup.id] ?? aiPlan;
    if (wetStart) plan = { stints: [{ compound: wetStart, laps: config.laps }], stops: 0, estTimeS: 0 };
    const compound = plan.stints[0]!.compound;

    state.cars.push({
      id: setup.id,
      status: 'grid',
      lap: -1,
      s: 1 - (slot + 1) * race.gridSpacing,
      rate: 0,
      tyre: { ...newTyre(compound), heat: 0.7 },
      stints: [{ compound, startLap: 0, endLap: null }],
      fuelKg: fuelForRace(config.laps, config.circuit.lengthKm),
      soc: 0.9,
      clipping: false,
      damage: 0,
      paceMode: 'standard',
      engineMode: 'standard',
      energyMode: 'balanced',
      defend: false,
      teamOrder: 'free',
      autoStrategy: false,
      pitRequest: null,
      pitTimer: 0,
      pitTotal: 0,
      pitCountedLap: false,
      pitStops: 0,
      lastPitLap: 0,
      plan,
      planIndex: 0,
      planBaseLap: 0,
      wetThreshold,
      extended: false,
      launchAt: LIGHTS_OUT_S + reaction + badStart,
      lapStartT: 0,
      lastLapS: null,
      bestLapS: null,
      sectorStartT: 0,
      sector: 0,
      lastSectors: [null, null, null],
      bestSectors: [null, null, null],
      lapNoise: noise,
      potentialS: config.refLapS,
      pendingLossS: 0,
      position: slot + 1,
      gapToLeaderS: null,
      intervalS: null,
      lapsBehind: 0,
      heldBy: null,
      stuckS: 0,
      attemptCooldownS: 0,
      overtakeActive: false,
      overtakeUntil: -1,
      puncture: false,
      penaltyS: 0,
      finishT: null,
      outReason: null,
      adviceLap: -1,
    });
  });
  return race;
}

function lapNoise(race: Race, setup: CarSetup): number {
  return 1 + randNormal(race.state) * (0.0012 + (100 - setup.consistency) * 0.00004);
}

// ------------------------------------------------------------ Ritmo

/** Tiempo por vuelta que haría el coche ahora mismo con pista libre, en segundos. */
function potentialLap(race: Race, car: CarState, setup: CarSetup): number {
  const { config, state } = race;
  const w = state.weather.wetness;
  const driverGap = ((92 - setup.racePace) / 14) * 0.01 * 0.55;
  const wetSkill = w > 0.05 ? ((85 - setup.wetWeather) / 100) * 0.04 * Math.min(1, w * 2) : 0;
  const closeAhead = state.flag === 'green' && car.position > 1 && car.intervalS !== null && car.intervalS < 1.5;
  const dirtyAir = closeAhead ? 0.0035 * (1 - car.intervalS! / 1.5) * (0.5 + config.circuit.overtakingDifficulty / 100) : 0;
  const factor =
    1 + setup.carGap + driverGap + wetSkill +
    compoundOffset(car.tyre.compound) + wearLoss(car.tyre.wear) + heatLoss(car.tyre) + wetLoss(car.tyre.compound, w) +
    PACE[car.paceMode] + ENGINE[car.engineMode] + (car.clipping ? 0.007 : ENERGY[car.energyMode]) +
    dirtyAir + car.damage * 0.03 + (car.defend ? 0.0015 : 0);
  return config.refLapS * factor * car.lapNoise + fuelLossS(car.fuelKg, config.refLapS);
}

// ------------------------------------------------------------ Paso

export function step(race: Race): void {
  const { state, config, track } = race;
  if (state.finished) return;
  const dt = config.dt;
  state.t += dt;
  state.tick++;
  if (state.tick === Math.round(LIGHTS_OUT_S / dt)) emit(race, { t: state.t, type: 'start' });

  const change = stepWeather(state.weather, state.t, dt);
  if (change) emit(race, { t: state.t, type: 'weather', kind: change });

  if ((state.flag === 'vsc' || state.flag === 'yellow') && state.t >= state.flagUntilT) setFlag(race, 'green');
  if (state.safetyCar) {
    state.safetyCar.dist += progressRate(track, state.safetyCar.dist, config.refLapS * SC_LAP_FACTOR) * dt;
  }

  const byId = new Map(state.cars.map((c) => [c.id, c]));
  const queue = state.flag === 'sc' ? physicalQueue(race) : null;

  // De delante hacia atrás: cada coche ve dónde ha quedado el que le precede.
  let ahead: CarState | null = null;
  let ahead2: CarState | null = null;
  for (const id of state.order) {
    const car = byId.get(id)!;
    if (car.status === 'pit') {
      stepPit(race, car, dt);
      continue;
    }
    if (car.status === 'grid') {
      if (state.t < car.launchAt) continue;
      car.status = 'racing';
    }
    if (car.status !== 'racing') continue;

    const setup = setupOf(race, id);
    car.attemptCooldownS = Math.max(0, car.attemptCooldownS - dt);
    const potential = potentialLap(race, car, setup);
    car.potentialS = potential;

    let lapS = potential;
    if (state.flag === 'sc') lapS = Math.max(lapS, config.refLapS * SC_CATCH_FACTOR);
    else if (state.flag === 'vsc') lapS = potential * VSC_FACTOR;
    if (car.puncture) lapS = Math.max(lapS, config.refLapS * 1.6);

    let rate = progressRate(track, car.s, lapS);
    const sinceLaunch = state.t - car.launchAt;
    if (sinceLaunch < 7) rate *= 0.3 + (sinceLaunch / 7) * 0.7; // salida parada
    if (car.overtakeActive) rate *= 1 + 0.035 * (setup.energyDeployment / 90);
    if (car.pendingLossS > 0) {
      const used = Math.min(car.pendingLossS, dt * 0.6);
      rate *= 1 - used / dt;
      car.pendingLossS -= used;
    }

    let ds = rate * dt;
    const gapFrac = FOLLOW_GAP_S * progressRate(track, car.s, potential);

    if (queue) {
      // Con safety car nadie adelanta: cada uno se coloca detrás del que tiene físicamente delante.
      const limit = queue.get(id);
      if (limit !== undefined) ds = Math.max(0, Math.min(ds, limit));
      car.heldBy = null;
    } else if (ahead) {
      const room = dist(ahead) - gapFrac - dist(car);
      if (ds > room) {
        const passed = (state.flag === 'green' || state.flag === 'yellow') && tryOvertake(race, ahead, car);
        if (passed) {
          ds = Math.max(ds, dist(ahead) + gapFrac - dist(car));
          if (ahead2) ds = Math.min(ds, Math.max(0, dist(ahead2) - gapFrac - dist(car)));
          advance(race, car, setup, ds, dt);
          // El adelantado pasa a ser el coche inmediatamente delante del siguiente.
          continue;
        }
        ds = Math.max(0, room);
        car.heldBy = ahead.id;
        car.stuckS += dt;
      } else if (car.heldBy) {
        car.heldBy = null;
        car.stuckS = 0;
      }
    }

    advance(race, car, setup, ds, dt);
    if (car.status === 'racing') {
      ahead2 = ahead;
      ahead = car;
    }
  }

  updateOrder(race);
  if (state.chequered && state.cars.every((c) => c.status === 'finished' || c.status === 'out')) finishRace(race);
}

/** Con safety car: cuánto puede avanzar cada coche sin alcanzar al que tiene físicamente delante. */
function physicalQueue(race: Race): Map<string, number> {
  const { state, track, config } = race;
  const sc = state.safetyCar!;
  const scS = sc.dist - Math.floor(sc.dist);
  const behind = (s: number) => {
    const d = scS - s;
    return d < 0 ? d + 1 : d;
  };
  const cars = state.cars.filter((c) => c.status === 'racing').sort((a, b) => behind(a.s) - behind(b.s));
  const limits = new Map<string, number>();
  let frontBehind = 0; // distancia física del coche anterior al safety car
  for (const car of cars) {
    const gap = SC_QUEUE_GAP_S * progressRate(track, car.s, config.refLapS * SC_LAP_FACTOR);
    const room = behind(car.s) - frontBehind - gap;
    const scMove = progressRate(track, scS, config.refLapS * SC_LAP_FACTOR) * config.dt;
    limits.set(car.id, Math.max(0, room) + scMove * 0.999);
    frontBehind = Math.max(frontBehind + gap, behind(car.s) - Math.max(0, room));
  }
  return limits;
}

// ------------------------------------------------------------ Movimiento de un coche

const crossed = (s0: number, s1: number, x: number) => (s0 < x && s1 >= x) || (s1 >= 1 && s0 < x + 1 && s1 >= x + 1);

function advance(race: Race, car: CarState, setup: CarSetup, ds: number, dt: number): void {
  const { state, config } = race;
  const circuit = config.circuit;
  const s0 = car.s;
  const s1 = s0 + ds;
  car.rate = ds / dt;
  /** Instante en que el coche pasó por la posición x (interpolado dentro del paso). */
  const timeAt = (x: number) => (ds > 0 ? state.t - (dt * (s1 - x)) / ds : state.t);

  // --- Consumos y neumáticos, proporcionales a lo recorrido
  const neutralised = state.flag === 'sc' || state.flag === 'vsc';
  const closeAhead = car.position > 1 && car.intervalS !== null && car.intervalS < 1.5;
  const wpl = wearPerLap(car.tyre.compound, circuit.lengthKm, circuit.tyreWear, setup.carTyreWear, setup.tyreManagement);
  car.tyre.wear = Math.min(
    1.15,
    car.tyre.wear + wpl * ds * (neutralised ? 0.35 : PACE_WEAR[car.paceMode]) * (closeAhead ? 1.12 : 1) * (car.defend ? 1.05 : 1) *
      (1 + car.tyre.thermal * 0.25) * wetTyreWearFactor(car.tyre.compound, state.weather.wetness),
  );
  warmUp(car.tyre, dt, state.weather.trackTempC);
  const thermalTarget = neutralised ? 0 : (car.paceMode === 'max' ? 0.85 : car.paceMode === 'push' ? 0.5 : 0.2) + (closeAhead ? 0.25 : 0);
  car.tyre.thermal += (thermalTarget - car.tyre.thermal) * Math.min(1, dt / 40);

  car.fuelKg -= circuit.lengthKm * FUEL_KG_PER_KM * ds * (neutralised ? 0.6 : ENGINE_BURN[car.engineMode]);
  const harvest = 0.3 * (0.8 + 0.4 * (setup.energyManagement / 100));
  const deploy = neutralised ? 0.05 : car.clipping ? 0.08 : ENERGY_DEPLOY[car.energyMode];
  car.soc = Math.min(1, Math.max(0, car.soc + (harvest - deploy) * ds));
  if (car.soc <= 0.02) car.clipping = true;
  else if (car.soc >= 0.15) car.clipping = false;

  // --- Puntos de control (para las diferencias de tiempo)
  const before = Math.floor((car.lap + 1 + s0) * CHECKPOINTS);
  const after = Math.floor((car.lap + 1 + s1) * CHECKPOINTS);
  if (after > before) {
    const times = race.passT.get(car.id)!;
    for (let c = before + 1; c <= after && c < times.length; c++) times[c] = timeAt(c / CHECKPOINTS - (car.lap + 1));
  }

  // --- Sectores
  for (let i = 0; i < 2; i++) {
    if (crossed(s0, s1, circuit.sectors[i]!) && car.lap >= 0 && car.sector === i) {
      const at = timeAt(circuit.sectors[i]!);
      recordSector(race, car, i, at);
      car.sector = i + 1;
      car.sectorStartT = at;
      // El muro decide una vez por vuelta, al final del segundo sector: antes de la entrada a boxes.
      if (i === 1) pitWall(race, car, setup);
    }
  }

  // --- Overtake Mode
  if (car.overtakeActive && !inSpan(s1, circuit.overtakeZones[car.overtakeUntil]?.[0] ?? 0, circuit.overtakeZones[car.overtakeUntil]?.[1] ?? 0)) {
    car.overtakeActive = false;
    car.overtakeUntil = -1;
  }
  if (!car.overtakeActive && state.flag === 'green' && car.lap >= 1 && car.position > 1) {
    for (let z = 0; z < circuit.overtakeZones.length; z++) {
      if (!crossed(s0, s1, circuit.overtakeZones[z]![0])) continue;
      const close = car.intervalS !== null && car.intervalS < OVERTAKE_DETECTION_S;
      const allowed = car.energyMode === 'overtake' ? car.soc > 0.08 : car.energyMode !== 'save' && car.soc > 0.3;
      if (close && allowed && !car.clipping) {
        car.overtakeActive = true;
        car.overtakeUntil = z;
        car.soc = Math.max(0, car.soc - OVERTAKE_COST);
      }
    }
  }

  rollIncidents(race, car, setup, ds);
  if (car.status !== 'racing') return;
  if (car.fuelKg <= 0) return retire(race, car, 'fuel');

  // --- Entrada a boxes
  if (car.pitRequest && crossed(s0, s1, circuit.pit.entry)) {
    car.s = circuit.pit.entry;
    enterPit(race, car, setup);
    return;
  }

  // --- Línea de meta
  if (s1 >= 1) {
    car.s = s1 - 1;
    completeLap(race, car, setup, timeAt(1));
  } else {
    car.s = s1;
  }
}

function recordSector(race: Race, car: CarState, index: number, at: number): void {
  const time = at - car.sectorStartT;
  car.lastSectors[index] = time;
  if (car.bestSectors[index] === null || time < car.bestSectors[index]!) car.bestSectors[index] = time;
  const best = race.state.bestSectors[index];
  if ((best === null || best === undefined || time < best) && race.state.flag === 'green') race.state.bestSectors[index] = time;
}

function completeLap(race: Race, car: CarState, setup: CarSetup, t: number = race.state.t): void {
  const { state, config } = race;
  if (car.lap >= 0) {
    const lapS = t - car.lapStartT;
    car.lastLapS = lapS;
    if (car.status === 'racing') recordSector(race, car, 2, t);
    if (car.bestLapS === null || lapS < car.bestLapS) car.bestLapS = lapS;
    if (!state.fastestLap || lapS < state.fastestLap.timeS) {
      state.fastestLap = { id: car.id, timeS: lapS };
      if (car.lap >= 2) emit(race, { t, type: 'fastestLap', id: car.id, timeS: lapS });
    }
    car.tyre.age++;
    if (car.tyre.graining > 0) car.tyre.graining--;
  }
  car.lap++;
  car.lapStartT = t;
  car.sector = 0;
  car.sectorStartT = t;
  car.lapNoise = lapNoise(race, setup);

  const leading = state.order.find((id) => {
    const c = state.cars.find((x) => x.id === id)!;
    return c.status === 'racing' || c.status === 'pit';
  });
  if (leading === car.id || car.lap > state.leaderLap) {
    state.leaderLap = Math.max(state.leaderLap, car.lap);
    if (state.safetyCar && --state.safetyCar.lapsLeft <= 0) {
      state.safetyCar = null;
      setFlag(race, 'green');
    }
    if (car.lap >= config.laps) state.chequered = true;
  }
  if (state.chequered) {
    car.status = 'finished';
    car.finishT = t;
    car.rate = 0;
    const stint = car.stints.at(-1);
    if (stint) stint.endLap = car.lap;
    emit(race, { t, type: 'chequered', id: car.id });
  }
}

// ------------------------------------------------------------ Boxes

function enterPit(race: Race, car: CarState, setup: CarSetup): void {
  const { state, config, track } = race;
  const pit = config.circuit.pit;
  const request = car.pitRequest!;
  const lane = config.refLapS * timeBetween(track, pit.entry, pit.exit) + pit.timeLossS;

  let stationary = 1.9 + ((100 - setup.pitCrew) / 100) * 2.2 + Math.abs(randNormal(state)) * 0.3;
  const slow = rand(state) < 0.045;
  if (slow) stationary += randRange(state, 2, 7); // tuerca lenta
  if (request.frontWing || car.damage > 0.3) {
    stationary += 7;
    car.damage = 0;
  }
  // Doble parada: si el compañero aún no ha salido del box, hay que esperar detrás.
  const mate = state.cars.find((c) => c.id !== car.id && c.status === 'pit' && setupOf(race, c.id).teamId === setup.teamId);
  const wait = mate && mate.pitTimer > mate.pitTotal * 0.45 ? mate.pitTimer - mate.pitTotal * 0.45 + 1 : 0;

  const lapNow = car.lap + 1;
  const planned = nextPlannedStop(car);
  const onPlan = planned !== null && Math.abs(planned - lapNow) <= 2 && car.plan.stints[car.planIndex + 1]?.compound === request.compound;
  const current = car.stints.at(-1);
  if (current) current.endLap = lapNow;
  car.stints.push({ compound: request.compound, startLap: lapNow, endLap: null });
  if (onPlan) {
    car.planIndex++;
  } else {
    const used = new Set(car.stints.map((s) => s.compound).filter(isDry)) as Set<DryCompound>;
    const stints = replan(race.contexts.get(car.id)!, config.laps - lapNow, request.compound, used);
    car.plan = { stints, stops: stints.length - 1, estTimeS: 0 };
    car.planIndex = 0;
    car.planBaseLap = lapNow;
  }

  car.status = 'pit';
  car.pitTimer = car.pitTotal = lane + stationary + wait;
  car.pitCountedLap = false;
  car.pitStops++;
  car.lastPitLap = lapNow;
  car.pitRequest = null;
  car.tyre = newTyre(request.compound);
  car.puncture = false;
  car.extended = false;
  car.overtakeActive = false;
  car.overtakeUntil = -1;
  car.heldBy = null;
  car.stuckS = 0;
  car.rate = 0;
  emit(race, { t: state.t, type: 'pit', id: car.id, compound: request.compound, stationaryS: Math.round((stationary + wait) * 10) / 10, slow: slow || wait > 0, lap: lapNow });
}

function stepPit(race: Race, car: CarState, dt: number): void {
  const pit = race.config.circuit.pit;
  car.pitTimer -= dt;
  const progress = Math.min(1, 1 - car.pitTimer / car.pitTotal);
  const span = pit.exit >= pit.entry ? pit.exit - pit.entry : 1 - pit.entry + pit.exit;
  const s0 = car.s;
  const virtual = pit.entry + progress * span;
  const crossesLine = pit.exit < pit.entry;

  const lapBase = car.lap + 1;
  const before = Math.floor((lapBase + s0) * CHECKPOINTS);
  if (crossesLine && virtual >= 1 && !car.pitCountedLap) {
    car.pitCountedLap = true;
    car.s = virtual - 1;
    completeLap(race, car, setupOf(race, car.id));
    if (car.status === 'finished') return;
  } else {
    car.s = virtual >= 1 ? virtual - 1 : virtual;
  }
  const after = Math.floor((car.lap + 1 + car.s) * CHECKPOINTS);
  if (after > before) {
    const times = race.passT.get(car.id)!;
    for (let c = before + 1; c <= after && c < times.length; c++) times[c] = race.state.t;
  }
  car.rate = (span * dt) / car.pitTotal / dt;

  if (car.pitTimer <= 0) {
    car.status = 'racing';
    car.s = pit.exit;
    car.pitTimer = 0;
  }
}

// ------------------------------------------------------------ Adelantamientos

function tryOvertake(race: Race, ahead: CarState, car: CarState): boolean {
  const { state, config, track } = race;
  if (car.lap < 0) return false;
  const a = setupOf(race, ahead.id);
  const b = setupOf(race, car.id);
  if (a.teamId === b.teamId) {
    if (ahead.teamOrder === 'letBy') return completePass(race, ahead, car);
    if (ahead.teamOrder === 'hold' || car.teamOrder === 'hold') return false;
  }
  if (car.attemptCooldownS > 0) return false;

  const firstLap = state.leaderLap < 1;
  const inZone = zoneAt(track, ahead.s) >= 0;
  // Fuera de las zonas de adelantamiento los intentos son raros (salvo en la primera vuelta).
  if (!inZone && !firstLap && rand(state) > 0.02 * config.dt) return false;
  car.attemptCooldownS = firstLap ? 3 : inZone ? 5 : 8;

  const advantage = ((ahead.potentialS - car.potentialS) / config.refLapS) * 100;
  const skill = (b.overtaking - (a.defending + (ahead.defend ? 8 : 0))) / 100;
  const x =
    2.4 * advantage + 1.2 * skill + (car.overtakeActive ? 0.45 : 0) + (inZone ? 0.45 : 0) + (firstLap ? 0.4 : 0) -
    (1.4 + 3.4 * (config.circuit.overtakingDifficulty / 100)) - state.weather.wetness * 0.3;
  const success = rand(state) < 1 / (1 + Math.exp(-2.2 * x));

  if (rand(state) < 0.012 * (firstLap ? 2.5 : 1)) {
    const victim = rand(state) < 0.5 ? ahead : car;
    victim.damage = Math.min(1, victim.damage + 0.35);
    victim.pendingLossS += 2;
    if (rand(state) < 0.15) victim.puncture = true;
    emit(race, { t: state.t, type: 'incident', id: victim.id, kind: 'contact' });
  }
  if (!success) {
    car.pendingLossS += 0.25;
    return false;
  }
  return completePass(race, ahead, car);
}

function completePass(race: Race, ahead: CarState, car: CarState): boolean {
  ahead.pendingLossS += 0.35;
  // El adelantado tarda en poder devolver la pasada.
  ahead.attemptCooldownS = Math.max(ahead.attemptCooldownS, 12);
  car.heldBy = null;
  car.stuckS = 0;
  race.state.overtakes++;
  emit(race, { t: race.state.t, type: 'overtake', by: car.id, on: ahead.id, position: ahead.position });
  return true;
}

// ------------------------------------------------------------ Incidentes y banderas

function rollIncidents(race: Race, car: CarState, setup: CarSetup, ds: number): void {
  const { state, config } = race;
  if (state.flag === 'sc' || state.flag === 'vsc' || car.lap < 0) return;
  const w = state.weather.wetness;
  const wrongTyre = isDry(car.tyre.compound) ? w * 6 : 0;
  const errorP = 0.011 * (1.7 - setup.consistency / 100) * PACE_ERROR[car.paceMode] * (1 + 2 * w + wrongTyre) * (state.leaderLap < 1 ? 2.5 : 1) * ds;
  if (rand(state) < errorP) {
    const r = rand(state);
    if (r < 0.7) {
      car.pendingLossS += randRange(state, 0.8, 2.5);
      emit(race, { t: state.t, type: 'incident', id: car.id, kind: 'lockup' });
    } else if (r < 0.92) {
      car.pendingLossS += randRange(state, 7, 14);
      emit(race, { t: state.t, type: 'incident', id: car.id, kind: 'spin' });
    } else {
      return retire(race, car, 'crash');
    }
  }

  const failRace = Math.min(0.4, Math.max(0.01, ((100 - setup.reliability) / 160) * 0.8));
  if (rand(state) < (failRace / config.laps) * ENGINE_STRESS[car.engineMode] * ds) return retire(race, car, 'mechanical');

  if (!car.puncture && rand(state) < 0.0005 * (car.tyre.wear > 0.95 ? 25 : 1) * ds) {
    car.puncture = true;
    emit(race, { t: state.t, type: 'incident', id: car.id, kind: 'puncture' });
  }
  if (car.tyre.thermal > 0.8 && rand(state) < 0.04 * ds) {
    car.tyre.wear += 0.04;
    emit(race, { t: state.t, type: 'incident', id: car.id, kind: 'blistering' });
  }
  if (car.tyre.age <= 3 && car.tyre.graining === 0 && car.tyre.heat < 0.85 && (car.paceMode === 'push' || car.paceMode === 'max') && rand(state) < 0.05 * ds) {
    car.tyre.graining = 3;
    emit(race, { t: state.t, type: 'incident', id: car.id, kind: 'graining' });
  }
}

function retire(race: Race, car: CarState, reason: NonNullable<CarState['outReason']>): void {
  const { state, config } = race;
  car.status = 'out';
  car.outReason = reason;
  car.rate = 0;
  car.pitRequest = null;
  emit(race, { t: state.t, type: 'incident', id: car.id, kind: reason });
  if (state.flag === 'sc' || state.chequered || reason === 'fuel') return;

  const scP = config.circuit.safetyCarProbability * (reason === 'crash' ? 0.8 : 0.25);
  const r = rand(state);
  const lapsLeft = config.laps - state.leaderLap;
  if (r < scP && lapsLeft > 3) {
    const leader = state.cars.find((c) => c.id === state.order[0])!;
    state.safetyCar = { lapsLeft: 3 + Math.floor(rand(state) * 3), dist: dist(leader) + 0.04 };
    setFlag(race, 'sc');
  } else if (r < scP + (reason === 'crash' ? 0.3 : 0.35)) {
    state.flagUntilT = state.t + randRange(state, 60, 110);
    setFlag(race, 'vsc');
  } else if (state.flag === 'green') {
    state.flagUntilT = state.t + 40;
    setFlag(race, 'yellow');
  }
}

function setFlag(race: Race, flag: RaceState['flag']): void {
  if (race.state.flag === flag) return;
  race.state.flag = flag;
  emit(race, { t: race.state.t, type: 'flag', flag });
}

// ------------------------------------------------------------ Muro

function viewFor(race: Race, car: CarState, setup: CarSetup): AiView {
  const { state, config } = race;
  const index = state.order.indexOf(car.id);
  const aheadCar = index > 0 ? state.cars.find((c) => c.id === state.order[index - 1]) : undefined;
  const behindCar = state.cars.find((c) => c.id === state.order[index + 1]);
  return {
    car, setup,
    ctx: race.contexts.get(car.id)!,
    totalLaps: config.laps,
    flag: state.flag,
    wetness: state.weather.wetness,
    rain: state.weather.rain,
    forecast: forecast(state.weather, state.t, config.seed, config.circuit.rainProbability),
    refLapS: config.refLapS,
    aheadJustPitted: aheadCar !== undefined && aheadCar.lastPitLap >= car.lap && aheadCar.lastPitLap > 0,
    behindS: behindCar && behindCar.status === 'racing' ? behindCar.intervalS : null,
  };
}

/** La IA decide por sus coches; para los del jugador, el ingeniero solo aconseja. */
function pitWall(race: Race, car: CarState, setup: CarSetup): void {
  if (race.state.chequered) return;
  const commands = decide(viewFor(race, car, setup), race.state);
  if (!setup.player || car.autoStrategy) {
    for (const c of commands) applyCommand(race, c);
    return;
  }
  if (car.adviceLap === car.lap) return;
  const pit = commands.find((c) => c.type === 'pit');
  const t = race.state.t;
  if (pit && pit.type === 'pit') {
    car.adviceLap = car.lap;
    emit(race, { t, type: 'advice', id: car.id, code: isDry(pit.compound) ? 'box' : 'boxWet', compound: pit.compound });
  } else if (car.tyre.wear > CLIFF + 0.06) {
    car.adviceLap = car.lap;
    emit(race, { t, type: 'advice', id: car.id, code: 'tyresGone' });
  } else if (car.soc < 0.1) {
    car.adviceLap = car.lap;
    emit(race, { t, type: 'advice', id: car.id, code: 'saveBattery' });
  }
}

export function applyCommand(race: Race, command: Command): void {
  const car = race.state.cars.find((c) => c.id === command.id);
  if (!car || car.status === 'out' || car.status === 'finished') return;
  switch (command.type) {
    case 'pit':
      if (car.status !== 'pit') car.pitRequest = { compound: command.compound, frontWing: command.frontWing ?? false };
      break;
    case 'cancelPit':
      car.pitRequest = null;
      break;
    case 'pace':
      car.paceMode = command.value;
      break;
    case 'engine':
      car.engineMode = command.value;
      break;
    case 'energy':
      car.energyMode = command.value;
      break;
    case 'defend':
      car.defend = command.value;
      break;
    case 'teamOrder':
      car.teamOrder = command.value;
      break;
    case 'auto':
      car.autoStrategy = command.value;
      break;
  }
}

// ------------------------------------------------------------ Orden y final

function updateOrder(race: Race): void {
  const { state } = race;
  const byId = new Map(state.cars.map((c) => [c.id, c]));
  const rank = (c: CarState) => (c.status === 'out' ? 1 : 0);
  state.order.sort((x, y) => {
    const a = byId.get(x)!;
    const b = byId.get(y)!;
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    const d = dist(b) - dist(a);
    if (Math.abs(d) > 1e-9) return d;
    return (a.finishT ?? 0) - (b.finishT ?? 0);
  });

  const leader = byId.get(state.order[0]!)!;
  const leaderTimes = race.passT.get(leader.id)!;
  let previous: CarState | null = null;
  state.order.forEach((id, i) => {
    const car = byId.get(id)!;
    car.position = i + 1;
    if (car.status === 'out') {
      car.gapToLeaderS = car.intervalS = null;
      return;
    }
    const times = race.passT.get(id)!;
    const c = Math.max(0, Math.min(times.length - 1, Math.floor((car.lap + 1 + car.s) * CHECKPOINTS)));
    const mine = times[c]!;
    car.lapsBehind = Math.max(0, Math.floor(dist(leader) - dist(car)));
    car.gapToLeaderS = i === 0 ? 0 : mine >= 0 && leaderTimes[c]! >= 0 ? mine - leaderTimes[c]! : null;
    if (previous) {
      const prevT = race.passT.get(previous.id)![c]!;
      car.intervalS = mine >= 0 && prevT >= 0 ? Math.max(0, mine - prevT) : null;
    } else {
      car.intervalS = null;
    }
    previous = car;
  });
}

function finishRace(race: Race): void {
  const { state } = race;
  // En seco hay que usar dos compuestos distintos; si la pista estuvo mojada, la norma no aplica.
  if (!state.weather.everWet) {
    for (const car of state.cars) {
      if (car.status !== 'finished') continue;
      if (new Set(car.stints.map((s) => s.compound).filter(isDry)).size < 2) {
        car.penaltyS += 30;
        emit(race, { t: state.t, type: 'penalty', id: car.id, seconds: 30, reason: 'twoCompounds' });
      }
    }
  }
  state.finished = true;
  emit(race, { t: state.t, type: 'finished' });
}

/** Clasificación final (o provisional si la carrera sigue). */
export function classification(race: Race): ClassificationRow[] {
  const cars = [...race.state.cars];
  const key = (c: CarState) => (c.finishT ?? race.state.t) + c.penaltyS;
  cars.sort((a, b) => {
    const outA = a.status === 'out' ? 1 : 0;
    const outB = b.status === 'out' ? 1 : 0;
    if (outA !== outB) return outA - outB;
    if (a.lap !== b.lap) return b.lap - a.lap;
    if (outA) return dist(b) - dist(a);
    if (a.status === 'finished' && b.status === 'finished') return key(a) - key(b);
    return dist(b) - dist(a);
  });
  const winner = cars[0]!;
  return cars.map((c, i) => ({
    id: c.id,
    position: i + 1,
    laps: Math.max(0, c.lap),
    timeS: c.status !== 'finished' ? null : i === 0 ? key(c) - LIGHTS_OUT_S : c.lap === winner.lap ? key(c) - key(winner) : null,
    lapsBehind: Math.max(0, winner.lap - c.lap),
    status: c.status === 'out' ? 'out' : 'finished',
    outReason: c.outReason,
    penaltyS: c.penaltyS,
    pitStops: c.pitStops,
    bestLapS: c.bestLapS,
  }));
}

/** Ejecuta la carrera entera sin interfaz (tests y calibración). */
export function runToEnd(race: Race, maxSimS = 4 * 3600): Race {
  const maxTicks = Math.ceil(maxSimS / race.config.dt);
  for (let i = 0; i < maxTicks && !race.state.finished; i++) step(race);
  return race;
}

export { sampleIndex };
export type { Compound };
