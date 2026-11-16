import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { findDriver, findTeam, driverName } from '../../data/index.ts';
import { teamVars } from '../format.ts';

/**
 * Marca del juego: los tres sectores de una vuelta con el código de cronometraje
 * (mejor general, mejor personal, más lento). Es el único adorno de la interfaz.
 */
export function SectorMark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex gap-0.5 ${className}`} aria-hidden="true">
      <span className="h-3.5 w-1.5 bg-timing-best" />
      <span className="h-3.5 w-1.5 bg-timing-personal" />
      <span className="h-3.5 w-1.5 bg-timing-slower" />
    </span>
  );
}

/** Marca visible de dato estimado: nunca se presenta una estimación como hecho. */
export function EstTag({ generated = false }: { generated?: boolean }) {
  const { t } = useTranslation();
  return (
    <abbr
      title={t(generated ? 'common.generatedLong' : 'common.estimatedLong')}
      className="label ml-2 border border-line-strong px-1.5 py-px align-middle text-[0.625rem] no-underline"
    >
      {t(generated ? 'common.generated' : 'common.estimated')}
    </abbr>
  );
}

/**
 * Cabecera de página. `size="lg"` es para títulos largos (nombres de Gran Premio),
 * que en la grotesca expandida no caben al tamaño normal.
 */
export function PageHeader({ kicker, title, lead, aside, size = 'xl' }: { kicker?: ReactNode; title: ReactNode; lead?: ReactNode; aside?: ReactNode; size?: 'xl' | 'lg' }) {
  return (
    <header className="reveal flex flex-wrap items-end justify-between gap-x-10 gap-y-6 border-b border-line-strong pb-7 pt-10 md:pt-20">
      <div className="min-w-0 max-w-full">
        {kicker && <p className="label mb-4">{kicker}</p>}
        <h1 className={`display text-balance ${size === 'xl' ? 'text-[clamp(2rem,6.4vw,6rem)]' : 'text-[clamp(1.75rem,4.3vw,4rem)]'}`}>{title}</h1>
        {lead && <p className="mt-5 max-w-[54ch] text-lg text-fg-2">{lead}</p>}
      </div>
      {aside}
    </header>
  );
}

export function Section({ title, note, children, className = '' }: { title: ReactNode; note?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`mt-16 ${className}`}>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-line-strong pt-3">
        <h2 className="display text-lg md:text-xl">{title}</h2>
        {note && <p className="max-w-[60ch] text-sm text-fg-3">{note}</p>}
      </div>
      {children}
    </section>
  );
}

/** Control segmentado: varias opciones, una activa. */
export function Segmented<T extends string>({ label, options, value, onChange, text, className = '' }: { label: string; options: readonly T[]; value: T; onChange: (v: T) => void; text: (v: T) => string; className?: string }) {
  return (
    <div role="group" aria-label={label} className={`grid auto-cols-fr grid-flow-col border border-line-strong ${className}`}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={`min-h-9 cursor-pointer px-2 text-[0.8125rem] leading-tight transition-colors ${value === option ? 'bg-fg font-semibold text-ink-950' : 'text-fg-2 hover:bg-ink-850'}`}
        >
          {text(option)}
        </button>
      ))}
    </div>
  );
}

/** Barra de valoración 0–100 con su número; el valor siempre va también en texto. */
export function RatingBar({ label, value, estimated = false }: { label: string; value: number; estimated?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-x-4 gap-y-2 border-b border-line py-2.5">
      <span className="text-[0.9375rem] text-fg-2">
        {label}
        {estimated && <EstTag />}
      </span>
      <span className="num text-right text-[0.9375rem] font-semibold">{value}</span>
      <div className="col-span-2 h-[3px] bg-ink-800" role="presentation">
        <div className="h-full bg-(--team-ink)" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function Stat({ label, value, sub }: { label: ReactNode; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0 border-t border-line pt-3">
      <dt className="label">{label}</dt>
      <dd className="mt-1.5 text-lg leading-snug text-fg">{value}</dd>
      {sub && <dd className="text-sm text-fg-3">{sub}</dd>}
    </div>
  );
}

/** Piloto en una fila de tabla: franja con el color del equipo con el que corrió, código y nombre. */
export function DriverCell({ driverId, teamId }: { driverId: string; teamId: string }) {
  const driver = findDriver(driverId);
  const team = findTeam(teamId);
  return (
    <Link to={`/drivers/${driverId}`} className="group flex min-w-0 items-center gap-3 py-2.5" style={teamVars(team)}>
      <span className="h-5 w-1 shrink-0 bg-(--team)" aria-hidden="true" />
      <span className="cond w-10 shrink-0 text-lg">{driver?.code ?? driverId.slice(0, 3)}</span>
      <span className="hidden truncate text-fg-2 underline-offset-4 group-hover:text-fg group-hover:underline sm:block">{driver ? driverName(driver) : driverId}</span>
    </Link>
  );
}

export function TeamCell({ teamId }: { teamId: string }) {
  const team = findTeam(teamId);
  return (
    <Link to={`/teams/${teamId}`} className="truncate text-fg-3 underline-offset-4 hover:text-fg hover:underline">
      {team?.name ?? teamId}
    </Link>
  );
}
