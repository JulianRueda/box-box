import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="py-24">
      <p className="num text-signal">404</p>
      <h1 className="display mt-3 text-7xl">{t('common.notFound')}</h1>
      <p className="mt-4 text-lg text-fg-2">{t('common.notFoundText')}</p>
      <Link to="/" className="label mt-8 inline-block border border-line-strong px-4 py-3 text-fg hover:border-signal hover:text-signal">
        {t('common.goHome')}
      </Link>
    </div>
  );
}
