import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  calendar, driverName, drivers, entriesFor, findCircuit, findDriver, findRound, findTeam, referenceLapFor, staff, teams,
} from '../../data/index.ts';
import { hash01 } from '../../engine/rng.ts';
import { buildCarSetup, buildRaceConfig, simulatedGrid, type Entry } from '../../engine/race/setup.ts';
import { planOptions, type StrategyContext } from '../../engine/race/strategy.ts';
import type { StrategyPlan } from '../../engine/race/types.ts';
import { PageHeader, Section } from '../components/bits.tsx';
import { TeamLogo } from '../components/TeamLogo.tsx';
import { TrackMap } from '../components/TrackMap.tsx';
import { teamVars, useFormat } from '../format.ts';
import { startRace } from './controller.ts';
import { formatLap, TyreChip } from './panels.tsx';

const DEFAULT_ROUND = calendar.rounds.find((r) => r.circuitId === 'monza')?.round ?? 1;

/** Un plan por número de paradas: el mejor de 1, de 2 y de 3. */
function plansFor(ctx: StrategyContext): StrategyPlan[] {
  const seen = new Set<number>();
  return planOptions(ctx).filter((p) => (seen.has(p.stops) ? false : (seen.add(p.stops), true)));
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

  const pillClass = (active: boolean) => `min-h-11 cursor-pointer border px-4 text-left transition-colors ${active ? 'border-fg bg-ink-850' : 'border-line-strong hover:bg-ink-900'}`;

  return (
    <>
      <PageHeader kicker={t('home.mode.quick.title')} title={t('race.quick')} lead={t('race.quickLead')} />

      <div className="grid gap-x-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="min-w-0">
          <Section title={t('race.round')}>
            <label className="sr-only" htmlFor="quick-round">{t('race.round')}</label>
            <select id="quick-round" value={round} onChange={(e) => { setRound(Number(e.target.value)); setSwaps({}); setPlanIndex({}); }} className="min-h-12 w-full cursor-pointer border border-line-strong bg-ink-900 px-3 text-lg">
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
          </Section>

          <Section title={t('race.team')}>
            <div role="radiogroup" aria-label={t('race.team')} className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {teams.map((item) => (
                <button key={item.id} type="button" role="radio" aria-checked={teamId === item.id} onClick={() => { setTeamId(item.id); setSwaps({}); setPlanIndex({}); }} className={`${pillClass(teamId === item.id)} flex items-center gap-3 py-2`} style={teamVars(item)}>
                  <TeamLogo team={item} size={28} />
                  <span className="display truncate text-base">{item.name}</span>
                </button>
              ))}
            </div>
          </Section>

          <Section title={t('race.drivers')}>
            <div className="grid gap-3 sm:grid-cols-2">
              {seats.map((seat, i) => (
                <div key={seat}>
                  <label className="label mb-1 block" htmlFor={`seat-${i}`}>{t('race.seat', { n: i + 1 })}</label>
                  <select id={`seat-${i}`} value={swaps[seat] ?? seat} onChange={(e) => setSwaps((s) => ({ ...s, [seat]: e.target.value }))} className="min-h-12 w-full cursor-pointer border border-line-strong bg-ink-900 px-3">
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
          </Section>

          <Section title={t('race.strategy')} note={t('race.strategyNote')}>
            <div className="grid gap-6 sm:grid-cols-2">
              {options.map(({ entry, plans }) => {
                const driver = findDriver(entry.driverId);
                const best = plans[0]?.estTimeS ?? 0;
                const chosen = planIndex[entry.driverId] ?? 0;
                return (
                  <div key={entry.driverId} role="radiogroup" aria-label={`${t('race.strategy')}: ${driver ? driverName(driver) : ''}`}>
                    <p className="display mb-2 text-lg">{driver ? driverName(driver) : entry.driverId}</p>
                    <div className="grid gap-2">
                      {plans.map((plan, i) => (
                        <button key={i} type="button" role="radio" aria-checked={chosen === i} onClick={() => setPlanIndex((s) => ({ ...s, [entry.driverId]: i }))} className={`${pillClass(chosen === i)} py-3`}>
                          <span className="flex items-baseline justify-between gap-3">
                            <span className="font-semibold">{t('race.stops', { count: plan.stops })}</span>
                            <span className="num text-sm text-fg-3">{i === 0 ? t('race.fastest') : t('race.slower', { value: (plan.estTimeS - best).toFixed(1) })}</span>
                          </span>
                          <span className="mt-2 flex h-6 w-full overflow-hidden">
                            {plan.stints.map((stint, k) => (
                              <span key={k} className="flex items-center gap-1 border-r-2 border-ink-950 bg-ink-800 px-1" style={{ width: `${(stint.laps / circuit.laps) * 100}%` }}>
                                <TyreChip compound={stint.compound} size={18} />
                                <span className="num text-xs text-fg-2">{stint.laps}</span>
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
          </Section>

          <Section title={t('race.conditions')} note={t('race.rainChance', { value: f.percent(circuit.rainProbability) })}>
            <div role="radiogroup" aria-label={t('race.conditions')} className="flex flex-wrap gap-2">
              {(['auto', 'dry'] as const).map((key) => (
                <button key={key} type="button" role="radio" aria-checked={weather === key} onClick={() => setWeather(key)} className={pillClass(weather === key)}>
                  {t(key === 'auto' ? 'race.weatherAuto' : 'race.weatherDry')}
                </button>
              ))}
            </div>
          </Section>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Section title={f.gp(info)}>
            <div className="panel p-4" style={teamVars(team)}>
              <TrackMap circuit={circuit} detailed className="h-auto w-full" />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div><dt className="label">{t('round.laps')}</dt><dd className="num text-lg">{circuit.laps}</dd></div>
              <div><dt className="label">{t('round.pitLoss')}</dt><dd className="num text-lg">{t('round.seconds', { value: circuit.pit.timeLossS })}</dd></div>
              <div><dt className="label">{t('round.tyreWear')}</dt><dd className="num text-lg">{circuit.tyreWear}</dd></div>
              <div><dt className="label">{t('race.refLap')}</dt><dd className="num text-lg">{formatLap(reference.seconds)}</dd></div>
            </dl>
            <button type="button" onClick={start} disabled={myEntries.length === 0} className="display mt-6 min-h-14 w-full cursor-pointer bg-signal px-6 text-lg text-white transition-colors hover:bg-fg hover:text-ink-950">
              {t('race.start')}
            </button>
          </Section>
        </aside>
      </div>
    </>
  );
}
