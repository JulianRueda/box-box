import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { findRound, results, teams } from '../../data/index.ts';
import { constructorStandings, driverStandings } from '../../engine/season/standings.ts';
import { PageHeader } from '../components/bits.tsx';
import { ConstructorStandingsTable, DriverStandingsTable } from '../components/tables.tsx';
import { useFormat } from '../format.ts';
import { useUi } from '../store.ts';

export function Standings() {
  const { t } = useTranslation();
  const f = useFormat();
  const round = useUi((s) => s.standingsRound);
  const setRound = useUi((s) => s.setStandingsRound);
  const info = findRound(round);
  const driversTable = driverStandings(results.rounds, round);
  const teamsTable = constructorStandings(results.rounds, round, teams.map((x) => x.id));
  const label = round === 0 ? t('standings.before') : t('standings.after', { round });

  return (
    <>
      <PageHeader title={t('standings.title')} lead={t('standings.lead')} />

      <div className="sticky top-14 z-30 -mx-4 border-b border-line bg-ink-950/95 px-4 py-4 backdrop-blur-md md:-mx-8 md:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6">
          <p className="display text-2xl md:text-3xl" aria-live="polite">
            {label}
            {info && (
              <Link to={`/calendar/${info.round}`} className="ml-3 text-fg-3 hover:text-signal">
                {f.gp(info)}
              </Link>
            )}
          </p>
          <p className="num text-sm text-fg-3">{round} / {results.lastRound}</p>
        </div>
        <input
          type="range"
          min={0}
          max={results.lastRound}
          step={1}
          value={round}
          onChange={(e) => setRound(Number(e.target.value))}
          aria-label={t('standings.slider')}
          aria-valuetext={label}
          className="mt-3 h-8 w-full cursor-pointer accent-(--color-signal)"
        />
      </div>

      <div className="mt-8 grid gap-x-14 gap-y-12 lg:grid-cols-2">
        <section>
          <h2 className="display mb-3 text-3xl md:text-4xl">{t('standings.drivers')}</h2>
          {driversTable.length ? <DriverStandingsTable rows={driversTable} caption={`${t('standings.drivers')} — ${label}`} /> : <p className="text-fg-3">{t('standings.empty')}</p>}
        </section>
        <section>
          <h2 className="display mb-3 text-3xl md:text-4xl">{t('standings.constructors')}</h2>
          <ConstructorStandingsTable rows={teamsTable} caption={`${t('standings.constructors')} — ${label}`} />
        </section>
      </div>
    </>
  );
}
