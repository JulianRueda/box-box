import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { calendar, driverName, findCircuit, findDriver, findResult, findRound, findTeam, results, teams } from '../../data/index.ts';
import { constructorStandings, driverStandings } from '../../engine/season/standings.ts';
import { Helmet } from '../components/Helmet.tsx';
import { TeamLogo } from '../components/TeamLogo.tsx';
import { TrackMap } from '../components/TrackMap.tsx';
import { stagger, teamVars, useFormat } from '../format.ts';

const MODES = [
  { key: 'quick', phase: 2 },
  { key: 'principal', phase: 4 },
  { key: 'create', phase: 4 },
  { key: 'career', phase: 7 },
] as const;

const EXPLORE = [
  { to: '/teams', nav: 'nav.teams', text: 'home.explorer.teams' },
  { to: '/drivers', nav: 'nav.drivers', text: 'home.explorer.drivers' },
  { to: '/calendar', nav: 'nav.calendar', text: 'home.explorer.calendar' },
  { to: '/standings', nav: 'nav.standings', text: 'home.explorer.standings' },
] as const;

export function Home() {
  const { t } = useTranslation();
  const f = useFormat();
  const last = results.lastRound;

  const leaderRow = driverStandings(results.rounds, last)[0];
  const leader = leaderRow && findDriver(leaderRow.id);
  const leaderTeam = leaderRow && findTeam(leaderRow.teamId);
  const topTeamRow = constructorStandings(results.rounds, last, teams.map((x) => x.id))[0];
  const topTeam = topTeamRow && findTeam(topTeamRow.id);

  const lastRound = findRound(last);
  const lastWinner = findResult(last)?.race[0];
  const lastWinnerDriver = lastWinner && findDriver(lastWinner.driverId);
  const nextRound = calendar.rounds.find((r) => r.round > last);
  const nextCircuit = nextRound && findCircuit(nextRound.circuitId);

  return (
    <>
      <section className="grid gap-x-12 gap-y-10 pb-4 pt-10 md:pt-16 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-end">
        <div className="reveal min-w-0">
          <p className="label mb-5 text-signal">{t('home.kicker', { round: last })}</p>
          <h1 className="display text-[clamp(2.5rem,5.4vw,5.5rem)] font-black">
            {t('home.title1')}
            <br />
            {t('home.title2')}
            <br />
            <span className="text-signal">{t('home.title3')}</span>
          </h1>
          <p className="mt-7 max-w-[46ch] text-lg text-fg-2">{t('home.lead')}</p>
        </div>

        {/* Rótulos de estado de la temporada, como los grafismos de una retransmisión. */}
        <div className="grid min-w-0 grid-cols-1 gap-px border border-line bg-line">
          {leader && leaderRow && (
            <Link to={`/drivers/${leader.id}`} className="reveal group flex items-center gap-5 bg-ink-900 p-5 transition-colors hover:bg-ink-850" style={{ ...teamVars(leaderTeam), ...stagger(1) }}>
              <Helmet driver={leader} team={leaderTeam} size={72} />
              <div className="min-w-0 flex-1">
                <p className="label">{t('home.leader')}</p>
                <p className="display mt-1 truncate text-2xl group-hover:text-signal sm:text-3xl">{driverName(leader)}</p>
                <p className="text-sm text-fg-3">{leaderTeam?.name}</p>
              </div>
              <p className="num text-2xl font-semibold sm:text-3xl">{leaderRow.points}</p>
            </Link>
          )}
          {topTeam && topTeamRow && (
            <Link to={`/teams/${topTeam.id}`} className="reveal group flex items-center gap-5 bg-ink-900 p-5 transition-colors hover:bg-ink-850" style={stagger(2)}>
              <span className="flex w-[72px] justify-center">
                <TeamLogo team={topTeam} size={52} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="label">{t('home.constructorsLeader')}</p>
                <p className="display mt-1 truncate text-2xl group-hover:text-signal sm:text-3xl">{topTeam.name}</p>
              </div>
              <p className="num text-2xl font-semibold sm:text-3xl">{topTeamRow.points}</p>
            </Link>
          )}
          <div className="reveal grid grid-cols-2 gap-px bg-line" style={stagger(3)}>
            {lastRound && (
              <Link to={`/calendar/${lastRound.round}`} className="group min-w-0 bg-ink-900 p-5 transition-colors hover:bg-ink-850">
                <p className="label">{t('home.lastRace')}</p>
                <p className="display mt-1 text-xl group-hover:text-signal sm:text-2xl">{f.gp(lastRound)}</p>
                {lastWinnerDriver && (
                  <p className="mt-1 text-sm text-fg-3">
                    {t('home.winner')}: <span className="text-fg-2">{driverName(lastWinnerDriver)}</span>
                  </p>
                )}
              </Link>
            )}
            {nextRound ? (
              <Link to={`/calendar/${nextRound.round}`} className="group relative min-w-0 overflow-hidden bg-ink-900 p-5 transition-colors hover:bg-ink-850">
                {nextCircuit && <TrackMap circuit={nextCircuit} className="pointer-events-none absolute -bottom-3 -right-3 h-24 w-24 opacity-25" />}
                <p className="label">{t('home.nextRace')}</p>
                <p className="display mt-1 text-xl group-hover:text-signal sm:text-2xl">{f.gp(nextRound)}</p>
                <p className="num mt-1 text-sm text-fg-3">{f.dayMonth(nextRound.date)}</p>
              </Link>
            ) : (
              <div className="bg-ink-900 p-5">
                <p className="label">{t('home.nextRace')}</p>
                <p className="display mt-1 text-2xl text-fg-3">{t('home.seasonOver')}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mt-16 grid gap-x-12 gap-y-14 lg:grid-cols-2">
        <div>
          <h2 className="label mb-4">{t('home.explore')}</h2>
          <ul className="border-t border-line-strong">
            {EXPLORE.map((item, i) => (
              <li key={item.to} className="reveal" style={stagger(i + 2)}>
                <Link to={item.to} className="row row-link group flex items-baseline justify-between gap-6 py-5">
                  <span className="display text-4xl transition-transform duration-300 ease-out-quart group-hover:translate-x-1 group-hover:text-signal md:text-5xl">{t(item.nav)}</span>
                  <span className="max-w-[24ch] text-right text-sm text-fg-3">{t(item.text, { count: calendar.rounds.length })}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="label mb-4">{t('home.modes')}</h2>
          <ul className="border-t border-line-strong">
            {MODES.map((mode, i) => (
              <li key={mode.key} className="reveal" style={stagger(i + 2)}>
                {mode.key === 'quick' ? (
                  <Link to="/race" className="row row-link group flex items-baseline justify-between gap-6 py-5">
                    <span className="min-w-0">
                      <span className="display block text-2xl group-hover:text-signal md:text-3xl">{t('home.mode.quick.title')}</span>
                      <span className="mt-1 block text-sm text-fg-3">{t('home.mode.quick.text')}</span>
                    </span>
                    <span className="display shrink-0 bg-signal px-3 py-2 text-sm text-white">{t('home.play')}</span>
                  </Link>
                ) : (
                  <div className="row flex items-baseline justify-between gap-6 py-5" aria-disabled="true">
                    <div className="min-w-0">
                      <p className="display text-2xl text-fg-3 md:text-3xl">{t(`home.mode.${mode.key}.title`)}</p>
                      <p className="mt-1 text-sm text-fg-4">{t(`home.mode.${mode.key}.text`)}</p>
                    </div>
                    <span className="label shrink-0 border border-line-strong px-2 py-1 text-[0.6875rem]">{t('home.comingPhase', { phase: mode.phase })}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
