import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Twitch Queue', description: 'A new MVP built with ideas.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
