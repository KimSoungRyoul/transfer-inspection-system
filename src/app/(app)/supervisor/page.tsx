/**
 * 감독관 첫 화면 — 신청 접수 목록 (view=cal 이면 방문 캘린더).
 * 감독관은 다른 신청자의 건까지 전부 본다.
 *
 * 필터·정렬은 searchParams 로 받는다. 상세를 열었다가 뒤로 와도 좁혀 둔 목록이
 * 그대로 남아야 252건짜리 트리아지 루프가 유지된다.
 */
import { redirect } from 'next/navigation';

import { listApplications, listExternalVisits } from '@/lib/data';
import { readSession } from '@/lib/session';
import { ListClient } from '@/components/supervisor/ListClient';

export const dynamic = 'force-dynamic';

const YEARS = ['2026년', '2025년', '2024년'];
const PRODUCTS = ['DDL', 'HN'];
const STATUSES = ['신청완료', '검토예정', '검토승인', '보완요청', '최종판정대기', '완료'];

/** 주소로 들어온 값이 목록이 아는 값일 때만 통과시킨다 */
const oneOf = (v: string | undefined, allowed: string[]): string =>
  v && allowed.includes(v) ? v : '';

export default async function SupervisorListPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    year?: string;
    product?: string;
    status?: string;
    q?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const s = await readSession();
  if (!s) redirect('/login');
  if (s.role !== 'supervisor') redirect('/applicant');

  const sp = await searchParams;
  const [apps, external] = await Promise.all([
    listApplications({ id: s.uid, role: 'supervisor' }),
    listExternalVisits(),
  ]);

  return (
    <ListClient
      apps={apps}
      external={external}
      view={sp.view === 'cal' ? 'cal' : 'list'}
      filters={{
        year: oneOf(sp.year, YEARS),
        product: oneOf(sp.product, PRODUCTS),
        status: oneOf(sp.status, STATUSES),
        q: (sp.q ?? '').trim(),
        sortKey: sp.sort === 'visitDate' ? 'visitDate' : 'reqDate',
        sortDir: sp.dir === 'asc' ? 'asc' : 'desc',
      }}
    />
  );
}
