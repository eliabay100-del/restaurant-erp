import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: ['/', '/(am|en)/:path*', '/((?!api|_next|.*\\..*).*)'],
};
