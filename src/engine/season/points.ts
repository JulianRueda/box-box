/** Puntos por posición (índice 0 = primer puesto). Verificado contra los resultados reales de 2026 en los tests. */
export const RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] as const;
export const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1] as const;

export const racePoints = (position: number): number => RACE_POINTS[position - 1] ?? 0;
export const sprintPoints = (position: number): number => SPRINT_POINTS[position - 1] ?? 0;
