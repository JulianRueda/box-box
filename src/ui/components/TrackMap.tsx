import { useTranslation } from 'react-i18next';
import type { Circuit } from '../../data/schemas.ts';

const VIEW = 1000;
const PAD = 70;
/** Sector 1, 2 y 3. Los mismos tonos que usa el mapa de carrera. */
export const SECTOR_COLORS = ['#ef6a5b', '#5aa9e6', '#ead35a'];

const scale = (v: number) => PAD + v * (VIEW - PAD * 2);

/** Puntos del trazado entre dos fracciones de vuelta (admite cruzar la meta). */
function slice(track: Circuit['track'], from: number, to: number): string {
  const n = track.length;
  const a = Math.round(from * n);
  let b = Math.round(to * n);
  if (b <= a) b += n;
  const pts: string[] = [];
  for (let i = a; i <= b; i++) {
    const p = track[i % n]!;
    pts.push(`${scale(p[0]).toFixed(1)},${scale(p[1]).toFixed(1)}`);
  }
  return pts.join(' ');
}

/**
 * Trazado del circuito en SVG.
 * `detailed` añade sectores, zonas de Overtake Mode y meta.
 * El modo simple se pinta con el color de texto heredado (currentColor).
 * `draw` hace que la línea se trace sola al aparecer (solo en el modo simple).
 * `decorative` lo oculta a los lectores de pantalla cuando el nombre ya está al lado.
 */
export function TrackMap({ circuit, detailed = false, draw = false, decorative = false, weight = 26, className = '' }: { circuit: Circuit; detailed?: boolean; draw?: boolean; decorative?: boolean; /** Grosor del trazo en el modo simple, sobre un lienzo de 1000 unidades. */ weight?: number; className?: string }) {
  const { t } = useTranslation();
  const outline = slice(circuit.track, 0, 1);
  const start = circuit.track[0]!;
  const next = circuit.track[1]!;
  const angle = (Math.atan2(next[1] - start[1], next[0] - start[0]) * 180) / Math.PI;
  const bounds = [0, circuit.sectors[0], circuit.sectors[1], 1];
  const a11y = decorative ? ({ 'aria-hidden': true } as const) : ({ role: 'img', 'aria-label': t('round.mapLabel', { name: circuit.name }) } as const);

  return (
    <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className={className} {...a11y}>
      {detailed ? (
        <>
          <polyline points={outline} fill="none" stroke="var(--color-ink-800)" strokeWidth="26" strokeLinejoin="round" strokeLinecap="round" />
          {circuit.overtakeZones.map(([from, to]) => (
            <polyline key={from} points={slice(circuit.track, from, to)} fill="none" stroke="var(--color-timing-personal)" strokeWidth="26" strokeOpacity="0.32" strokeLinecap="butt" />
          ))}
          {SECTOR_COLORS.map((color, i) => (
            <polyline key={color} points={slice(circuit.track, bounds[i]!, bounds[i + 1]!)} fill="none" stroke={color} strokeWidth="6" strokeLinejoin="round" strokeLinecap="butt" />
          ))}
          <g transform={`translate(${scale(start[0])} ${scale(start[1])}) rotate(${angle})`}>
            <rect x="-4" y="-24" width="8" height="48" fill="var(--color-fg)" />
            <path d="M14 -9l16 9-16 9z" fill="var(--color-fg)" />
          </g>
        </>
      ) : (
        <polyline points={outline} pathLength={1} fill="none" stroke="currentColor" strokeWidth={weight} strokeLinejoin="round" strokeLinecap="round" className={draw ? 'draw' : undefined} />
      )}
    </svg>
  );
}

export function TrackLegend() {
  const { t } = useTranslation();
  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-fg-3">
      {SECTOR_COLORS.map((color, i) => (
        <li key={color} className="flex items-center gap-2">
          <span className="h-0.5 w-5" style={{ background: color }} aria-hidden="true" />
          {t('round.legendSector', { n: i + 1 })}
        </li>
      ))}
      <li className="flex items-center gap-2">
        <span className="h-3 w-5 bg-timing-personal/35" aria-hidden="true" />
        {t('round.legendOvertake')}
      </li>
      <li className="flex items-center gap-2">
        <span className="h-3.5 w-1 bg-fg" aria-hidden="true" />
        {t('round.legendStart')}
      </li>
    </ul>
  );
}
