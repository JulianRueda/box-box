import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { findDriver, findTeam, driverName } from '../../data/index.ts';
import { teamVars } from '../format.ts';

/** Marca visible de dato estimado: nunca se presenta una estimación como hecho. */
export function EstTag({ generated = false }: { generated?: boolean }) {
  const { t } = useTranslation();
  return (
    <abbr
      title={t(generated ? 'common.generatedLong' : 'common.estimatedLong')}
      className="label ml-2 border border-line-strong px-1.5 py-px align-middle text-[0.6875rem] text-fg-3 no-underline"
    >
      {t(generated ? 'common.generated' : 'common.estimated')}
    </abbr>
  );
}

export function PageHeader({ kicker, title, lead, aside }: { kicker?: ReactNode; title: ReactNode; lead?: ReactNode; aside?: ReactNode }) {
  return (
    <header className="reveal flex flex-wrap items-end justify-between gap-x-10 gap-y-6 border-b border-line pb-8 pt-10 md:pt-16">
      <div className="min-w-0">
        {kicker && <p className="label mb-3 text-signal">{kicker}</p>}
        <h1 className="display text-[clamp(2rem,5.2vw,4.25rem)]">{title}</h1>
        {lead && <p className="mt-5 max-w-[52ch] text-lg text-fg-2">{lead}</p>}
      </div>
      {aside}
    </header>
  );
}

export function Section({ title, note, children, className = '' }: { title: ReactNode; note?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`mt-14 ${className}`}>
      <div className="corner mb-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pr-4 pt-3">
        <h2 className="display text-2xl md:text-[1.75rem]">{title}</h2>
        {note && <p className="text-sm text-fg-3">{note}</p>}
      </div>
      {children}
    </section>
  );
}

/** Barra de valoración 0–100 con su número; el valor siempre va también en texto. */
export function RatingBar({ label, value, estimated = false }: { label: string; value: number; estimated?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-x-4 gap-y-1.5 py-2">
      <span className="text-[0.9375rem] text-fg-2">
        {label}
        {estimated && <EstTag />}
      </span>
      <span className="num text-right text-[0.9375rem] font-semibold">{value}</span>
      <div className="col-span-2 h-1 bg-ink-800" role="presentation">
        <div className="h-full origin-left bg-(--team)" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function Stat({ label, value, sub }: { label: ReactNode; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="label">{label}</dt>
      <dd className="mt-1 text-lg leading-snug text-fg">{value}</dd>
      {sub && <dd className="text-sm text-fg-3">{sub}</dd>}
    </div>
  );
}

/** Piloto en una fila de tabla: franja con el color del equipo con el que corrió, código y nombre. */
export function DriverCell({ driverId, teamId }: { driverId: string; teamId: string }) {
  const driver = findDriver(driverId);
  const team = findTeam(teamId);
  return (
    <Link to={`/drivers/${driverId}`} className="flex min-w-0 items-center gap-3 py-3 hover:text-signal" style={teamVars(team)}>
      <span className="h-6 w-1 shrink-0 bg-(--team)" aria-hidden="true" />
      <span className="display w-11 shrink-0 text-lg">{driver?.code ?? driverId.slice(0, 3)}</span>
      <span className="hidden truncate text-fg-2 sm:block">{driver ? driverName(driver) : driverId}</span>
    </Link>
  );
}

export function TeamCell({ teamId }: { teamId: string }) {
  const team = findTeam(teamId);
  return (
    <Link to={`/teams/${teamId}`} className="truncate text-fg-3 hover:text-signal">
      {team?.name ?? teamId}
    </Link>
  );
}
