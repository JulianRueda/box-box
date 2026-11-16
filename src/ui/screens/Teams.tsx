import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import {
  calendar, carOverall, driverName, driverOverall, findDriver, findTeam, raceDrivers, reserveDrivers, results, teams, teamStaff,
} from '../../data/index.ts';
import type { CarRatings, Driver, StaffRole, Team } from '../../data/schemas.ts';
import { constructorStandings } from '../../engine/season/standings.ts';
import { EstTag, PageHeader, RatingBar, Section, Stat } from '../components/bits.tsx';
import { Helmet } from '../components/Helmet.tsx';
import { TeamLogo } from '../components/TeamLogo.tsx';
import { stagger, teamVars, useFormat } from '../format.ts';
import { NotFound } from './NotFound.tsx';

const CAR_KEYS: (keyof CarRatings)[] = [
  'downforceHigh', 'downforceMedium', 'downforceLow', 'straightEfficiency', 'enginePower', 'energyDeployment', 'reliability', 'tyreWear', 'weight',
];
const STAFF_ORDER: StaffRole[] = ['technicalDirector', 'headOfAero', 'headOfStrategy', 'raceEngineer', 'chiefMechanic', 'headOfAcademy'];

const standings = () => constructorStandings(results.rounds, results.lastRound, teams.map((t) => t.id));

export function Teams() {
  const { t } = useTranslation();
  const table = standings();
  return (
    <>
      <PageHeader kicker={t('teams.sortNote', { round: results.lastRound })} title={t('teams.title')} lead={t('teams.lead')} />
      <ul className="mt-8 grid gap-px border border-line bg-line sm:grid-cols-2 xl:grid-cols-3">
        {table.map((row, i) => {
          const team = findTeam(row.id);
          if (!team) return null;
          return (
            <li key={team.id} className="reveal bg-ink-950" style={{ ...teamVars(team), ...stagger(i) }}>
              <Link to={`/teams/${team.id}`} className="group relative flex h-full flex-col gap-6 overflow-hidden bg-ink-900 p-5 transition-colors hover:bg-ink-850 md:p-6">
                <span className="absolute inset-y-0 left-0 w-1 bg-(--team) transition-[width] duration-300 ease-out-quart group-hover:w-2" aria-hidden="true" />
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="num text-sm text-fg-3">P{row.position}</p>
                    <h2 className="display mt-1 text-4xl group-hover:text-signal">{team.name}</h2>
                    <p className="mt-1 truncate text-sm text-fg-3">{team.powerUnit} · {team.chassis}</p>
                  </div>
                  <TeamLogo team={team} size={48} />
                </div>
                <div className="mt-auto flex items-end justify-between gap-4">
                  <ul className="text-[0.9375rem] text-fg-2">
                    {raceDrivers(team.id).map((d) => (
                      <li key={d.id} className="flex items-baseline gap-2.5">
                        <span className="num w-6 text-right text-xs text-fg-4">{d.number}</span>
                        {driverName(d)}
                      </li>
                    ))}
                  </ul>
                  <p className="text-right">
                    <span className="num block text-3xl font-semibold leading-none">{row.points}</span>
                    <span className="label text-[0.6875rem]">{t('table.points')}</span>
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function DriverCard({ driver, team }: { driver: Driver; team: Team }) {
  const { t } = useTranslation();
  return (
    <Link to={`/drivers/${driver.id}`} className="group flex items-center gap-4 bg-ink-900 p-4 transition-colors hover:bg-ink-850">
      <Helmet driver={driver} team={team} size={64} />
      <div className="min-w-0 flex-1">
        <p className="display truncate text-2xl group-hover:text-signal">{driverName(driver)}</p>
        <p className="text-sm text-fg-3">{t(`driver.role.${driver.role}`)}</p>
      </div>
      <p className="text-right">
        <span className="num block text-2xl font-semibold leading-none">{driverOverall(driver)}</span>
        <span className="label text-[0.6875rem]">{t('driver.overall')}</span>
      </p>
    </Link>
  );
}

export function TeamDetail() {
  const { t } = useTranslation();
  const f = useFormat();
  const { teamId = '' } = useParams();
  const team = findTeam(teamId);
  if (!team) return <NotFound />;

  const row = standings().find((r) => r.id === team.id);
  const reserves = reserveDrivers(team.id);
  const people = teamStaff(team.id).sort((a, b) => STAFF_ORDER.indexOf(a.role) - STAFF_ORDER.indexOf(b.role));

  return (
    <div style={teamVars(team)}>
      <PageHeader
        kicker={team.fullName}
        title={team.name}
        aside={
          <div className="flex items-center gap-6">
            <TeamLogo team={team} size={88} />
            {row && (
              <p>
                <span className="display block text-6xl leading-none">P{row.position}</span>
                <span className="num text-fg-3">{row.points} {t('table.points').toLowerCase()}</span>
              </p>
            )}
          </div>
        }
      />
      <div className="h-1 bg-(--team)" aria-hidden="true" />

      <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-5">
        <Stat label={t('team.principal')} value={team.principal} />
        <Stat label={t('team.powerUnit')} value={team.powerUnit} />
        <Stat label={t('team.chassis')} value={team.chassis} />
        <Stat label={t('team.base')} value={team.base} sub={f.country(team.baseCountryCode)} />
        <Stat
          label={t('team.budget')}
          value={
            <>
              <span className="num">{t('team.budgetValue', { value: team.budgetM.value })}</span>
              {team.budgetM.estimated && <EstTag />}
            </>
          }
        />
      </dl>

      <div className="grid gap-x-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Section title={t('team.car')} note={<><span className="num text-fg">{carOverall(team)}</span> · {t('team.carOverall')}</>}>
          <div className="border-t border-line-strong">
            {CAR_KEYS.map((key) => (
              <RatingBar key={key} label={t(`car.${key}`)} value={team.car[key]} estimated={key === 'weight'} />
            ))}
          </div>
        </Section>

        <div>
          <Section title={t('team.drivers')}>
            <div className="grid gap-px border border-line bg-line">
              {raceDrivers(team.id).map((d) => <DriverCard key={d.id} driver={d} team={team} />)}
            </div>
          </Section>
          <Section title={t('team.reserves')}>
            {reserves.length ? (
              <div className="grid gap-px border border-line bg-line">
                {reserves.map((d) => <DriverCard key={d.id} driver={d} team={team} />)}
              </div>
            ) : (
              <p className="text-fg-3">{t('team.noReserves')}</p>
            )}
          </Section>
        </div>
      </div>

      <Section title={t('team.season')} note={t('team.seasonNote')}>
        <SeasonGrid team={team} />
      </Section>

      <Section title={t('team.staff')}>
        <ul className="grid gap-x-10 border-t border-line-strong sm:grid-cols-2 xl:grid-cols-3">
          {people.map((s) => {
            const driver = s.driverId ? findDriver(s.driverId) : undefined;
            return (
              <li key={s.id} className="row flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-fg">
                    {s.name}
                    {s.generated && <EstTag generated />}
                  </p>
                  <p className="text-sm text-fg-3">
                    {t(`staffRole.${s.role}`)}
                    {driver && ` · ${driver.code}`}
                  </p>
                </div>
                <span className="num font-semibold">{s.rating}</span>
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}

/** Posición final de los dos coches del equipo en cada ronda disputada. */
function SeasonGrid({ team }: { team: Team }) {
  const { t } = useTranslation();
  const f = useFormat();
  return (
    <div className="overflow-x-auto">
      <ol className="flex min-w-max gap-px border border-line bg-line">
        {results.rounds.map((rr) => {
          const round = calendar.rounds.find((r) => r.round === rr.round);
          const cars = rr.race.filter((e) => e.teamId === team.id);
          return (
            <li key={rr.round} className="w-14 bg-ink-900">
              <Link to={`/calendar/${rr.round}`} title={round ? f.gp(round) : undefined} className="block py-2 text-center hover:bg-ink-850">
                <span className="label block text-[0.6875rem]">{t('calendar.roundShort', { round: rr.round })}</span>
                {cars.map((e) => {
                  const done = /^\d+$/.test(e.positionText);
                  return (
                    <span key={e.driverId} className={`num block text-lg leading-7 ${!done ? 'text-fg-4' : e.position <= 3 ? 'font-semibold text-(--team)' : e.points ? 'text-fg' : 'text-fg-3'}`}>
                      {done ? e.position : '—'}
                    </span>
                  );
                })}
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
