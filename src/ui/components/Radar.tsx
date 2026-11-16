export interface RadarAxis {
  label: string;
  value: number;
}

/** Gráfico de radar en SVG para valores 0–100. */
export function Radar({ axes, title }: { axes: RadarAxis[]; title: string }) {
  const size = 320;
  const c = size / 2;
  const radius = 104;
  const n = axes.length;
  const point = (i: number, r: number): [number, number] => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [c + Math.cos(angle) * r, c + Math.sin(angle) * r];
  };
  const ring = (scale: number) => axes.map((_, i) => point(i, radius * scale).join(',')).join(' ');
  // La escala empieza en 40: por debajo no hay pilotos y así se aprecian las diferencias.
  const reach = (value: number) => radius * Math.max(0.04, (value - 40) / 60);
  const shape = axes.map((a, i) => point(i, reach(a.value)).join(',')).join(' ');

  return (
    <svg viewBox={`-60 0 ${size + 120} ${size}`} className="h-auto w-full max-w-[27rem]" role="img" aria-label={title}>
      {[0.25, 0.5, 0.75, 1].map((s) => (
        <polygon key={s} points={ring(s)} fill="none" stroke={s === 1 ? 'var(--color-line-strong)' : 'var(--color-line)'} strokeWidth="1" />
      ))}
      {axes.map((_, i) => {
        const [x, y] = point(i, radius);
        return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="var(--color-line)" />;
      })}
      <polygon points={shape} fill="var(--team)" fillOpacity="0.2" stroke="var(--team-ink)" strokeWidth="1.5" strokeLinejoin="round" />
      {axes.map((a, i) => {
        const [x, y] = point(i, reach(a.value));
        return <rect key={i} x={x - 2.5} y={y - 2.5} width="5" height="5" fill="var(--team-ink)" />;
      })}
      {axes.map((a, i) => {
        const [x, y] = point(i, radius + 20);
        const anchor = Math.abs(x - c) < 8 ? 'middle' : x > c ? 'start' : 'end';
        return (
          <g key={a.label}>
            <text x={x} y={y - 2} textAnchor={anchor} fontFamily="var(--font-mono)" fontWeight="500" fontSize="10" letterSpacing="0.08em" fill="var(--color-fg-3)">
              {a.label.toUpperCase()}
            </text>
            <text x={x} y={y + 12} textAnchor={anchor} fontFamily="var(--font-mono)" fontWeight="600" fontSize="12.5" fill="var(--color-fg)">
              {a.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
