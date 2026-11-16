import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { driverName, drivers, findTeam, teams } from '../../data/index.ts';
import type { Driver, Team } from '../../data/schemas.ts';
import { hasUploadedAsset, isAcceptableImage, useAssets, type AssetKind } from '../assets.ts';
import { PageHeader, Section } from '../components/bits.tsx';
import { DriverPortrait } from '../components/DriverPortrait.tsx';
import { Helmet } from '../components/Helmet.tsx';
import { TeamLogo } from '../components/TeamLogo.tsx';
import { teamVars } from '../format.ts';

interface ImportReport {
  added: number;
  skipped: string[];
}

/** "ferrari.png" → logo; "antonelli.jpg" o "ANT.png" → foto; "antonelli-helmet.png" → casco. */
function matchFile(name: string): { kind: AssetKind; id: string } | null {
  const stem = name.replace(/\.[^.]+$/, '').toLowerCase().trim();
  const helmet = /[-_ ](helmet|casco)$/.exec(stem);
  const base = helmet ? stem.slice(0, helmet.index) : stem;
  const driver = drivers.find((d) => d.id === base || d.code.toLowerCase() === base || d.familyName.toLowerCase() === base);
  if (driver) return { kind: helmet ? 'helmet' : 'driver', id: driver.id };
  if (helmet) return null;
  const team = teams.find((x) => x.id === base || x.name.toLowerCase() === base || x.shortName.toLowerCase() === base);
  return team ? { kind: 'logo', id: team.id } : null;
}

function Slot({ kind, id, label, children }: { kind: AssetKind; id: string; label: string; children: ReactNode }) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const uploaded = useAssets((s) => hasUploadedAsset(s.urls, kind, id));
  const put = useAssets((s) => s.put);
  const remove = useAssets((s) => s.remove);
  const [error, setError] = useState(false);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`flex h-20 w-20 items-end justify-center overflow-hidden border bg-ink-950 ${uploaded ? 'border-timing-personal' : 'border-line'}`}>{children}</div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          if (!isAcceptableImage(file)) return setError(true);
          setError(false);
          void put(kind, id, file);
        }}
      />
      <div className="flex gap-3 text-sm">
        <button type="button" onClick={() => input.current?.click()} aria-label={`${t('settings.change')}: ${label}`} className="min-h-6 cursor-pointer text-fg-2 underline decoration-line-strong underline-offset-4 hover:text-fg hover:decoration-fg">
          {uploaded ? t('settings.change') : t('settings.upload')}
        </button>
        {uploaded && (
          <button type="button" onClick={() => void remove(kind, id)} aria-label={`${t('settings.remove')}: ${label}`} className="min-h-6 cursor-pointer text-fg-3 hover:text-alert">
            {t('settings.remove')}
          </button>
        )}
      </div>
      {error && <p role="alert" className="text-center text-xs text-timing-slower">{t('settings.badFile')}</p>}
    </div>
  );
}

function TeamRow({ team }: { team: Team }) {
  const { t } = useTranslation();
  return (
    <li className="flex flex-col items-center gap-3 bg-ink-900 p-4">
      <Slot kind="logo" id={team.id} label={team.name}>
        <span className="flex h-full w-full items-center justify-center"><TeamLogo team={team} size={52} /></span>
      </Slot>
      <p className="text-center">
        <span className="cond block text-lg leading-tight">{team.name}</span>
        <span className="num text-xs text-fg-4">{team.id}.svg / .png</span>
        <span className="sr-only">{t('settings.fileName')}</span>
      </p>
    </li>
  );
}

function DriverRow({ driver }: { driver: Driver }) {
  const { t } = useTranslation();
  const team = driver.teamId ? findTeam(driver.teamId) : undefined;
  return (
    <li className="flex flex-wrap items-center gap-x-5 gap-y-4 bg-ink-900 p-4" style={teamVars(team)}>
      <div className="min-w-40 flex-1 border-l-2 border-(--team) pl-3">
        <p className="cond truncate text-xl leading-tight">{driverName(driver)}</p>
        <p className="text-sm text-fg-3">{team?.name ?? t('driver.freeAgent')}</p>
        <p className="num mt-1 text-xs text-fg-4">{driver.id}.png · {driver.id}-helmet.png</p>
      </div>
      <Slot kind="driver" id={driver.id} label={`${t('settings.photo')} — ${driverName(driver)}`}>
        <DriverPortrait driver={driver} team={team} className="h-20 w-20" />
      </Slot>
      <Slot kind="helmet" id={driver.id} label={`${t('settings.helmet')} — ${driverName(driver)}`}>
        <span className="flex h-full w-full items-center justify-center"><Helmet driver={driver} team={team} size={60} /></span>
      </Slot>
    </li>
  );
}

export function Settings() {
  const { t } = useTranslation();
  const put = useAssets((s) => s.put);
  const bulk = useRef<HTMLInputElement>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [over, setOver] = useState(false);

  const importFiles = async (files: File[]) => {
    const result: ImportReport = { added: 0, skipped: [] };
    for (const file of files) {
      const match = isAcceptableImage(file) ? matchFile(file.name) : null;
      if (!match) {
        result.skipped.push(file.name);
        continue;
      }
      await put(match.kind, match.id, file);
      result.added++;
    }
    setReport(result);
  };

  return (
    <>
      <PageHeader title={t('settings.title')} lead={t('settings.lead')} />

      <Section title={t('settings.bulk')}>
        <div
          className={`bracket flex flex-col items-start gap-6 border border-dashed p-6 transition-colors md:flex-row md:items-center md:justify-between md:p-8 ${over ? 'border-fg bg-ink-850' : 'border-line-strong bg-ink-900'}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            void importFiles([...e.dataTransfer.files]);
          }}
        >
          <p className="max-w-[60ch] text-fg-2">{t('settings.bulkText')}</p>
          <input ref={bulk} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} onChange={(e) => { void importFiles([...(e.target.files ?? [])]); e.target.value = ''; }} />
          <button type="button" onClick={() => bulk.current?.click()} className="btn btn-solid shrink-0">
            {t('settings.bulkButton')}
          </button>
        </div>
        {report && (
          <p role="status" className="mt-3 text-sm text-fg-2">
            {t('settings.imported', { count: report.added })}
            {report.skipped.length > 0 && ` ${t('settings.skipped', { files: report.skipped.join(', ') })}`}
          </p>
        )}
        <p className="mt-3 max-w-[80ch] text-sm text-fg-4">{t('settings.privacy')}</p>
      </Section>

      <Section title={t('settings.logos')}>
        <ul className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {teams.map((team) => <TeamRow key={team.id} team={team} />)}
        </ul>
      </Section>

      <Section title={t('settings.drivers')}>
        <ul className="grid gap-px border border-line bg-line lg:grid-cols-2">
          {drivers.map((d) => <DriverRow key={d.id} driver={d} />)}
        </ul>
      </Section>
    </>
  );
}
