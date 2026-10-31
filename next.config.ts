import { networkInterfaces } from 'os';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const lanOrigins: string[] = [];
for (const iface of Object.values(networkInterfaces())) {
  for (const info of iface ?? []) {
    if (info && info.family === 'IPv4' && !info.internal) {
      lanOrigins.push(info.address);
    }
  }
}

const nextConfig: import('next').NextConfig = {
  output: undefined,
  allowedDevOrigins: [...lanOrigins, 'localhost', '127.0.0.1'],
};

export default withNextIntl(nextConfig);
