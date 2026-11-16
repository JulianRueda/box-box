/**
 * npm run update-season [-- --yes] [-- --season 2026]
 *
 * Descarga calendario y resultados de la API de Jolpica (sucesora de Ergast),
 * los compara con los JSON del repo y muestra un diff antes de escribir.
 * Si la API falla o los datos no validan, no se toca ningún archivo.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import {
  calendarSchema,
  resultsSchema,
  type Calendar,
  type QualifyingEntry,
  type RaceEntry,
  type Results,
  type Round,
  type RoundResult,
} from '../src/data/schemas.ts';

const API = 'https://api.jolpi.ca/ergast/f1';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const autoYes = args.includes('--yes');
const seasonArg = args.indexOf('--season');
const season = seasonArg >= 0 ? Number(args[seasonArg + 1]) : 2026;
const dataDir = resolve(ROOT, 'data', String(season));

// ------------------------------------------------------------ API helpers

type Json = Record<string, unknown>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(path: string): Promise<Json> {
  const url = `${API}/${path}`;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': 'paddock-manager-update-season' } });
    if (res.status === 429 && attempt <= 5) {
      await sleep(1500 * attempt);
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
    await sleep(300); // la API limita a ~4 peticiones por segundo
    const body = (await res.json()) as { MRData: Json };
    return body.MRData;
  }
}

interface ApiSession {
  date: string;
  time?: string;
}
interface ApiRace {
  round: string;
  raceName: string;
  date: string;
  time?: string;
  Circuit: { circuitId: string; circuitName: string; Location: { locality: string; country: string } };
  FirstPractice?: ApiSession;
  SecondPractice?: ApiSession;
  ThirdPractice?: ApiSession;
  Qualifying?: ApiSession;
  Sprint?: ApiSession;
  SprintQualifying?: ApiSession;
  Results?: ApiResult[];
  SprintResults?: ApiResult[];
  QualifyingResults?: ApiQualifying[];
}
interface ApiResult {
  position: string;
  positionText: string;
  points: string;
  Driver: { driverId: string };
  Constructor: { constructorId: string };
  grid: string;
  laps: string;
  status: string;
  Time?: { time: string };
  FastestLap?: { rank?: string; lap?: string; Time: { time: string } };
}
interface ApiQualifying {
  position: string;
  Driver: { driverId: string };
  Constructor: { constructorId: string };
  Q1?: string;
  Q2?: string;
  Q3?: string;
}

async function races(path: string): Promise<ApiRace[]> {
  const data = await get(path);
  return (data.RaceTable as { Races: ApiRace[] }).Races;
}

// ------------------------------------------------------------ Conversión

const stamp = (s?: ApiSession) => (s ? `${s.date}T${s.time ?? '00:00:00Z'}` : undefined);

function toRound(r: ApiRace): Round {
  const sessions: Round['sessions'] = { race: `${r.date}T${r.time ?? '00:00:00Z'}` };
  const optional = {
    fp1: stamp(r.FirstPractice),
    fp2: stamp(r.SecondPractice),
    fp3: stamp(r.ThirdPractice),
    sprintQualifying: stamp(r.SprintQualifying),
    sprint: stamp(r.Sprint),
    qualifying: stamp(r.Qualifying),
  };
  for (const [k, v] of Object.entries(optional)) {
    if (v) sessions[k as keyof typeof optional] = v;
  }
  return {
    round: Number(r.round),
    name: r.raceName,
    circuitId: r.Circuit.circuitId,
    circuitName: r.Circuit.circuitName,
    locality: r.Circuit.Location.locality,
    country: r.Circuit.Location.country,
    date: r.date,
    sprint: Boolean(r.Sprint),
    sessions,
  };
}

function toRaceEntry(r: ApiResult): RaceEntry {
  return {
    position: Number(r.position),
    positionText: r.positionText,
    driverId: r.Driver.driverId,
    teamId: r.Constructor.constructorId,
    grid: Number(r.grid),
    laps: Number(r.laps),
    status: r.status,
    points: Number(r.points),
    time: r.Time?.time ?? null,
    fastestLap: r.FastestLap
      ? {
          rank: r.FastestLap.rank ? Number(r.FastestLap.rank) : null,
          lap: r.FastestLap.lap ? Number(r.FastestLap.lap) : null,
          time: r.FastestLap.Time.time,
        }
      : null,
  };
}

function toQualifyingEntry(q: ApiQualifying): QualifyingEntry {
  return {
    position: Number(q.position),
    driverId: q.Driver.driverId,
    teamId: q.Constructor.constructorId,
    q1: q.Q1 || null,
    q2: q.Q2 || null,
    q3: q.Q3 || null,
  };
}

// ------------------------------------------------------------ Descarga

async function download(): Promise<{ calendar: Calendar; results: Results }> {
  const schedule = await races(`${season}/races/?limit=100`);
  const calendar: Calendar = { season, rounds: schedule.map(toRound) };

  const today = new Date().toISOString().slice(0, 10);
  const rounds: RoundResult[] = [];
  for (const r of calendar.rounds) {
    if (r.date > today) break;
    const [race] = await races(`${season}/${r.round}/results/?limit=100`);
    if (!race?.Results?.length) break; // aún sin resultados publicados
    const [quali] = await races(`${season}/${r.round}/qualifying/?limit=100`);
    const sprint = r.sprint ? (await races(`${season}/${r.round}/sprint/?limit=100`))[0] : undefined;
    rounds.push({
      round: r.round,
      qualifying: (quali?.QualifyingResults ?? []).map(toQualifyingEntry),
      sprint: sprint?.SprintResults?.length ? sprint.SprintResults.map(toRaceEntry) : null,
      race: race.Results.map(toRaceEntry),
    });
    process.stdout.write(`  ronda ${r.round} · ${r.name}\n`);
  }

  return {
    calendar: calendarSchema.parse(calendar),
    results: resultsSchema.parse({ season, lastRound: rounds.at(-1)?.round ?? 0, rounds }),
  };
}

// ------------------------------------------------------------ Diff

function readJson<T>(file: string): T | null {
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : null;
}

function diffCalendar(prev: Calendar | null, next: Calendar): string[] {
  if (!prev) return [`+ calendario nuevo con ${next.rounds.length} rondas`];
  const out: string[] = [];
  const before = new Map(prev.rounds.map((r) => [r.round, r]));
  for (const r of next.rounds) {
    const old = before.get(r.round);
    if (!old) out.push(`+ ronda ${r.round}: ${r.name} (${r.date})`);
    else if (JSON.stringify(old) !== JSON.stringify(r)) {
      const what = old.name !== r.name ? `${old.name} → ${r.name}` : old.date !== r.date ? `${old.date} → ${r.date}` : 'horarios de sesión';
      out.push(`~ ronda ${r.round}: ${what}`);
    }
    before.delete(r.round);
  }
  for (const r of before.values()) out.push(`- ronda ${r.round}: ${r.name}`);
  return out;
}

function diffResults(prev: Results | null, next: Results): string[] {
  if (!prev) return [`+ resultados nuevos: ${next.rounds.length} rondas`];
  const out: string[] = [];
  const before = new Map(prev.rounds.map((r) => [r.round, r]));
  for (const r of next.rounds) {
    const old = before.get(r.round);
    const winner = r.race[0]?.driverId ?? '—';
    if (!old) {
      out.push(`+ ronda ${r.round}: resultados nuevos (ganador: ${winner})`);
      continue;
    }
    for (const key of ['qualifying', 'sprint', 'race'] as const) {
      if (JSON.stringify(old[key]) === JSON.stringify(r[key])) continue;
      const a = old[key] ?? [];
      const b = r[key] ?? [];
      const changed = b.filter((e, i) => JSON.stringify(a[i]) !== JSON.stringify(e)).length;
      out.push(`~ ronda ${r.round} ${key}: ${changed} filas cambiadas (${a.length} → ${b.length} filas)`);
    }
    before.delete(r.round);
  }
  for (const r of before.values()) out.push(`- ronda ${r.round}: ya no está en la API (se conserva en el diff, se elimina al escribir)`);
  return out;
}

// ------------------------------------------------------------ Main

async function main(): Promise<void> {
  console.log(`Consultando Jolpica para la temporada ${season}…`);
  let fresh: Awaited<ReturnType<typeof download>>;
  try {
    fresh = await download();
  } catch (err) {
    console.error(`\nNo se pudo actualizar: ${err instanceof Error ? err.message : String(err)}`);
    console.error('Los JSON locales no se han modificado.');
    return; // salida limpia: un fallo de la API no rompe nada
  }

  const calendarFile = resolve(dataDir, 'calendar.json');
  const resultsFile = resolve(dataDir, 'results.json');
  const changes = [
    ...diffCalendar(readJson<Calendar>(calendarFile), fresh.calendar),
    ...diffResults(readJson<Results>(resultsFile), fresh.results),
  ];

  if (changes.length === 0) {
    console.log('\nSin cambios: los JSON ya están al día.');
    return;
  }
  console.log(`\nCambios (${changes.length}):`);
  for (const line of changes) console.log(`  ${line}`);

  let ok = autoYes;
  if (!ok && process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    ok = /^[sy]/i.test(await rl.question('\n¿Escribir estos cambios? [s/N] '));
    rl.close();
  }
  if (!ok) {
    console.log('\nNo se ha escrito nada. Usa --yes para aplicar sin preguntar.');
    return;
  }

  mkdirSync(dataDir, { recursive: true });
  writeFileSync(calendarFile, JSON.stringify(fresh.calendar, null, 2) + '\n');
  writeFileSync(resultsFile, JSON.stringify(fresh.results, null, 2) + '\n');
  console.log(`\nEscrito: ${calendarFile}\n         ${resultsFile}`);
  console.log('Ejecuta ahora `npm run update-race-facts` (referencias de carrera) y `npm run build-ratings` (valoraciones).');
}

await main();
