import { describe, expect, it } from 'vitest';
import { findCircuit } from '../../../src/data/index.ts';
import { rand, seedFrom } from '../../../src/engine/rng.ts';
import { applyCommand, classification, createRace, runToEnd, step, type Race } from '../../../src/engine/race/sim.ts';
import { planOptions, type StrategyContext } from '../../../src/engine/race/strategy.ts';
import { buildTrack, timeBetween, timeFraction } from '../../../src/engine/race/track.ts';
import { CLIFF, lapsToCliff, wearLoss, wearPerLap, wetLoss } from '../../../src/engine/race/tyres.ts';
import type { LoggedCommand, RaceEvent } from '../../../src/engine/race/types.ts';
import { createWeather, forecast, stepWeather } from '../../../src/engine/race/weather.ts';
import { config, MONACO, MONZA, SEPANG } from './helpers.ts';

const summary = (race: Race) => classification(race).map((r) => `${r.position}:${r.id}:${r.laps}:${r.timeS?.toFixed(3) ?? r.outReason}:${r.pitStops}`).join('|');

describe('RNG', () => {
  it('con la misma semilla produce la misma secuencia', () => {
    const a = { rng: seedFrom('monza') };
    const b = { rng: seedFrom('monza') };
    expect(Array.from({ length: 5 }, () => rand(a))).toEqual(Array.from({ length: 5 }, () => rand(b)));
    expect(rand({ rng: 1 })).not.toBe(rand({ rng: 2 }));
  });
});

describe('pista', () => {
  const track = buildTrack(findCircuit('monza')!);

  it('reparte el tiempo de la vuelta entre las muestras', () => {
    expect(track.cum[track.n]).toBeCloseTo(1, 9);
    expect(Array.from(track.tau).every((x) => x > 0)).toBe(true);
    expect(timeFraction(track, 0)).toBe(0);
    expect(timeBetween(track, 0.9, 0.1)).toBeCloseTo(timeBetween(track, 0.9, 0.999999) + timeBetween(track, 0, 0.1), 4);
  });

  it('Monza tiene rectas muy rápidas y chicanes lentas', () => {
    expect(Math.max(...track.speedKmh)).toBeGreaterThan(300);
    expect(Math.min(...track.speedKmh)).toBeLessThan(130);
    expect(track.braking.some((b) => b === 1)).toBe(true);
  });
});

describe('neumáticos', () => {
  it('el blando dura menos que el medio y este menos que el duro', () => {
    const laps = (c: 'soft' | 'medium' | 'hard') => lapsToCliff(c, 5.8, 50, 75, 80);
    expect(laps('soft')).toBeLessThan(laps('medium'));
    expect(laps('medium')).toBeLessThan(laps('hard'));
  });

  it('un circuito abrasivo y un piloto brusco gastan más', () => {
    expect(wearPerLap('medium', 5, 80, 75, 80)).toBeGreaterThan(wearPerLap('medium', 5, 40, 75, 80));
    expect(wearPerLap('medium', 5, 50, 75, 60)).toBeGreaterThan(wearPerLap('medium', 5, 50, 75, 95));
  });

  it('la pérdida de ritmo es suave hasta el acantilado y luego se dispara', () => {
    const before = wearLoss(CLIFF) - wearLoss(CLIFF - 0.1);
    const after = wearLoss(CLIFF + 0.2) - wearLoss(CLIFF + 0.1);
    expect(after).toBeGreaterThan(before * 4);
    for (let w = 0; w < 1; w += 0.05) expect(wearLoss(w + 0.05)).toBeGreaterThan(wearLoss(w));
  });

  it('cada compuesto es el mejor en su rango de agua', () => {
    const total = (c: 'soft' | 'inter' | 'wet', w: number) => ({ soft: 0, inter: 0.075, wet: 0.13 })[c] + wetLoss(c, w);
    expect(total('soft', 0)).toBeLessThan(total('inter', 0));
    expect(total('inter', 0.4)).toBeLessThan(total('soft', 0.4));
    expect(total('inter', 0.4)).toBeLessThan(total('wet', 0.4));
    expect(total('wet', 0.95)).toBeLessThan(total('inter', 0.95));
  });
});

describe('planificador de estrategia', () => {
  const ctx = (circuitWear: number): StrategyContext => ({ laps: 60, lengthKm: 5, circuitWear, pitLossS: 21, refLapS: 90, carTyreWear: 75, tyreManagement: 80 });

  it('todos los planes completan la distancia con dos compuestos o más', () => {
    const plans = planOptions(ctx(55));
    expect(plans.length).toBeGreaterThanOrEqual(3);
    for (const p of plans) {
      expect(p.stints.reduce((a, s) => a + s.laps, 0)).toBe(60);
      expect(new Set(p.stints.map((s) => s.compound)).size).toBeGreaterThanOrEqual(2);
      expect(p.stops).toBe(p.stints.length - 1);
    }
    expect(plans.map((p) => p.estTimeS)).toEqual([...plans.map((p) => p.estTimeS)].sort((a, b) => a - b));
  });

  it('cuanto más desgaste, más paradas pide el plan óptimo', () => {
    expect(planOptions(ctx(30))[0]!.stops).toBeLessThanOrEqual(planOptions(ctx(90))[0]!.stops);
    expect(planOptions(ctx(95))[0]!.stops).toBeGreaterThanOrEqual(2);
  });
});

describe('clima', () => {
  it('en modo seco no llueve nunca', () => {
    const w = createWeather({ rng: 5 }, 1, 6000, 'dry');
    expect(w.plan).toEqual([]);
    expect(w.wetness).toBe(0);
  });

  it('la pista se moja cuando llueve y se seca después', () => {
    const w = createWeather({ rng: 1 }, 0, 6000, 'dry');
    w.plan = [{ fromS: 100, toS: 700, intensity: 0.8 }];
    const seen: string[] = [];
    let peak = 0;
    for (let t = 0; t < 4000; t += 1) {
      const change = stepWeather(w, t, 1);
      if (change) seen.push(change);
      peak = Math.max(peak, w.wetness);
    }
    expect(seen).toEqual(['rainStart', 'rainStop', 'trackDry']);
    expect(peak).toBeGreaterThan(0.5);
    expect(w.wetness).toBe(0);
    expect(w.everWet).toBe(true);
  });

  it('el pronóstico acierta más de cerca que de lejos', () => {
    const w = createWeather({ rng: 1 }, 0, 6000, 'dry');
    w.plan = [{ fromS: 400, toS: 2500, intensity: 0.8 }];
    const slots = forecast(w, 0, 7, 0.2);
    expect(slots).toHaveLength(6);
    for (const s of slots) {
      expect(s.rainChance).toBeGreaterThanOrEqual(0);
      expect(s.rainChance).toBeLessThanOrEqual(1);
    }
    expect(slots[1]!.rainChance).toBeGreaterThan(0.6); // a 10 minutos ya está lloviendo
  });
});

describe('carrera completa', () => {
  const race = runToEnd(createRace(config(MONZA, 3)));
  const rows = classification(race);

  it('termina con todos los coches clasificados o retirados', () => {
    expect(race.state.finished).toBe(true);
    expect(rows).toHaveLength(22);
    expect(rows.map((r) => r.position)).toEqual(Array.from({ length: 22 }, (_, i) => i + 1));
    expect(rows[0]!.laps).toBe(race.config.laps);
    expect(race.state.cars.every((c) => c.status === 'finished' || c.status === 'out')).toBe(true);
  });

  it('los que terminan llegan con combustible y sin vueltas de más', () => {
    for (const car of race.state.cars.filter((c) => c.status === 'finished')) {
      expect(car.fuelKg, car.id).toBeGreaterThan(0);
      expect(car.lap, car.id).toBeLessThanOrEqual(race.config.laps);
      expect(car.bestLapS, car.id).toBeGreaterThan(race.config.refLapS * 0.97);
    }
  });

  it('en seco todos usan dos compuestos o reciben sanción', () => {
    for (const car of race.state.cars.filter((c) => c.status === 'finished')) {
      const compounds = new Set(car.stints.map((s) => s.compound));
      expect(compounds.size >= 2 || car.penaltyS === 30, car.id).toBe(true);
    }
  });

  it('las diferencias de la clasificación son coherentes', () => {
    const sameLap = rows.filter((r) => r.status === 'finished' && r.lapsBehind === 0);
    for (let i = 2; i < sameLap.length; i++) expect(sameLap[i]!.timeS!).toBeGreaterThanOrEqual(sameLap[i - 1]!.timeS!);
    expect(rows[0]!.timeS!).toBeGreaterThan(race.config.laps * race.config.refLapS);
  });
});

describe('determinismo', () => {
  it('misma semilla, misma carrera; otra semilla, otra carrera', () => {
    const a = summary(runToEnd(createRace(config(MONZA, 11))));
    const b = summary(runToEnd(createRace(config(MONZA, 11))));
    const c = summary(runToEnd(createRace(config(MONZA, 12))));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('el registro de órdenes reproduce la carrera del jugador', () => {
    const player = 'ferrari';
    const log: LoggedCommand[] = [
      { tick: 400, command: { type: 'pace', id: 'leclerc', value: 'push' } },
      { tick: 900, command: { type: 'pit', id: 'leclerc', compound: 'hard' } },
      { tick: 1500, command: { type: 'energy', id: 'hamilton', value: 'attack' } },
      { tick: 2200, command: { type: 'pit', id: 'hamilton', compound: 'medium' } },
    ];
    const play = () => {
      const race = createRace(config(MONZA, 21, { playerTeamId: player }));
      while (!race.state.finished && race.state.tick < 20000) {
        for (const entry of log) if (entry.tick === race.state.tick) applyCommand(race, entry.command);
        step(race);
      }
      return race;
    };
    const first = play();
    expect(summary(first)).toBe(summary(play()));
    expect(first.state.cars.find((c) => c.id === 'leclerc')!.stints.some((s) => s.compound === 'hard')).toBe(true);
  });
});

describe('órdenes del jugador', () => {
  it('la IA no para los coches del jugador: solo aconseja', () => {
    const race = runToEnd(createRace(config(MONZA, 5, { playerTeamId: 'ferrari' })));
    const mine = race.state.cars.filter((c) => c.id === 'leclerc' || c.id === 'hamilton');
    expect(mine.every((c) => c.pitStops === 0)).toBe(true);
    expect(race.state.events.some((e) => e.type === 'advice' && e.code === 'box')).toBe(true);
  });

  it('pedir boxes cambia el neumático al final de esa vuelta y se puede cancelar', () => {
    const race = createRace(config(MONZA, 5, { playerTeamId: 'ferrari' }));
    while (race.state.leaderLap < 5) step(race);
    const car = race.state.cars.find((c) => c.id === 'leclerc')!;
    applyCommand(race, { type: 'pit', id: 'leclerc', compound: 'hard' });
    applyCommand(race, { type: 'cancelPit', id: 'leclerc' });
    expect(car.pitRequest).toBeNull();

    applyCommand(race, { type: 'pit', id: 'leclerc', compound: 'hard' });
    const lap = car.lap;
    while (car.pitStops === 0 && race.state.tick < 5000) step(race);
    expect(car.pitStops).toBe(1);
    expect(car.tyre.compound).toBe('hard');
    expect(car.lap - lap).toBeLessThanOrEqual(1);
    const pit = race.state.events.find((e): e is Extract<RaceEvent, { type: 'pit' }> => e.type === 'pit' && e.id === 'leclerc')!;
    expect(pit.stationaryS).toBeGreaterThan(1.8);
  });

  it('con estrategia automática el ingeniero para por ti', () => {
    const race = createRace(config(MONZA, 5, { playerTeamId: 'ferrari' }));
    applyCommand(race, { type: 'auto', id: 'leclerc', value: true });
    runToEnd(race);
    expect(race.state.cars.find((c) => c.id === 'leclerc')!.pitStops).toBeGreaterThanOrEqual(1);
  });

  it('empujar es más rápido y gasta más neumático que conservar', () => {
    const run = (value: 'conserve' | 'max') => {
      const race = createRace(config(MONZA, 9, { playerTeamId: 'ferrari' }));
      applyCommand(race, { type: 'pace', id: 'leclerc', value });
      while (race.state.leaderLap < 8) step(race);
      return race.state.cars.find((c) => c.id === 'leclerc')!;
    };
    const slow = run('conserve');
    const fast = run('max');
    expect(fast.tyre.wear).toBeGreaterThan(slow.tyre.wear);
    expect(fast.bestLapS!).toBeLessThan(slow.bestLapS!);
  });
});

describe('safety car', () => {
  it('agrupa al pelotón y nadie adelanta mientras está en pista', () => {
    // Los coches recortan a un 20 % más de ritmo que el safety car: hacen falta unas tres vueltas para juntarse.
    const SETTLE_S = 420;
    let checked = 0;
    for (let seed = 1; seed <= 60 && checked < 2; seed++) {
      const race = createRace(config(SEPANG, seed));
      let scTicks = 0;
      let overtakesAtStart = -1;
      let intervals: number[] = [];
      while (!race.state.finished) {
        step(race);
        if (race.state.flag === 'sc') {
          if (overtakesAtStart < 0) overtakesAtStart = race.state.overtakes;
          if (++scTicks === SETTLE_S) {
            intervals = race.state.cars
              .filter((c) => c.status === 'racing' && c.lapsBehind === 0 && c.position > 1)
              .map((c) => c.intervalS ?? 0)
              .sort((x, y) => x - y);
          }
        } else if (overtakesAtStart >= 0) {
          expect(race.state.overtakes, 'semilla ' + seed).toBe(overtakesAtStart);
          if (intervals.length >= 4) {
            // La mediana ignora a quien acaba de salir de boxes y aún no ha llegado a la cola.
            expect(intervals[intervals.length >> 1]!, 'semilla ' + seed).toBeLessThan(1.5);
            checked++;
          }
          break;
        }
      }
    }
    expect(checked, 'ninguna semilla produjo un safety car largo').toBeGreaterThan(0);
  });
});

describe('IA sin información privilegiada', () => {
  it('una lluvia futura que aún no asoma en el pronóstico no cambia nada', () => {
    const a = createRace(config(MONZA, 31));
    const b = createRace(config(MONZA, 31));
    b.state.weather.plan = [{ fromS: 4000, toS: 5000, intensity: 0.9 }];
    for (let i = 0; i < 1500; i++) {
      step(a);
      step(b);
    }
    const snapshot = (r: Race) => r.state.cars.map((c) => `${c.id}:${c.lap}:${c.s.toFixed(6)}:${c.pitStops}:${c.tyre.compound}`).join('|');
    expect(snapshot(a)).toBe(snapshot(b));
  });

  it('cuando llueve de verdad, los coches acaban montando neumáticos de agua', () => {
    const race = createRace(config(MONZA, 31));
    race.state.weather.plan = [{ fromS: 1200, toS: 3200, intensity: 0.7 }];
    while (race.state.t < 2600 && !race.state.finished) step(race);
    const running = race.state.cars.filter((c) => c.status === 'racing' || c.status === 'pit');
    const onWets = running.filter((c) => c.tyre.compound === 'inter' || c.tyre.compound === 'wet');
    expect(onWets.length).toBeGreaterThan(running.length * 0.8);
  });
});

describe('dificultad de adelantar', () => {
  it('en Mónaco se adelanta mucho menos que en Monza', () => {
    const count = (round: number) => [1, 2, 3].reduce((sum, seed) => sum + runToEnd(createRace(config(round, seed))).state.overtakes, 0);
    expect(count(MONACO)).toBeLessThan(count(MONZA) * 0.5);
  });
});
