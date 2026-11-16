/**
 * Planificador de estrategia: estima el tiempo total de cada plan de paradas
 * con el mismo modelo de neumáticos que usa la carrera, sin tráfico ni safety car.
 */
import { compoundOffset, DRY, wearLoss, wearPerLap } from './tyres.ts';
import type { Compound, DryCompound, Stint, StrategyPlan } from './types.ts';

export interface StrategyContext {
  laps: number;
  lengthKm: number;
  circuitWear: number;
  pitLossS: number;
  refLapS: number;
  carTyreWear: number;
  tyreManagement: number;
}

/** Tiempo medio parado en una parada normal, en segundos. */
export const STATIONARY_S = 2.6;
/** Vueltas de más que pierde una parada frente a rodar (para elegir compuesto en paradas no planeadas). */
const OUT_LAP_LOSS = 0.012;

/** Combustible: kilos por kilómetro y segundos por kilo en una vuelta de 90 s. */
export const FUEL_KG_PER_KM = 0.245;
export const FUEL_S_PER_KG = 0.033;

export const fuelForRace = (laps: number, lengthKm: number) => (laps + 1) * lengthKm * FUEL_KG_PER_KM;
export const fuelLossS = (fuelKg: number, refLapS: number) => fuelKg * FUEL_S_PER_KG * (refLapS / 90);

/** Tiempo de un stint de `laps` vueltas con ese compuesto (sin combustible, que es igual para todos los planes). */
function stintTime(ctx: StrategyContext, compound: Compound, laps: number): number {
  const wpl = wearPerLap(compound, ctx.lengthKm, ctx.circuitWear, ctx.carTyreWear, ctx.tyreManagement);
  let total = 0;
  for (let j = 0; j < laps; j++) total += ctx.refLapS * (1 + compoundOffset(compound) + wearLoss((j + 0.5) * wpl));
  return total + ctx.refLapS * OUT_LAP_LOSS;
}

function planTime(ctx: StrategyContext, stints: Stint[]): number {
  let total = (stints.length - 1) * (ctx.pitLossS + STATIONARY_S);
  for (const s of stints) total += stintTime(ctx, s.compound, s.laps);
  return total;
}

/** Reparte las vueltas entre los stints y afina moviendo vueltas de uno a otro mientras mejore. */
function optimise(ctx: StrategyContext, compounds: DryCompound[]): StrategyPlan | null {
  const k = compounds.length;
  if (ctx.laps < k * 3) return null;
  const life = compounds.map((c) => 1 / wearPerLap(c, ctx.lengthKm, ctx.circuitWear, ctx.carTyreWear, ctx.tyreManagement));
  const lifeSum = life.reduce((a, b) => a + b, 0);
  const laps = life.map((l) => Math.max(3, Math.round((l / lifeSum) * ctx.laps)));
  laps[k - 1] = laps[k - 1]! + ctx.laps - laps.reduce((a, b) => a + b, 0);
  if (laps[k - 1]! < 3) return null;

  const build = () => compounds.map((compound, i) => ({ compound, laps: laps[i]! }));
  let best = planTime(ctx, build());
  for (let improved = true; improved; ) {
    improved = false;
    for (let a = 0; a < k; a++) {
      for (let b = 0; b < k; b++) {
        if (a === b || laps[a]! <= 3) continue;
        laps[a] = laps[a]! - 1;
        laps[b] = laps[b]! + 1;
        const time = planTime(ctx, build());
        if (time < best - 1e-6) {
          best = time;
          improved = true;
        } else {
          laps[a] = laps[a]! + 1;
          laps[b] = laps[b]! - 1;
        }
      }
    }
  }
  return { stints: build(), stops: k - 1, estTimeS: best };
}

function sequences(length: number): DryCompound[][] {
  let out: DryCompound[][] = [[]];
  for (let i = 0; i < length; i++) out = out.flatMap((seq) => DRY.map((c) => [...seq, c]));
  // En seco hay que usar al menos dos compuestos distintos.
  return out.filter((seq) => new Set(seq).size >= 2);
}

/** Planes de 1, 2 y 3 paradas, del más rápido al más lento. */
export function planOptions(ctx: StrategyContext, perStopCount = 2): StrategyPlan[] {
  const out: StrategyPlan[] = [];
  for (const stops of [1, 2, 3]) {
    const plans = sequences(stops + 1)
      .map((seq) => optimise(ctx, seq))
      .filter((p): p is StrategyPlan => p !== null)
      .sort((a, b) => a.estTimeS - b.estTimeS);
    out.push(...plans.slice(0, perStopCount));
  }
  return out.sort((a, b) => a.estTimeS - b.estTimeS);
}

/** Compuesto de seco más rápido para llegar a meta con `lapsLeft` vueltas sin volver a parar. */
export function bestCompoundToEnd(ctx: StrategyContext, lapsLeft: number, avoid?: DryCompound): DryCompound {
  let best: DryCompound = 'hard';
  let bestTime = Infinity;
  for (const c of DRY) {
    if (c === avoid) continue;
    const time = stintTime(ctx, c, lapsLeft);
    if (time < bestTime) {
      bestTime = time;
      best = c;
    }
  }
  return best;
}
