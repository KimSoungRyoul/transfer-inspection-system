import { redirect } from 'next/navigation';

import { readSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const s = await readSession();
  if (!s) redirect('/login');
  redirect(s.role === 'supervisor' ? '/supervisor' : '/applicant');
}
