import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: import('next').NextConfig = {
  // Standalone output = minimal production bundle (only needed deps)
  output: 'standalone',
};

export default withNextIntl(nextConfig);
