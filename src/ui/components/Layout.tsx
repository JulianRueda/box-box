import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { calendar, results, SEASON } from '../../data/index.ts';
import { LANGUAGES } from '../../i18n/index.ts';
import { SectorMark } from './bits.tsx';

const NAV = [
  { to: '/race', key: 'nav.race' },
  { to: '/teams', key: 'nav.teams' },
  { to: '/drivers', key: 'nav.drivers' },
  { to: '/calendar', key: 'nav.calendar' },
  { to: '/standings', key: 'nav.standings' },
] as const;

function LanguageSwitch() {
  const { i18n, t } = useTranslation();
  return (
    <div role="group" aria-label={t('nav.language')} className="flex border border-line-strong">
      {LANGUAGES.map((lng) => {
        const active = i18n.language === lng;
        return (
          <button
            key={lng}
            type="button"
            aria-pressed={active}
            onClick={() => void i18n.changeLanguage(lng)}
            className={`label min-h-8 min-w-9 cursor-pointer px-2 transition-colors ${active ? 'bg-fg text-ink-950' : 'hover:text-fg'}`}
          >
            {lng}
          </button>
        );
      })}
    </div>
  );
}

/**
 * La temporada como una tira de marcas bajo la cabecera: una por ronda,
 * encendidas las ya disputadas. Es decorativa; el dato está en Calendario.
 */
function SeasonTicks() {
  return (
    <div className="flex h-[3px] gap-px" aria-hidden="true">
      {calendar.rounds.map((round) => (
        <span key={round.round} className={`flex-1 ${round.round <= results.lastRound ? 'bg-fg-3' : 'bg-ink-800'}`} />
      ))}
    </div>
  );
}

export function Layout() {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `label relative flex items-center px-1 text-[0.75rem] transition-colors ${isActive ? 'text-fg after:absolute after:inset-x-1 after:top-0 after:h-0.5 after:bg-fg' : 'hover:text-fg'}`;

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-fg focus:px-3 focus:py-2 focus:text-ink-950">
        {t('app.skip')}
      </a>

      <header className="sticky top-0 z-40 bg-ink-950/92 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[100rem] items-stretch justify-between gap-6 px-4 md:px-8">
          <Link to="/" className="flex items-center gap-3">
            <SectorMark />
            <span className="display text-[0.9375rem] tracking-normal">{t('app.name')}</span>
            <span className="num hidden text-xs text-fg-4 sm:inline">{SEASON}</span>
          </Link>
          <nav aria-label={t('nav.main')} className="hidden items-stretch gap-6 md:flex">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} className={linkClass}>
                {t(item.key)}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <NavLink to="/settings" className={({ isActive }) => `label text-[0.75rem] transition-colors hover:text-fg ${isActive ? 'text-fg' : ''}`}>
              {t('nav.settings')}
            </NavLink>
            <LanguageSwitch />
          </div>
        </div>
        <SeasonTicks />
      </header>

      <main id="main" className="mx-auto w-full max-w-[100rem] flex-1 px-4 pb-28 md:px-8 md:pb-28">
        <Outlet />
      </main>

      <footer className="hidden border-t border-line md:block">
        <div className="mx-auto flex max-w-[100rem] items-center justify-between gap-6 px-8 py-5">
          <p className="label flex items-center gap-3">
            <SectorMark className="scale-75" />
            {t('app.name')} {SEASON}
          </p>
          <p className="label num">
            R{String(results.lastRound).padStart(2, '0')} / {calendar.rounds.length}
          </p>
        </div>
      </footer>

      {/* En el móvil la navegación va abajo, al alcance del pulgar. */}
      <nav aria-label={t('nav.main')} className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line-strong bg-ink-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `cond flex h-14 items-center justify-center px-0.5 text-center text-[0.8125rem] ${isActive ? 'text-fg shadow-[inset_0_2px_0_var(--color-fg)]' : 'text-fg-3'}`}
          >
            {t(item.key)}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
