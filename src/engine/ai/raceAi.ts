/**
 * Decisiones de carrera de los equipos rivales (y consejos del ingeniero al jugador).
 *
 * La IA recibe un `AiView`: lo mismo que ve el jugador en pantalla. No tiene
 * acceso al plan real de lluvia ni a las averías futuras, solo al pronóstico.
 */
import { rand, type RngHolder } from '../rng.ts';
import { bestCompoundToEnd, planOptions, type StrategyContext } from '../race/strategy.ts';
import { CLIFF, isDry, wearPerLap } from '../race/tyres.ts';
import type { CarSetup, CarState, Command, Compound, DryCompound, EnergyMode, Flag, ForecastSlot, Level, Stint, StrategyPlan } from '../race/types.ts';

export interface AiView {
  car: CarState;
  setup: CarSetup;
  ctx: StrategyContext;
  totalLaps: number;
  flag: Flag;
  wetness: number;
  rain: number;
  forecast: ForecastSlot[];
  /** Tiempo por vuelta de referencia, para convertir segundos en vueltas. */
  refLapS: number;
  /** El coche de delante paró en la vuelta anterior. */
  aheadJustPitted: boolean;
  /** Segundos con el coche de detrás, o null. */
  behindS: number | null;
}

/** Elige plan antes de la carrera: casi siempre el mejor, con más dispersión cuanto peor es el estratega. */
export function pickPlan(rng: RngHolder, ctx: StrategyContext, strategist: number): StrategyPlan {
  const options = planOptions(ctx).slice(0, 4);
  const best = options[0]!;
  const spread = 3 + (100 - strategist) * 0.3;
  const weights = options.map((o) => Math.exp(-(o.estTimeS - best.estTimeS) / spread));
  let roll = rand(rng) * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < options.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return options[i]!;
  }
  return best;
}

const usedDry = (car: CarState): Set<DryCompound> => new Set(car.stints.map((s) => s.compound).filter(isDry));

/** Vuelta (contando desde 1) en la que toca la próxima parada según el plan, o null si no quedan. */
export function nextPlannedStop(car: CarState): number | null {
  if (car.planIndex >= car.plan.stints.length - 1) return null;
  let lap = car.planBaseLap;
  for (let i = 0; i <= car.planIndex; i++) lap += car.plan.stints[i]!.laps;
  return lap;
}

/**
 * Plan para lo que queda de carrera tras una parada no prevista (safety car, lluvia, pinchazo).
 * Un stint si el compuesto llega a meta; si no, dos.
 */
export function replan(ctx: StrategyContext, lapsLeft: number, compound: Compound, used: Set<DryCompound>): Stint[] {
  if (!isDry(compound) || lapsLeft <= 1) return [{ compound, laps: Math.max(1, lapsLeft) }];
  const all = new Set(used).add(compound);
  const reach = (0.9 / wearPerLap(compound, ctx.lengthKm, ctx.circuitWear, ctx.carTyreWear, ctx.tyreManagement)) | 0;
  // Con un solo compuesto de seco usado hay que parar otra vez para cumplir la norma.
  if (lapsLeft <= reach && all.size >= 2) return [{ compound, laps: lapsLeft }];
  const first = Math.max(2, Math.min(lapsLeft - 2, Math.round(Math.min(reach * 0.85, lapsLeft * 0.55))));
  const second = lapsLeft - first;
  return [
    { compound, laps: first },
    { compound: bestCompoundToEnd(ctx, second, all.size >= 2 ? undefined : compound), laps: second },
  ];
}

/** Compuesto para la parada que se va a hacer ahora. */
function compoundForStop(v: AiView, lapsLeft: number, onPlan: boolean): Compound {
  const { car, ctx } = v;
  const next = car.plan.stints[car.planIndex + 1];
  if (onPlan && next) return next.compound;
  const used = usedDry(car);
  const current = car.tyre.compound;
  // Si solo ha usado un compuesto de seco, el siguiente tiene que ser otro.
  const avoid = used.size === 1 && isDry(current) ? current : undefined;
  return bestCompoundToEnd(ctx, lapsLeft, avoid);
}

/** Órdenes que daría el muro en este momento. Se llama una vez por vuelta, antes de la entrada a boxes. */
export function decide(v: AiView, rng: RngHolder): Command[] {
  const { car, setup, ctx } = v;
  const out: Command[] = [];
  if (car.status !== 'racing') return out;
  const id = car.id;
  const lapNow = car.lap + 1;
  const lapsLeft = v.totalLaps - lapNow;
  const compound = car.tyre.compound;
  const slick = isDry(compound);
  const neutralised = v.flag === 'sc' || v.flag === 'vsc';
  const pit = (c: Compound) => out.push({ type: 'pit', id, compound: c, frontWing: car.damage > 0.3 });

  if (!car.pitRequest && lapsLeft >= 1) {
    const rainSoon = (v.forecast[0]?.rainChance ?? 0) >= 0.75;

    // --- Neumático adecuado para el agua que hay
    if (slick && v.wetness > car.wetThreshold) pit(v.wetness > 0.75 ? 'wet' : 'inter');
    else if (compound === 'inter' && v.wetness > 0.8) pit('wet');
    else if (compound === 'wet' && v.wetness < 0.6) pit(v.wetness < 0.12 ? compoundForStop(v, lapsLeft, false) : 'inter');
    else if (compound === 'inter' && v.wetness < 0.1 && v.rain === 0 && !rainSoon && lapsLeft >= 2) pit(compoundForStop(v, lapsLeft, false));
    // --- Pinchazo o alerón roto
    else if (car.puncture || car.damage > 0.3) pit(slick ? compound : compound);
    // --- Estrategia en seco
    else if (slick && lapsLeft >= 2) {
      const wpl = wearPerLap(compound, ctx.lengthKm, ctx.circuitWear, ctx.carTyreWear, ctx.tyreManagement);
      const wearAtEnd = car.tyre.wear + lapsLeft * wpl;
      const stop = nextPlannedStop(car);
      const toStop = stop === null ? null : stop - lapNow;
      const stintLaps = car.plan.stints[car.planIndex]?.laps ?? 20;
      const stuckLaps = car.stuckS / v.refLapS;

      if (car.tyre.wear > CLIFF + 0.04 && wearAtEnd > 0.92) {
        pit(compoundForStop(v, lapsLeft, toStop !== null && toStop <= 3));
      } else if (toStop !== null && toStop <= 0) {
        // Overcut: si el de delante acaba de parar y las gomas aguantan, se alarga una vez.
        const overcut = v.aheadJustPitted && !car.extended && car.tyre.wear < CLIFF - 0.12 && !rainSoon;
        if (overcut) car.extended = true;
        else if (!(rainSoon && car.tyre.wear < CLIFF)) pit(compoundForStop(v, lapsLeft, true));
      } else if (toStop !== null && toStop <= 4 && stuckLaps >= 2 && rand(rng) < 0.25 + setup.strategist / 200) {
        // Undercut: atascado detrás de otro y ya dentro de la ventana.
        pit(compoundForStop(v, lapsLeft, true));
      } else if (neutralised && lapsLeft >= 4) {
        const cheapStop = toStop !== null ? toStop <= Math.max(6, stintLaps * 0.4) : car.tyre.wear > 0.42 && wearAtEnd > 0.8;
        if (cheapStop && rand(rng) < 0.55 + setup.strategist / 250) pit(compoundForStop(v, lapsLeft, toStop !== null && toStop <= 3));
      }
    }
  }

  // --- Ritmo y energía
  const attacking = car.position > 1 && car.intervalS !== null && car.intervalS < 1.3;
  const defending = v.behindS !== null && v.behindS < 0.9;
  const freshStop = car.lastPitLap > 0 && lapNow - car.lastPitLap <= 2;
  let pace: Level = 'standard';
  if (!neutralised) {
    const wpl = wearPerLap(compound, ctx.lengthKm, ctx.circuitWear, ctx.carTyreWear, ctx.tyreManagement);
    const stop = nextPlannedStop(car);
    const lapsOnTyre = (stop ?? v.totalLaps) - lapNow;
    const short = car.tyre.wear + lapsOnTyre * wpl > CLIFF + 0.1;
    if (short && !attacking) pace = 'conserve';
    else if (attacking || freshStop) pace = 'push';
  }
  if (pace !== car.paceMode) out.push({ type: 'pace', id, value: pace });

  let energy: EnergyMode = 'balanced';
  if (car.soc < 0.18) energy = 'save';
  else if ((attacking || defending) && car.soc > 0.45 && !neutralised) energy = 'attack';
  if (energy !== car.energyMode) out.push({ type: 'energy', id, value: energy });

  return out;
}
