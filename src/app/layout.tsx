import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BLUFF — Online Multiplayer Card Game',
  description: 'Play your cards. Trust nobody. A fast-paced, real-time multiplayer deception card game.',
  keywords: ['bluff', 'cheat', 'i doubt it', 'multiplayer card game', 'realtime card game'],
  authors: [{ name: 'Bluff Multiplayer Team' }],
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        {children}
      </body>
    </html>
  );
}
