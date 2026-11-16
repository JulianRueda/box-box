import type { ClassificationRow } from '../engine/race/sim.ts';
import type { RaceSnapshot } from '../engine/race/snapshot.ts';
import type { Command, LoggedCommand, RaceConfig } from '../engine/race/types.ts';

export const SPEEDS = [1, 2, 4, 8, 16] as const;
export type Speed = (typeof SPEEDS)[number];

/** Mensajes de la interfaz al worker. */
export type ToWorker =
  | { type: 'init'; config: RaceConfig }
  | { type: 'command'; command: Command }
  | { type: 'speed'; value: Speed }
  | { type: 'paused'; value: boolean }
  | { type: 'stop' };

/** Mensajes del worker a la interfaz. */
export type FromWorker =
  | { type: 'snapshot'; snapshot: RaceSnapshot; speed: Speed; paused: boolean }
  | { type: 'finished'; classification: ClassificationRow[]; log: LoggedCommand[] };
