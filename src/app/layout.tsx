import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { AppProvider } from '@/context/AppContext';
import { PwaRegistrar } from '@/components/PwaRegistrar';
import './globals.css';

export const metadata: Metadata = {
  title: 'PingCoach Pro — Entraînement Tennis de Table',
  description:
    'PWA complète de gestion d’entraînement de tennis de table, constitution des paires, mode Live bord de table et synchronisation Google Sheets.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PingCoach',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark">
      <body className="bg-obsidian text-zinc-100 antialiased">
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
        />
        <PwaRegistrar />
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
