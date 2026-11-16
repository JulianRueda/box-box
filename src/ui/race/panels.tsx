import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { CarSnap, RaceSnapshot } from '../../engine/race/snapshot.ts';
import type { CarSetup, Compound, EnergyMode, Level, RaceEvent, TeamOrder } from '../../engine/race/types.ts';
import { sendCommand, useRace } from './controller.ts';

export const TYRE_COLOR: Record<Compound, string> = { soft: '#e9584d', medium: '#ead35a', hard: '#f1f1f4', inter: '#52c27a', wet: '#4d8fe0' };
const COMPOUNDS: Compound[] = ['soft', 'medium', 'hard', 'inter', 'wet'];
const LEVELS: Level[] = ['conserve', 'standard', 'push', 'max'];
const ENERGY_MODES: EnergyMode[] = ['save', 'balanced', 'attack', 'overtake'];
const ORDERS: TeamOrder[] = ['free', 'hold', 'letBy'];

export function formatLap(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return m > 0 ? `${m}:${s.toFixed(3).padStart(6, '0')}` : s.toFixed(3);
}

/** Neumático con su letra: el compuesto nunca se distingue solo por el color. */
export function TyreChip({ compound, size = 22 }: { compound: Compound; size?: number }) {
  const { t } = useTranslation();
  return (
    <span
      title={t(`race.tyre.${compound}`)}
      className="num inline-flex shrink-0 items-center justify-center rounded-full border-2 bg-ink-950 font-semibold text-fg"
      style={{ width: size, height: size, borderColor: TYRE_COLOR[compound], fontSize: size * 0.48 }}
    >
      {t(`race.tyreLetter.${compound}`)}
      <span className="sr-only"> {t(`race.tyre.${compound}`)}</span>
    </span>
  );
}

function Tag({ children, title, tone = 'neutral' }: { children: ReactNode; title?: string; tone?: 'neutral' | 'alert' | 'good' }) {
  const color = tone === 'alert' ? 'border-signal text-signal' : tone === 'good' ? 'border-timing-personal text-timing-personal' : 'border-line-strong text-fg-3';
  return (
    <span title={title} className={`label border px-1 py-px text-[0.625rem] ${color}`}>
      {children}
    </span>
  );
}

// ------------------------------------------------------------ Torre de tiempos

export function TimingTower({ snapshot, setups }: { snapshot: RaceSnapshot; setups: Map<string, CarSetup> }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'interval' | 'gap'>('interval');
  const selectedId = useRace((s) => s.selectedId);
  const select = useRace((s) => s.select);

  const gapText = (car: CarSnap): string => {
    if (car.status === 'out') return t(`race.out.${car.outReason ?? 'mechanical'}`);
    if (car.position === 1) return t('race.leader');
    if (mode === 'gap' && car.lapsBehind > 0) return t('race.lapsDown', { count: car.lapsBehind });
    const value = mode === 'gap' ? car.gapToLeaderS : car.intervalS;
    return value === null ? '—' : `+${value.toFixed(value < 100 ? 3 : 1)}`;
  };

  return (
    <div>
      <div className="flex items-center justify-end border-b border-line-strong pb-2">
        <div role="group" aria-label={t('race.gapMode')} className="flex border border-line-strong">
          {(['interval', 'gap'] as const).map((key) => (
            <button key={key} type="button" aria-pressed={mode === key} onClick={() => setMode(key)} className={`label min-h-8 cursor-pointer px-3 ${mode === key ? 'bg-fg text-ink-950' : 'hover:text-fg'}`}>
              {t(`race.${key}`)}
            </button>
          ))}
        </div>
      </div>
      <ol>
        {snapshot.cars.map((car) => {
          const setup = setups.get(car.id);
          if (!setup) return null;
          const out = car.status === 'out';
          return (
            <li key={car.id}>
              <button
                type="button"
                onClick={() => select(car.id)}
                aria-pressed={selectedId === car.id}
                className={`grid h-9 w-full cursor-pointer grid-cols-[1.75rem_0.25rem_2.75rem_minmax(0,1fr)_auto_1.5rem] items-center gap-2 border-b border-line px-1 text-left transition-colors hover:bg-ink-850 ${selectedId === car.id ? 'bg-ink-800' : car.player ? 'bg-ink-900' : ''} ${out ? 'text-fg-4' : ''}`}
              >
                <span className="num text-right text-sm font-semibold">{out ? '' : car.position}</span>
                <span className="h-5 w-1" style={{ background: setup.color }} aria-hidden="true" />
                <span className={`display text-sm ${car.player ? 'text-fg' : ''}`}>{setup.code}</span>
                <span className="num truncate text-right text-[0.8125rem] text-fg-2">{gapText(car)}</span>
                <span className="flex items-center gap-1">
                  {car.status === 'pit' && <Tag tone="alert">{t('race.pitTag')}</Tag>}
                  {car.status === 'finished' && <Tag>{t('race.finTag')}</Tag>}
                  {car.overtakeActive && <Tag tone="good" title={t('race.overtakeTagLong')}>{t('race.overtakeTag')}</Tag>}
                  {car.pitRequest && car.player && <Tag>{t('race.pitTag')}</Tag>}
                  {!out && <TyreChip compound={car.compound} size={20} />}
                  {!out && <span className="num w-5 text-right text-xs text-fg-3">{car.tyreAge}</span>}
                </span>
                <span className="num text-right text-xs text-fg-3" title={t('race.stopsHeader')}>{out ? '' : car.pitStops}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ------------------------------------------------------------ Estrategia de todos

export function StrategyTable({ snapshot, setups }: { snapshot: RaceSnapshot; setups: Map<string, CarSetup> }) {
  const { t } = useTranslation();
  const total = snapshot.totalLaps;
  return (
    <div>
      <ol className="border-t border-line-strong">
        {snapshot.cars.map((car) => {
          const setup = setups.get(car.id);
          if (!setup) return null;
          const cliffLap = Math.min(total, Math.max(1, car.lap + 1) + Math.floor(car.lapsToCliff));
          return (
            <li key={car.id} className="grid h-9 grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-2 border-b border-line px-1">
              <span className={`display text-sm ${car.status === 'out' ? 'text-fg-4' : ''}`}>{setup.code}</span>
              <div className="relative h-4 bg-ink-850" title={car.status === 'out' ? undefined : t('race.nextStop', { lap: cliffLap })}>
                {car.stints.map((stint, i) => {
                  const end = stint.endLap ?? Math.max(stint.startLap, car.lap);
                  return (
                    <span
                      key={i}
                      className="num absolute inset-y-0 flex items-center justify-center border-r border-ink-950 text-[0.625rem] font-semibold text-ink-950"
                      style={{ left: `${(stint.startLap / total) * 100}%`, width: `${(Math.max(0, end - stint.startLap) / total) * 100}%`, background: TYRE_COLOR[stint.compound] }}
                    >
                      {end - stint.startLap >= 4 ? t(`race.tyreLetter.${stint.compound}`) : ''}
                    </span>
                  );
                })}
                {car.status !== 'out' && car.status !== 'finished' && (
                  <span className="absolute inset-y-[-3px] w-px bg-fg" style={{ left: `${(cliffLap / total) * 100}%` }} aria-hidden="true" />
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ------------------------------------------------------------ Panel de un piloto del jugador

function Segmented<T extends string>({ label, options, value, onChange, text }: { label: string; options: readonly T[]; value: T; onChange: (v: T) => void; text: (v: T) => string }) {
  return (
    <div>
      <p className="label mb-1">{label}</p>
      <div role="group" aria-label={label} className="grid auto-cols-fr grid-flow-col border border-line-strong">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(option)}
            className={`min-h-9 cursor-pointer px-1 text-[0.8125rem] leading-tight transition-colors ${value === option ? 'bg-fg font-semibold text-ink-950' : 'text-fg-2 hover:bg-ink-850'}`}
          >
            {text(option)}
          </button>
        ))}
      </div>
    </div>
  );
}

function Meter({ label, value, text, tone }: { label: string; value: number; text: string; tone?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="label">{label}</span>
        <span className="num text-[0.8125rem] text-fg-2">{text}</span>
      </div>
      <div className="mt-1 h-1.5 bg-ink-800">
        <div className="h-full origin-left transition-transform duration-200" style={{ transform: `scaleX(${Math.min(1, Math.max(0, value))})`, background: tone ?? 'var(--color-fg-2)' }} />
      </div>
    </div>
  );
}

/** Desgaste por rueda: el modelo lleva un valor por juego; aquí se reparte con un sesgo fijo por eje. */
const CORNERS = [
  ['fl', 1.06],
  ['fr', 1.0],
  ['rl', 0.96],
  ['rr', 0.92],
] as const;

export function DriverPanel({ car, setup, snapshot }: { car: CarSnap; setup: CarSetup; snapshot: RaceSnapshot }) {
  const { t } = useTranslation();
  const [wing, setWing] = useState(false);
  const id = car.id;
  const active = car.status === 'racing' || car.status === 'pit' || car.status === 'grid';
  const codeOf = (carId: string | null) => (carId ? useRace.getState().config?.cars.find((c) => c.id === carId)?.code ?? '' : '');

  const sectorTone = (i: number): string => {
    const last = car.lastSectors[i];
    if (last === null || last === undefined) return 'text-fg-4';
    if (last === snapshot.bestSectors[i]) return 'text-timing-best';
    if (last === car.bestSectors[i]) return 'text-timing-personal';
    return 'text-timing-slower';
  };

  return (
    <section className="border border-line bg-ink-900" aria-label={setup.code}>
      <header className="flex items-center gap-3 border-b border-line px-3 py-2" style={{ boxShadow: `inset 4px 0 0 ${setup.color}` }}>
        <span className="num text-lg font-semibold">P{car.position}</span>
        <span className="display text-xl">{setup.code}</span>
        <TyreChip compound={car.compound} />
        <span className="num text-sm text-fg-3">{t('race.tyreAge', { count: car.tyreAge })}</span>
        <span className="ml-auto text-right leading-tight">
          <span className="num block text-sm">{formatLap(car.lastLapS)}</span>
          <span className="label text-[0.625rem]">{t('race.lastLap')}</span>
        </span>
      </header>

      <div className="grid gap-3 p-3">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3">
          {/* Cuatro ruedas, colocadas como en el coche */}
          <div className="grid grid-cols-2 gap-1" role="group" aria-label={t('race.tyres')}>
            {CORNERS.map(([key, bias]) => {
              const wear = Math.min(1, car.wear * bias);
              const left = Math.round((1 - wear) * 100);
              return (
                <div key={key} title={t(`race.corner.${key}`)} className="relative flex h-10 w-9 items-end overflow-hidden border border-line-strong bg-ink-950">
                  <span className="absolute inset-x-0 bottom-0" style={{ height: `${left}%`, background: wear > 0.72 ? 'var(--color-signal)' : wear > 0.5 ? 'var(--color-timing-slower)' : 'var(--color-timing-personal)', opacity: 0.55 }} aria-hidden="true" />
                  <span className="num relative w-full pb-0.5 text-center text-xs font-semibold">{left}</span>
                  <span className="sr-only">{t(`race.corner.${key}`)} %</span>
                </div>
              );
            })}
          </div>
          <div className="grid content-between gap-2">
            <p className="text-[0.8125rem] text-fg-2">
              {car.lapsToCliff < 1 ? <span className="font-semibold text-signal">{t('race.cliff')}</span> : t('race.toCliff', { count: Math.floor(car.lapsToCliff) })}
              <span className="text-fg-4"> · </span>
              {car.heat < 0.85 ? t('race.tempCold') : t('race.tempOk')}
            </p>
            <Meter label={t('race.fuel')} value={car.fuelLaps / Math.max(1, snapshot.totalLaps)} text={t('race.fuelValue', { kg: car.fuelKg.toFixed(0), laps: car.fuelLaps.toFixed(1) })} />
            <Meter label={t('race.battery')} value={car.soc} text={car.clipping ? t('race.clipping') : `${Math.round(car.soc * 100)} %`} tone={car.clipping ? 'var(--color-signal)' : 'var(--color-timing-personal)'} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem]">
          <span className="label">{t('race.sectors')}</span>
          {[0, 1, 2].map((i) => (
            <span key={i} className={`num font-semibold ${sectorTone(i)}`}>
              {car.lastSectors[i] ? car.lastSectors[i]!.toFixed(3) : '—'}
            </span>
          ))}
          <span className="num ml-auto text-fg-3">{t('race.bestLap')} {formatLap(car.bestLapS)}</span>
        </div>

        {(car.damage > 0.05 || car.puncture) && (
          <p role="status" className="text-[0.8125rem] font-semibold text-signal">
            {car.puncture ? t('race.puncture') : `${t('race.damage')} ${Math.round(car.damage * 100)} %`}
          </p>
        )}

        {active && (
          <>
            <Segmented label={t('race.pace')} options={LEVELS} value={car.paceMode} onChange={(value) => sendCommand({ type: 'pace', id, value })} text={(v) => t(`race.level.${v}`)} />
            <Segmented label={t('race.engine')} options={LEVELS} value={car.engineMode} onChange={(value) => sendCommand({ type: 'engine', id, value })} text={(v) => t(`race.level.${v}`)} />
            <Segmented label={t('race.energy')} options={ENERGY_MODES} value={car.energyMode} onChange={(value) => sendCommand({ type: 'energy', id, value })} text={(v) => t(`race.energyMode.${v}`)} />

            <div>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <p className="label">{car.pitRequest ? t('race.boxRequested') : t('race.boxNow')}</p>
                {car.pitProjection && (
                  <p className="text-[0.8125rem] text-fg-2">
                    {t('race.pitWindowText', { position: car.pitProjection.position })}
                    {car.pitProjection.aheadId && <span className="text-fg-3"> · {t('race.behindOf', { code: codeOf(car.pitProjection.aheadId) })}</span>}
                  </p>
                )}
              </div>
              <div role="group" aria-label={t('race.box')} className="grid grid-cols-5 gap-1">
                {COMPOUNDS.map((compound) => (
                  <button
                    key={compound}
                    type="button"
                    aria-pressed={car.pitRequest === compound}
                    aria-label={`${t('race.boxNow')}: ${t(`race.tyre.${compound}`)}`}
                    onClick={() => sendCommand(car.pitRequest === compound ? { type: 'cancelPit', id } : { type: 'pit', id, compound, frontWing: wing || car.damage > 0.3 })}
                    className={`flex min-h-11 cursor-pointer items-center justify-center border transition-colors ${car.pitRequest === compound ? 'border-fg bg-ink-800' : 'border-line-strong hover:bg-ink-850'}`}
                  >
                    <TyreChip compound={compound} size={24} />
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-[0.8125rem]">
                <label className="flex min-h-6 cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={wing} onChange={(e) => setWing(e.target.checked)} className="h-4 w-4 accent-(--color-signal)" />
                  {t('race.frontWing')}
                </label>
                <label className="flex min-h-6 cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={car.defend} onChange={(e) => sendCommand({ type: 'defend', id, value: e.target.checked })} className="h-4 w-4 accent-(--color-signal)" />
                  {t('race.defend')}
                </label>
                <label className="flex min-h-6 cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={car.autoStrategy} onChange={(e) => sendCommand({ type: 'auto', id, value: e.target.checked })} className="h-4 w-4 accent-(--color-signal)" />
                  {t('race.auto')}
                </label>
              </div>
            </div>

            <Segmented label={t('race.teamOrder')} options={ORDERS} value={car.teamOrder} onChange={(value) => sendCommand({ type: 'teamOrder', id, value })} text={(v) => t(`race.order.${v}`)} />
          </>
        )}
      </div>
    </section>
  );
}

// ------------------------------------------------------------ Dirección de carrera

export function useEventText(): (event: RaceEvent) => string | null {
  const { t } = useTranslation();
  const code = (id: string) => useRace.getState().config?.cars.find((c) => c.id === id)?.code ?? id;
  return (e) => {
    switch (e.type) {
      case 'start':
        return t('race.msg.start');
      case 'overtake':
        return t('race.msg.overtake', { by: code(e.by), on: code(e.on), position: e.position });
      case 'pit':
        return t(e.slow ? 'race.msg.pitSlow' : 'race.msg.pit', { code: code(e.id), compound: t(`race.tyre.${e.compound}`), time: e.stationaryS.toFixed(1) });
      case 'incident':
        return t(`race.msg.${e.kind}`, { code: code(e.id) });
      case 'flag':
        return t(`race.msg.flag_${e.flag}`);
      case 'fastestLap':
        return t('race.msg.fastestLap', { code: code(e.id), time: formatLap(e.timeS) });
      case 'weather':
        return t(`race.msg.${e.kind}`);
      case 'advice':
        return t(`race.msg.advice_${e.code}`, { code: code(e.id), compound: e.compound ? t(`race.tyre.${e.compound}`) : '' });
      case 'penalty':
        return t('race.msg.penalty', { code: code(e.id), seconds: e.seconds });
      case 'chequered':
        return null; // solo se anuncia el ganador, al terminar
      case 'finished':
        return t('race.msg.finished');
    }
  };
}

const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export function Feed({ feed }: { feed: RaceEvent[] }) {
  const { t } = useTranslation();
  const text = useEventText();
  const lines = feed.map((e) => ({ e, line: text(e) })).filter((x): x is { e: RaceEvent; line: string } => x.line !== null);
  return (
    <section aria-label={t('race.feed')}>
      <h2 className="display border-b border-line-strong pb-2 text-lg">{t('race.feed')}</h2>
      {lines.length === 0 ? (
        <p className="py-3 text-sm text-fg-4">{t('race.feedEmpty')}</p>
      ) : (
        <ol className="max-h-64 overflow-y-auto" aria-live="polite">
          {lines.slice(0, 40).map(({ e, line }, i) => (
            <li key={`${e.t}-${i}`} className={`grid grid-cols-[3rem_minmax(0,1fr)] gap-2 border-b border-line py-2 text-[0.8125rem] ${e.type === 'advice' ? 'text-fg' : e.type === 'flag' || e.type === 'incident' ? 'text-fg-2' : 'text-fg-3'}`}>
              <span className="num text-fg-4">{clock(e.t)}</span>
              <span className={e.type === 'advice' ? 'font-semibold' : ''}>{line}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// ------------------------------------------------------------ Clima

export function WeatherStrip({ snapshot }: { snapshot: RaceSnapshot }) {
  const { t } = useTranslation();
  const wetPct = `${Math.round(snapshot.wetness * 100)} %`;
  return (
    <div className="flex items-center gap-4 text-[0.8125rem]">
      <p className="leading-tight">
        <span className="block font-semibold">{snapshot.rain > 0 ? t('race.raining') : t('race.dry')}</span>
        <span className="text-fg-3">{snapshot.wetness > 0.02 ? t('race.trackWet', { value: wetPct }) : t('race.trackTemp', { value: snapshot.trackTempC })}</span>
      </p>
      <div role="img" aria-label={`${t('race.forecast')}: ${snapshot.forecast.map((f) => `${t('race.inMin', { min: f.inMin })} ${Math.round(f.rainChance * 100)} %`).join(', ')}`} className="flex h-8 items-end gap-0.5" title={t('race.forecast')}>
        {snapshot.forecast.map((f) => (
          <span key={f.inMin} className="w-2 bg-ink-800" style={{ height: '100%' }}>
            <span className="block w-full bg-[#4d8fe0]" style={{ height: `${Math.round(f.rainChance * 100)}%`, marginTop: `${100 - Math.round(f.rainChance * 100)}%` }} />
          </span>
        ))}
      </div>
    </div>
  );
}
