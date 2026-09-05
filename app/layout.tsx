import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'AELE · Tu evento, desde otra perspectiva',
  description: 'Videografía aérea para eventos. Una mirada diferente desde Villahermosa, Tabasco. Conoce AELE y cuéntanos tu próximo evento.',
  robots: { index: false, follow: false },
  icons: { icon: '/media/aele-logo.jpg' },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es-MX" className="dark"><body>{children}</body></html>;
}
