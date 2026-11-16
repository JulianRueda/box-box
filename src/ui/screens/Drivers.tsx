import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import {
  ageOn, calendar, driverName, driverOverall, drivers, findDriver, findTeam, results, staff,
} from '../../data/index.ts';
import type { Driver, DriverAttributes } from '../../data/schemas.ts';
import { driverStandings } from '../../engine/season/standings.ts';
import { EstTag, PageHeader, RatingBar, Section, Segmented, Stat } from '../components/bits.tsx';
import { DriverCard, DriverPortrait } from '../components/DriverPortrait.tsx';
import { Helmet } from '../components/Helmet.tsx';
import { TeamLogo } from '../components/TeamLogo.tsx';
import { Radar } from '../components/Radar.tsx';
import { teamVars, useFormat } from '../format.ts';
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
        aside={<Segmented label={t('drivers.filter')} options={FILTERS} value={filter} onChange={setFilter} text={(key) => t(`drivers.${key}`)} className="w-full sm:w-auto [&>button]:min-h-11 [&>button]:px-4" />}
      />
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {list.map((d) => {
          const team = d.teamId ? findTeam(d.teamId) : undefined;
          const row = rank.get(d.id);
          return (
            <li key={d.id}>
              <DriverCard driver={d} team={team} meta={row ? { value: row.points, label: t('table.points') } : undefined} />
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
      <header className="reveal relative grid items-end gap-x-10 gap-y-6 overflow-hidden border-b border-line-strong pt-10 md:grid-cols-[minmax(0,1fr)_auto] md:pt-20">
        {/* El número del piloto, enorme, como dorsal de fondo. */}
        <span className="num pointer-events-none absolute -bottom-[0.14em] right-[clamp(8rem,24vw,22rem)] hidden text-[clamp(10rem,24vw,21rem)] font-bold leading-none text-(--team) opacity-[0.16] md:block" aria-hidden="true">
          {driver.number ?? driver.code}
        </span>

        <div className="relative min-w-0 pb-8">
          <p className="label mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="border border-line-strong px-1.5 py-px text-fg-2">{driver.countryCode}</span>
            <span>{f.country(driver.countryCode)}</span>
            <span aria-hidden="true">·</span>
            <span className="text-(--team-ink)">{t(`driver.role.${driver.role}`)}{flag('role')}</span>
          </p>
          <h1 className="display text-[clamp(2.25rem,6.6vw,6.5rem)]">
            <span className="mb-2 block font-sans text-[max(0.32em,1.125rem)] font-medium normal-case tracking-normal text-fg-2 [font-stretch:100%]">{driver.givenName}</span>
            {driver.familyName}
          </h1>
          <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4">
            {team ? (
              <Link to={`/teams/${team.id}`} className="group inline-flex items-center gap-3 text-lg text-fg-2 hover:text-fg">
                <TeamLogo team={team} size={32} />
                <span className="underline-offset-4 group-hover:underline">{team.name}</span>
              </Link>
            ) : (
              <p className="text-lg text-fg-3">{t('driver.freeAgent')}</p>
            )}
            <p className="flex items-baseline gap-2">
              <span className="num text-4xl font-semibold leading-none">{driverOverall(driver)}</span>
              <span className="label">{t('driver.overall')}</span>
            </p>
          </div>
        </div>

        <div className="relative flex items-end justify-end gap-3">
          <Helmet driver={driver} team={team} size={64} />
          <DriverPortrait driver={driver} team={team} className="h-48 w-40 md:h-72 md:w-60" />
        </div>
      </header>
      <div className="h-1 bg-(--team)" aria-hidden="true" />

      <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-4">
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
        <div className="grid items-center gap-x-16 gap-y-8 lg:grid-cols-[minmax(0,27rem)_minmax(0,1fr)]">
          <div className="panel bracket flex justify-center p-4">
            <Radar title={t('driver.radar', { name: driverName(driver) })} axes={RADAR_KEYS.map((k) => ({ label: t(`attrShort.${k}`), value: a[k] }))} />
          </div>
          <div className="grid gap-x-12 sm:grid-cols-2">
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
            <li key={round} className="w-14 bg-ink-950" style={teamVars(findTeam(entry.teamId))}>
              <Link to={`/calendar/${round}`} title={info ? f.gp(info) : undefined} className="block pb-2 text-center transition-colors hover:bg-ink-850">
                <span className="block h-0.5 bg-(--team)" aria-hidden="true" />
                <span className="label mt-3 block text-[0.625rem]">{t('calendar.roundShort', { round })}</span>
                <span className={`num block text-xl leading-8 ${!done ? 'text-fg-3' : entry.position <= 3 ? 'font-semibold text-(--team-ink)' : entry.points ? 'text-fg' : 'text-fg-3'}`}>
                  {done ? entry.position : '—'}
                </span>
                <span className="num block text-xs text-fg-3">{entry.points ? `+${entry.points}` : ' '}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
