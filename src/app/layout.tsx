import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Providers } from './providers';
import './globals.css';

// Self-hosted (OFL, from @fontsource) so the build never depends on Google Fonts being reachable.
// next/font needs literal options, hence no helper.
const plex = localFont({
  variable: '--font-plex',
  display: 'swap',
  src: [
    { path: './fonts/ibm-plex-sans-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/ibm-plex-sans-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/ibm-plex-sans-latin-600-normal.woff2', weight: '600', style: 'normal' },
  ],
});
const plexBn = localFont({
  variable: '--font-plex-bn',
  display: 'swap',
  preload: false, // only a fallback for ৳ — don't preload 5 files on every page
  src: [
    { path: './fonts/noto-sans-bengali-bengali-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/noto-sans-bengali-bengali-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/noto-sans-bengali-bengali-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './fonts/noto-sans-bengali-bengali-700-normal.woff2', weight: '700', style: 'normal' },
    { path: './fonts/noto-sans-bengali-bengali-800-normal.woff2', weight: '800', style: 'normal' },
  ],
});
const plexMono = localFont({
  variable: '--font-plex-mono',
  display: 'swap',
  src: [
    { path: './fonts/ibm-plex-mono-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/ibm-plex-mono-latin-500-normal.woff2', weight: '500', style: 'normal' },
  ],
});
const schibsted = localFont({
  variable: '--font-schibsted',
  display: 'swap',
  src: [
    { path: './fonts/schibsted-grotesk-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/schibsted-grotesk-latin-700-normal.woff2', weight: '700', style: 'normal' },
    { path: './fonts/schibsted-grotesk-latin-800-normal.woff2', weight: '800', style: 'normal' },
  ],
});

export const metadata: Metadata = {
  title: { default: 'Sultan TopUp', template: '%s · Sultan TopUp' },
  description: 'Mobile recharge desk',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#edf1ee' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${plex.variable} ${plexBn.variable} ${plexMono.variable} ${schibsted.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
