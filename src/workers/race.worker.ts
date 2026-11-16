/// <reference lib="webworker" />
/**
 * Ejecuta la simulación fuera del hilo de la interfaz.
 * Avanza el motor en pasos fijos según el tiempo real transcurrido y la velocidad
 * elegida, y envía una foto del estado unas 20 veces por segundo.
 */
import { applyCommand, classification, createRace, step, type Race } from '../engine/race/sim.ts';
import { takeSnapshot } from '../engine/race/snapshot.ts';
import type { LoggedCommand, RaceEvent } from '../engine/race/types.ts';
import type { FromWorker, Speed, ToWorker } from './protocol.ts';

const FRAME_MS = 50;
/** Tope de pasos por fotograma: si el equipo no da más, la carrera se ralentiza en vez de congelar el worker. */
const MAX_STEPS_PER_FRAME = 400;

let race: Race | null = null;
let speed: Speed = 1;
let paused = false;
let timer: ReturnType<typeof setInterval> | null = null;
let last = 0;
let owed = 0;
let log: LoggedCommand[] = [];

const post = (message: FromWorker) => self.postMessage(message);

function drainEvents(): RaceEvent[] {
  if (!race) return [];
  const events = race.state.events;
  race.state.events = [];
  return events;
}

function frame(): void {
  if (!race) return;
  const now = performance.now();
  const elapsed = Math.min(250, now - last);
  last = now;
  if (!paused && !race.state.finished) {
    owed += (elapsed / 1000) * speed;
    let steps = 0;
    while (owed >= race.config.dt && steps < MAX_STEPS_PER_FRAME && !race.state.finished) {
      step(race);
      owed -= race.config.dt;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) owed = 0;
  }
  post({ type: 'snapshot', snapshot: takeSnapshot(race, drainEvents()), speed, paused });
  if (race.state.finished) {
    post({ type: 'finished', classification: classification(race), log });
    stop();
  }
}

function stop(): void {
  if (timer !== null) clearInterval(timer);
  timer = null;
}

self.onmessage = (event: MessageEvent<ToWorker>) => {
  const message = event.data;
  switch (message.type) {
    case 'init':
      stop();
      race = createRace(message.config);
      log = [];
      owed = 0;
      paused = false;
      last = performance.now();
      post({ type: 'snapshot', snapshot: takeSnapshot(race, []), speed, paused });
      timer = setInterval(frame, FRAME_MS);
      break;
    case 'command':
      if (!race) break;
      // Se anota el tick para poder repetir la carrera con las mismas órdenes.
      log.push({ tick: race.state.tick, command: message.command });
      applyCommand(race, message.command);
      break;
    case 'speed':
      speed = message.value;
      break;
    case 'paused':
      paused = message.value;
      break;
    case 'stop':
      stop();
      race = null;
      break;
  }
};
