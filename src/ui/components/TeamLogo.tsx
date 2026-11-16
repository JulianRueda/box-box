import type { Team } from '../../data/schemas.ts';
import { useAsset } from '../assets.ts';
import { readableOn } from '../format.ts';

/**
 * Logo del equipo. Los logos reales son marcas registradas y no van en el repo:
 * el jugador los sube en Ajustes o los deja en public/assets/logos/<id>.svg|png.
 * Si no hay ninguno se dibuja un escudo genérico con los colores y las siglas.
 */
export function TeamLogo({ team, size = 40 }: { team: Team; size?: number }) {
  const url = useAsset('logo', team.id);
  if (url) {
    return <img src={url} alt="" width={size} height={size} className="shrink-0 object-contain" style={{ width: size, height: size }} />;
  }
  return <TeamShield team={team} size={size} />;
}

export function TeamShield({ team, size = 40 }: { team: Team; size?: number }) {
  const { primary, secondary } = team.colors;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className="shrink-0" aria-hidden="true">
      <path d="M5 4h30v17c0 8.5-6.3 13.2-15 16-8.700-2.800-15-7.500-15-16z" fill={primary} />
      <path d="M5 4h30v5H5z" fill={secondary} opacity="0.9" />
      <text
        x="20"
        y="25"
        textAnchor="middle"
        fontFamily="var(--font-display)"
        fontWeight="700"
        fontSize={team.shortName.length > 2 ? 11 : 14}
        fill={readableOn(primary)}
      >
        {team.shortName}
      </text>
    </svg>
  );
}
