import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { driverOverall } from '../../data/index.ts';
import type { Driver, Team } from '../../data/schemas.ts';
import { useAsset } from '../assets.ts';
import { teamVars } from '../format.ts';
import { Helmet } from './Helmet.tsx';
import { TeamLogo } from './TeamLogo.tsx';

/**
 * Retrato del piloto. Usa la foto que haya puesto el jugador; si no hay,
 * dibuja un busto genérico con el mono del equipo. El busto es deliberadamente
 * anónimo: no intenta parecerse a la persona real.
 */
export function DriverPortrait({ driver, team, className = '' }: { driver: Driver; team: Team | undefined; className?: string }) {
  const url = useAsset('driver', driver.id);
  if (url) return <img src={url} alt="" className={`object-cover object-top ${className}`} />;

  const primary = team?.colors.primary ?? '#7d828c';
  const secondary = team?.colors.secondary ?? '#2a2e37';
  return (
    <svg viewBox="0 0 120 140" className={className} aria-hidden="true" preserveAspectRatio="xMidYMax meet">
      {/* Mono */}
      <path d="M8 140c0-30 18-44 38-48h28c20 4 38 18 38 48z" fill={primary} />
      <path d="M46 92l14 20 14-20 8 3-22 30-22-30z" fill={secondary} />
      {/* Cuello y cabeza */}
      <path d="M49 78h22v18l-11 14-11-14z" fill="#b9bcc6" />
      <path d="M36 50c0-18 10-30 24-30s24 12 24 30c0 20-10 36-24 36S36 70 36 50z" fill="#d3d6de" />
      {/* Gorra */}
      <path d="M33 46c0-17 12-29 27-29s27 12 27 29c-9-5-18-7-27-7s-18 2-27 7z" fill={primary} />
      <path d="M33 46c9-5 18-7 27-7s18 2 27 7l12 6c-13-4-26-6-39-6s-22 2-27 6z" fill={secondary} />
    </svg>
  );
}

/**
 * Tarjeta de piloto: degradado con el color del equipo, número grande,
 * retrato, casco y logo. Es la pieza con la que se presenta a un piloto.
 */
export function DriverCard({ driver, team, meta }: { driver: Driver; team: Team | undefined; meta?: { value: number | string; label: string } }) {
  const { t } = useTranslation();
  const shown = meta ?? { value: driverOverall(driver), label: t('driver.overall') };
  return (
    <Link
      to={`/drivers/${driver.id}`}
      style={teamVars(team)}
      className="group relative flex h-full min-h-44 overflow-hidden rounded-tr-2xl bg-ink-900 transition-colors hover:bg-ink-850"
    >
      {/* El color del equipo entra desde la derecha, detrás del retrato; el texto queda sobre fondo oscuro. */}
      <span className="absolute inset-0 bg-[linear-gradient(105deg,transparent_38%,color-mix(in_oklab,var(--team)_62%,transparent))] opacity-80" aria-hidden="true" />
      <span className="absolute inset-y-0 left-0 w-1 bg-(--team)" aria-hidden="true" />
      <span className="display pointer-events-none absolute -bottom-3 right-[38%] text-[6.5rem] text-fg opacity-10" aria-hidden="true">
        {driver.number ?? driver.code}
      </span>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-between p-4 pl-5">
        <div className="min-w-0">
          <p className="leading-tight text-fg-2">{driver.givenName}</p>
          <p className="display truncate text-2xl group-hover:text-signal">{driver.familyName}</p>
          <p className="mt-1 truncate text-sm text-fg-3">
            {team?.name ?? t('driver.freeAgent')}
            {driver.role !== 'race' && ` · ${t(`driver.role.${driver.role}`)}`}
          </p>
        </div>
        <div className="flex items-end gap-3">
          <Helmet driver={driver} team={team} size={44} />
          {team && <TeamLogo team={team} size={30} />}
          <p className="ml-auto text-right leading-none">
            <span className="num block text-2xl font-semibold">{shown.value}</span>
            <span className="label text-[0.6875rem]">{shown.label}</span>
          </p>
        </div>
      </div>

      <DriverPortrait driver={driver} team={team} className="relative z-10 h-44 w-[38%] shrink-0 self-end" />
    </Link>
  );
}
