/**
 * Clima de carrera: lluvia que va y viene, agua en pista y pronóstico con incertidumbre.
 * El plan real de lluvia se sortea al crear la carrera; ni la IA ni el jugador lo ven.
 */
import { hash01, rand, randRange, type RngHolder } from '../rng.ts';
import type { ForecastSlot, WeatherSegment, WeatherState } from './types.ts';

/** Agua en pista a partir de la cual se considera que la carrera ha sido en mojado. */
const WET_DECLARED = 0.12;

export function createWeather(rng: RngHolder, rainProbability: number, durationS: number, mode: 'auto' | 'dry'): WeatherState {
  const plan: WeatherSegment[] = [];
  const trackTempC = Math.round(randRange(rng, 28, 44));
  // Los sorteos se hacen siempre, también en seco, para no desalinear el RNG entre modos.
  const rains = rand(rng) < rainProbability;
  const showers = rand(rng) < 0.35 ? 2 : 1;
  const draws = [0, 1].map(() => ({ start: rand(rng), length: rand(rng), intensity: rand(rng) }));
  if (mode === 'auto' && rains) {
    for (let i = 0; i < showers; i++) {
      const d = draws[i]!;
      // Puede empezar ya lloviendo (inicio negativo) o caer a mitad de carrera.
      const fromS = (d.start * 1.15 - 0.15) * durationS;
      const toS = fromS + (480 + d.length * 1500);
      plan.push({ fromS, toS, intensity: 0.3 + d.intensity * 0.7 });
    }
    plan.sort((a, b) => a.fromS - b.fromS);
  }
  const rain = rainAt(plan, 0);
  return { rain, wetness: rain > 0 ? Math.min(0.85, rain) : 0, trackTempC: rain > 0 ? trackTempC - 8 : trackTempC, plan, everWet: rain > 0 };
}

function rainAt(plan: WeatherSegment[], t: number): number {
  let rain = 0;
  for (const seg of plan) if (t >= seg.fromS && t < seg.toS) rain = Math.max(rain, seg.intensity);
  return rain;
}

/** Avanza el clima dt segundos. Devuelve el cambio ocurrido, si lo hubo. */
export function stepWeather(w: WeatherState, t: number, dt: number): 'rainStart' | 'rainStop' | 'trackDry' | null {
  const before = w.rain;
  const wetBefore = w.wetness;
  w.rain = rainAt(w.plan, t);
  if (w.rain > 0) {
    // La pista se moja hacia la intensidad de la lluvia, más rápido cuanto más llueve.
    w.wetness += (w.rain - w.wetness) * (0.004 + 0.012 * w.rain) * dt;
  } else {
    w.wetness = Math.max(0, w.wetness - 0.00055 * (1 + (w.trackTempC - 30) / 40) * dt);
  }
  if (w.wetness > WET_DECLARED) w.everWet = true;
  if (before === 0 && w.rain > 0) return 'rainStart';
  if (before > 0 && w.rain === 0) return 'rainStop';
  if (wetBefore >= 0.03 && w.wetness < 0.03) return 'trackDry';
  return null;
}

/**
 * Pronóstico para los próximos 30 minutos en tramos de 5.
 * Cuanto más lejos mira, más se mezcla la verdad con la probabilidad base y con ruido.
 */
export function forecast(w: WeatherState, t: number, seed: number, baseChance: number): ForecastSlot[] {
  const slots: ForecastSlot[] = [];
  const bucketNow = Math.floor(t / 300);
  for (let k = 1; k <= 6; k++) {
    const at = t + k * 300;
    const truth = rainAt(w.plan, at) > 0 || rainAt(w.plan, at - 150) > 0 ? 1 : 0;
    const blur = Math.min(0.75, k * 0.11);
    const noise = (hash01(seed, bucketNow + k, k) - 0.5) * 0.5 * blur;
    const chance = truth * (1 - blur) + baseChance * blur + noise;
    slots.push({ inMin: k * 5, rainChance: Math.round(Math.min(1, Math.max(0, chance)) * 20) / 20 });
  }
  return slots;
}
