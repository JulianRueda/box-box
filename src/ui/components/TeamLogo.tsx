import { useState } from 'react';
import type { Team } from '../../data/schemas.ts';
import { readableOn } from '../format.ts';

/**
 * Logo del equipo. Los logos reales son marcas registradas y no van en el repo:
 * el jugador los deja en public/assets/logos/<id>.svg o .png. Si no existe el
 * archivo se dibuja un escudo genérico con los colores y las siglas del equipo.
 */
const SOURCES = ['svg', 'png'] as const;

export function TeamLogo({ team, size = 40 }: { team: Team; size?: number }) {
  const [attempt, setAttempt] = useState(0);
  const ext = SOURCES[attempt];

  if (ext) {
    return (
      <img
        src={`${import.meta.env.BASE_URL}assets/logos/${team.id}.${ext}`}
        alt=""
        width={size}
        height={size}
        className="shrink-0 object-contain"
        style={{ width: size, height: size }}
        onError={() => setAttempt((a) => a + 1)}
      />
    );
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
        fontWeight="800"
        fontSize={team.shortName.length > 2 ? 12 : 15}
        fill={readableOn(primary)}
      >
        {team.shortName}
      </text>
    </svg>
  );
}
