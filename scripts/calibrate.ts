/**
 * npm run calibrate [-- --n 200] [-- --dt 1] [-- --rounds 13,16] [-- --no-write]
 *
 * Simula cada GP disputado N veces con IA en todos los coches, en seco, y
 * compara con la carrera real. Escribe docs/CALIBRATION.md.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calibrateRound } from '../src/engine/race/calibration.ts';
import { dryFastestLap } from '../src/engine/race/setup.ts';
import { loadSeason, ROOT } from './load-season.ts';

const args = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1]! : fallback;
};
const runs = Number(arg('n', '200'));
const dt = Number(arg('dt', '1'));
const only = arg('rounds', '').split(',').filter(Boolean).map(Number);
const write = !args.includes('--no-write');

const season = loadSeason();
const rounds = season.results.rounds.map((r) => r.round).filter((r) => !only.length || only.includes(r));

interface Row {
  round: number;
  name: string;
  realFl: number;
  simFl: number;
  errPct: number;
  wet: boolean;
  realStops: number | null;
  simStops: number;
  overtakes: number;
  retirements: number;
  sc: number;
  gapP10: number;
  leadLap: number;
}

const rows: Row[] = [];
const started = Date.now();
for (const round of rounds) {
  const circuit = season.circuitOf(round);
  const fact = season.factOf(round)!;
  const stats = calibrateRound(
    { dt, circuit, refLapS: season.refLapOf(round).seconds, grid: season.realGrid(round), teams: season.teams, drivers: season.drivers, staff: season.staff },
    runs,
  );
  const realFl = dryFastestLap(fact);
  const row: Row = {
    round,
    name: circuit.id,
    realFl,
    simFl: stats.fastestLapS,
    errPct: (stats.fastestLapS / realFl - 1) * 100,
    wet: fact.wet === true,
    realStops: fact.avgStops,
    simStops: stats.stops,
    overtakes: stats.overtakes,
    retirements: stats.retirements,
    sc: stats.safetyCarRate,
    gapP10: stats.gapP10S,
    leadLap: stats.leadLapFinishers,
  };
  rows.push(row);
  console.log(
    `R${String(round).padStart(2)} ${row.name.padEnd(14)} VR real ${realFl.toFixed(3)} sim ${row.simFl.toFixed(3)} (${row.errPct >= 0 ? '+' : ''}${row.errPct.toFixed(2)} %)` +
      ` · paradas ${row.realStops ?? '—'} / ${row.simStops.toFixed(2)} · adel. ${row.overtakes.toFixed(0)} · aband. ${row.retirements.toFixed(1)} · SC ${(row.sc * 100).toFixed(0)} % · P10 +${row.gapP10.toFixed(0)} s · en vuelta ${row.leadLap.toFixed(1)}${row.wet ? ' · (real en mojado)' : ''}`,
  );
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const maxErr = Math.max(...rows.map((r) => Math.abs(r.errPct)));
console.log(`\nError medio de vuelta rápida ${mean(rows.map((r) => r.errPct)).toFixed(2)} % · máximo ${maxErr.toFixed(2)} % · adelantamientos medios ${mean(rows.map((r) => r.overtakes)).toFixed(0)} · ${((Date.now() - started) / 1000).toFixed(0)} s`);

if (write) {
  const lines = [
    '# Calibración de la simulación de carrera',
    '',
    `Generado por \`npm run calibrate\` el ${new Date().toISOString().slice(0, 10)}: ${runs} simulaciones por GP, en seco, con IA en todos los coches y paso de ${dt} s.`,
    '',
    'La vuelta de referencia de cada circuito sale de la vuelta rápida real de la carrera de 2026 (`data/2026/race-facts.json`).',
    'Lo que se comprueba aquí es que, con esa referencia, el modelo de neumáticos, combustible, tráfico y paradas da carreras parecidas a las reales.',
    '',
    '| Ronda | Circuito | VR real (s) | VR simulada (s) | Error | Paradas reales | Paradas sim. | Adelant. | Abandonos | Carreras con SC | P10 a (s) | En la vuelta del ganador |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map(
      (r) =>
        `| ${r.round} | ${r.name}${r.wet ? ' ¹' : ''} | ${r.realFl.toFixed(3)} | ${r.simFl.toFixed(3)} | ${r.errPct >= 0 ? '+' : ''}${r.errPct.toFixed(2)} % | ${r.realStops ?? '—'} | ${r.simStops.toFixed(2)} | ${r.overtakes.toFixed(0)} | ${r.retirements.toFixed(1)} | ${(r.sc * 100).toFixed(0)} % | ${Number.isNaN(r.gapP10) ? '—' : r.gapP10.toFixed(0)} | ${r.leadLap.toFixed(1)} |`,
    ),
    '',
    `**Resumen:** error medio de vuelta rápida ${mean(rows.map((r) => r.errPct)).toFixed(2)} %, máximo ${maxErr.toFixed(2)} % (objetivo: ±1,5 %). Adelantamientos medios por carrera: ${mean(rows.map((r) => r.overtakes)).toFixed(0)}.`,
    '',
    '¹ La carrera real fue en mojado: la referencia en seco se acota con la pole y sus paradas reales no son comparables.',
    '',
    '## Cómo leer la tabla',
    '',
    '- **Paradas reales** vienen de los stints de OpenF1 e incluyen las provocadas por lluvia, safety car y daños. La simulación de esta tabla es siempre en seco, así que en carreras reales accidentadas sale por debajo.',
    '- **Mónaco**: las 5 paradas reales de media no las reproduce el modelo; apuntan a una norma de paradas obligatorias propia de esa carrera que no está modelada.',
    '- **Adelantamientos** cuenta los cambios de posición en pista, no los que se producen por paradas.',
    '',
  ];
  writeFileSync(resolve(ROOT, 'docs/CALIBRATION.md'), lines.join('\n'));
  console.log('Escrito docs/CALIBRATION.md');
}
