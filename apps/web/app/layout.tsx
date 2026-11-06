import type { Metadata } from 'next';
import './globals.css';
import './warm-studio.css';
import './studio-refinement.css';
import { SiteHeader } from './components/site-header';
import { NetworkStatus } from './components/network-status';
import { AiAssistant } from './components/ai-assistant';
import { VisitTracker } from './components/visit-tracker';
export const metadata: Metadata = {
  title: { default: 'Resaller.uz', template: '%s — Resaller.uz' },
  description: 'Siz uchun tanlangan mahsulotlar — Resaller rasmiy do‘koni',
};
const themeScript = `(function(){try{var t=localStorage.getItem('resaller-theme')||'light';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';document.documentElement.style.colorScheme=d?'dark':'light'}catch(e){}})()`;
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uz" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          Asosiy qismga o‘tish
        </a>
        <NetworkStatus />
        <VisitTracker />
        <SiteHeader />
        <div id="main-content">{children}</div>
        <AiAssistant />
      </body>
    </html>
  );
}
