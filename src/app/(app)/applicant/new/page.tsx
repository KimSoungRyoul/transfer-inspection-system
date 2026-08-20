/**
 * 이관검사 신규 신청 — 프로토타입 isNew 화면.
 * 서버에서는 신청자 정보와 자동 생성될 식별번호만 넘기고, 위저드는 클라이언트가 돌린다.
 */
import { redirect } from 'next/navigation';

import { getMe, nextApplicationId } from '@/lib/data';
import { readSession } from '@/lib/session';
import { today } from '@/lib/domain';
import { NewWizard } from '@/components/applicant/NewWizard';

export const dynamic = 'force-dynamic';

export default async function NewApplicationPage() {
  const s = await readSession();
  if (!s) redirect('/login');
  if (s.role !== 'applicant') redirect('/supervisor');

  const me = await getMe(s.uid);
  if (!me) redirect('/login');

  const draftId = await nextApplicationId(Number(today().slice(0, 4)));

  return <NewWizard me={me} draftId={draftId} />;
}
