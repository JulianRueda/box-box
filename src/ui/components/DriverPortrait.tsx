import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { driverOverall } from '../../data/index.ts';
import type { Driver, Team } from '../../data/schemas.ts';
import { useAsset } from '../assets.ts';
import { teamVars } from '../format.ts';
import { Helmet } from './Helmet.tsx';

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
      <path d="M49 78h22v18l-11 14-11-14z" fill="#aab0bd" />
      <path d="M36 50c0-18 10-30 24-30s24 12 24 30c0 20-10 36-24 36S36 70 36 50z" fill="#c9ced9" />
      {/* Gorra */}
      <path d="M33 46c0-17 12-29 27-29s27 12 27 29c-9-5-18-7-27-7s-18 2-27 7z" fill={primary} />
      <path d="M33 46c9-5 18-7 27-7s18 2 27 7l12 6c-13-4-26-6-39-6s-22 2-27 6z" fill={secondary} />
    </svg>
  );
}

/**
 * Tarjeta de piloto: número en mono, apellido en condensada y el retrato sobre un
 * bloque inclinado con el color del equipo. Es la pieza con la que se presenta a un piloto.
 */
export function DriverCard({ driver, team, meta }: { driver: Driver; team: Team | undefined; meta?: { value: number | string; label: string } }) {
  const { t } = useTranslation();
  const shown = meta ?? { value: driverOverall(driver), label: t('driver.overall') };
  return (
    <Link
      to={`/drivers/${driver.id}`}
      style={teamVars(team)}
      className="group relative flex h-full min-h-44 overflow-hidden border border-line bg-ink-900 transition-colors hover:border-line-strong hover:bg-ink-850"
    >
      {/* Bloque inclinado con el color del equipo, detrás del retrato; el texto queda sobre fondo oscuro. */}
      <span
        className="absolute inset-y-0 right-0 w-[46%] bg-[color-mix(in_oklab,var(--team)_30%,var(--color-ink-900))] transition-[background-color] duration-300 [clip-path:polygon(34%_0,100%_0,100%_100%,0_100%)] group-hover:bg-[color-mix(in_oklab,var(--team)_46%,var(--color-ink-900))]"
        aria-hidden="true"
      />
      <span className="absolute inset-x-0 top-0 h-0.5 bg-(--team)" aria-hidden="true" />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-between p-4">
        <div className="min-w-0">
          <p className="num flex items-center gap-2 text-sm text-(--team-ink)">
            <span className="font-semibold">{driver.number ?? driver.code}</span>
            <span className="text-fg-4">{driver.countryCode}</span>
          </p>
          <p className="mt-3 leading-tight text-fg-2">{driver.givenName}</p>
          <p className="cond truncate text-[1.75rem] leading-none">{driver.familyName}</p>
          <p className="mt-2 truncate text-sm text-fg-3">
            {team?.name ?? t('driver.freeAgent')}
            {driver.role !== 'race' && ` · ${t(`driver.role.${driver.role}`)}`}
          </p>
        </div>
        <div className="mt-4 flex items-end gap-3">
          <Helmet driver={driver} team={team} size={40} />
          <p className="ml-auto text-right leading-none">
            <span className="num block text-2xl font-semibold">{shown.value}</span>
            <span className="label mt-1 block text-[0.625rem]">{shown.label}</span>
          </p>
        </div>
      </div>

      <DriverPortrait driver={driver} team={team} className="relative z-10 h-44 w-[36%] shrink-0 self-end" />
    </Link>
  );
}
