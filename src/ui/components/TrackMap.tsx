import { useEffect, useRef } from 'react';
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
        <span className="h-4 w-1 bg-fg" aria-hidden="true" />
        {t('round.legendStart')}
      </li>
    </ul>
  );
}

export interface LiveCar {
  id: string;
  code: string;
  color: string;
  /** Lleva su código en una placa sobre el coche. */
  labelled: boolean;
}

/** Una vuelta del líder dura esto en pantalla; no es tiempo real. */
const LAP_MS = 26_000;
/** Separación entre coches al empezar, en fracción de vuelta: más holgada entre los que llevan placa. */
const gapBefore = (index: number) => (index <= 3 ? 0.034 : 0.015);

/**
 * El circuito con la parrilla rodando: una vista previa de la pantalla de carrera.
 * No es una simulación: los coches salen en el orden que se le pasa y cada uno rueda
 * una pizca más lento que el anterior, para que el pelotón se estire como en carrera.
 * Con `prefers-reduced-motion` se queda quieto, y se pausa cuando no está en pantalla.
 */
export function LiveTrack({ circuit, cars, className = '' }: { circuit: Circuit; cars: LiveCar[]; className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const nodes = useRef<(SVGGElement | null)[]>([]);
  const bounds = [0, circuit.sectors[0], circuit.sectors[1], 1];
  const start = circuit.track[0]!;
  const next = circuit.track[1]!;
  const angle = (Math.atan2(next[1] - start[1], next[0] - start[0]) * 180) / Math.PI;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const track = circuit.track;
    const n = track.length;
    const offsets: number[] = [];
    cars.forEach((_, i) => offsets.push(i === 0 ? 0.06 : offsets[i - 1]! - gapBefore(i)));

    const place = (elapsedMs: number) => {
      cars.forEach((_, i) => {
        const s = offsets[i]! + (elapsedMs / LAP_MS) * (1 - i * 0.0005);
        const f = (s - Math.floor(s)) * n;
        const k = Math.floor(f) % n;
        const a = track[k]!;
        const b = track[(k + 1) % n]!;
        const t = f - Math.floor(f);
        nodes.current[i]?.setAttribute('transform', `translate(${scale(a[0] + (b[0] - a[0]) * t).toFixed(1)} ${scale(a[1] + (b[1] - a[1]) * t).toFixed(1)})`);
      });
    };
    place(0);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    let elapsed = 0;
    let last = 0;
    let visible = true;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      // Si la pestaña estuvo oculta, el salto de tiempo no cuenta.
      if (visible && last) elapsed += Math.min(100, now - last);
      last = now;
      if (visible) place(elapsed);
    };
    frame = requestAnimationFrame(tick);
    const observer = new IntersectionObserver(([entry]) => (visible = entry?.isIntersecting ?? true));
    observer.observe(svg);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [circuit, cars]);

  return (
    <svg ref={svgRef} viewBox={`0 0 ${VIEW} ${VIEW}`} className={className} aria-hidden="true">
      <polyline points={slice(circuit.track, 0, 1)} fill="none" stroke="var(--color-ink-800)" strokeWidth="34" strokeLinejoin="round" strokeLinecap="round" />
      {circuit.overtakeZones.map(([from, to]) => (
        <polyline key={from} points={slice(circuit.track, from, to)} fill="none" stroke="var(--color-timing-personal)" strokeWidth="34" strokeOpacity="0.22" strokeLinecap="butt" />
      ))}
      {SECTOR_COLORS.map((color, i) => (
        <polyline key={color} points={slice(circuit.track, bounds[i]!, bounds[i + 1]!)} fill="none" stroke={color} strokeWidth="4" strokeLinejoin="round" strokeLinecap="butt" />
      ))}
      <g transform={`translate(${scale(start[0])} ${scale(start[1])}) rotate(${angle})`}>
        <rect x="-4" y="-28" width="8" height="56" fill="var(--color-fg)" />
      </g>
      {/* Del último al primero, para que el líder quede encima. */}
      {cars
        .map((car, i) => ({ car, i }))
        .reverse()
        .map(({ car, i }) => (
          <g key={car.id} ref={(node) => void (nodes.current[i] = node)}>
            <circle r={car.labelled ? 17 : 12} fill={car.color} stroke="var(--color-ink-950)" strokeWidth="3" />
            {car.labelled && (
              <g transform="translate(0 -30)">
                <rect x="-40" y="-36" width="80" height="36" fill="var(--color-ink-950)" />
                <rect x="-40" y="-4" width="80" height="4" fill={car.color} />
                <text y="-11" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="700" fontSize="27" fill="var(--color-fg)" style={{ fontStretch: '68%' }}>
                  {car.code}
                </text>
              </g>
            )}
          </g>
        ))}
    </svg>
  );
}