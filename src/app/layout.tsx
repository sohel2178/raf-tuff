import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans, Noto_Sans_Bengali, Schibsted_Grotesk } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const plex = IBM_Plex_Sans({ variable: '--font-plex', subsets: ['latin'], weight: ['400', '500', '600'] });
const plexBn = Noto_Sans_Bengali({ variable: '--font-plex-bn', subsets: ['bengali'], weight: ['400', '500', '600', '700', '800'] });
const plexMono = IBM_Plex_Mono({ variable: '--font-plex-mono', subsets: ['latin'], weight: ['400', '500'] });
const schibsted = Schibsted_Grotesk({ variable: '--font-schibsted', subsets: ['latin'], weight: ['500', '700', '800'] });

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
