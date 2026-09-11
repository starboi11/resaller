import Link from 'next/link';
import { StatePanel } from '@resaller/ui';

export default function NotFound() {
  return <main className="shell py-16"><StatePanel eyebrow="404" title="Bu sahifa topilmadi" description="Havola eskirgan yoki sahifa ko‘chirilgan bo‘lishi mumkin." action={<Link className="rs-button" href="/marketplace">Bozorga qaytish</Link>} /></main>;
}
