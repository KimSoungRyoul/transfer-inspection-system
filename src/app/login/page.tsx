import { redirect } from 'next/navigation';

import { AuthScreen } from '@/components/auth/AuthScreen';
import { readSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const s = await readSession();
  if (s) redirect(s.role === 'supervisor' ? '/supervisor' : '/applicant');
  return <AuthScreen />;
}
