import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { findTeam } from '../../data/index.ts';
import type { QualifyingEntry, RaceEntry } from '../../data/schemas.ts';
import type { DriverStandingRow, StandingRow } from '../../engine/season/standings.ts';
import { teamVars } from '../format.ts';
import { DriverCell, TeamCell } from './bits.tsx';
import { TeamLogo } from './TeamLogo.tsx';

const th = 'label py-3 font-semibold';
const isClassified = (e: RaceEntry) => /^\d+$/.test(e.positionText);

function Pos({ value }: { value: string | number }) {
  return <span className="display block w-9 text-2xl text-fg">{value}</span>;
}

/** Resultado de carrera o sprint. */
export function RaceTable({ entries, caption }: { entries: RaceEntry[]; caption: string }) {
  const { t } = useTranslation();
  const status = (e: RaceEntry) => t(`status.${e.status}`, { defaultValue: e.status });
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[22rem] border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line-strong">
            <th scope="col" className={th}>{t('table.pos')}</th>
            <th scope="col" className={th}>{t('table.driver')}</th>
            <th scope="col" className={`${th} hidden lg:table-cell`}>{t('table.team')}</th>
            <th scope="col" className={`${th} hidden text-right sm:table-cell`}>{t('table.grid')}</th>
            <th scope="col" className={`${th} hidden text-right md:table-cell`}>{t('table.laps')}</th>
            <th scope="col" className={`${th} text-right`}>{t('table.time')}</th>
            <th scope="col" className={`${th} w-14 text-right`}>{t('table.points')}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const done = isClassified(e);
            const fastest = e.fastestLap?.rank === 1;
            return (
              <tr key={e.driverId} className={`row ${done ? '' : 'text-fg-3'}`}>
                <td><Pos value={done ? e.position : '—'} /></td>
                <td><DriverCell driverId={e.driverId} teamId={e.teamId} /></td>
                <td className="hidden lg:table-cell"><TeamCell teamId={e.teamId} /></td>
                <td className="num hidden text-right text-fg-3 sm:table-cell">{e.grid === 0 ? t('table.pitLane') : e.grid}</td>
                <td className="num hidden text-right text-fg-3 md:table-cell">{e.laps}</td>
                <td className="num whitespace-nowrap text-right text-[0.9375rem]">
                  {fastest && (
                    <abbr title={`${t('table.fastestLap')} ${e.fastestLap?.time ?? ''}`} className="label mr-2 bg-timing-best px-1.5 py-0.5 text-[0.6875rem] text-fg no-underline">
                      {t('table.fastestLapShort')}
                    </abbr>
                  )}
                  {done && e.time ? e.time : status(e)}
                </td>
                <td className={`num text-right font-semibold ${e.points ? 'text-fg' : 'text-fg-4'}`}>{e.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function QualifyingTable({ entries, caption }: { entries: QualifyingEntry[]; caption: string }) {
  const { t } = useTranslation();
  const cell = (time: string | null) => <td className="num hidden text-right text-fg-3 sm:table-cell">{time ?? ''}</td>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[20rem] border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line-strong">
            <th scope="col" className={th}>{t('table.pos')}</th>
            <th scope="col" className={th}>{t('table.driver')}</th>
            <th scope="col" className={`${th} hidden lg:table-cell`}>{t('table.team')}</th>
            <th scope="col" className={`${th} hidden text-right sm:table-cell`}>Q1</th>
            <th scope="col" className={`${th} hidden text-right sm:table-cell`}>Q2</th>
            <th scope="col" className={`${th} hidden text-right sm:table-cell`}>Q3</th>
            <th scope="col" className={`${th} text-right sm:hidden`}>{t('table.time')}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.driverId} className="row">
              <td><Pos value={e.position} /></td>
              <td><DriverCell driverId={e.driverId} teamId={e.teamId} /></td>
              <td className="hidden lg:table-cell"><TeamCell teamId={e.teamId} /></td>
              {cell(e.q1)}
              {cell(e.q2)}
              <td className="num hidden text-right sm:table-cell">{e.q3 ?? ''}</td>
              <td className="num text-right sm:hidden">{e.q3 ?? e.q2 ?? e.q1 ?? t('table.noTime')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DriverStandingsTable({ rows, caption, limit }: { rows: DriverStandingRow[]; caption: string; limit?: number }) {
  const { t } = useTranslation();
  const leader = rows[0]?.points ?? 0;
  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-line-strong">
          <th scope="col" className={th}>{t('table.pos')}</th>
          <th scope="col" className={th}>{t('table.driver')}</th>
          <th scope="col" className={`${th} hidden text-right sm:table-cell`}>{t('table.wins')}</th>
          <th scope="col" className={`${th} w-16 text-right`}>{t('table.points')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, limit).map((r) => (
          <tr key={r.id} className="row">
            <td><Pos value={r.position} /></td>
            <td>
              <DriverCell driverId={r.id} teamId={r.teamId} />
              <PointsBar share={leader ? r.points / leader : 0} teamId={r.teamId} />
            </td>
            <td className="num hidden text-right text-fg-3 sm:table-cell">{r.wins || ''}</td>
            <td className="num text-right text-lg font-semibold">{r.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ConstructorStandingsTable({ rows, caption }: { rows: StandingRow[]; caption: string }) {
  const { t } = useTranslation();
  const leader = rows[0]?.points ?? 0;
  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-line-strong">
          <th scope="col" className={th}>{t('table.pos')}</th>
          <th scope="col" className={th}>{t('table.team')}</th>
          <th scope="col" className={`${th} hidden text-right sm:table-cell`}>{t('table.wins')}</th>
          <th scope="col" className={`${th} w-16 text-right`}>{t('table.points')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const team = findTeam(r.id);
          return (
            <tr key={r.id} className="row">
              <td><Pos value={r.position} /></td>
              <td>
                <Link to={`/teams/${r.id}`} className="flex items-center gap-3 py-2 hover:text-signal">
                  {team && <TeamLogo team={team} size={26} />}
                  <span className="display truncate text-xl">{team?.name ?? r.id}</span>
                </Link>
                <PointsBar share={leader ? r.points / leader : 0} teamId={r.id} />
              </td>
              <td className="num hidden text-right text-fg-3 sm:table-cell">{r.wins || ''}</td>
              <td className="num text-right text-lg font-semibold">{r.points}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Barra fina bajo la fila: puntos en proporción al líder. */
function PointsBar({ share, teamId }: { share: number; teamId: string }) {
  return (
    <div className="-mt-1 mb-1.5 h-0.5 bg-ink-800" style={teamVars(findTeam(teamId))} aria-hidden="true">
      <div className="h-full origin-left bg-(--team) transition-transform duration-500 ease-out-quart" style={{ transform: `scaleX(${share})` }} />
    </div>
  );
}
