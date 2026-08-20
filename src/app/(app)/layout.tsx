import { redirect } from 'next/navigation';

import { getMe, listApplications } from '@/lib/data';
import { readSession } from '@/lib/session';
import { Shell, type NavItem } from '@/components/Shell';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await readSession();
  if (!s) redirect('/login');

  const me = await getMe(s.uid);
  if (!me) redirect('/login');

  const apps = await listApplications({ id: me.id, role: me.role });
  const count = (fn: (x: (typeof apps)[number]) => boolean) => apps.filter(fn).length;

  const nav: NavItem[] =
    me.role === 'supervisor'
      ? [
          { key: 's-list', label: '신청 접수 목록', href: '/supervisor?view=list', count: count((x) => x.status === '신청완료') },
          { key: 's-cal', label: '방문 캘린더', href: '/supervisor?view=cal', count: 0 },
          {
            key: 's-judge',
            // KPI 의 '최종판정 대기' 와 숫자가 달라 혼란스러웠다.
            // 여기서는 방문 후 판정을 기다리는 건과 방문 전 검토승인 건을 함께 세므로 라벨을 맞춘다.
            label: '판정 · 방문 대기',
            href: '/supervisor/judge',
            count: count((x) => x.status === '최종판정대기' || x.status === '검토승인'),
          },
        ]
      : [
          {
            key: 'a-list',
            label: '내 신청 현황',
            href: '/applicant',
            // 감독관 쪽만 배지가 붙어 있어 신청자는 사이드바에서 아무 신호도 못 받았다.
            // 신청자가 지금 손대야 하는 건 보완요청 뿐이므로 그것만 센다.
            count: count((x) => x.status === '보완요청'),
          },
          { key: 'a-new', label: '이관검사 신청', href: '/applicant/new', count: 0 },
        ];

  return (
    <Shell me={me} nav={nav} viaGoogle={!!s.google}>
      {children}
    </Shell>
  );
}
