/**
 * npm run build-circuits [-- --refresh]
 *
 * Genera data/circuits/<id>.json a partir de los GeoJSON públicos de
 * https://github.com/bacinger/f1-circuits (licencia MIT):
 *   1. proyecta lon/lat a metros (equirectangular local),
 *   2. remuestrea a puntos equidistantes,
 *   3. normaliza al cuadrado unidad (norte arriba, eje Y hacia abajo como en SVG),
 *   4. orienta la polilínea en el sentido de marcha,
 *   5. detecta las rectas más largas como zonas de Overtake Mode (estimación geométrica).
 *
 * Los GeoJSON descargados se guardan en scripts/.cache/ (fuera de git).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calendarSchema, circuitSchema, resultsSchema, type Circuit } from '../src/data/schemas.ts';
import { CIRCUIT_META } from './circuit-meta.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = resolve(ROOT, 'scripts', '.cache', 'geojson');
const OUT = resolve(ROOT, 'data', 'circuits');
const SOURCE = 'https://raw.githubusercontent.com/bacinger/f1-circuits/master/circuits';
const SAMPLES = 240;
const refresh = process.argv.includes('--refresh');

type Pt = [number, number];

interface GeoJson {
  features: { properties: { Name: string; length: number }; geometry: { coordinates: Pt[] } }[];
}

async function loadGeo(geoId: string): Promise<GeoJson> {
  const file = resolve(CACHE, `${geoId}.geojson`);
  if (refresh || !existsSync(file)) {
    const res = await fetch(`${SOURCE}/${geoId}.geojson`);
    if (!res.ok) throw new Error(`${res.status} al descargar ${geoId}.geojson`);
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(file, await res.text());
  }
  return JSON.parse(readFileSync(file, 'utf8')) as GeoJson;
}

// ------------------------------------------------------------ Geometría

function project(coords: Pt[]): Pt[] {
  const lat0 = (coords.reduce((s, c) => s + c[1], 0) / coords.length) * (Math.PI / 180);
  const R = 6371000;
  // Y negada: en pantalla el norte queda arriba.
  return coords.map(([lon, lat]) => [lon * (Math.PI / 180) * Math.cos(lat0) * R, -lat * (Math.PI / 180) * R]);
}

function closeLoop(pts: Pt[]): Pt[] {
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  return first[0] === last[0] && first[1] === last[1] ? pts.slice(0, -1) : pts;
}

/** Remuestrea un bucle cerrado a `n` puntos equidistantes en longitud de arco. */
function resample(loop: Pt[], n: number): Pt[] {
  const cum: number[] = [0];
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i]!;
    const b = loop[(i + 1) % loop.length]!;
    cum.push(cum[i]! + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = cum[loop.length]!;
  const out: Pt[] = [];
  let seg = 0;
  for (let k = 0; k < n; k++) {
    const d = (k / n) * total;
    while (cum[seg + 1]! < d) seg++;
    const a = loop[seg]!;
    const b = loop[(seg + 1) % loop.length]!;
    const t = (d - cum[seg]!) / (cum[seg + 1]! - cum[seg]! || 1);
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

/** Área con signo en coordenadas de pantalla (Y hacia abajo): > 0 = sentido horario. */
function signedArea(pts: Pt[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

function normalize(pts: Pt[]): Pt[] {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(...xs) - minX;
  const h = Math.max(...ys) - minY;
  const scale = Math.max(w, h);
  const offX = (1 - w / scale) / 2;
  const offY = (1 - h / scale) / 2;
  const r = (v: number) => Math.round(v * 10000) / 10000;
  return pts.map(([x, y]) => [r((x - minX) / scale + offX), r((y - minY) / scale + offY)]);
}

/** Rectas más largas del trazado como fracciones de vuelta [inicio, fin]. */
function straights(pts: Pt[], max = 3): [number, number][] {
  const n = pts.length;
  const heading = pts.map((p, i) => {
    const q = pts[(i + 1) % n]!;
    return Math.atan2(q[1] - p[1], q[0] - p[0]);
  });
  const straight = heading.map((h, i) => {
    let d = heading[(i + 1) % n]! - h;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return Math.abs(d) < 0.03;
  });
  const start = straight.indexOf(false);
  if (start < 0) return [];
  const runs: { from: number; len: number }[] = [];
  let len = 0;
  for (let k = 1; k <= n; k++) {
    const i = (start + k) % n;
    if (straight[i]) len++;
    else {
      if (len > 0) runs.push({ from: (i - len + n) % n, len });
      len = 0;
    }
  }
  const minLen = Math.round(n * 0.06);
  const picked = runs.filter((r) => r.len >= minLen).sort((a, b) => b.len - a.len).slice(0, max);
  const best = picked.length ? picked : runs.sort((a, b) => b.len - a.len).slice(0, 1);
  const r = (v: number) => Math.round(v * 1000) / 1000;
  return best
    .map((s): [number, number] => {
      // El Overtake Mode se activa pasado el primer cuarto de la recta.
      const from = (s.from + s.len * 0.25) / n;
      const to = (s.from + s.len) / n;
      return [r(from % 1), r(to % 1)];
    })
    .sort((a, b) => a[0] - b[0]);
}

// ------------------------------------------------------------ Main

async function main(): Promise<void> {
  const calendar = calendarSchema.parse(JSON.parse(readFileSync(resolve(ROOT, 'data/2026/calendar.json'), 'utf8')));
  const results = resultsSchema.parse(JSON.parse(readFileSync(resolve(ROOT, 'data/2026/results.json'), 'utf8')));
  mkdirSync(OUT, { recursive: true });

  for (const round of calendar.rounds) {
    const meta = CIRCUIT_META[round.circuitId];
    if (!meta) throw new Error(`Falta circuit-meta para "${round.circuitId}"`);
    const geo = await loadGeo(meta.geo);
    const feature = geo.features[0]!;

    let pts = resample(closeLoop(project(feature.geometry.coordinates)), SAMPLES);
    const estimated = [
      'track.startPoint',
      'sectors',
      'overtakeZones',
      'pit',
      'downforceLevel',
      'tyreWear',
      'overtakingDifficulty',
      'safetyCarProbability',
      'rainProbability',
    ];
    if (meta.clockwise === null) estimated.push('track.direction');
    else if (signedArea(pts) > 0 !== meta.clockwise) pts = [pts[0]!, ...pts.slice(1).reverse()];

    const raced = results.rounds.find((r) => r.round === round.round);
    const laps = raced?.race[0]?.laps ?? meta.laps;
    if (!raced) estimated.push('laps');

    const circuit: Circuit = circuitSchema.parse({
      id: round.circuitId,
      name: round.circuitName,
      lengthKm: feature.properties.length / 1000,
      laps,
      track: normalize(pts),
      sectors: [0.33, 0.67],
      overtakeZones: straights(pts),
      pit: { entry: 0.965, exit: 0.035, timeLossS: meta.pitLossS },
      downforceLevel: meta.downforceLevel,
      tyreWear: meta.tyreWear,
      overtakingDifficulty: meta.overtakingDifficulty,
      safetyCarProbability: meta.safetyCarProbability,
      rainProbability: meta.rainProbability,
      estimatedFields: estimated,
    });

    // Una línea por punto sería enorme: el trazado va en una sola línea.
    const { track, ...rest } = circuit;
    const body = JSON.stringify(rest, null, 2).replace(/\n}$/, `,\n  "track": ${JSON.stringify(track)}\n}`);
    writeFileSync(resolve(OUT, `${circuit.id}.json`), body + '\n');
    console.log(`  ${circuit.id.padEnd(14)} ${circuit.lengthKm.toFixed(3)} km · ${laps} vueltas · ${circuit.overtakeZones.length} zonas`);
  }
  console.log(`\n${calendar.rounds.length} circuitos escritos en data/circuits/`);
}

await main();
