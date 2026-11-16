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
  const shape = axes.map((a, i) => point(i, radius * Math.max(0.04, (a.value - 40) / 60)).join(',')).join(' ');

  return (
    <svg viewBox={`-56 0 ${size + 112} ${size}`} className="h-auto w-full max-w-[27rem]" role="img" aria-label={title}>
      {[0.25, 0.5, 0.75, 1].map((s) => (
        <polygon key={s} points={ring(s)} fill="none" stroke="var(--color-line-strong)" strokeWidth={s === 1 ? 1.2 : 0.6} />
      ))}
      {axes.map((_, i) => {
        const [x, y] = point(i, radius);
        return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="var(--color-line)" />;
      })}
      <polygon points={shape} fill="var(--team)" fillOpacity="0.28" stroke="var(--team)" strokeWidth="2" strokeLinejoin="round" />
      {axes.map((a, i) => {
        const [x, y] = point(i, radius + 20);
        const anchor = Math.abs(x - c) < 8 ? 'middle' : x > c ? 'start' : 'end';
        return (
          <g key={a.label}>
            <text x={x} y={y - 2} textAnchor={anchor} fontFamily="var(--font-display)" fontWeight="600" fontSize="11.5" letterSpacing="0.06em" fill="var(--color-fg-3)">
              {a.label.toUpperCase()}
            </text>
            <text x={x} y={y + 12} textAnchor={anchor} fontFamily="var(--font-mono)" fontWeight="600" fontSize="12" fill="var(--color-fg)">
              {a.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
