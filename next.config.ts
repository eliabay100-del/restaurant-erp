import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: import('next').NextConfig = {
  // Standalone output disabled to keep local dev folder lean.
  // Enable (output: 'standalone') for production deployments.
  output: undefined,
};

export default withNextIntl(nextConfig);
