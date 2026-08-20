/**
 * 내 신청 현황 — 프로토타입 isAList 화면.
 * KPI 4장 · 감독관 방문 일정(내 현장 카드 + 그날 동선) · 신청 목록 표.
 */
import { redirect } from 'next/navigation';

import { getMe, listAllVisits, listApplications, listExternalVisits } from '@/lib/data';
import { readSession } from '@/lib/session';
import { today } from '@/lib/domain';
import { myVisits, rowBase, scheduleDays } from '@/lib/view';
import { MyBoard, MyVisitCards, NewApplicationButton, PlanTimeline, type KpiCard } from '@/components/applicant/ListClient';
import { AnimGroup, AnimIn } from '@/components/applicant/Motion';

export const dynamic = 'force-dynamic';

/** KPI 카드 = 표 필터. statuses 가 비면 "전체" (누르면 필터 해제) */
const KPI: KpiCard[] = [
  { key: 'all', label: '내 신청 전체', color: '#1a1d21', statuses: [] },
  {
    key: 'progress',
    label: '검토·판정 진행중',
    color: '#5b46c9',
    statuses: ['신청완료', '검토예정', '검토승인', '최종판정대기'],
  },
  { key: 'fix', label: '보완요청', color: '#9a5b12', statuses: ['보완요청'] },
  {
    key: 'passed',
    label: '최종 합격 (조건부 포함)',
    color: '#1f7a43',
    statuses: ['최종합격', '조건부합격'],
  },
];

export default async function ApplicantListPage() {
  const s = await readSession();
  if (!s) redirect('/login');
  if (s.role !== 'applicant') redirect('/supervisor');

  const me = await getMe(s.uid);
  if (!me) redirect('/login');

  const apps = await listApplications({ id: me.id, role: 'applicant' });
  const external = await listExternalVisits();
  const t = today();

  /**
   * 감독관의 하루 동선은 그날 방문하는 전 현장을 순서대로 도는 것이라, 내 건만으로
   * 계산하면 도착 시각이 상세 화면과 어긋난다. 전 건을 불러오되 내 신청 건에는
   * mine 플래그를 되살려 "내 현장" 강조가 유지되도록 한다.
   */
  const mineIds = new Set(apps.map((a) => a.id));
  const allVisits = (await listAllVisits()).map((a) =>
    mineIds.has(a.id) ? { ...a, mine: true } : a,
  );

  const visits = myVisits(apps, external, t, allVisits);
  const rows = apps.map((a) => ({ ...rowBase(a), status: a.status }));

  /*
   * 감독관 일정 패널은 "내 현장이 있는 가장 가까운 날" 을 보여 준다.
   * 내 현장과 무관한 남의 동선을 기본으로 띄우면 신청자에게 아무 의미가 없다.
   */
  const planDays = scheduleDays(allVisits, external, t, null);
  const isMineDay = (d: (typeof planDays)[number]) => d.items.some((i) => i.tag === '내 현장');
  const mineDays = planDays.filter(isMineDay);
  const planDay =
    mineDays.find((d) => d.full === t) ??
    mineDays[0] ??
    planDays.find((d) => d.full === t) ??
    planDays[0] ??
    null;
  const planMine = !!planDay && isMineDay(planDay);
  const planDayLabel = planDay
    ? `${planDay.full === t ? '오늘 · ' : ''}${planDay.full} (${planDay.dow})`
    : '방문 일정 없음';
  const planNote = !planDay
    ? ''
    : !planMine
      ? '내 현장 방문일 아님'
      : planDay.full === t
        ? '오늘 감독관 방문 동선'
        : '가장 가까운 내 현장 방문일 기준';
  const planSpan = planDay ? planDay.span : '';
  const inspector = apps.find((x) => x.inspector)?.inspector ?? '';

  return (
    <div
      className="ti-page"
      style={{ padding: '24px 26px 44px', display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <AnimIn className="ti-pagehead" style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ font: "700 18px/1.2 'Noto Sans KR'", letterSpacing: '-.01em' }}>내 신청 현황</span>
          <span style={{ font: "400 12px/1.4 'Noto Sans KR'", color: '#6b7480' }}>
            신청한 이관검사의 검토승인·방문예정일·최종 합격·불합격 여부를 조회합니다
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <NewApplicationButton />
      </AnimIn>

      <MyBoard kpi={KPI} rows={rows}>
        {/* 신청 건이 없으면 남의 동선만 남으므로 패널 자체를 숨긴다 */}
        {apps.length ? (
          <AnimIn style={{ background: '#fff', border: '1px solid #dfe3e8', borderRadius: 6 }}>
            <div
              className="ti-cardhead"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '13px 16px',
                borderBottom: '1px solid #eceff2',
              }}
            >
              <span style={{ font: "500 12.5px/1 'Noto Sans KR'" }}>감독관 방문 일정</span>
              <span
                style={{
                  padding: '2px 7px',
                  border: '1px solid #dfe3e8',
                  borderRadius: 3,
                  font: "400 10.5px/1.6 'Noto Sans KR'",
                  color: '#5b6672',
                }}
              >
                감독관 {inspector || '미배정'}
              </span>
              <div style={{ flex: 1 }} />
              <span className="ti-cardnote" style={{ font: "400 11px/1.2 'Noto Sans KR'", color: '#8b95a1' }}>
                내 현장 방문 시각과, 감독관이 그날 어떤 현장을 거쳐 오는지 표시됩니다
              </span>
            </div>
            <div
              className="ti-visit"
              style={{
                padding: '18px 18px 20px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '22px 28px',
                alignItems: 'start',
              }}
            >
              <AnimGroup each={0.04} nested style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                <span style={{ font: "500 11.5px/1.2 'Noto Sans KR'", color: '#5b6672' }}>내 현장 방문 예정</span>
                <MyVisitCards visits={visits} />
              </AnimGroup>

              <AnimGroup
                each={0.04}
                nested
                className="ti-visit-right"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  paddingLeft: 26,
                  borderLeft: '1px solid #eceff2',
                }}
              >
                <span
                  style={{ font: "500 11.5px/1.2 'Noto Sans KR'", color: '#5b6672', paddingBottom: 13 }}
                >
                  감독관 일정
                </span>
                <div
                  className="ti-cardhead"
                  style={{ display: 'flex', alignItems: 'baseline', gap: 9, paddingBottom: 12 }}
                >
                  <span style={{ font: "500 12.5px/1.2 'Noto Sans KR'", color: '#1a1d21' }}>{planDayLabel}</span>
                  <span style={{ font: "400 11px/1.2 'Roboto Mono',monospace", color: '#8b95a1' }}>{planSpan}</span>
                  <div style={{ flex: 1 }} />
                  <span className="ti-cardnote" style={{ font: "400 11px/1.2 'Noto Sans KR'", color: '#98a1ac' }}>
                    {planNote}
                  </span>
                </div>
                <PlanTimeline items={planDay ? planDay.items : []} />
              </AnimGroup>
            </div>
          </AnimIn>
        ) : null}
      </MyBoard>
    </div>
  );
}
