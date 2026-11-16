import type { Driver, Team } from '../../data/schemas.ts';
import { useAsset } from '../assets.ts';
import { readableOn } from '../format.ts';

/**
 * Casco del piloto. Si el jugador ha puesto una imagen del casco se usa esa;
 * si no, se dibuja uno genérico de perfil con los colores del equipo y el
 * número. El dibujo varía un poco por piloto para distinguir a los compañeros.
 */
export function Helmet({ driver, team, size = 96 }: { driver: Driver; team: Team | undefined; size?: number }) {
  const url = useAsset('helmet', driver.id);
  if (url) {
    return <img src={url} alt="" width={size} height={size} className="shrink-0 object-contain" style={{ width: size, height: size }} />;
  }

  const primary = team?.colors.primary ?? '#7d828c';
  const secondary = team?.colors.secondary ?? '#2a2e37';
  const seed = [...driver.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const variant = seed % 3;
  const label = driver.number ?? driver.code;

  return (
    <svg width={size} height={size} viewBox="0 0 96 96" className="shrink-0" aria-hidden="true">
      <defs>
        <clipPath id={`shell-${driver.id}`}>
          <path d="M12 54c0-23 17-40 39-40 20 0 34 13 36 31l1 9c0 3-2 5-5 5H62l-6 17c-1 3-4 5-7 5H26c-8 0-14-11-14-27z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#shell-${driver.id})`}>
        <rect width="96" height="96" fill={primary} />
        {variant === 0 && <path d="M0 30l96-22v12L0 44z" fill={secondary} />}
        {variant === 1 && <path d="M0 14h96v8H0z" fill={secondary} />}
        {variant === 2 && <path d="M0 66h96v8H0z M0 22h96v5H0z" fill={secondary} />}
        <path d="M0 78h96v18H0z" fill="#000" opacity="0.22" />
      </g>
      <path d="M50 37h36l2 13c0 2-1 4-4 4H56c-5 0-9-4-9-9 0-4 1-8 3-8z" fill="#0b0d12" />
      <path d="M53 40h30l1 5H52z" fill="#fff" opacity="0.14" />
      <text x="30" y="61" textAnchor="middle" fontFamily="var(--font-mono)" fontWeight="700" fontSize={String(label).length > 2 ? 12 : 17} fill={readableOn(primary)}>
        {label}
      </text>
    </svg>
  );
}
