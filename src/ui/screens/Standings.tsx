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

      {/* Control de ronda: se queda pegado bajo la cabecera mientras se leen las tablas. */}
      <div className="sticky top-15 z-30 -mx-4 border-b border-line-strong bg-ink-950/95 px-4 pb-2 pt-4 backdrop-blur-md md:-mx-8 md:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <p className="min-w-0" aria-live="polite">
            <span className="cond text-2xl md:text-3xl">{label}</span>
            {info && (
              <Link to={`/calendar/${info.round}`} className="ml-3 text-fg-3 underline-offset-4 hover:text-fg hover:underline">
                {f.gp(info)}
              </Link>
            )}
          </p>
          <p className="num text-sm text-fg-3">
            {round} / {results.lastRound}
          </p>
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
          className="range mt-1"
        />
        {/* Una marca por ronda disputada, alineada con el recorrido del control. */}
        <div className="-mt-1 flex justify-between px-[0.375rem]" aria-hidden="true">
          {Array.from({ length: results.lastRound + 1 }, (_, i) => (
            <span key={i} className={`h-1 w-px ${i <= round ? 'bg-fg-3' : 'bg-ink-700'}`} />
          ))}
        </div>
      </div>

      <div className="mt-10 grid gap-x-16 gap-y-14 lg:grid-cols-2">
        <section>
          <h2 className="display mb-4 text-xl md:text-2xl">{t('standings.drivers')}</h2>
          {driversTable.length ? <DriverStandingsTable rows={driversTable} caption={`${t('standings.drivers')} — ${label}`} /> : <p className="text-fg-3">{t('standings.empty')}</p>}
        </section>
        <section>
          <h2 className="display mb-4 text-xl md:text-2xl">{t('standings.constructors')}</h2>
          <ConstructorStandingsTable rows={teamsTable} caption={`${t('standings.constructors')} — ${label}`} />        </section>
      </div>
    </>
  );
}
