import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="relative py-24 md:py-36">
      <span className="num pointer-events-none absolute right-0 top-10 -z-10 text-[clamp(8rem,30vw,24rem)] font-bold leading-none text-ink-850" aria-hidden="true">
        404
      </span>
      <p className="label">404</p>
      <h1 className="display mt-4 text-[clamp(2rem,6.4vw,6rem)]">{t('common.notFound')}</h1>
      <p className="mt-5 text-lg text-fg-2">{t('common.notFoundText')}</p>
      <Link to="/" className="btn btn-solid mt-10">
        {t('common.goHome')}
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
