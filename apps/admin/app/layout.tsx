import type { Metadata } from 'next';
import './globals.css';
import { AdminChrome } from './components/admin-chrome';
export const metadata: Metadata = {
  title: 'Boshqaruv — Resaller Admin',
  description: 'Resaller moderatsiya va audit markazi',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uz">
      <body>
        <a className="skip-link" href="#admin-content">
          Asosiy qismga o‘tish
        </a>
        <AdminChrome>
          <div id="admin-content">{children}</div>
        </AdminChrome>
      </body>
    </html>
  );
}
