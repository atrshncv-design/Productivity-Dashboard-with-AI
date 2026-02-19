import type { Metadata, Viewport } from 'next';
import './globals.css';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'Трекер Продуктивности',
  description: 'Персональный дашборд для отслеживания привычек и продуктивности',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-512.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0d0d11',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
