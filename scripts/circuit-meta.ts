/**
 * Metadatos por circuito que no vienen en el GeoJSON.
 *
 * `geo` y `clockwise` son hechos (id del archivo en bacinger/f1-circuits y sentido de giro).
 * El resto son PARÁMETROS DE JUEGO ESTIMADOS a mano (escala 0–100 o probabilidad 0–1):
 * no hay una fuente oficial para ellos y se recalibrarán en la Fase 2 contra tiempos reales.
 */
export interface CircuitMeta {
  geo: string;
  /** null = trazado en ocho (Suzuka): no se puede comprobar con el área con signo. */
  clockwise: boolean | null;
  /** Vueltas programadas; solo se usa si la carrera de 2026 aún no se ha corrido. */
  laps: number;
  downforceLevel: 'low' | 'medium' | 'high';
  tyreWear: number;
  overtakingDifficulty: number;
  safetyCarProbability: number;
  rainProbability: number;
  pitLossS: number;
}

const m = (
  geo: string,
  clockwise: boolean | null,
  laps: number,
  downforceLevel: CircuitMeta['downforceLevel'],
  tyreWear: number,
  overtakingDifficulty: number,
  safetyCarProbability: number,
  rainProbability: number,
  pitLossS: number,
): CircuitMeta => ({ geo, clockwise, laps, downforceLevel, tyreWear, overtakingDifficulty, safetyCarProbability, rainProbability, pitLossS });

/** Clave = circuitId de Jolpica. */
export const CIRCUIT_META: Record<string, CircuitMeta> = {
  albert_park: m('au-1953', true, 58, 'medium', 45, 60, 0.55, 0.2, 20),
  shanghai: m('cn-2004', true, 56, 'medium', 50, 40, 0.35, 0.25, 23),
  suzuka: m('jp-1962', null, 53, 'high', 55, 70, 0.4, 0.3, 22),
  miami: m('us-2022', false, 57, 'medium', 42, 50, 0.5, 0.3, 21),
  villeneuve: m('ca-1978', true, 70, 'low', 40, 40, 0.65, 0.3, 18),
  monaco: m('mc-1929', true, 78, 'high', 25, 98, 0.6, 0.15, 20),
  catalunya: m('es-1991', true, 66, 'high', 75, 65, 0.25, 0.1, 22),
  red_bull_ring: m('at-1969', true, 71, 'medium', 55, 35, 0.4, 0.3, 20),
  silverstone: m('gb-1948', true, 52, 'high', 75, 45, 0.5, 0.35, 21),
  spa: m('be-1925', true, 44, 'low', 52, 30, 0.45, 0.45, 19),
  hungaroring: m('hu-1986', true, 70, 'high', 60, 80, 0.25, 0.2, 21),
  zandvoort: m('nl-1948', true, 72, 'high', 65, 80, 0.5, 0.4, 19),
  monza: m('it-1922', true, 53, 'low', 40, 35, 0.45, 0.15, 24),
  madring: m('es-2026', true, 57, 'medium', 42, 60, 0.5, 0.1, 21),
  baku: m('az-2016', false, 51, 'low', 40, 40, 0.6, 0.05, 20),
  sepang: m('my-1999', true, 56, 'medium', 75, 40, 0.3, 0.5, 22),
  marina_bay: m('sg-2008', false, 62, 'high', 38, 80, 0.85, 0.3, 27),
  americas: m('us-2012', false, 56, 'medium', 52, 40, 0.35, 0.1, 21),
  rodriguez: m('mx-1962', true, 71, 'high', 50, 55, 0.4, 0.15, 22),
  interlagos: m('br-1940', false, 71, 'medium', 55, 30, 0.6, 0.45, 20),
  vegas: m('us-2023', false, 50, 'low', 40, 35, 0.5, 0.03, 20),
  losail: m('qa-2004', true, 57, 'high', 80, 55, 0.35, 0.01, 25),
  yas_marina: m('ae-2009', false, 58, 'medium', 50, 55, 0.3, 0.01, 21),
};
