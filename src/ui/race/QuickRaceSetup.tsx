import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  calendar, driverName, drivers, entriesFor, findCircuit, findDriver, findRound, findTeam, referenceLapFor, staff, teams,
} from '../../data/index.ts';
import { hash01 } from '../../engine/rng.ts';
import { buildCarSetup, buildRaceConfig, simulatedGrid, type Entry } from '../../engine/race/setup.ts';
import { planOptions, type StrategyContext } from '../../engine/race/strategy.ts';
import type { StrategyPlan } from '../../engine/race/types.ts';
import { PageHeader } from '../components/bits.tsx';
import { TeamLogo } from '../components/TeamLogo.tsx';
import { TrackMap } from '../components/TrackMap.tsx';
import { teamVars, useFormat } from '../format.ts';
import { startRace } from './controller.ts';
import { formatLap, TYRE_COLOR } from './panels.tsx';

const DEFAULT_ROUND = calendar.rounds.find((r) => r.circuitId === 'monza')?.round ?? 1;

/** Un plan por número de paradas: el mejor de 1, de 2 y de 3. */
function plansFor(ctx: StrategyContext): StrategyPlan[] {
  const seen = new Set<number>();
  return planOptions(ctx).filter((p) => (seen.has(p.stops) ? false : (seen.add(p.stops), true)));
}

/** Paso numerado del formulario: la preparación se lee como una lista de comprobación antes de salir. */
function Step({ n, title, note, children }: { n: number; title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-x-8 gap-y-4 border-t border-line-strong py-8 first:border-t-0 md:grid-cols-[3rem_minmax(0,1fr)]">
      <span className="num text-sm font-semibold text-fg-4" aria-hidden="true">{String(n).padStart(2, '0')}</span>
      <div className="min-w-0">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 className="display text-lg md:text-xl">{title}</h2>
          {note && <p className="max-w-[52ch] text-sm text-fg-3">{note}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

export function QuickRaceSetup() {
  const { t } = useTranslation();
  const f = useFormat();
  const navigate = useNavigate();
  const [round, setRound] = useState(DEFAULT_ROUND);
  const [teamId, setTeamId] = useState('ferrari');
  const [weather, setWeather] = useState<'auto' | 'dry'>('auto');
  /** Sustituciones de piloto: asiento original → piloto elegido. */
  const [swaps, setSwaps] = useState<Record<string, string>>({});
  const [planIndex, setPlanIndex] = useState<Record<string, number>>({});

  const info = findRound(round)!;
  const circuit = findCircuit(info.circuitId)!;
  const reference = referenceLapFor(round);
  const team = findTeam(teamId)!;

  const { grid, real, seats } = useMemo(() => {
    const base = entriesFor(round);
    const raw: Entry[] = base.real ? base.entries : simulatedGrid(base.entries, { teams, drivers, circuit }, (i) => hash01(round, i, 7));
    const mine = raw.filter((e) => e.teamId === teamId).map((e) => e.driverId);
    // Un piloto sustituto ocupa el puesto de parrilla del titular al que reemplaza.
    const taken = new Set<string>();
    const withSwaps = raw.map((e) => {
      const chosen = e.teamId === teamId ? swaps[e.driverId] ?? e.driverId : e.driverId;
      return { ...e, driverId: chosen };
    });
    const unique = withSwaps.filter((e) => (taken.has(e.driverId) ? false : (taken.add(e.driverId), true)));
    return { grid: unique, real: base.real, seats: mine };
  }, [round, teamId, swaps, circuit]);

  const myEntries = grid.filter((e) => e.teamId === teamId);
  const options = useMemo(
    () =>
      myEntries.map((entry) => {
        const setup = buildCarSetup(entry, { teams, drivers, staff, circuit, playerTeamId: teamId });
        const ctx: StrategyContext = {
          laps: circuit.laps, lengthKm: circuit.lengthKm, circuitWear: circuit.tyreWear, pitLossS: circuit.pit.timeLossS,
          refLapS: reference.seconds, carTyreWear: setup.carTyreWear, tyreManagement: setup.tyreManagement,
        };
        return { entry, plans: plansFor(ctx) };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [grid, teamId, circuit, reference.seconds],
  );

  const start = () => {
    const plans: Record<string, StrategyPlan> = {};
    for (const o of options) plans[o.entry.driverId] = o.plans[planIndex[o.entry.driverId] ?? 0] ?? o.plans[0]!;
    const config = buildRaceConfig({
      seed: (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0,
      circuit, refLapS: reference.seconds, grid, teams, drivers, staff, playerTeamId: teamId, weather, plans,
    });
    startRace(config, { round, playerTeamId: teamId, gridReal: real });
    navigate('/race/live');
  };

  const optionClass = (active: boolean) => `min-h-11 cursor-pointer border px-4 text-left transition-colors ${active ? 'border-fg bg-ink-850' : 'border-line-strong hover:border-fg-3 hover:bg-ink-900'}`;

  return (
    <div style={teamVars(team)}>
      <PageHeader kicker={t('home.mode.quick.title')} title={t('race.quick')} lead={t('race.quickLead')} />

      <div className="grid gap-x-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="min-w-0 border-b border-line-strong">
          <Step n={1} title={t('race.round')}>
            <label className="sr-only" htmlFor="quick-round">{t('race.round')}</label>
            <select id="quick-round" value={round} onChange={(e) => { setRound(Number(e.target.value)); setSwaps({}); setPlanIndex({}); }} className="field text-lg">
              {calendar.rounds.map((r) => (
                <option key={r.round} value={r.round}>
                  {String(r.round).padStart(2, '0')} · {f.gp(r)}
                </option>
              ))}
            </select>
            <p className="mt-3 text-sm text-fg-3">
              {real ? t('race.gridReal') : t('race.gridSim')}
              {reference.estimated && <span className="mt-1 block text-timing-slower">{t('race.refEstimated')}</span>}
            </p>
          </Step>

          <Step n={2} title={t('race.team')}>
            <div role="radiogroup" aria-label={t('race.team')} className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {teams.map((item) => {
                const active = teamId === item.id;
                return (
                  <button key={item.id} type="button" role="radio" aria-checked={active} onClick={() => { setTeamId(item.id); setSwaps({}); setPlanIndex({}); }} className={`${optionClass(active)} relative flex items-center gap-3 py-2`} style={teamVars(item)}>
                    {active && <span className="absolute inset-y-0 left-0 w-1 bg-(--team)" aria-hidden="true" />}
                    <TeamLogo team={item} size={28} />
                    <span className="cond truncate text-lg leading-none">{item.name}</span>
                  </button>
                );
              })}
            </div>
          </Step>

          <Step n={3} title={t('race.drivers')}>
            <div className="grid gap-3 sm:grid-cols-2">
              {seats.map((seat, i) => (
                <div key={seat}>
                  <label className="label mb-1.5 block" htmlFor={`seat-${i}`}>{t('race.seat', { n: i + 1 })}</label>
                  <select id={`seat-${i}`} value={swaps[seat] ?? seat} onChange={(e) => setSwaps((s) => ({ ...s, [seat]: e.target.value }))} className="field">
                    {drivers
                      .filter((d) => d.id === seat || !grid.some((e) => e.driverId === d.id) || (swaps[seat] ?? seat) === d.id)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {driverName(d)} ({d.code})
                        </option>
                      ))}
                  </select>
                </div>
              ))}
            </div>
          </Step>

          <Step n={4} title={t('race.strategy')} note={t('race.strategyNote')}>
            <div className="grid gap-6 sm:grid-cols-2">
              {options.map(({ entry, plans }) => {
                const driver = findDriver(entry.driverId);
                const best = plans[0]?.estTimeS ?? 0;
                const chosen = planIndex[entry.driverId] ?? 0;
                return (
                  <div key={entry.driverId} role="radiogroup" aria-label={`${t('race.strategy')}: ${driver ? driverName(driver) : ''}`}>
                    <p className="cond mb-2 text-xl">{driver ? driverName(driver) : entry.driverId}</p>
                    <div className="grid gap-2">
                      {plans.map((plan, i) => (
                        <button key={i} type="button" role="radio" aria-checked={chosen === i} onClick={() => setPlanIndex((s) => ({ ...s, [entry.driverId]: i }))} className={`${optionClass(chosen === i)} py-3`}>
                          <span className="flex items-baseline justify-between gap-3">
                            <span className="font-semibold">{t('race.stops', { count: plan.stops })}</span>
                            <span className={`num text-sm ${i === 0 ? 'text-timing-personal' : 'text-fg-3'}`}>{i === 0 ? t('race.fastest') : t('race.slower', { value: (plan.estTimeS - best).toFixed(1) })}</span>
                          </span>
                          {/* Los stints como en la tabla de estrategia de la carrera: bloques de color con su letra. */}
                          <span className="mt-2.5 flex h-5 w-full gap-0.5">
                            {plan.stints.map((stint, k) => (
                              <span key={k} className="num flex items-center justify-center gap-1 text-[0.6875rem] font-semibold text-ink-950" style={{ width: `${(stint.laps / circuit.laps) * 100}%`, background: TYRE_COLOR[stint.compound] }}>
                                {t(`race.tyreLetter.${stint.compound}`)} {stint.laps}
                                <span className="sr-only"> {t(`race.tyre.${stint.compound}`)}</span>
                              </span>
                            ))}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Step>

          <Step n={5} title={t('race.conditions')} note={t('race.rainChance', { value: f.percent(circuit.rainProbability) })}>
            <div role="radiogroup" aria-label={t('race.conditions')} className="flex flex-wrap gap-2">
              {(['auto', 'dry'] as const).map((key) => (
                <button key={key} type="button" role="radio" aria-checked={weather === key} onClick={() => setWeather(key)} className={optionClass(weather === key)}>
                  {t(key === 'auto' ? 'race.weatherAuto' : 'race.weatherDry')}
                </button>
              ))}
            </div>
          </Step>
        </div>

        {/* Resumen pegado: circuito, cifras clave y el botón de salida siempre a mano. */}
        <aside className="mt-8 lg:sticky lg:top-24 lg:self-start">
          <div className="panel bracket">
            <p className="label flex items-center justify-between border-b border-line px-4 py-3">
              <span className="truncate">{f.gp(info)}</span>
              <span className="num">R{String(round).padStart(2, '0')}</span>
            </p>
            <div className="p-4">
              <TrackMap circuit={circuit} detailed className="h-auto w-full" />
            </div>
            <dl className="grid grid-cols-2 gap-px border-t border-line bg-line">
              {[
                [t('round.laps'), circuit.laps],
                [t('round.pitLoss'), t('round.seconds', { value: circuit.pit.timeLossS })],
                [t('round.tyreWear'), circuit.tyreWear],
                [t('race.refLap'), formatLap(reference.seconds)],
              ].map(([label, value]) => (
                <div key={label} className="bg-ink-900 px-4 py-3">
                  <dt className="label text-[0.625rem]">{label}</dt>
                  <dd className="num mt-1 text-lg font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <button type="button" onClick={start} disabled={myEntries.length === 0} className="btn btn-solid mt-3 min-h-14 w-full text-[0.9375rem] disabled:cursor-not-allowed disabled:opacity-40">
            {t('race.start')}
            <span aria-hidden="true">→</span>
          </button>
          <p className="mt-3 flex items-center gap-2 text-sm text-fg-3">
            <span className="h-4 w-1 bg-(--team)" aria-hidden="true" />
            {team.name}
          </p>
        </aside>
      </div>
    </div>
  );
}
