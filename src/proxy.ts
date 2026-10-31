import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// The `middleware` file convention is deprecated in Next 16 and renamed to `proxy`.
// next-intl still ships its request hook as `createMiddleware`, so only the filename changes.
export default createMiddleware(routing);

export const config = {
  matcher: ['/', '/(am|en)/:path*', '/((?!api|_next|.*\\..*).*)'],
};
