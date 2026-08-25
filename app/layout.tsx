import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://yu-zora.com/games/shape-fit-100/'),
  title: '目分量100（仮）',
  description: 'さっき見た形を100%として、合計100%ピッタリを目指す目分量ゲーム。',
  icons: {
    icon: '/games/shape-fit-100/favicon.svg',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
