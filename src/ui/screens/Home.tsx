import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { calendar, driverName, drivers, findCircuit, findDriver, findResult, findRound, findTeam, results, teams } from '../../data/index.ts';
import { constructorStandings, driverStandings } from '../../engine/season/standings.ts';
import { ConstructorStandingsTable, DriverStandingsTable } from '../components/tables.tsx';
import { TeamLogo } from '../components/TeamLogo.tsx';
import { LiveTrack, type LiveCar } from '../components/TrackMap.tsx';
import { stagger, teamVars, useFormat } from '../format.ts';

const MODES = [
  { key: 'quick', phase: 2 },
  { key: 'principal', phase: 4 },
  { key: 'create', phase: 4 },
  { key: 'career', phase: 7 },
] as const;

/** Filas de la torre del mundial que acompaña al mapa. */
const TOWER = 5;

export function Home() {
  const { t } = useTranslation();
  const f = useFormat();
  const last = results.lastRound;

  const table = useMemo(() => driverStandings(results.rounds, last), [last]);
  const teamTable = useMemo(() => constructorStandings(results.rounds, last, teams.map((x) => x.id)), [last]);
  const leaderPoints = table[0]?.points ?? 0;
  const topTeamRow = teamTable[0];
  const topTeam = topTeamRow && findTeam(topTeamRow.id);

  const lastRound = findRound(last);
  const lastWinner = findResult(last)?.race[0];
  const lastWinnerDriver = lastWinner && findDriver(lastWinner.driverId);
  const nextRound = calendar.rounds.find((r) => r.round > last);
  // El panel enseña la próxima carrera; si la temporada acabó, la última.
  const featured = nextRound ?? lastRound;
  const circuit = findCircuit(featured?.circuitId ?? '');

  // Los titulares, en el orden del mundial: así el coche de cabeza del mapa es el líder de la torre.
  const cars = useMemo<LiveCar[]>(() => {
    const rank = new Map(table.map((r) => [r.id, r.position]));
    return drivers
      .filter((d) => d.role === 'race')
      .sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99))
      .map((d, i) => ({ id: d.id, code: d.code, color: (d.teamId && findTeam(d.teamId)?.colors.primary) || '#8b909c', labelled: i < 3 }));
  }, [table]);

  const explore = [
    { to: '/teams', nav: 'nav.teams', text: 'home.explorer.teams', count: teams.length },
    { to: '/drivers', nav: 'nav.drivers', text: 'home.explorer.drivers', count: cars.length },
    { to: '/calendar', nav: 'nav.calendar', text: 'home.explorer.calendar', count: calendar.rounds.length },
    { to: '/standings', nav: 'nav.standings', text: 'home.explorer.standings', count: last },
  ] as const;

  return (
    <>
      <section className="pt-10 md:pt-16">
        <p className="label reveal mb-6">{t('home.kicker', { round: last })}</p>
        <h1 className="display text-[clamp(2rem,6.6vw,6.25rem)]">
          <span className="reveal block text-fg-3" style={stagger(1)}>{t('home.title1')}</span>
          <span className="reveal block text-fg-3" style={stagger(2)}>{t('home.title2')}</span>
          <span className="reveal block" style={stagger(3)}>{t('home.title3')}</span>
        </h1>

        <div className="reveal mt-8 flex flex-wrap items-end justify-between gap-x-12 gap-y-6 md:mt-10" style={stagger(4)}>
          <p className="max-w-[46ch] text-lg text-fg-2 md:text-xl">{t('home.lead')}</p>
          <div className="flex flex-wrap gap-3">
            <Link to="/race" className="btn btn-solid min-h-13 px-7">
              {t('home.mode.quick.title')}
              <span aria-hidden="true">→</span>
            </Link>
            <Link to="/calendar" className="btn btn-ghost min-h-13 px-7">{t('home.explore')}</Link>
          </div>
        </div>

        {/* El muro en pequeño: el circuito de la próxima carrera con la parrilla rodando, y la torre del mundial. */}
        <div className="panel bracket reveal mt-10 md:mt-12" style={stagger(5)}>
          {featured && (
            <Link to={`/calendar/${featured.round}`} className="group flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line px-4 py-3 transition-colors hover:bg-ink-850 md:px-6">
              <span className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="label">{t(nextRound ? 'home.nextRace' : 'home.lastRace')}</span>
                <span className="cond truncate text-xl leading-none underline-offset-4 group-hover:underline md:text-2xl">{f.gp(featured)}</span>
              </span>
              <span className="num text-sm text-fg-3">
                R{featured.round} · {f.dayMonth(featured.date)}
              </span>
            </Link>
          )}

          <div className="grid lg:grid-cols-[13rem_minmax(0,1fr)_26rem]">
            {/* Ficha del circuito: columna a la izquierda en escritorio, fila bajo el mapa en el móvil. */}
            {circuit && (
              <dl className="order-2 grid grid-cols-3 border-t border-line lg:order-none lg:grid-cols-1 lg:content-start lg:border-r lg:border-t-0">
                {[
                  [t('round.length'), t('round.km', { value: f.number(circuit.lengthKm) }), ''],
                  [t('round.laps'), circuit.laps, ''],
                  [t('round.pitLoss'), t('round.seconds', { value: circuit.pit.timeLossS }), ''],
                  [t('round.safetyCar'), f.percent(circuit.safetyCarProbability), 'hidden lg:block'],
                  [t('round.rain'), f.percent(circuit.rainProbability), 'hidden lg:block'],
                ].map(([label, value, show]) => (
                  <div key={label} className={`px-4 py-3 md:px-6 lg:border-b lg:border-line lg:py-4 ${show}`}>
                    <dt className="label text-[0.625rem]">{label}</dt>
                    <dd className="num mt-1 font-semibold md:text-lg">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
            <div className="order-1 min-w-0 lg:order-none lg:border-r lg:border-line">
              {circuit && <LiveTrack circuit={circuit} cars={cars} className="mx-auto aspect-square w-full max-w-[38rem] lg:h-[34rem] lg:w-auto" />}
            </div>

            <div className="order-3 flex min-w-0 flex-col border-t border-line lg:order-none lg:border-t-0">
              <p className="label flex items-center justify-between border-b border-line px-4 py-3 md:px-6">
                {t('home.leader')}
                <span className="num">R{last}</span>
              </p>
              <ol>
                {table.slice(0, TOWER).map((row) => {
                  const driver = findDriver(row.id);
                  const team = findTeam(row.teamId);
                  if (!driver) return null;
                  return (
                    <li key={row.id} style={teamVars(team)}>
                      <Link to={`/drivers/${driver.id}`} className="row row-link grid h-14 grid-cols-[1.5rem_0.25rem_2.75rem_minmax(0,1fr)_auto_3rem] items-center gap-3 px-4 hover:bg-ink-850 md:px-6">
                        <span className="num text-right text-sm font-semibold text-fg-3">{row.position}</span>
                        <span className="h-6 w-1 bg-(--team)" aria-hidden="true" />
                        <span className="cond text-xl leading-none">{driver.code}</span>
                        <span className="truncate text-sm text-fg-2">{driverName(driver)}</span>
                        <span className="num text-xs text-fg-3">{row.position === 1 ? '' : `−${leaderPoints - row.points}`}</span>
                        <span className="num text-right text-lg font-semibold">{row.points}</span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
              {topTeam && topTeamRow && (
                <Link to={`/teams/${topTeam.id}`} className="row row-link flex items-center gap-4 px-4 py-4 hover:bg-ink-850 md:px-6">
                  <TeamLogo team={topTeam} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="label block text-[0.625rem]">{t('home.constructorsLeader')}</span>
                    <span className="cond block truncate text-xl leading-tight">{topTeam.name}</span>
                  </span>
                  <span className="num text-lg font-semibold">{topTeamRow.points}</span>
                </Link>
              )}
              {lastRound && nextRound && (
                <Link to={`/calendar/${lastRound.round}`} className="mt-auto block px-4 py-4 transition-colors hover:bg-ink-850 md:px-6">
                  <span className="label block text-[0.625rem]">{t('home.lastRace')}</span>
                  <span className="mt-1 block truncate">{f.gp(lastRound)}</span>
                  {lastWinnerDriver && <span className="block truncate text-sm text-fg-3">{t('home.winner')}: {driverName(lastWinnerDriver)}</span>}
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* La temporada de un vistazo: quién ganó cada ronda, con el color de su equipo. */}
      <section className="mt-20 md:mt-28">
        <div className="mb-4 flex items-baseline justify-between gap-6">
          <h2 className="label">{t('driver.season')}</h2>
          <Link to="/calendar" className="label underline-offset-4 hover:text-fg hover:underline">{t('common.viewAll')}</Link>
        </div>
        <div className="overflow-x-auto">
          <ol className="grid min-w-[64rem] gap-px border border-line bg-line" style={{ gridTemplateColumns: `repeat(${calendar.rounds.length}, minmax(0, 1fr))` }}>
            {calendar.rounds.map((round) => {
              const winner = findResult(round.round)?.race[0];
              const driver = winner && findDriver(winner.driverId);
              return (
                <li key={round.round} className="bg-ink-950" style={teamVars(winner && findTeam(winner.teamId))}>
                  <Link to={`/calendar/${round.round}`} title={f.gp(round)} className="relative flex h-24 flex-col items-center justify-between pb-3 transition-colors hover:bg-ink-850">
                    <span className={`block h-1 w-full ${winner ? 'bg-(--team)' : 'bg-transparent'}`} aria-hidden="true" />
                    <span className="num text-xs text-fg-3">{round.round}</span>
                    {driver ? <span className="cond text-xl leading-none">{driver.code}</span> : <span className="num text-xs text-fg-3">{f.dayMonth(round.date)}</span>}
                    <span className="sr-only">{f.gp(round)}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="mt-12 grid gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <div>
            <div className="mb-2 flex items-baseline justify-between gap-6">
              <h3 className="display text-lg md:text-xl">{t('standings.drivers')}</h3>
              <Link to="/standings" className="label underline-offset-4 hover:text-fg hover:underline">{t('common.viewAll')}</Link>
            </div>
            <DriverStandingsTable rows={table} caption={t('standings.drivers')} limit={10} />
          </div>
          <div>
            <h3 className="display mb-2 text-lg md:text-xl">{t('standings.constructors')}</h3>
            <ConstructorStandingsTable rows={teamTable} caption={t('standings.constructors')} />
          </div>
        </div>
      </section>

      <section className="mt-20 md:mt-28">
        <h2 className="label mb-4">{t('home.modes')}</h2>
        <ul className="border-t border-line-strong">
          {MODES.map((mode, i) => {
            const quick = mode.key === 'quick';
            const body = (
              <>
                <span className="num text-right text-sm text-fg-3">{i + 1}</span>
                <span className="min-w-0">
                  <span className={`display block text-[clamp(1.375rem,3.4vw,3rem)] ${quick ? '' : 'text-fg-3'}`}>{t(`home.mode.${mode.key}.title`)}</span>
                  <span className="mt-2 block text-sm text-fg-3 md:hidden">{t(`home.mode.${mode.key}.text`)}</span>
                </span>
                <span className={`hidden text-[0.9375rem] md:block ${quick ? 'text-fg-2' : 'text-fg-3'}`}>{t(`home.mode.${mode.key}.text`)}</span>
              </>
            );
            const grid = 'grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-4 py-6 md:grid-cols-[2rem_minmax(0,1.3fr)_minmax(0,1fr)_9rem] md:gap-x-8 md:py-7';
            return (
              <li key={mode.key}>
                {quick ? (
                  <Link to="/race" className={`row row-link group ${grid}`}>
                    {body}
                    <span className="btn btn-solid justify-self-end group-hover:bg-timing-personal">{t('home.play')}</span>
                  </Link>
                ) : (
                  <div className={`row ${grid}`} aria-disabled="true">
                    {body}
                    <span className="label justify-self-end text-right text-[0.625rem]">{t('home.comingPhase', { phase: mode.phase })}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-20 md:mt-28">
        <h2 className="label mb-4">{t('home.explore')}</h2>
        {/* Cuatro enlaces en una sola línea: son navegación, no tarjetas. */}
        <ul className="grid grid-cols-2 gap-x-8 border-t border-line-strong lg:grid-cols-4">
          {explore.map((item) => (
            <li key={item.to}>
              <Link to={item.to} className="group block border-b border-line py-5">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="cond text-2xl underline-offset-4 group-hover:underline md:text-3xl">{t(item.nav)}</span>
                  <span className="num text-sm text-fg-3">{item.count}</span>
                </span>
                <span className="mt-1 block text-sm text-fg-3">{t(item.text, { count: calendar.rounds.length })}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
