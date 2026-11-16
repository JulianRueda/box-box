import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import {
  calendar, carOverall, driverName, findDriver, findTeam, raceDrivers, reserveDrivers, results, teams, teamStaff,
} from '../../data/index.ts';
import type { CarRatings, StaffRole, Team } from '../../data/schemas.ts';
import { constructorStandings } from '../../engine/season/standings.ts';
import { EstTag, PageHeader, RatingBar, Section, Stat } from '../components/bits.tsx';
import { DriverCard } from '../components/DriverPortrait.tsx';
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
  const leader = table[0]?.points ?? 0;
  return (
    <>
      <PageHeader kicker={t('teams.sortNote', { round: results.lastRound })} title={t('teams.title')} lead={t('teams.lead')} />
      <ul>
        {table.map((row, i) => {
          const team = findTeam(row.id);
          if (!team) return null;
          return (
            <li key={team.id} className="reveal" style={{ ...teamVars(team), ...stagger(Math.min(i, 10)) }}>
              <Link to={`/teams/${team.id}`} className="row row-link group relative grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-4 py-5 md:grid-cols-[3rem_3.5rem_minmax(0,1.5fr)_minmax(0,1fr)_7rem] md:gap-x-8 md:py-6">
                <span className="num text-sm font-semibold text-fg-3">{String(row.position).padStart(2, '0')}</span>
                <span className="hidden md:block"><TeamLogo team={team} size={44} /></span>
                <span className="min-w-0">
                  <span className="display block truncate text-[clamp(1.5rem,3.6vw,3.25rem)] transition-colors group-hover:text-(--team-ink)">{team.name}</span>
                  <span className="mt-1.5 block truncate text-sm text-fg-3">{team.powerUnit} · {team.chassis}</span>
                </span>
                <span className="col-span-2 col-start-2 mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[0.9375rem] text-fg-2 md:col-span-1 md:col-start-auto md:mt-0 md:block">
                  {raceDrivers(team.id).map((d) => (
                    <span key={d.id} className="flex items-baseline gap-2">
                      <span className="num w-6 text-right text-xs text-fg-4">{d.number}</span>
                      {driverName(d)}
                    </span>
                  ))}
                </span>
                <span className="col-start-3 row-start-1 text-right md:col-start-auto md:row-start-auto">
                  <span className="num block text-2xl font-semibold leading-none md:text-3xl">{row.points}</span>
                  <span className="label mt-1 block text-[0.625rem]">{t('table.points')}</span>
                </span>
                {/* Puntos en proporción al líder, sobre la línea de la fila. */}
                <span className="absolute inset-x-0 -bottom-px h-0.5 origin-left bg-(--team)" style={{ transform: `scaleX(${leader ? row.points / leader : 0})` }} aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </>
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
      {/* La ficha se tiñe del color del equipo: un velo arriba y la franja bajo la cabecera. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[32rem] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--team)_16%,transparent),transparent)]" aria-hidden="true" />
      <PageHeader
        kicker={team.fullName}
        title={team.name}
        aside={
          <div className="flex items-end gap-6">
            <TeamLogo team={team} size={80} />
            {row && (
              <p>
                <span className="num block text-6xl font-semibold leading-none md:text-7xl">P{row.position}</span>
                <span className="label mt-2 block">{row.points} {t('table.points')}</span>
              </p>
            )}
          </div>
        }
      />
      <div className="h-1 bg-(--team)" aria-hidden="true" />

      <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-5">
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

      <div className="grid gap-x-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <Section title={t('team.car')} note={<><span className="num font-semibold text-fg">{carOverall(team)}</span> · {t('team.carOverall')}</>}>
          <div>
            {CAR_KEYS.map((key) => (
              <RatingBar key={key} label={t(`car.${key}`)} value={team.car[key]} estimated={key === 'weight'} />
            ))}
          </div>
        </Section>

        <div>
          <Section title={t('team.drivers')}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {raceDrivers(team.id).map((d) => <DriverCard key={d.id} driver={d} team={team} />)}
            </div>
          </Section>
          <Section title={t('team.reserves')}>
            {reserves.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
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
        <ul className="grid gap-x-12 sm:grid-cols-2 xl:grid-cols-3">
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
            <li key={rr.round} className="w-14 bg-ink-950">
              <Link to={`/calendar/${rr.round}`} title={round ? f.gp(round) : undefined} className="block py-2.5 text-center transition-colors hover:bg-ink-850">
                <span className="label block text-[0.625rem]">{t('calendar.roundShort', { round: rr.round })}</span>
                {cars.map((e) => {
                  const done = /^\d+$/.test(e.positionText);
                  return (
                    <span key={e.driverId} className={`num block text-lg leading-7 ${!done ? 'text-fg-4' : e.position <= 3 ? 'font-semibold text-(--team-ink)' : e.points ? 'text-fg' : 'text-fg-3'}`}>
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
