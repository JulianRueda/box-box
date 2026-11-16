/**
 * Modelo de neumáticos: vida útil, pérdida de ritmo por desgaste (con acantilado),
 * calentamiento y comportamiento según el agua en pista.
 * Todo son parámetros de juego ajustados con scripts/calibrate.ts.
 */
import type { Compound, DryCompound, TyreState } from './types.ts';

export const DRY: DryCompound[] = ['soft', 'medium', 'hard'];
export const isDry = (c: Compound): c is DryCompound => c === 'soft' || c === 'medium' || c === 'hard';

/** Kilómetros hasta desgaste 1 en un circuito de desgaste medio (50). */
const LIFE_KM: Record<Compound, number> = { soft: 132, medium: 200, hard: 280, inter: 160, wet: 180 };

/** Pérdida de ritmo frente al blando nuevo, en seco (fracción del tiempo por vuelta). */
const OFFSET: Record<Compound, number> = { soft: 0, medium: 0.0055, hard: 0.0105, inter: 0.075, wet: 0.13 };

/** Segundos que tarda en llegar a temperatura al salir de boxes. */
const WARMUP_S: Record<Compound, number> = { soft: 22, medium: 36, hard: 55, inter: 25, wet: 30 };

/** Desgaste a partir del cual el neumático cae por el acantilado. */
export const CLIFF = 0.72;

export function newTyre(compound: Compound): TyreState {
  return { compound, wear: 0, age: 0, heat: 0.55, thermal: 0, graining: 0 };
}

/**
 * Desgaste por vuelta (0–1).
 * @param circuitWear desgaste del circuito 0–100
 * @param carTyre cuidado de neumáticos del coche 0–100
 * @param driverTyre gestión de neumáticos del piloto 0–100
 */
export function wearPerLap(compound: Compound, lengthKm: number, circuitWear: number, carTyre: number, driverTyre: number): number {
  const circuit = Math.pow(50 / Math.max(circuitWear, 10), 0.6);
  const car = 0.85 + 0.3 * (carTyre / 100);
  const driver = 0.88 + 0.24 * (driverTyre / 100);
  return lengthKm / (LIFE_KM[compound] * circuit * car * driver);
}

/** Vueltas hasta el acantilado para ese coche y circuito. */
export function lapsToCliff(compound: Compound, lengthKm: number, circuitWear: number, carTyre: number, driverTyre: number): number {
  return CLIFF / wearPerLap(compound, lengthKm, circuitWear, carTyre, driverTyre);
}

/** Pérdida de ritmo por desgaste: lineal y, pasado el acantilado, cuadrática. */
export function wearLoss(wear: number): number {
  const over = Math.max(0, wear - CLIFF);
  return 0.011 * wear + 1.9 * over * over;
}

export const compoundOffset = (compound: Compound) => OFFSET[compound];

/**
 * Pérdida de ritmo por el agua en pista según el compuesto (fracción del tiempo por vuelta).
 * Cruces aproximados: seco → intermedio con 0,15 de agua; intermedio → lluvia con 0,75.
 */
export function wetLoss(compound: Compound, wetness: number): number {
  if (isDry(compound)) return wetness < 0.03 ? 0 : 0.02 + 0.36 * wetness;
  if (compound === 'inter') return -0.03 * (Math.min(wetness, 0.4) / 0.4) + 0.35 * Math.max(0, wetness - 0.55);
  return -0.02 * Math.min(wetness, 0.8);
}

/** Multiplicador de desgaste por rodar con neumático de agua sobre pista seca. */
export function wetTyreWearFactor(compound: Compound, wetness: number): number {
  return isDry(compound) ? 1 : 1 + 3 * Math.max(0, 0.5 - wetness);
}

/** Pérdida de ritmo por neumático frío. */
export const heatLoss = (tyre: TyreState) => (1 - tyre.heat) * 0.03 + (tyre.graining > 0 ? 0.004 : 0);

/** Avanza el calentamiento del neumático durante dt segundos. */
export function warmUp(tyre: TyreState, dt: number, trackTempC: number): void {
  const tempFactor = 1 + (trackTempC - 35) / 80;
  tyre.heat = Math.min(1, tyre.heat + (dt / WARMUP_S[tyre.compound]) * 0.45 * tempFactor);
}

/** Compuesto de agua adecuado para ese nivel de agua, o null si toca seco. */
export function wetCompoundFor(wetness: number): Compound | null {
  if (wetness >= 0.75) return 'wet';
  if (wetness >= 0.15) return 'inter';
  return null;
}
