import type { Metadata } from 'next';
import './globals.css';
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
        <div id="admin-content">{children}</div>
      </body>
    </html>
  );
}
