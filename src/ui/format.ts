import type { CSSProperties } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Round, Team } from '../data/schemas.ts';

/** Formateadores dependientes del idioma activo. */
export function useFormat() {
  const { i18n, t } = useTranslation();
  const lang = i18n.language;
  return useMemo(() => {
    const regions = new Intl.DisplayNames([lang], { type: 'region' });
    const dayMonth = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', timeZone: 'UTC' });
    const long = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    const session = new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const number = new Intl.NumberFormat(lang, { maximumFractionDigits: 3 });
    return {
      country: (code: string) => regions.of(code) ?? code,
      dayMonth: (iso: string) => dayMonth.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)),
      longDate: (iso: string) => long.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)),
      /** Fecha y hora de una sesión en la zona horaria del jugador. */
      sessionTime: (iso: string) => session.format(new Date(iso)),
      number: (v: number) => number.format(v),
      percent: (v: number) => `${Math.round(v * 100)} %`,
      gp: (round: Pick<Round, 'circuitId' | 'name'>) => t(`gp.${round.circuitId}`, { defaultValue: round.name }),
    };
  }, [lang, t]);
}

/** Variables CSS con los colores del equipo, para que los hijos usen var(--team). */
export function teamVars(team: Pick<Team, 'colors'> | undefined): CSSProperties {
  if (!team) return {};
  return { '--team': team.colors.primary, '--team-2': team.colors.secondary } as CSSProperties;
}

/** Color de texto legible (oscuro o claro) sobre un color de fondo hex. */
export function readableOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  return luminance > 0.4 ? '#15151e' : '#ffffff';
}

/** Retraso escalonado para la animación .reveal de listas. */
export function stagger(index: number): CSSProperties {
  return { '--i': index } as CSSProperties;
}
