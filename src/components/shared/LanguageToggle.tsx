'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';
import { localeNames } from '@/i18n/config';
import type { Locale } from '@/i18n/config';

export default function LanguageToggle() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = (newLocale: Locale) => {
    if (newLocale !== locale) {
      router.replace(pathname, { locale: newLocale });
    }
  };

  return (
    <div className="lang-toggle">
      {(Object.entries(localeNames) as [Locale, string][]).map(([loc, label]) => (
        <button
          key={loc}
          className={`lang-toggle-btn ${locale === loc ? 'active' : ''}`}
          onClick={() => switchLocale(loc)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
