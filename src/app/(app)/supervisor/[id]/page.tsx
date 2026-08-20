/**
 * 판정 상세 — 신청 1건의 전 항목과 판정 입력 패널.
 * 방문 동선 계산에 다른 신청자의 건까지 필요하므로 listAllVisits 를 함께 읽는다.
 */
import { notFound, redirect } from 'next/navigation';

import { getApplication, listAllVisits, listExternalVisits } from '@/lib/data';
import { readSession } from '@/lib/session';
import { buildDetail } from '@/lib/view';
import { JudgeScreen } from '@/components/supervisor/JudgeScreen';

export const dynamic = 'force-dynamic';

export default async function JudgeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await readSession();
  if (!s) redirect('/login');
  if (s.role !== 'supervisor') redirect('/applicant');

  const { id } = await params;
  const app = await getApplication(id, null);
  if (!app) notFound();

  const [visits, external] = await Promise.all([listAllVisits(), listExternalVisits()]);

  return (
    <JudgeScreen
      app={app}
      sel={buildDetail(app, visits, external)}
      apps={visits}
      external={external}
    />
  );
}
