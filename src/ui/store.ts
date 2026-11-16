import { create } from 'zustand';
import { results } from '../data/index.ts';

type RoleFilter = 'all' | 'race' | 'others';

interface UiState {
  /** Ronda elegida en la pantalla de clasificación (se conserva al navegar). */
  standingsRound: number;
  setStandingsRound: (round: number) => void;
  driverFilter: RoleFilter;
  setDriverFilter: (filter: RoleFilter) => void;
}

export const useUi = create<UiState>((set) => ({
  standingsRound: results.lastRound,
  setStandingsRound: (standingsRound) => set({ standingsRound }),
  driverFilter: 'race',
  setDriverFilter: (driverFilter) => set({ driverFilter }),
}));

export type { RoleFilter };
