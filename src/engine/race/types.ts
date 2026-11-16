/** Tipos del motor de carrera. Sin React ni DOM. */

export type DryCompound = 'soft' | 'medium' | 'hard';
export type Compound = DryCompound | 'inter' | 'wet';
/** Ritmo del piloto y modo de motor comparten la misma escala de cuatro niveles. */
export type Level = 'conserve' | 'standard' | 'push' | 'max';
export type EnergyMode = 'save' | 'balanced' | 'attack' | 'overtake';
export type Flag = 'green' | 'yellow' | 'vsc' | 'sc';
export type CarStatus = 'grid' | 'racing' | 'pit' | 'out' | 'finished';
export type TeamOrder = 'free' | 'hold' | 'letBy';

export interface Stint {
  compound: Compound;
  laps: number;
}

export interface StrategyPlan {
  stints: Stint[];
  stops: number;
  /** Tiempo total estimado en segundos, sin tráfico ni safety car. */
  estTimeS: number;
}

/** Datos fijos de un coche durante la carrera (0–100 salvo indicación). */
export interface CarSetup {
  /** driverId. */
  id: string;
  code: string;
  number: number | null;
  teamId: string;
  color: string;
  /** Diferencia de ritmo del coche con el de referencia en este circuito (fracción del tiempo por vuelta). */
  carGap: number;
  racePace: number;
  tyreManagement: number;
  overtaking: number;
  defending: number;
  wetWeather: number;
  consistency: number;
  energyManagement: number;
  carTyreWear: number;
  reliability: number;
  energyDeployment: number;
  pitCrew: number;
  strategist: number;
  /** true = lo controla el jugador (salvo que active la estrategia automática). */
  player: boolean;
}

export interface TrackInput {
  id: string;
  lengthKm: number;
  track: [number, number][];
  sectors: [number, number];
  overtakeZones: [number, number][];
  pit: { entry: number; exit: number; timeLossS: number };
  tyreWear: number;
  overtakingDifficulty: number;
  safetyCarProbability: number;
  rainProbability: number;
}

export interface RaceConfig {
  seed: number;
  /** Paso de simulación en segundos. Misma semilla + mismo dt + mismas órdenes = misma carrera. */
  dt: number;
  circuit: TrackInput;
  laps: number;
  /** Vuelta de referencia en carrera (coche y piloto de referencia, neumático nuevo, sin combustible). */
  refLapS: number;
  /** Orden de parrilla: cars[0] sale primero. */
  cars: CarSetup[];
  /** 'dry' fuerza carrera seca; 'auto' sortea la lluvia según el circuito. */
  weather: 'auto' | 'dry';
  /** Plan elegido por el jugador para sus coches (clave = id). El resto lo decide la IA. */
  plans?: Record<string, StrategyPlan>;
}

export interface TyreState {
  compound: Compound;
  /** 0 = nuevo, 1 = destruido. El acantilado empieza hacia 0,72. */
  wear: number;
  /** Vueltas completadas con este juego. */
  age: number;
  /** 0 = frío, 1 = en ventana. */
  heat: number;
  /** 0 = normal, 1 = sobrecalentado. */
  thermal: number;
  /** Vueltas restantes de graining (pérdida temporal de agarre). */
  graining: number;
}

export interface StintRecord {
  compound: Compound;
  startLap: number;
  endLap: number | null;
}

export interface CarState {
  id: string;
  status: CarStatus;
  /** Vueltas completadas. -1 en la parrilla, antes de cruzar la línea por primera vez. */
  lap: number;
  /** Posición en la vuelta, 0–1. */
  s: number;
  /** Fracción de vuelta por segundo en el último paso (para interpolar el mapa). */
  rate: number;
  tyre: TyreState;
  stints: StintRecord[];
  fuelKg: number;
  /** Estado de carga de la batería, 0–1. */
  soc: number;
  clipping: boolean;
  /** Daño del coche, 0–1. Por encima de 0,3 hay que cambiar el alerón. */
  damage: number;
  paceMode: Level;
  engineMode: Level;
  energyMode: EnergyMode;
  defend: boolean;
  teamOrder: TeamOrder;
  autoStrategy: boolean;
  pitRequest: { compound: Compound; frontWing: boolean } | null;
  /** Segundos que faltan para salir del pit lane (status 'pit'). */
  pitTimer: number;
  pitTotal: number;
  pitCountedLap: boolean;
  pitStops: number;
  lastPitLap: number;
  plan: StrategyPlan;
  planIndex: number;
  /** Vuelta en la que empezó a contar el plan vigente (cambia al replanificar). */
  planBaseLap: number;
  /** Umbral de mojado con el que su estratega pide intermedios (calidad del estratega). */
  wetThreshold: number;
  extended: boolean;
  launchAt: number;
  lapStartT: number;
  lastLapS: number | null;
  bestLapS: number | null;
  sectorStartT: number;
  sector: number;
  lastSectors: (number | null)[];
  bestSectors: (number | null)[];
  /** Factor de ruido de la vuelta en curso (consistencia del piloto). */
  lapNoise: number;
  /** Tiempo por vuelta potencial en este instante, en segundos. */
  potentialS: number;
  /** Segundos de retraso pendientes de absorber (errores, trompos, adelantamientos fallidos). */
  pendingLossS: number;
  position: number;
  gapToLeaderS: number | null;
  intervalS: number | null;
  lapsBehind: number;
  heldBy: string | null;
  stuckS: number;
  attemptCooldownS: number;
  overtakeActive: boolean;
  /** Final de la zona de Overtake Mode en curso (fracción de vuelta), o -1. */
  overtakeUntil: number;
  puncture: boolean;
  penaltyS: number;
  finishT: number | null;
  outReason: 'crash' | 'mechanical' | 'fuel' | null;
  adviceLap: number;
}

export interface WeatherSegment {
  fromS: number;
  toS: number;
  intensity: number;
}

export interface WeatherState {
  /** Intensidad de lluvia ahora, 0–1. */
  rain: number;
  /** Agua en pista, 0–1. */
  wetness: number;
  trackTempC: number;
  /** Lo que va a pasar. La IA y el jugador NO lo ven: solo ven `forecast`. */
  plan: WeatherSegment[];
  /** true si en algún momento la pista estuvo mojada (exime de usar dos compuestos de seco). */
  everWet: boolean;
}

export type RaceEvent =
  | { t: number; type: 'start' }
  | { t: number; type: 'overtake'; by: string; on: string; position: number }
  | { t: number; type: 'pit'; id: string; compound: Compound; stationaryS: number; slow: boolean; lap: number }
  | { t: number; type: 'incident'; id: string; kind: 'lockup' | 'spin' | 'crash' | 'mechanical' | 'puncture' | 'contact' | 'fuel' | 'blistering' | 'graining' }
  | { t: number; type: 'flag'; flag: Flag }
  | { t: number; type: 'fastestLap'; id: string; timeS: number }
  | { t: number; type: 'weather'; kind: 'rainStart' | 'rainStop' | 'trackDry' }
  | { t: number; type: 'advice'; id: string; code: 'box' | 'boxWet' | 'planB' | 'tyresGone' | 'saveBattery'; compound?: Compound }
  | { t: number; type: 'penalty'; id: string; seconds: number; reason: 'twoCompounds' }
  | { t: number; type: 'chequered'; id: string }
  | { t: number; type: 'finished' };

export interface SafetyCarState {
  /** Vueltas del líder que quedan con el coche de seguridad en pista. */
  lapsLeft: number;
  /** Distancia total (vuelta + fracción) del coche de seguridad. */
  dist: number;
}

export interface RaceState {
  rng: number;
  t: number;
  tick: number;
  flag: Flag;
  /** Fin de un VSC o de una amarilla, en segundos de carrera. */
  flagUntilT: number;
  safetyCar: SafetyCarState | null;
  weather: WeatherState;
  cars: CarState[];
  /** ids en orden de carrera. */
  order: string[];
  leaderLap: number;
  /** El líder ha visto la bandera a cuadros: cada coche termina al cruzar la meta. */
  chequered: boolean;
  finished: boolean;
  fastestLap: { id: string; timeS: number } | null;
  bestSectors: (number | null)[];
  overtakes: number;
  events: RaceEvent[];
}

export type Command =
  | { type: 'pit'; id: string; compound: Compound; frontWing?: boolean }
  | { type: 'cancelPit'; id: string }
  | { type: 'pace'; id: string; value: Level }
  | { type: 'engine'; id: string; value: Level }
  | { type: 'energy'; id: string; value: EnergyMode }
  | { type: 'defend'; id: string; value: boolean }
  | { type: 'teamOrder'; id: string; value: TeamOrder }
  | { type: 'auto'; id: string; value: boolean };

/** Orden con el instante en que se aplicó: el registro permite repetir la carrera. */
export interface LoggedCommand {
  tick: number;
  command: Command;
}

export interface ForecastSlot {
  /** Minutos desde ahora. */
  inMin: number;
  /** Probabilidad de lluvia 0–1 según el pronóstico (con incertidumbre). */
  rainChance: number;
}
