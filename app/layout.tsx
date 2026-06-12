import type { Metadata } from 'next';
import { Nunito } from 'next/font/google';
import './globals.css';

const nunito = Nunito({
  variable: '--font-nunito',
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'Trico — Le tri des déchets, c\'est facile !',
  description:
    'Trico est ton assistant expert du tri des déchets en Wallonie et à Bruxelles. Pose une question ou envoie une photo pour savoir comment recycler un objet !',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${nunito.variable} h-full`}>
      <body className="h-full font-nunito antialiased bg-white">{children}</body>
    </html>
  );
}
