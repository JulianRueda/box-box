import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { driverName, findDriver, findRound, findTeam } from '../../data/index.ts';
import { racePoints } from '../../engine/season/points.ts';
import type { Flag } from '../../engine/race/types.ts';
import { SPEEDS } from '../../workers/protocol.ts';
import { SectorMark } from '../components/bits.tsx';
import { useFormat } from '../format.ts';
import { releaseRace, retainRace, setPaused, setSpeed, startRace, useRace } from './controller.ts';
import { DriverPanel, Feed, formatLap, StrategyTable, TimingTower, WeatherStrip } from './panels.tsx';
import { TrackCanvas } from './TrackCanvas.tsx';

/** Con bandera, el aviso ocupa un bloque de color pleno; en verde se queda en un punto discreto. */
const FLAG_STYLE: Record<Flag, string> = {
  green: 'text-fg-2',
  yellow: 'bg-flag px-3 text-ink-950',
  vsc: 'bg-flag px-3 text-ink-950',
  sc: 'bg-flag px-3 text-ink-950',
};

export function RaceScreen() {
  const { t } = useTranslation();
  const f = useFormat();
  const navigate = useNavigate();
  const config = useRace((s) => s.config);
  const meta = useRace((s) => s.meta);
  const snapshot = useRace((s) => s.snapshot);
  const feed = useRace((s) => s.feed);
  const speed = useRace((s) => s.speed);
  const paused = useRace((s) => s.paused);
  const result = useRace((s) => s.result);
  const [side, setSide] = useState<'tower' | 'strategy'>('tower');

  const setups = useMemo(() => new Map(config?.cars.map((c) => [c.id, c]) ?? []), [config]);

  useEffect(() => {
    retainRace();
    return releaseRace;
  }, []);
  // Espacio: pausa. Teclas 1–5: velocidad.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ['INPUT', 'BUTTON', 'SELECT'].includes(e.target.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setPaused(!useRace.getState().paused);
      }
      const index = Number(e.key) - 1;
      if (index >= 0 && index < SPEEDS.length) setSpeed(SPEEDS[index]!);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!config || !meta) return <Navigate to="/race" replace />;
  const round = findRound(meta.round);
  const gp = round ? f.gp(round) : '';

  if (result && snapshot) {
    const winner = findDriver(result[0]!.id);
    const podium = result.filter((row) => row.status !== 'out' && row.position <= 3);
    return (
      <div className="mx-auto max-w-[88rem] px-4 pb-20 md:px-8">
        <header className="reveal border-b border-line-strong pb-8 pt-10 md:pt-16">
          <p className="label mb-4 flex items-center gap-3">
            <SectorMark />
            {t('race.result')} · {gp}
          </p>
          <h1 className="display text-balance text-[clamp(1.75rem,5vw,4.75rem)]">{winner ? t('race.resultLead', { name: driverName(winner), gp }) : gp}</h1>
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" onClick={() => startRace(config, meta)} className="btn btn-solid">
              {t('race.replay')}
            </button>
            <Link to="/race" className="btn btn-ghost">
              {t('race.again')}
            </Link>
          </div>
        </header>

        {/* Podio: los tres primeros, cada uno con el color de su equipo. */}
        <div className="mt-px grid grid-cols-3 gap-px bg-line">
          {podium.map((row) => {
            const setup = setups.get(row.id);
            const driver = findDriver(row.id);
            return (
              <div key={row.id} className="relative min-w-0 bg-ink-900 p-4 md:p-6" style={{ boxShadow: `inset 0 3px 0 ${setup?.color ?? 'transparent'}` }}>
                <p className="num text-[clamp(2rem,6vw,4.5rem)] font-bold leading-none text-fg-3">{row.position}</p>
                <p className="cond mt-4 truncate text-[clamp(1.5rem,3.2vw,2.75rem)] leading-none">{setup?.code}</p>
                <p className="mt-1 hidden truncate text-sm text-fg-3 sm:block">{driver ? driverName(driver) : row.id}</p>
              </div>
            );
          })}
        </div>

        <div className="overflow-x-auto">
          <table className="mt-8 w-full min-w-[30rem] border-collapse text-left">
            <caption className="sr-only">{t('race.result')}</caption>
            <thead>
              <tr className="border-b border-line-strong">
                {[t('table.pos'), t('table.driver'), t('table.team'), t('table.laps'), t('table.time'), t('race.bestLap'), t('race.stopsHeader'), t('table.points')].map((h, i) => (
                  <th key={h} scope="col" className={`label py-3 ${i >= 3 ? 'text-right' : ''} ${i === 2 ? 'hidden md:table-cell' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.map((row) => {
                const setup = setups.get(row.id);
                const driver = findDriver(row.id);
                const out = row.status === 'out';
                const time = out ? t(`race.out.${row.outReason ?? 'mechanical'}`) : row.position === 1 ? formatLap(row.timeS) : row.timeS !== null ? `+${row.timeS.toFixed(3)}` : t('race.lapsDown', { count: row.lapsBehind });
                const fastest = snapshot.fastestLap?.id === row.id;
                return (
                  <tr key={row.id} className={`row ${setup?.player ? 'bg-ink-900' : ''} ${out ? 'text-fg-3' : ''}`}>
                    <td className="num py-3 pl-2 text-lg font-semibold">{out ? '—' : row.position}</td>
                    <td>
                      <span className="flex items-center gap-3">
                        <span className="h-5 w-1 shrink-0" style={{ background: setup?.color }} aria-hidden="true" />
                        <span className="cond w-10 text-lg">{setup?.code}</span>
                        <span className="hidden truncate text-fg-2 sm:block">{driver ? driverName(driver) : row.id}</span>
                      </span>
                    </td>
                    <td className="hidden text-fg-3 md:table-cell">{setup ? findTeam(setup.teamId)?.name : ''}</td>
                    <td className="num text-right text-sm text-fg-3">{row.laps}</td>
                    <td className="num whitespace-nowrap text-right text-sm">
                      {time}
                      {row.penaltyS > 0 && <span className="ml-2 text-alert">+{row.penaltyS} s</span>}
                    </td>
                    <td className={`num text-right text-sm ${fastest ? 'font-semibold text-timing-best' : 'text-fg-3'}`}>{formatLap(row.bestLapS)}</td>
                    <td className="num text-right text-sm text-fg-3">{row.pitStops}</td>
                    <td className="num pr-2 text-right font-semibold">{out ? 0 : racePoints(row.position)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4" role="status">
        <SectorMark className="animate-pulse" />
        <p className="label">{gp}</p>
      </div>
    );
  }
  const mine = snapshot.cars.filter((c) => c.player);
  const flagged = snapshot.flag !== 'green';
  const progress = Math.min(1, (snapshot.lap - 1) / Math.max(1, snapshot.totalLaps));

  return (
    <div className="grid h-dvh grid-rows-[auto_minmax(0,1fr)] lg:overflow-hidden">
      {/* Barra de estado: vuelta, bandera, clima y velocidad */}
      <header className="relative z-20 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line-strong bg-ink-950 px-3 py-2 md:px-5">
        <div className="flex items-center gap-4">
          <span className="hidden sm:block"><SectorMark /></span>
          <p className="leading-tight">
            <span className="cond block text-lg leading-none">{gp}</span>
            <span className="num mt-1 block text-sm font-semibold text-fg-2">{t('race.lapOf', { lap: snapshot.lap, total: snapshot.totalLaps })}</span>
          </p>
        </div>
        <p role="status" className={`label flex min-h-7 items-center gap-2 font-semibold ${FLAG_STYLE[snapshot.flag]}`}>
          {!flagged && <span className="h-2 w-2 rounded-full bg-timing-personal" aria-hidden="true" />}
          {t(`race.flag.${snapshot.flag}`)}
        </p>
        <WeatherStrip snapshot={snapshot} />

        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-center gap-2 border-t border-line-strong bg-ink-950 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:static lg:ml-auto lg:border-0 lg:p-0">
          <button type="button" onClick={() => setPaused(!paused)} aria-pressed={paused} className={`btn min-w-28 ${paused ? 'bg-flag text-ink-950' : 'btn-ghost'}`}>
            {paused ? t('race.resume') : t('race.pause')}
          </button>
          <div role="group" aria-label={t('race.speed')} className="flex border border-line-strong">
            {SPEEDS.map((value) => (
              <button key={value} type="button" aria-pressed={speed === value} onClick={() => setSpeed(value)} className={`num min-h-11 min-w-11 cursor-pointer px-2 text-sm transition-colors ${speed === value ? 'bg-fg font-semibold text-ink-950' : 'text-fg-2 hover:bg-ink-850'}`}>
                x{value}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(t('race.exitConfirm'))) navigate('/race');
            }}
            className="label min-h-11 cursor-pointer px-3 transition-colors hover:text-fg"
          >
            {t('race.exit')}
          </button>
        </div>

        {/* Avance de la carrera sobre el borde inferior de la barra; amarillo con bandera. */}
        <span className={`absolute inset-x-0 -bottom-px h-0.5 origin-left transition-transform duration-500 ${flagged ? 'bg-flag' : 'bg-fg'}`} style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />
      </header>

      <div className="grid gap-px bg-line pb-16 lg:grid-cols-[19rem_minmax(0,1fr)_23rem] lg:overflow-hidden lg:pb-0">
        {/* En el celular el mapa va primero; en escritorio, en el centro */}
        <div className="order-1 h-[46dvh] bg-ink-950 lg:order-2 lg:h-auto">
          <TrackCanvas circuit={config.circuit} cars={config.cars} />
        </div>

        <aside className="order-3 bg-ink-950 p-3 lg:order-1 lg:overflow-y-auto">
          <div role="tablist" className="mb-3 flex gap-5">
            {(['tower', 'strategy'] as const).map((key) => (
              <button key={key} type="button" role="tab" aria-selected={side === key} onClick={() => setSide(key)} className={`label min-h-9 cursor-pointer text-[0.75rem] transition-colors ${side === key ? 'text-fg shadow-[inset_0_-2px_0_var(--color-fg)]' : 'hover:text-fg'}`}>
                {t(key === 'tower' ? 'race.tower' : 'race.strategyTab')}
              </button>
            ))}
          </div>
          {side === 'tower' ? <TimingTower snapshot={snapshot} setups={setups} /> : <StrategyTable snapshot={snapshot} setups={setups} />}
        </aside>

        <aside className="order-2 grid content-start gap-3 bg-ink-950 p-3 lg:order-3 lg:overflow-y-auto">
          {mine.map((car) => {
            const setup = setups.get(car.id);
            return setup ? <DriverPanel key={car.id} car={car} setup={setup} snapshot={snapshot} /> : null;
          })}
          <Feed feed={feed} />
        </aside>
      </div>
    </div>
  );
}
