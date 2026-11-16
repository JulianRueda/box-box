import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import {
  ageOn, calendar, driverName, driverOverall, drivers, findDriver, findTeam, results, staff,
} from '../../data/index.ts';
import type { Driver, DriverAttributes } from '../../data/schemas.ts';
import { driverStandings } from '../../engine/season/standings.ts';
import { EstTag, PageHeader, RatingBar, Section, Stat } from '../components/bits.tsx';
import { Helmet } from '../components/Helmet.tsx';
import { Radar } from '../components/Radar.tsx';
import { stagger, teamVars, useFormat } from '../format.ts';
import { useUi, type RoleFilter } from '../store.ts';
import { NotFound } from './NotFound.tsx';

const RADAR_KEYS = ['qualifyingPace', 'racePace', 'tyreManagement', 'overtaking', 'defending', 'wetWeather', 'consistency', 'energyManagement'] as const;
const BAR_KEYS: (keyof DriverAttributes)[] = ['technicalFeedback', 'experience', 'marketability', 'morale', 'potential'];
/** Atributos que no salen de una medición directa de 2026 (ver docs/RATINGS.md). */
const DERIVED: (keyof DriverAttributes)[] = ['wetWeather', 'energyManagement', 'marketability'];
const FILTERS: RoleFilter[] = ['race', 'others', 'all'];

export function Drivers() {
  const { t } = useTranslation();
  const filter = useUi((s) => s.driverFilter);
  const setFilter = useUi((s) => s.setDriverFilter);
  const table = driverStandings(results.rounds, results.lastRound);
  const rank = new Map(table.map((r) => [r.id, r]));

  const list = drivers
    .filter((d) => filter === 'all' || (filter === 'race' ? d.role === 'race' : d.role !== 'race'))
    .sort((a, b) => (rank.get(a.id)?.position ?? 99) - (rank.get(b.id)?.position ?? 99) || a.familyName.localeCompare(b.familyName));

  return (
    <>
      <PageHeader
        title={t('drivers.title')}
        lead={t('drivers.lead')}
        aside={
          <div role="group" aria-label={t('drivers.filter')} className="flex border border-line-strong">
            {FILTERS.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
                className={`label min-h-11 cursor-pointer px-4 transition-colors ${filter === key ? 'bg-fg text-ink-950' : 'text-fg-3 hover:text-fg'}`}
              >
                {t(`drivers.${key}`)}
              </button>
            ))}
          </div>
        }
      />
      <ul className="mt-8 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {list.map((d, i) => {
          const team = d.teamId ? findTeam(d.teamId) : undefined;
          const row = rank.get(d.id);
          return (
            <li key={d.id} className="reveal bg-ink-950" style={{ ...teamVars(team), ...stagger(Math.min(i, 14)) }}>
              <Link to={`/drivers/${d.id}`} className="group relative flex h-full items-center gap-4 overflow-hidden bg-ink-900 p-4 transition-colors hover:bg-ink-850">
                <span className="display pointer-events-none absolute -right-1 -top-3 text-[5.5rem] leading-none text-fg opacity-[0.045]" aria-hidden="true">
                  {d.number ?? d.code}
                </span>
                <Helmet driver={d} team={team} size={68} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-tight text-fg-3">{d.givenName}</p>
                  <p className="display truncate text-[1.75rem] group-hover:text-signal">{d.familyName}</p>
                  <p className="mt-1 flex items-center gap-2 text-sm text-fg-3">
                    <span className="h-3 w-0.5 bg-(--team)" aria-hidden="true" />
                    <span className="truncate">{team?.name ?? t('driver.freeAgent')}</span>
                    {d.role !== 'race' && <span className="label text-[0.6875rem]">· {t(`driver.role.${d.role}`)}</span>}
                  </p>
                </div>
                <div className="text-right">
                  {row ? (
                    <>
                      <span className="num block text-2xl font-semibold leading-none">{row.points}</span>
                      <span className="label text-[0.6875rem]">{t('table.points')}</span>
                    </>
                  ) : (
                    <>
                      <span className="num block text-2xl font-semibold leading-none text-fg-3">{driverOverall(d)}</span>
                      <span className="label text-[0.6875rem]">{t('driver.overall')}</span>
                    </>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function DriverDetail() {
  const { t } = useTranslation();
  const f = useFormat();
  const { driverId = '' } = useParams();
  const driver = findDriver(driverId);
  if (!driver) return <NotFound />;

  const team = driver.teamId ? findTeam(driver.teamId) : undefined;
  const row = driverStandings(results.rounds, results.lastRound).find((r) => r.id === driver.id);
  const engineer = staff.find((s) => s.role === 'raceEngineer' && s.driverId === driver.id);
  const a = driver.attributes;
  const unverified = (field: string) => driver.unverifiedFields.includes(field);
  const flag = (field: string) => (unverified(field) ? <abbr title={t('driver.unverified')} className="ml-1 text-timing-slower no-underline">*</abbr> : null);

  return (
    <div style={teamVars(team)}>
      <header className="reveal relative grid items-end gap-x-10 gap-y-6 overflow-hidden border-b border-line pb-8 pt-10 md:grid-cols-[auto_minmax(0,1fr)_auto] md:pt-16">
        <span className="display pointer-events-none absolute -top-6 right-0 text-[clamp(10rem,30vw,22rem)] leading-none text-(--team) opacity-[0.09]" aria-hidden="true">
          {driver.number ?? driver.code}
        </span>
        <Helmet driver={driver} team={team} size={148} />
        <div className="relative min-w-0">
          <p className="label mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="border border-line-strong px-1.5 py-px text-fg-2">{driver.countryCode}</span>
            <span>{f.country(driver.countryCode)}</span>
            <span aria-hidden="true">·</span>
            <span className="text-(--team)">{t(`driver.role.${driver.role}`)}{flag('role')}</span>
          </p>
          <h1 className="display text-[clamp(2.5rem,7vw,5.75rem)]">
            <span className="block text-[0.5em] font-medium text-fg-2">{driver.givenName}</span>
            {driver.familyName}
          </h1>
          {team ? (
            <Link to={`/teams/${team.id}`} className="mt-3 inline-flex items-center gap-2 text-lg text-fg-2 hover:text-signal">
              <span className="h-4 w-1 bg-(--team)" aria-hidden="true" />
              {team.name}
            </Link>
          ) : (
            <p className="mt-3 text-lg text-fg-3">{t('driver.freeAgent')}</p>
          )}
        </div>
        <p className="relative">
          <span className="display block text-7xl leading-none">{driverOverall(driver)}</span>
          <span className="label">{t('driver.overall')}</span>
        </p>
      </header>
      <div className="h-1 bg-(--team)" aria-hidden="true" />

      <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-4">
        <Stat label={t('driver.number')} value={<span className="num">{driver.number ?? '—'}</span>} />
        <Stat label={t('driver.nationality')} value={f.country(driver.countryCode)} sub={<>{t('driver.age', { count: ageOn(driver.dateOfBirth) })}{flag('dateOfBirth')}</>} />
        <Stat label={t('driver.championship')} value={row ? <span className="num">P{row.position}</span> : '—'} sub={row && `${row.points} ${t('table.points').toLowerCase()}`} />
        <Stat label={t('driver.wins')} value={<span className="num">{row?.wins ?? 0}</span>} sub={`${row?.podiums ?? 0} ${t('driver.podiums').toLowerCase()}`} />
        <Stat
          label={t('driver.contract')}
          value={<>{t('driver.contractEnd')} <span className="num">{driver.contract.endYear}</span>{driver.contract.endYearEstimated && <EstTag />}</>}
        />
        <Stat
          label={t('driver.salary')}
          value={<><span className="num">{t('driver.salaryValue', { value: f.number(driver.contract.salaryM.value) })}</span>{driver.contract.salaryM.estimated && <EstTag />}</>}
        />
        <Stat label={t('driver.engineer')} value={engineer?.name ?? '—'} />
        <Stat label={t('driver.starts')} value={<span className="num">{driver.careerStartsBefore2026}</span>} />
      </dl>

      <Section title={t('driver.attributes')} note={driver.attributesEstimated ? t('driver.attributesEstimated') : undefined}>
        <div className="grid items-center gap-x-14 gap-y-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          <div className="flex justify-center">
            <Radar title={t('driver.radar', { name: driverName(driver) })} axes={RADAR_KEYS.map((k) => ({ label: t(`attrShort.${k}`), value: a[k] }))} />
          </div>
          <div className="grid gap-x-12 border-t border-line-strong sm:grid-cols-2">
            {[...RADAR_KEYS, ...BAR_KEYS].map((key) => {
              const value = a[key];
              if (value === undefined) return null;
              return <RatingBar key={key} label={t(`attr.${key}`)} value={value} estimated={driver.attributesEstimated || DERIVED.includes(key)} />;
            })}
          </div>
        </div>
      </Section>

      <Section title={t('driver.season')} note={t('team.seasonNote')}>
        <SeasonStrip driver={driver} />
      </Section>
    </div>
  );
}

/** Resultado del piloto en cada ronda disputada, con el color del equipo con el que corrió. */
function SeasonStrip({ driver }: { driver: Driver }) {
  const { t } = useTranslation();
  const f = useFormat();
  const races = results.rounds.flatMap((rr) => {
    const entry = rr.race.find((e) => e.driverId === driver.id);
    return entry ? [{ round: rr.round, entry }] : [];
  });
  if (!races.length) return <p className="text-fg-3">{t('driver.noRaces')}</p>;

  return (
    <div className="overflow-x-auto">
      <ol className="flex min-w-max gap-px border border-line bg-line">
        {races.map(({ round, entry }) => {
          const info = calendar.rounds.find((r) => r.round === round);
          const done = /^\d+$/.test(entry.positionText);
          return (
            <li key={round} className="w-14 bg-ink-900" style={teamVars(findTeam(entry.teamId))}>
              <Link to={`/calendar/${round}`} title={info ? f.gp(info) : undefined} className="block pb-2 text-center hover:bg-ink-850">
                <span className="block h-1 bg-(--team)" aria-hidden="true" />
                <span className="label mt-2 block text-[0.6875rem]">{t('calendar.roundShort', { round })}</span>
                <span className={`num block text-xl leading-8 ${!done ? 'text-fg-4' : entry.position <= 3 ? 'font-semibold text-(--team)' : entry.points ? 'text-fg' : 'text-fg-3'}`}>
                  {done ? entry.position : '—'}
                </span>
                <span className="num block text-xs text-fg-4">{entry.points ? `+${entry.points}` : ' '}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
