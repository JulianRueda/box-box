import { describe, expect, it } from 'vitest';
import { calendar, circuits, drivers, findCircuit, results, staff, teams } from '../../src/data/index.ts';
import { validateSeason } from '../../src/data/validate.ts';

describe('datos de la temporada 2026', () => {
  it('cargan y pasan los esquemas zod', () => {
    // Importar src/data ya valida con zod: si llega aquí, los esquemas se cumplen.
    expect(teams).toHaveLength(11);
    expect(drivers.filter((d) => d.role === 'race')).toHaveLength(22);
    expect(calendar.rounds.length).toBeGreaterThanOrEqual(20);
    expect(results.rounds.length).toBe(results.lastRound);
  });

  it('no tienen referencias rotas entre archivos', () => {
    expect(validateSeason({ teams, drivers, calendar, results, staff, circuits })).toEqual([]);
  });

  it('incluyen a Audi y Cadillac', () => {
    expect(teams.map((t) => t.id)).toEqual(expect.arrayContaining(['audi', 'cadillac']));
  });

  it('cada ronda tiene un circuito con trazado cerrado y normalizado', () => {
    for (const round of calendar.rounds) {
      const circuit = findCircuit(round.circuitId);
      expect(circuit, round.circuitId).toBeDefined();
      for (const [x, y] of circuit!.track) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(1);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(1);
      }
      // Puntos equidistantes: ningún salto debe ser mucho mayor que la media.
      const steps = circuit!.track.map((p, i) => {
        const q = circuit!.track[(i + 1) % circuit!.track.length]!;
        return Math.hypot(q[0] - p[0], q[1] - p[1]);
      });
      const avg = steps.reduce((a, b) => a + b, 0) / steps.length;
      expect(Math.max(...steps)).toBeLessThan(avg * 1.6);
    }
  });

  it('cada equipo tiene director técnico, estrategia e ingeniero de pista por titular', () => {
    for (const team of teams) {
      const roles = staff.filter((s) => s.teamId === team.id).map((s) => s.role);
      expect(roles, team.id).toEqual(expect.arrayContaining(['technicalDirector', 'headOfStrategy', 'headOfAero', 'chiefMechanic']));
      expect(roles.filter((r) => r === 'raceEngineer'), team.id).toHaveLength(2);
    }
  });

  it('todas las carreras disputadas tienen parrilla completa y un único ganador', () => {
    for (const round of results.rounds) {
      expect(round.race.length, `ronda ${round.round}`).toBe(22);
      expect(round.race.filter((e) => e.position === 1)).toHaveLength(1);
      // Quien no marca tiempo en clasificación no aparece en la API: puede haber menos de 22.
      expect(round.qualifying.length, `ronda ${round.round}`).toBeGreaterThanOrEqual(18);
    }
  });

  it('las valoraciones reflejan el orden real del campeonato', () => {
    const car = (id: string) => teams.find((t) => t.id === id)!.car.downforceMedium;
    expect(car('mercedes')).toBeGreaterThan(car('williams'));
    expect(car('ferrari')).toBeGreaterThan(car('cadillac'));
    const estimated = drivers.filter((d) => d.attributesEstimated);
    // Los titulares han corrido de sobra: sus atributos salen de resultados, no de estimaciones.
    expect(estimated.every((d) => d.role !== 'race')).toBe(true);
  });
});
