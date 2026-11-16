import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { driverName, findDriver, findRound, findTeam } from '../../data/index.ts';
import { racePoints } from '../../engine/season/points.ts';
import type { Flag } from '../../engine/race/types.ts';
import { SPEEDS } from '../../workers/protocol.ts';
import { useFormat } from '../format.ts';
import { releaseRace, retainRace, setPaused, setSpeed, startRace, useRace } from './controller.ts';
import { DriverPanel, Feed, formatLap, StrategyTable, TimingTower, WeatherStrip } from './panels.tsx';
import { TrackCanvas } from './TrackCanvas.tsx';

const FLAG_STYLE: Record<Flag, string> = {
  green: 'bg-ink-800 text-fg-2',
  yellow: 'bg-[#f5c400] text-ink-950',
  vsc: 'bg-[#f5c400] text-ink-950',
  sc: 'bg-[#f5c400] text-ink-950',
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
    return (
      <div className="mx-auto max-w-[70rem] px-4 pb-16 md:px-8">
        <header className="border-b border-line pb-6 pt-10">
          <p className="label mb-3 text-signal">{t('race.result')} · {gp}</p>
          <h1 className="display text-[clamp(2rem,5vw,3.75rem)]">{winner ? t('race.resultLead', { name: driverName(winner), gp }) : gp}</h1>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={() => startRace(config, meta)} className="display min-h-11 cursor-pointer bg-fg px-5 text-sm text-ink-950 hover:bg-signal hover:text-white">
              {t('race.replay')}
            </button>
            <Link to="/race" className="display flex min-h-11 items-center border border-line-strong px-5 text-sm hover:border-fg">
              {t('race.again')}
            </Link>
          </div>
        </header>
        <div className="overflow-x-auto">
          <table className="mt-4 w-full min-w-[30rem] border-collapse text-left">
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
                    <td className="display py-3 text-xl">{out ? '—' : row.position}</td>
                    <td>
                      <span className="flex items-center gap-3">
                        <span className="h-6 w-1 shrink-0" style={{ background: setup?.color }} aria-hidden="true" />
                        <span className="display w-11 text-lg">{setup?.code}</span>
                        <span className="hidden truncate text-fg-2 sm:block">{driver ? driverName(driver) : row.id}</span>
                      </span>
                    </td>
                    <td className="hidden text-fg-3 md:table-cell">{setup ? findTeam(setup.teamId)?.name : ''}</td>
                    <td className="num text-right text-fg-3">{row.laps}</td>
                    <td className="num whitespace-nowrap text-right">
                      {time}
                      {row.penaltyS > 0 && <span className="ml-2 text-signal">+{row.penaltyS} s</span>}
                    </td>
                    <td className={`num text-right ${fastest ? 'font-semibold text-timing-best' : 'text-fg-3'}`}>{formatLap(row.bestLapS)}</td>
                    <td className="num text-right text-fg-3">{row.pitStops}</td>
                    <td className="num text-right font-semibold">{out ? 0 : racePoints(row.position)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (!snapshot) return <div className="p-8 text-fg-3" role="status">{gp}</div>;
  const mine = snapshot.cars.filter((c) => c.player);

  return (
    <div className="grid h-dvh grid-rows-[auto_minmax(0,1fr)] lg:overflow-hidden">
      {/* Barra de estado: vuelta, bandera, clima y velocidad */}
      <header className="z-20 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-ink-950 px-3 py-2 md:px-5">
        <p className="leading-tight">
          <span className="display block text-lg">{gp}</span>
          <span className="num text-sm text-fg-2">{t('race.lapOf', { lap: snapshot.lap, total: snapshot.totalLaps })}</span>
        </p>
        <p role="status" className={`display px-3 py-1 text-sm ${FLAG_STYLE[snapshot.flag]}`}>{t(`race.flag.${snapshot.flag}`)}</p>
        <WeatherStrip snapshot={snapshot} />

        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-center gap-2 border-t border-line bg-ink-950 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:static lg:ml-auto lg:border-0 lg:p-0">
          <button type="button" onClick={() => setPaused(!paused)} aria-pressed={paused} className={`display min-h-11 min-w-24 cursor-pointer px-4 text-sm ${paused ? 'bg-signal text-white' : 'border border-line-strong hover:bg-ink-850'}`}>
            {paused ? t('race.resume') : t('race.pause')}
          </button>
          <div role="group" aria-label={t('race.speed')} className="flex border border-line-strong">
            {SPEEDS.map((value) => (
              <button key={value} type="button" aria-pressed={speed === value} onClick={() => setSpeed(value)} className={`num min-h-11 min-w-11 cursor-pointer px-2 text-sm ${speed === value ? 'bg-fg font-semibold text-ink-950' : 'hover:bg-ink-850'}`}>
                x{value}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(t('race.exitConfirm'))) navigate('/race');
            }}
            className="label min-h-11 cursor-pointer px-3 hover:text-fg"
          >
            {t('race.exit')}
          </button>
        </div>
      </header>

      <div className="grid gap-px bg-line pb-16 lg:grid-cols-[20rem_minmax(0,1fr)_23rem] lg:overflow-hidden lg:pb-0">
        {/* En el celular el mapa va primero; en escritorio, en el centro */}
        <div className="order-1 h-[46dvh] bg-ink-950 lg:order-2 lg:h-auto">
          <TrackCanvas circuit={config.circuit} cars={config.cars} />
        </div>

        <aside className="order-3 bg-ink-950 p-3 lg:order-1 lg:overflow-y-auto">
          <div role="tablist" className="mb-3 flex gap-5">
            {(['tower', 'strategy'] as const).map((key) => (
              <button key={key} type="button" role="tab" aria-selected={side === key} onClick={() => setSide(key)} className={`display min-h-9 cursor-pointer text-lg ${side === key ? 'text-fg shadow-[inset_0_-2px_0_var(--color-signal)]' : 'text-fg-3 hover:text-fg'}`}>
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
