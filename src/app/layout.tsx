import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
