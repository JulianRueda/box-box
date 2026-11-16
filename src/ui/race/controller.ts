/**
 * Puente entre la interfaz y el worker de carrera.
 *
 * El mapa lee `live` directamente en cada fotograma (sin pasar por React).
 * El resto de la pantalla usa el store, que se actualiza unas 5 veces por segundo:
 * suficiente para leer cronos y mucho más barato que repintar a 20 Hz.
 */
import { create } from 'zustand';
import type { ClassificationRow } from '../../engine/race/sim.ts';
import type { RaceSnapshot } from '../../engine/race/snapshot.ts';
import type { Command, RaceConfig, RaceEvent } from '../../engine/race/types.ts';
import type { FromWorker, Speed, ToWorker } from '../../workers/protocol.ts';

const UI_REFRESH_MS = 200;
const FEED_LIMIT = 60;

export interface RaceMeta {
  round: number;
  playerTeamId: string;
  gridReal: boolean;
}

interface RaceStore {
  config: RaceConfig | null;
  meta: RaceMeta | null;
  snapshot: RaceSnapshot | null;
  feed: RaceEvent[];
  speed: Speed;
  paused: boolean;
  result: ClassificationRow[] | null;
  selectedId: string | null;
  select: (id: string) => void;
}

export const useRace = create<RaceStore>((set) => ({
  config: null,
  meta: null,
  snapshot: null,
  feed: [],
  speed: 1,
  paused: false,
  result: null,
  selectedId: null,
  select: (selectedId) => set({ selectedId }),
}));

/** Última foto y cuándo llegó, para que el mapa extrapole la posición de los coches. */
export const live: { snapshot: RaceSnapshot | null; at: number; speed: Speed; paused: boolean } = { snapshot: null, at: 0, speed: 1, paused: false };

let worker: Worker | null = null;
let lastUi = 0;
let pendingEvents: RaceEvent[] = [];

function send(message: ToWorker): void {
  worker?.postMessage(message);
}

function onMessage(event: MessageEvent<FromWorker>): void {
  const message = event.data;
  if (message.type === 'finished') {
    useRace.setState({ result: message.classification });
    return;
  }
  const { snapshot } = message;
  live.snapshot = snapshot;
  live.at = performance.now();
  live.speed = message.speed;
  live.paused = message.paused;
  pendingEvents.push(...snapshot.events);

  const now = performance.now();
  if (now - lastUi < UI_REFRESH_MS && !snapshot.finished && useRace.getState().snapshot) return;
  lastUi = now;
  const events = pendingEvents;
  pendingEvents = [];
  useRace.setState((s) => ({
    snapshot,
    speed: message.speed,
    paused: message.paused,
    feed: events.length ? [...events.reverse(), ...s.feed].slice(0, FEED_LIMIT) : s.feed,
  }));
}

let releaseTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * La pantalla de carrera llama a retainRace() al montarse y a releaseRace() al desmontarse.
 * El cierre se aplaza un instante: en desarrollo React monta, desmonta y vuelve a montar
 * cada pantalla, y un cierre inmediato mataría la carrera recién empezada.
 */
export function retainRace(): void {
  clearTimeout(releaseTimer);
}

export function releaseRace(): void {
  clearTimeout(releaseTimer);
  releaseTimer = setTimeout(stopRace, 150);
}

export function startRace(config: RaceConfig, meta: RaceMeta): void {
  clearTimeout(releaseTimer);
  stopRace();
  worker = new Worker(new URL('../../workers/race.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = onMessage;
  pendingEvents = [];
  live.snapshot = null;
  const firstPlayer = config.cars.find((c) => c.player)?.id ?? null;
  useRace.setState({ config, meta, snapshot: null, feed: [], result: null, speed: 1, paused: false, selectedId: firstPlayer });
  send({ type: 'init', config });
  send({ type: 'speed', value: 1 });
}

export function stopRace(): void {
  if (!worker) return;
  send({ type: 'stop' });
  worker.terminate();
  worker = null;
}

/**
 * Envía una orden al worker y la refleja ya en la interfaz, sin esperar a la
 * siguiente foto: así un botón o una casilla responden al instante.
 */
export function sendCommand(command: Command): void {
  send({ type: 'command', command });
  const snapshot = useRace.getState().snapshot;
  if (!snapshot) return;
  const cars = snapshot.cars.map((car) => {
    if (car.id !== command.id) return car;
    switch (command.type) {
      case 'pit':
        return { ...car, pitRequest: command.compound };
      case 'cancelPit':
        return { ...car, pitRequest: null };
      case 'pace':
        return { ...car, paceMode: command.value };
      case 'engine':
        return { ...car, engineMode: command.value };
      case 'energy':
        return { ...car, energyMode: command.value };
      case 'defend':
        return { ...car, defend: command.value };
      case 'teamOrder':
        return { ...car, teamOrder: command.value };
      case 'auto':
        return { ...car, autoStrategy: command.value };
    }
  });
  // Se retrasa el siguiente refresco para que una foto anterior a la orden no la deshaga un instante.
  lastUi = performance.now();
  useRace.setState({ snapshot: { ...snapshot, cars } });
}
export const setSpeed = (value: Speed) => send({ type: 'speed', value });
export const setPaused = (value: boolean) => send({ type: 'paused', value });
