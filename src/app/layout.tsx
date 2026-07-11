import type { Metadata } from 'next';
import { DM_Sans, Nunito } from 'next/font/google';
import { ThemeScript, ThemeToggle } from '@/shared/ui';
import './globals.css';

/**
 * Fundação de Design System da Fase 1 (T3, DS-16/DS-17). Nunito (títulos,
 * `font-heading`) e DM Sans (corpo/botões/inputs, `font-sans`) auto-hospedadas
 * via `next/font/google` — sem CDN externo em produção (DS-MN-01). Pesos
 * idênticos ao protótipo (`docs/prototipo/index.html` L9).
 */
const nunito = Nunito({
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  variable: '--font-nunito',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ASONSEG — Portal de Empregabilidade e Serviços',
  description:
    'Portal social de empregabilidade e serviços da Ação Social Nossa Senhora de Guadalupe.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${nunito.variable} ${dmSans.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body className="font-sans">
        {children}
        <ThemeToggle className="fixed bottom-4 right-4 z-50 shadow-md" />
      </body>
    </html>
  );
}
