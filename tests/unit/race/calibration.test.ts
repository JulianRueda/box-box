import { describe, expect, it } from 'vitest';
import { raceFacts } from '../../../src/data/index.ts';
import { calibrateRound } from '../../../src/engine/race/calibration.ts';
import { dryFastestLap } from '../../../src/engine/race/setup.ts';
import { MONZA, SEPANG, setupInput } from './helpers.ts';

/**
 * Versión rápida de `npm run calibrate` (que hace 200 simulaciones de todos los GP):
 * aquí, 20 simulaciones de los dos circuitos de referencia de la Fase 2.
 */
describe.each([
  ['Monza', MONZA],
  ['Sepang', SEPANG],
])('calibración rápida: %s', (_name, round) => {
  const stats = calibrateRound(setupInput(round), 20);
  const real = raceFacts.find((f) => f.round === round)!;

  it('la vuelta rápida queda dentro del ±1,5 % de la real', () => {
    const error = stats.fastestLapS / dryFastestLap(real) - 1;
    expect(Math.abs(error)).toBeLessThan(0.015);
  });

  it('el número de paradas es razonable', () => {
    expect(stats.stops).toBeGreaterThanOrEqual(1);
    expect(stats.stops).toBeLessThan(3);
  });

  it('hay adelantamientos, pero no un caos', () => {
    expect(stats.overtakes).toBeGreaterThan(10);
    expect(stats.overtakes).toBeLessThan(140);
  });

  it('abandona una parte creíble de la parrilla', () => {
    expect(stats.retirements).toBeGreaterThan(1);
    expect(stats.retirements).toBeLessThan(8);
  });
});
