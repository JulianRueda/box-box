/**
 * Generador pseudoaleatorio determinista (mulberry32).
 * El estado es un entero que vive dentro del estado de la partida, de modo
 * que guardar/cargar o repetir una carrera reproduce exactamente los mismos números.
 */
export interface RngHolder {
  rng: number;
}

export function seedFrom(text: string | number): number {
  if (typeof text === 'number') return text >>> 0;
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Número uniforme en [0, 1). Avanza el estado. */
export function rand(holder: RngHolder): number {
  holder.rng = (holder.rng + 0x6d2b79f5) | 0;
  let t = Math.imul(holder.rng ^ (holder.rng >>> 15), 1 | holder.rng);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const randRange = (holder: RngHolder, min: number, max: number) => min + rand(holder) * (max - min);

/** Normal estándar (Box–Muller). */
export function randNormal(holder: RngHolder): number {
  const u = Math.max(rand(holder), 1e-12);
  const v = rand(holder);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Ruido determinista en [0, 1) a partir de enteros, sin consumir el RNG de la partida. */
export function hash01(a: number, b: number, c = 0): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x165667b1, 0xc2b2ae35) ^ Math.imul(c + 0x27d4eb2f, 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}
