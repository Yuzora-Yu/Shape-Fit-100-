import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '目分量100（仮）',
  description: 'さっき見た形を100%として、合計100%ピッタリを目指す目分量ゲーム。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
