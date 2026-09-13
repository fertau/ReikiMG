import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ServiceWorkerRegistrar } from '@/components/service-worker-registrar';

export const metadata: Metadata = {
  title: {
    default: 'ReikiMG · Relevamientos',
    template: '%s · ReikiMG',
  },
  description:
    'Relevamientos de obra y órdenes de producción para vidrios, cerramientos, mamparas, barandas, frentes y cristal templado.',
  manifest: '/manifest.webmanifest',
  applicationName: 'ReikiMG',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ReikiMG',
  },
  icons: {
    icon: [{ url: '/favicon-32.png', sizes: '32x32', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body className="min-h-dvh antialiased">
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
