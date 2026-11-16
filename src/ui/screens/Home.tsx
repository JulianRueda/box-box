import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { calendar, driverName, drivers, findCircuit, findDriver, findResult, findRound, findTeam, results, teams } from '../../data/index.ts';
import { constructorStandings, driverStandings } from '../../engine/season/standings.ts';
import { TeamLogo } from '../components/TeamLogo.tsx';
import { TrackMap } from '../components/TrackMap.tsx';
import { stagger, teamVars, useFormat } from '../format.ts';

const MODES = [
  { key: 'quick', phase: 2 },
  { key: 'principal', phase: 4 },
  { key: 'create', phase: 4 },
  { key: 'career', phase: 7 },
] as const;

export function Home() {
  const { t } = useTranslation();
  const f = useFormat();
  const last = results.lastRound;

  const table = driverStandings(results.rounds, last);
  const leaderPoints = table[0]?.points ?? 0;
  const topTeamRow = constructorStandings(results.rounds, last, teams.map((x) => x.id))[0];
  const topTeam = topTeamRow && findTeam(topTeamRow.id);

  const lastRound = findRound(last);
  const lastWinner = findResult(last)?.race[0];
  const lastWinnerDriver = lastWinner && findDriver(lastWinner.driverId);
  const nextRound = calendar.rounds.find((r) => r.round > last);
  // El trazado de fondo es el de la próxima carrera; si la temporada acabó, el de la última.
  const heroCircuit = findCircuit((nextRound ?? lastRound)?.circuitId ?? '');

  const explore = [
    { to: '/teams', nav: 'nav.teams', text: 'home.explorer.teams', count: teams.length },
    { to: '/drivers', nav: 'nav.drivers', text: 'home.explorer.drivers', count: drivers.filter((d) => d.role === 'race').length },
    { to: '/calendar', nav: 'nav.calendar', text: 'home.explorer.calendar', count: calendar.rounds.length },
    { to: '/standings', nav: 'nav.standings', text: 'home.explorer.standings', count: last },
  ] as const;

  return (
    <>
      <section className="relative pb-6 pt-10 md:pt-20">
        {heroCircuit && (
          <TrackMap
            circuit={heroCircuit}
            draw
            decorative
            weight={3}
            className="pointer-events-none absolute -right-[12%] -top-6 -z-10 h-[min(88vw,46rem)] w-[min(88vw,46rem)] text-ink-800 md:-right-8"
          />
        )}

        <p className="label reveal mb-6">{t('home.kicker', { round: last })}</p>
        <h1 className="display text-[clamp(2.25rem,7.4vw,7rem)]">
          <span className="reveal block text-fg-4" style={stagger(1)}>{t('home.title1')}</span>
          <span className="reveal block text-fg-4" style={stagger(2)}>{t('home.title2')}</span>
          <span className="reveal block" style={stagger(3)}>{t('home.title3')}</span>
        </h1>

        <div className="mt-10 grid gap-x-16 gap-y-12 lg:mt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:items-start">
          <div className="reveal" style={stagger(4)}>
            <p className="max-w-[44ch] text-lg text-fg-2 md:text-xl">{t('home.lead')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/race" className="btn btn-solid min-h-13 px-7">
                {t('home.mode.quick.title')}
                <span aria-hidden="true">→</span>
              </Link>
              <Link to="/calendar" className="btn btn-ghost min-h-13 px-7">{t('home.explore')}</Link>
            </div>
          </div>

          {/* Monitor de la temporada: el mundial como una torre de tiempos. */}
          <div className="panel bracket reveal min-w-0" style={stagger(5)}>
            <p className="label flex items-center justify-between border-b border-line px-4 py-3">
              {t('home.leader')}
              <span className="num">R{String(last).padStart(2, '0')}</span>
            </p>
            <ol>
              {table.slice(0, 5).map((row) => {
                const driver = findDriver(row.id);
                const team = findTeam(row.teamId);
                if (!driver) return null;
                return (
                  <li key={row.id} style={teamVars(team)}>
                    <Link to={`/drivers/${driver.id}`} className="row row-link grid h-11 grid-cols-[1.5rem_0.25rem_2.75rem_minmax(0,1fr)_auto_3.25rem] items-center gap-3 px-4 hover:bg-ink-850">
                      <span className="num text-sm font-semibold text-fg-3">{row.position}</span>
                      <span className="h-5 w-1 bg-(--team)" aria-hidden="true" />
                      <span className="cond text-lg">{driver.code}</span>
                      <span className="truncate text-sm text-fg-2">{driverName(driver)}</span>
                      <span className="num text-xs text-fg-4">{row.position === 1 ? '' : `−${leaderPoints - row.points}`}</span>
                      <span className="num text-right font-semibold">{row.points}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
            {topTeam && topTeamRow && (
              <Link to={`/teams/${topTeam.id}`} className="row row-link flex items-center gap-3 px-4 py-3 hover:bg-ink-850">
                <TeamLogo team={topTeam} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="label block text-[0.625rem]">{t('home.constructorsLeader')}</span>
                  <span className="cond block truncate text-lg leading-tight">{topTeam.name}</span>
                </span>
                <span className="num font-semibold">{topTeamRow.points}</span>
              </Link>
            )}
            <div className="grid grid-cols-2">
              {lastRound && (
                <Link to={`/calendar/${lastRound.round}`} className="min-w-0 border-r border-line px-4 py-3 transition-colors hover:bg-ink-850">
                  <span className="label block text-[0.625rem]">{t('home.lastRace')}</span>
                  <span className="mt-1 block truncate text-sm">{f.gp(lastRound)}</span>
                  {lastWinnerDriver && <span className="block truncate text-sm text-fg-3">{t('home.winner')}: {driverName(lastWinnerDriver)}</span>}
                </Link>
              )}
              {nextRound ? (
                <Link to={`/calendar/${nextRound.round}`} className="min-w-0 px-4 py-3 transition-colors hover:bg-ink-850">
                  <span className="label block text-[0.625rem]">{t('home.nextRace')}</span>
                  <span className="mt-1 block truncate text-sm">{f.gp(nextRound)}</span>
                  <span className="num block text-sm text-fg-3">{f.dayMonth(nextRound.date)}</span>
                </Link>
              ) : (
                <p className="px-4 py-3">
                  <span className="label block text-[0.625rem]">{t('home.nextRace')}</span>
                  <span className="mt-1 block text-sm text-fg-3">{t('home.seasonOver')}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-20 md:mt-32">
        <h2 className="label mb-4">{t('home.modes')}</h2>
        <ul className="border-t border-line-strong">
          {MODES.map((mode, i) => {
            const body = (
              <>
                <span className="num text-sm text-fg-4">{String(i + 1).padStart(2, '0')}</span>
                <span className="min-w-0">
                  <span className={`display block text-[clamp(1.375rem,3.4vw,3rem)] ${mode.key === 'quick' ? '' : 'text-fg-4'}`}>{t(`home.mode.${mode.key}.title`)}</span>
                  <span className={`mt-2 block text-sm md:hidden ${mode.key === 'quick' ? 'text-fg-3' : 'text-fg-4'}`}>{t(`home.mode.${mode.key}.text`)}</span>
                </span>
                <span className={`hidden text-[0.9375rem] md:block ${mode.key === 'quick' ? 'text-fg-2' : 'text-fg-4'}`}>{t(`home.mode.${mode.key}.text`)}</span>
              </>
            );
            const grid = 'grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-4 py-6 md:grid-cols-[3rem_minmax(0,1.3fr)_minmax(0,1fr)_9rem] md:gap-x-8 md:py-7';
            return (
              <li key={mode.key} className="reveal" style={stagger(i)}>
                {mode.key === 'quick' ? (
                  <Link to="/race" className={`row row-link group ${grid}`}>
                    {body}
                    <span className="btn btn-solid justify-self-end group-hover:bg-timing-personal">{t('home.play')}</span>
                  </Link>
                ) : (
                  <div className={`row ${grid}`} aria-disabled="true">
                    {body}
                    <span className="label justify-self-end text-right text-[0.625rem] text-fg-4">{t('home.comingPhase', { phase: mode.phase })}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-20 md:mt-32">
        <h2 className="label mb-4">{t('home.explore')}</h2>
        <ul className="grid grid-cols-2 gap-px border border-line bg-line lg:grid-cols-4">
          {explore.map((item, i) => (
            <li key={item.to} className="reveal bg-ink-950" style={stagger(i)}>
              <Link to={item.to} className="group flex h-full min-h-44 flex-col justify-between gap-8 p-4 transition-colors hover:bg-ink-900 md:min-h-56 md:p-6">
                <span className="num text-[clamp(2.5rem,6vw,5rem)] font-semibold leading-none text-fg-4 transition-colors group-hover:text-fg">{String(item.count).padStart(2, '0')}</span>
                <span>
                  <span className="cond block text-2xl md:text-3xl">{t(item.nav)}</span>
                  <span className="mt-1 block text-sm text-fg-3">{t(item.text, { count: calendar.rounds.length })}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
