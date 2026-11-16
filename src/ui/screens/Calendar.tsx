import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { calendar, driverName, findCircuit, findDriver, findResult, findRound, findTeam, results, teams } from '../../data/index.ts';
import type { Round } from '../../data/schemas.ts';
import { constructorStandings, driverStandings } from '../../engine/season/standings.ts';
import { PageHeader, Section, Stat } from '../components/bits.tsx';
import { ConstructorStandingsTable, DriverStandingsTable, QualifyingTable, RaceTable } from '../components/tables.tsx';
import { TrackLegend, TrackMap } from '../components/TrackMap.tsx';
import { stagger, teamVars, useFormat } from '../format.ts';
import { NotFound } from './NotFound.tsx';

const SESSION_ORDER = ['fp1', 'fp2', 'fp3', 'sprintQualifying', 'sprint', 'qualifying', 'race'] as const;

export function Calendar() {
  const { t } = useTranslation();
  const f = useFormat();
  const done = results.rounds.length;
  const total = calendar.rounds.length;

  return (
    <>
      <PageHeader title={t('calendar.title')} lead={t('calendar.lead', { total, done, left: total - done })} />
      <ol className="mt-4">
        {calendar.rounds.map((round, i) => {
          const result = findResult(round.round);
          const winner = result?.race[0];
          const winnerDriver = winner && findDriver(winner.driverId);
          const circuit = findCircuit(round.circuitId);
          return (
            <li key={round.round} className="reveal" style={{ ...teamVars(winner && findTeam(winner.teamId)), ...stagger(Math.min(i, 12)) }}>
              <Link to={`/calendar/${round.round}`} className="row row-link group grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-x-4 py-4 md:grid-cols-[3.5rem_5.5rem_minmax(0,1.4fr)_minmax(0,1fr)_4rem] md:gap-x-6">
                <span className="display text-3xl text-fg-4 group-hover:text-signal md:text-4xl">{String(round.round).padStart(2, '0')}</span>
                <span className="num hidden text-sm text-fg-3 md:block">{f.dayMonth(round.date)}</span>
                <span className="min-w-0">
                  <span className="display block truncate text-2xl md:text-3xl">
                    {f.gp(round)}
                    {round.sprint && <span className="label ml-3 border border-line-strong px-1.5 py-px align-middle text-[0.6875rem]">{t('calendar.sprint')}</span>}
                  </span>
                  <span className="block truncate text-sm text-fg-3">
                    <span className="num md:hidden">{f.dayMonth(round.date)} · </span>
                    {round.circuitName} · {round.locality}
                  </span>
                </span>
                <span className="col-start-2 mt-1 min-w-0 md:col-start-auto md:mt-0">
                  {winnerDriver ? (
                    <span className="flex items-center gap-2.5">
                      <span className="h-5 w-1 shrink-0 bg-(--team)" aria-hidden="true" />
                      <span className="truncate text-fg-2">{driverName(winnerDriver)}</span>
                    </span>
                  ) : (
                    <span className="label text-fg-4">{t('calendar.upcoming')}</span>
                  )}
                </span>
                {circuit && <TrackMap circuit={circuit} className="col-start-3 row-span-2 row-start-1 h-12 w-12 opacity-60 transition-opacity group-hover:opacity-100 md:col-start-auto md:row-span-1 md:row-start-auto md:h-14 md:w-14" />}
              </Link>
            </li>
          );
        })}
      </ol>
    </>
  );
}

type Tab = 'race' | 'qualifying' | 'sprint' | 'standings';

export function RoundDetail() {
  const { t } = useTranslation();
  const f = useFormat();
  const { round: param = '' } = useParams();
  const round = findRound(Number(param));
  if (!round) return <NotFound />;
  // La clave reinicia la pestaña elegida al cambiar de ronda.
  return <RoundView key={round.round} round={round} t={t} f={f} />;
}

function RoundView({ round, t, f }: { round: Round; t: ReturnType<typeof useTranslation>['t']; f: ReturnType<typeof useFormat> }) {
  const [tab, setTab] = useState<Tab>('race');
  const result = findResult(round.round);
  const circuit = findCircuit(round.circuitId);
  const prev = findRound(round.round - 1);
  const next = findRound(round.round + 1);
  const name = f.gp(round);

  const tabs: Tab[] = result ? ['race', 'qualifying', ...(result.sprint ? (['sprint'] as const) : []), 'standings'] : [];
  const tabId = (key: Tab) => `tab-${key}`;

  return (
    <>
      <PageHeader
        kicker={
          <>
            {t('calendar.round', { round: round.round })} · {f.longDate(round.date)}
            {round.sprint && ` · ${t('calendar.sprint')}`}
          </>
        }
        title={name}
        lead={`${round.circuitName} · ${round.locality}`}
        aside={
          <nav className="flex gap-px border border-line bg-line" aria-label={t('calendar.title')}>
            {[
              { to: prev, label: t('round.prev'), glyph: '←' },
              { to: next, label: t('round.next'), glyph: '→' },
            ].map(({ to, label, glyph }) =>
              to ? (
                <Link key={label} to={`/calendar/${to.round}`} aria-label={`${label}: ${f.gp(to)}`} className="flex h-11 w-12 items-center justify-center bg-ink-900 text-xl hover:bg-ink-850 hover:text-signal">
                  <span aria-hidden="true">{glyph}</span>
                </Link>
              ) : (
                <span key={label} className="flex h-11 w-12 items-center justify-center bg-ink-900 text-xl text-fg-4" aria-hidden="true">{glyph}</span>
              ),
            )}
          </nav>
        }
      />

      <div className="grid gap-x-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="min-w-0">
          {result ? (
            <section className="mt-10">
              <div role="tablist" aria-label={t('round.tabs')} className="flex gap-6 overflow-x-auto border-b border-line-strong">
                {tabs.map((key) => (
                  <button
                    key={key}
                    id={tabId(key)}
                    role="tab"
                    type="button"
                    aria-selected={tab === key}
                    aria-controls="round-panel"
                    onClick={() => setTab(key)}
                    className={`display relative min-h-12 cursor-pointer whitespace-nowrap text-xl tracking-wide transition-colors ${tab === key ? 'text-fg after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-signal' : 'text-fg-3 hover:text-fg'}`}
                  >
                    {t(`round.${key}`)}
                  </button>
                ))}
              </div>
              <div id="round-panel" role="tabpanel" aria-labelledby={tabId(tab)} className="mt-2">
                {tab === 'race' && <RaceTable entries={result.race} caption={`${name} — ${t('round.race')}`} />}
                {tab === 'qualifying' && <QualifyingTable entries={result.qualifying} caption={`${name} — ${t('round.qualifying')}`} />}
                {tab === 'sprint' && result.sprint && <RaceTable entries={result.sprint} caption={`${name} — ${t('round.sprint')}`} />}
                {tab === 'standings' && (
                  <div className="grid gap-x-10 gap-y-8 pt-4 xl:grid-cols-2">
                    <DriverStandingsTable rows={driverStandings(results.rounds, round.round)} caption={t('standings.drivers')} />
                    <ConstructorStandingsTable rows={constructorStandings(results.rounds, round.round, teams.map((x) => x.id))} caption={t('standings.constructors')} />
                  </div>
                )}
              </div>
            </section>
          ) : (
            <Section title={t('round.schedule')} note={t('round.notRun')}>
              <ul className="border-t border-line-strong">
                {SESSION_ORDER.map((key) => {
                  const at = round.sessions[key];
                  if (!at) return null;
                  return (
                    <li key={key} className="row flex items-baseline justify-between gap-6 py-3.5">
                      <span className="display text-2xl">{t(`session.${key}`)}</span>
                      <span className="num text-fg-2">{f.sessionTime(at)}</span>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}
        </div>

        {circuit && (
          <aside>
            <Section title={t('round.circuit')}>
              <div className="panel p-4">
                <TrackMap circuit={circuit} detailed className="h-auto w-full" />
              </div>
              <div className="mt-4">
                <TrackLegend />
              </div>
              <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5">
                <Stat label={t('round.length')} value={<span className="num">{t('round.km', { value: f.number(circuit.lengthKm) })}</span>} />
                <Stat label={t('round.laps')} value={<span className="num">{circuit.laps}</span>} sub={t('round.km', { value: f.number(Math.round(circuit.lengthKm * circuit.laps * 10) / 10) })} />
                <Stat label={t('round.downforce')} value={t(`round.downforceLevel.${circuit.downforceLevel}`)} />
                <Stat label={t('round.pitLoss')} value={<span className="num">{t('round.seconds', { value: circuit.pit.timeLossS })}</span>} />
                <Stat label={t('round.tyreWear')} value={<span className="num">{circuit.tyreWear}</span>} />
                <Stat label={t('round.overtaking')} value={<span className="num">{circuit.overtakingDifficulty}</span>} />
                <Stat label={t('round.safetyCar')} value={<span className="num">{f.percent(circuit.safetyCarProbability)}</span>} />
                <Stat label={t('round.rain')} value={<span className="num">{f.percent(circuit.rainProbability)}</span>} />
              </dl>
              <p className="mt-6 text-sm text-fg-4">{t('round.estimatedNote')}</p>
            </Section>
          </aside>
        )}
      </div>
    </>
  );
}
