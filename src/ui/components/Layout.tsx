import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { SEASON } from '../../data/index.ts';
import { LANGUAGES } from '../../i18n/index.ts';

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
            className={`label min-h-9 min-w-10 cursor-pointer px-3 transition-colors ${active ? 'bg-fg text-ink-950' : 'text-fg-3 hover:text-fg'}`}
          >
            {lng}
          </button>
        );
      })}
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
    `display relative flex items-center px-1 text-[0.9375rem] transition-colors ${isActive ? 'text-fg after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-signal' : 'text-fg-3 hover:text-fg'}`;

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-fg focus:px-3 focus:py-2 focus:text-ink-950">
        {t('app.skip')}
      </a>

      <header className="sticky top-0 z-40 border-b border-line bg-ink-950/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[90rem] items-stretch justify-between gap-6 px-4 md:px-8">
          <Link to="/" className="flex items-center gap-3">
            <span className="h-5 w-1.5 -skew-x-12 bg-signal" aria-hidden="true" />
            <span className="display text-lg">{t('app.name')}</span>
            <span className="num hidden text-xs text-fg-3 sm:inline">{SEASON}</span>
          </Link>
          <nav aria-label={t('nav.main')} className="hidden items-stretch gap-7 md:flex">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} className={linkClass}>
                {t(item.key)}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <NavLink to="/settings" className={({ isActive }) => `label hover:text-fg ${isActive ? 'text-fg' : ''}`}>
              {t('nav.settings')}
            </NavLink>
            <LanguageSwitch />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-[90rem] flex-1 px-4 pb-28 md:px-8 md:pb-24">
        <Outlet />
      </main>

      {/* En el móvil la navegación va abajo, al alcance del pulgar. */}
      <nav aria-label={t('nav.main')} className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-ink-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `display flex h-14 items-center justify-center text-[0.6875rem] ${isActive ? 'text-fg shadow-[inset_0_2px_0_var(--color-signal)]' : 'text-fg-3'}`}
          >
            {t(item.key)}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
