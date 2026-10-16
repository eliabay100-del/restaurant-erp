import type { Metadata, Viewport } from 'next';
import { Poppins, Noto_Sans_Ethiopic } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getLocale } from 'next-intl/server';
import { AuthProvider } from '@/context/AuthProvider';
import { SocketProvider } from '@/context/SocketProvider';
import SiteFooter from '@/components/shared/SiteFooter';
import '../globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-poppins',
  display: 'swap',
});

const notoEthiopic = Noto_Sans_Ethiopic({
  subsets: ['ethiopic'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-noto-ethiopic',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Warka Dine | Restaurant POS System',
  description: 'Modern restaurant and cafe management POS system with Amharic and English support. Order taking, kitchen display, payments, and staff management.',
  keywords: ['restaurant', 'POS', 'point of sale', 'Ethiopian', 'Amharic', 'cafe', 'kitchen display', 'order management'],
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#00a651',
  width: 'device-width',
  initialScale: 1,
};

export default async function LocaleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} dir="ltr" className={`${poppins.variable} ${notoEthiopic.variable}`}>
      <body style={{ fontFamily: locale === 'am' ? 'var(--font-noto-ethiopic), var(--font-poppins), sans-serif' : 'var(--font-poppins), sans-serif' }}>
        {/* Register the service worker (offline app shell). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                // Service workers require a secure context: https, or localhost/127.0.0.1.
                var secure = location.protocol === 'https:' ||
                  location.hostname === 'localhost' ||
                  location.hostname === '127.0.0.1';
                if ('serviceWorker' in navigator && secure) {
                  window.addEventListener('load', function () {
                    navigator.serviceWorker.register('/sw.js').catch(function () {});
                  });
                }
              })();
            `,
          }}
        />
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            <SocketProvider>
              {children}
            </SocketProvider>
          </AuthProvider>
        </NextIntlClientProvider>
        <SiteFooter />
      </body>
    </html>
  );
}
