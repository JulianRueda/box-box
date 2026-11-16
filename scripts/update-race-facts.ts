/**
 * npm run update-race-facts
 *
 * Referencias reales de cada carrera para calibrar la simulación:
 *   - de results.json: pole, vuelta rápida y ritmo medio del ganador,
 *   - de OpenF1 (stints): paradas medias, duración típica de cada compuesto,
 *     compuestos de salida y si la carrera fue en mojado.
 * Escribe data/<año>/race-facts.json. Si OpenF1 falla, no toca el archivo.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calendarSchema, raceFactsSchema, resultsSchema, type RaceFact } from '../src/data/schemas.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SEASON = 2026;
const dir = resolve(ROOT, 'data', String(SEASON));
const API = 'https://api.openf1.org/v1';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get<T>(path: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API}/${path}`);
    if (res.status === 429 && attempt <= 6) {
      await sleep(4000 * attempt);
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
    await sleep(2200); // el plan gratuito de OpenF1 limita a 30 peticiones por minuto
    return (await res.json()) as T;
  }
}

interface Session {
  session_key: number;
  date_start: string;
}
interface Stint {
  driver_number: number;
  stint_number: number;
  lap_start: number | null;
  lap_end: number | null;
  compound: string | null;
}

const seconds = (t: string | null | undefined): number | null => {
  if (!t) return null;
  const parts = t.split(':').map(Number);
  return parts.some(Number.isNaN) ? null : parts.reduce((acc, p) => acc * 60 + p, 0);
};
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};
const round1 = (v: number) => Math.round(v * 10) / 10;

async function main(): Promise<void> {
  const calendar = calendarSchema.parse(JSON.parse(readFileSync(resolve(dir, 'calendar.json'), 'utf8')));
  const results = resultsSchema.parse(JSON.parse(readFileSync(resolve(dir, 'results.json'), 'utf8')));

  let sessions: Session[];
  const facts: RaceFact[] = [];
  try {
    sessions = await get<Session[]>(`sessions?year=${SEASON}&session_name=Race`);
    for (const rr of results.rounds) {
      const info = calendar.rounds.find((r) => r.round === rr.round)!;
      const session = sessions.find((s) => s.date_start.slice(0, 10) === info.date);
      const winner = rr.race[0]!;

      const poleS = Math.min(...rr.qualifying.flatMap((q) => [seconds(q.q1), seconds(q.q2), seconds(q.q3)].filter((t): t is number => t !== null)));
      const fastestLapS = Math.min(...rr.race.map((e) => seconds(e.fastestLap?.time)).filter((t): t is number => t !== null));
      const winnerTimeS = seconds(winner.time);

      const fact: RaceFact = {
        round: rr.round,
        poleS,
        fastestLapS,
        winnerAvgLapS: winnerTimeS ? Math.round((winnerTimeS / winner.laps) * 1000) / 1000 : null,
        wet: null,
        avgStops: null,
        medianStintLaps: {},
        startCompounds: {},
      };

      if (session) {
        const stints = await get<Stint[]>(`stints?session_key=${session.session_key}`);
        const finishers = new Set(rr.race.filter((e) => /^\d+$/.test(e.positionText) && e.laps >= winner.laps - 2).map((e) => e.driverId));
        const numberOf = new Map(rr.race.map((e) => [e.driverId, e] as const));
        void numberOf;
        const byDriver = new Map<number, Stint[]>();
        for (const s of stints) byDriver.set(s.driver_number, [...(byDriver.get(s.driver_number) ?? []), s]);

        const lengths: Record<string, number[]> = {};
        const starts: Record<string, number> = {};
        const stops: number[] = [];
        let wetStints = 0;
        for (const list of byDriver.values()) {
          list.sort((a, b) => a.stint_number - b.stint_number);
          const last = list.at(-1);
          // Solo cuentan quienes llegaron (casi) al final: un abandono falsea las paradas.
          const completed = (last?.lap_end ?? 0) >= winner.laps - 2;
          if (completed) stops.push(list.length - 1);
          const first = list[0]?.compound;
          if (first) starts[first] = (starts[first] ?? 0) + 1;
          for (const s of list) {
            if (!s.compound || s.lap_start === null || s.lap_end === null) continue;
            if (s.compound === 'INTERMEDIATE' || s.compound === 'WET') wetStints++;
            if (completed) (lengths[s.compound] ??= []).push(s.lap_end - s.lap_start + 1);
          }
        }
        void finishers;
        fact.wet = wetStints > 0;
        fact.avgStops = stops.length ? round1(stops.reduce((a, b) => a + b, 0) / stops.length) : null;
        fact.medianStintLaps = Object.fromEntries(Object.entries(lengths).map(([k, v]) => [k, median(v)]));
        fact.startCompounds = starts;
      }
      facts.push(fact);
      console.log(`  ronda ${rr.round}: pole ${poleS.toFixed(3)} · VR ${fastestLapS.toFixed(3)} · paradas ${fact.avgStops ?? '—'} · ${fact.wet ? 'mojado' : 'seco'}`);
    }
  } catch (err) {
    console.error(`\nNo se pudo actualizar: ${err instanceof Error ? err.message : String(err)}`);
    console.error('race-facts.json no se ha modificado.');
    return;
  }

  const out = raceFactsSchema.parse({ season: SEASON, rounds: facts });
  writeFileSync(resolve(dir, 'race-facts.json'), '{\n  "season": ' + SEASON + ',\n  "rounds": [\n' + out.rounds.map((r) => '    ' + JSON.stringify(r)).join(',\n') + '\n  ]\n}\n');
  console.log(`\nEscrito data/${SEASON}/race-facts.json (${facts.length} rondas).`);
}

await main();
