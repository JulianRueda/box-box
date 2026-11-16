import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { CarSetup, TrackInput } from '../../engine/race/types.ts';
import { readableOn } from '../format.ts';
import { live, useRace } from './controller.ts';

const PAD = 0.07;
const SECTOR_COLORS = ['#e9584d', '#5aa9e6', '#ead35a'];
/** Desplazamiento del pit lane hacia el interior, en unidades del trazado. */
const PIT_OFFSET = 0.022;

interface View {
  scale: number;
  x: number;
  y: number;
}

/** Punto del trazado (y su normal) en la posición s de la vuelta. */
function pointAt(track: [number, number][], s: number): { x: number; y: number; nx: number; ny: number } {
  const n = track.length;
  const f = (s - Math.floor(s)) * n;
  const i = Math.floor(f) % n;
  const a = track[i]!;
  const b = track[(i + 1) % n]!;
  const t = f - Math.floor(f);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  return { x: a[0] + dx * t, y: a[1] + dy * t, nx: -dy / len, ny: dx / len };
}

/**
 * Mapa de carrera en Canvas 2D. Se dibuja en cada fotograma leyendo la última
 * foto del worker y extrapolando la posición de cada coche con su velocidad,
 * para que el movimiento sea fluido a cualquier velocidad de simulación.
 * Rueda o pellizco para acercar, arrastrar para mover, doble clic para centrar.
 */
export function TrackCanvas({ circuit, cars }: { circuit: TrackInput; cars: CarSetup[] }) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef<View>({ scale: 1, x: 0, y: 0 });
  const selectedId = useRace((s) => s.selectedId);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const setups = new Map(cars.map((c) => [c.id, c]));
    const track = circuit.track;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let width = 0;
    let height = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const toScreen = (x: number, y: number): [number, number] => {
      const size = Math.min(width, height) * (1 - PAD * 2);
      const ox = (width - size) / 2;
      const oy = (height - size) / 2;
      const v = view.current;
      return [(ox + x * size - width / 2) * v.scale + width / 2 + v.x, (oy + y * size - height / 2) * v.scale + height / 2 + v.y];
    };

    const strokeSpan = (from: number, to: number, color: string, lineWidth: number, offset = 0) => {
      const n = track.length;
      const a = Math.round(from * n);
      let b = Math.round(to * n);
      if (b <= a) b += n;
      ctx.beginPath();
      for (let i = a; i <= b; i++) {
        const p = pointAt(track, i / n);
        const [sx, sy] = toScreen(p.x + p.nx * offset, p.y + p.ny * offset);
        if (i === a) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'butt';
      ctx.stroke();
    };

    const draw = () => {
      frame = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, width, height);
      const zoom = view.current.scale;
      const base = Math.max(6, Math.min(width, height) * 0.018) * Math.sqrt(zoom);

      strokeSpan(0, 1, '#3a3a48', base * 1.5);
      const bounds = [0, circuit.sectors[0], circuit.sectors[1], 1];
      SECTOR_COLORS.forEach((color, i) => strokeSpan(bounds[i]!, bounds[i + 1]!, color, Math.max(1.5, base * 0.16)));
      for (const [from, to] of circuit.overtakeZones) strokeSpan(from, to, 'rgba(96, 211, 148, 0.34)', base * 1.5);
      strokeSpan(circuit.pit.entry, circuit.pit.exit, '#6b6b7b', Math.max(1.5, base * 0.3), PIT_OFFSET);

      // Línea de meta
      const start = pointAt(track, 0);
      const [lx1, ly1] = toScreen(start.x - start.nx * 0.02, start.y - start.ny * 0.02);
      const [lx2, ly2] = toScreen(start.x + start.nx * 0.02, start.y + start.ny * 0.02);
      ctx.beginPath();
      ctx.moveTo(lx1, ly1);
      ctx.lineTo(lx2, ly2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(2, base * 0.3);
      ctx.stroke();

      const snapshot = live.snapshot;
      if (!snapshot) return;
      // Segundos de simulación transcurridos desde la última foto, acotados para no pasarse si el worker se retrasa.
      const ahead = live.paused || reduceMotion ? 0 : Math.min(0.12, (performance.now() - live.at) / 1000) * live.speed;
      const selected = selectedRef.current;
      const radius = Math.max(5, base * 0.62);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Dónde saldría de boxes el coche seleccionado
      const mine = snapshot.cars.find((c) => c.id === selected);
      if (mine?.pitProjection && mine.status === 'racing') {
        const p = pointAt(track, mine.pitProjection.s);
        const [gx, gy] = toScreen(p.x, p.y);
        ctx.beginPath();
        ctx.arc(gx, gy, radius * 1.25, 0, Math.PI * 2);
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (snapshot.safetyCarS !== null) {
        const p = pointAt(track, snapshot.safetyCarS);
        const [sx, sy] = toScreen(p.x, p.y);
        ctx.fillStyle = '#f5c400';
        ctx.fillRect(sx - radius, sy - radius * 0.7, radius * 2, radius * 1.4);
        ctx.fillStyle = '#15151e';
        ctx.font = `700 ${Math.round(radius * 0.95)}px Titillium Web, sans-serif`;
        ctx.fillText('SC', sx, sy + 0.5);
      }

      // De atrás hacia delante, y los del jugador al final para que queden encima.
      const ordered = [...snapshot.cars].reverse().sort((a, b) => Number(a.player) - Number(b.player));
      for (const car of ordered) {
        if (car.status === 'out') continue;
        const setup = setups.get(car.id);
        if (!setup) continue;
        const moving = car.status === 'racing' || car.status === 'pit';
        const s = car.s + (moving ? car.rate * ahead : 0);
        const p = pointAt(track, s);
        const off = car.status === 'pit' ? PIT_OFFSET : 0;
        const [x, y] = toScreen(p.x + p.nx * off, p.y + p.ny * off);
        const r = car.player ? radius * 1.3 : radius;

        if (car.id === selected) {
          ctx.beginPath();
          ctx.arc(x, y, r + 4, 0, Math.PI * 2);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = setup.color;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#15151e';
        ctx.stroke();

        if (car.player || zoom > 1.6 || car.position === 1) {
          ctx.font = `700 ${Math.round(r * 0.95)}px Titillium Web, sans-serif`;
          ctx.fillStyle = readableOn(setup.color);
          ctx.fillText(String(setup.number ?? ''), x, y + 0.5);
          ctx.font = `700 ${Math.round(Math.max(10, r))}px Titillium Web, sans-serif`;
          ctx.fillStyle = '#ffffff';
          ctx.fillText(setup.code, x, y - r - 8);
        }
      }
    };
    frame = requestAnimationFrame(draw);

    // --- Zoom y paneo (ratón y táctil)
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    const clampView = () => {
      const v = view.current;
      v.scale = Math.min(6, Math.max(1, v.scale));
      const limit = (Math.min(width, height) * (v.scale - 1)) / 2 + 40;
      v.x = Math.min(limit, Math.max(-limit, v.x));
      v.y = Math.min(limit, Math.max(-limit, v.y));
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      view.current.scale *= e.deltaY < 0 ? 1.15 : 1 / 1.15;
      clampView();
    };
    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    };
    const onMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        view.current.x += e.clientX - prev.x;
        view.current.y += e.clientY - prev.y;
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        if (pinch > 0) view.current.scale *= d / pinch;
        pinch = d;
      }
      clampView();
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      pinch = 0;
    };
    const reset = () => (view.current = { scale: 1, x: 0, y: 0 });
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('dblclick', reset);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('dblclick', reset);
    };
  }, [circuit, cars]);

  return (
    <div className="relative h-full w-full">
      <canvas ref={canvasRef} role="img" aria-label={t('race.map')} className="h-full w-full cursor-grab touch-none active:cursor-grabbing" />
      <button
        type="button"
        onClick={() => (view.current = { scale: 1, x: 0, y: 0 })}
        className="label absolute bottom-3 right-3 min-h-9 cursor-pointer border border-line-strong bg-ink-950/80 px-3 text-fg-2 hover:text-fg"
      >
        {t('race.resetView')}
      </button>
    </div>
  );
}
