import type { Team } from '../../data/schemas.ts';
import { useAsset } from '../assets.ts';
import { readableOn } from '../format.ts';

/**
 * Logo del equipo. Los logos reales son marcas registradas y no van en el repo:
 * el jugador los sube en Ajustes o los deja en public/assets/logos/<id>.svg|png.
 * Si no hay ninguno se dibuja una placa genérica con los colores y las siglas.
 */
export function TeamLogo({ team, size = 40 }: { team: Team; size?: number }) {
  const url = useAsset('logo', team.id);
  if (url) {
    return <img src={url} alt="" width={size} height={size} className="shrink-0 object-contain" style={{ width: size, height: size }} />;
  }
  return <TeamShield team={team} size={size} />;
}

/** Placa de equipo: como la etiqueta de un monitor de tiempos, con un corte en la esquina. */
export function TeamShield({ team, size = 40 }: { team: Team; size?: number }) {
  const { primary, secondary } = team.colors;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className="shrink-0" aria-hidden="true">
      <path d="M2 6h28l8 8v20H2z" fill={primary} />
      <path d="M2 30h36v4H2z" fill={secondary} />
      <text
        x="20"
        y="24"
        textAnchor="middle"
        fontFamily="var(--font-display)"
        fontWeight="800"
        fontSize={team.shortName.length > 2 ? 12.5 : 15}
        style={{ fontStretch: '68%' }}
        fill={readableOn(primary)}
      >
        {team.shortName}
      </text>
    </svg>
  );
}
