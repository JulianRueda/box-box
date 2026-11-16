/**
 * Modelo de pista: convierte la polilínea del circuito en un perfil de velocidad.
 *
 * La forma del perfil (dónde se va despacio y dónde rápido) sale de la curvatura
 * del trazado. El tiempo por vuelta NO sale de aquí: lo fija la vuelta de referencia
 * real del circuito. El perfil solo reparte ese tiempo a lo largo de la vuelta.
 */
import type { TrackInput } from './types.ts';

export interface Track {
  input: TrackInput;
  /** Número de muestras del trazado. */
  n: number;
  lengthM: number;
  /** Fracción del tiempo por vuelta que se tarda en recorrer cada muestra. Suma 1. */
  tau: Float64Array;
  /** Acumulado de tau: cum[i] = fracción de tiempo hasta el inicio de la muestra i. cum[n] = 1. */
  cum: Float64Array;
  /** Velocidad de referencia en cada muestra, km/h (para mostrar y para detectar frenadas). */
  speedKmh: Float64Array;
  /** 1 si en esa muestra se está frenando (se recupera energía). */
  braking: Uint8Array;
}

const V_MAX = 91; // m/s ≈ 328 km/h
const V_MIN = 17; // m/s ≈ 61 km/h
const A_LAT = 36; // m/s², agarre lateral medio con carga aerodinámica
const A_BRAKE = 40;
const A_ACCEL = 10.5;

export function buildTrack(input: TrackInput): Track {
  const pts = input.track;
  const n = pts.length;
  const seg = new Float64Array(n);
  let perimeter = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % n]!;
    seg[i] = Math.hypot(b[0] - a[0], b[1] - a[1]);
    perimeter += seg[i]!;
  }
  const lengthM = input.lengthKm * 1000;
  const scale = lengthM / perimeter;

  // Curvatura: cambio de rumbo por metro, suavizada porque el trazado público es ruidoso.
  const heading = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % n]!;
    heading[i] = Math.atan2(b[1] - a[1], b[0] - a[0]);
  }
  const raw = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let d = heading[i]! - heading[(i - 1 + n) % n]!;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    raw[i] = Math.abs(d) / (seg[i]! * scale);
  }
  const v = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const k = (raw[(i - 1 + n) % n]! + 2 * raw[i]! + raw[(i + 1) % n]!) / 4;
    v[i] = Math.min(V_MAX, Math.max(V_MIN, Math.sqrt(A_LAT / Math.max(k, 1e-5))));
  }
  // Límite de frenada (hacia atrás) y de aceleración (hacia delante), dos vueltas para cerrar el bucle.
  for (let pass = 0; pass < 2; pass++) {
    for (let i = n - 1; i >= 0; i--) {
      const next = v[(i + 1) % n]!;
      v[i] = Math.min(v[i]!, Math.sqrt(next * next + 2 * A_BRAKE * seg[i]! * scale));
    }
    for (let i = 0; i < n; i++) {
      const prev = v[(i - 1 + n) % n]!;
      v[i] = Math.min(v[i]!, Math.sqrt(prev * prev + 2 * A_ACCEL * seg[(i - 1 + n) % n]! * scale));
    }
  }

  const tau = new Float64Array(n);
  let total = 0;
  for (let i = 0; i < n; i++) {
    tau[i] = (seg[i]! * scale) / v[i]!;
    total += tau[i]!;
  }
  const cum = new Float64Array(n + 1);
  const speedKmh = new Float64Array(n);
  const braking = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    tau[i] = tau[i]! / total;
    cum[i + 1] = cum[i]! + tau[i]!;
    speedKmh[i] = v[i]! * 3.6;
    braking[i] = v[(i + 1) % n]! < v[i]! - 0.5 ? 1 : 0;
  }
  cum[n] = 1;
  return { input, n, lengthM, tau, cum, speedKmh, braking };
}

const wrap = (s: number) => s - Math.floor(s);

/** Fracción del tiempo por vuelta transcurrida al llegar a la posición s (0–1). */
export function timeFraction(track: Track, s: number): number {
  const x = wrap(s) * track.n;
  const i = Math.min(track.n - 1, Math.floor(x));
  return track.cum[i]! + (x - i) * track.tau[i]!;
}

/** Fracción del tiempo por vuelta entre dos posiciones, yendo hacia delante desde `from`. */
export function timeBetween(track: Track, from: number, to: number): number {
  const d = timeFraction(track, to) - timeFraction(track, from);
  return d < 0 ? d + 1 : d;
}

/** Fracción de vuelta por segundo en la posición s para un coche con tiempo por vuelta lapS. */
export function progressRate(track: Track, s: number, lapS: number): number {
  const i = Math.min(track.n - 1, Math.floor(wrap(s) * track.n));
  return 1 / (track.n * track.tau[i]! * lapS);
}

export function sampleIndex(track: Track, s: number): number {
  return Math.min(track.n - 1, Math.floor(wrap(s) * track.n));
}

/** ¿Está s dentro del tramo [from, to]? Admite tramos que cruzan la meta (from > to). */
export function inSpan(s: number, from: number, to: number): boolean {
  const x = wrap(s);
  return from <= to ? x >= from && x <= to : x >= from || x <= to;
}

/** Índice de la zona de Overtake Mode que contiene s, o -1. */
export function zoneAt(track: Track, s: number): number {
  const zones = track.input.overtakeZones;
  for (let i = 0; i < zones.length; i++) if (inSpan(s, zones[i]![0], zones[i]![1])) return i;
  return -1;
}
