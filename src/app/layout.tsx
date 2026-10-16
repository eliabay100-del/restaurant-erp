import type { ReactNode } from 'react';

// This root layout simply passes through to the [locale] layout.
// The actual HTML, body, fonts, and providers are in [locale]/layout.tsx.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
