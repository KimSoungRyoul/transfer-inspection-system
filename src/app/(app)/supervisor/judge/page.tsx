/**
 * 판정 대기 목록 — 방문을 마쳤거나 방문이 예정된 건을 한 화면에 모은다.
 *
 * 예전에는 임의의 1건으로 리다이렉트했다. 사이드바가 "판정 · 방문 대기 27" 이라고
 * 알려 준 뒤 27건 중 무엇인지 보여 주지 않고 한 건에 떨어뜨리면, 감독관은 나머지
 * 26건을 목록에서 다시 찾아야 한다.
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { listApplications } from '@/lib/data';
import { today } from '@/lib/domain';
import { readSession } from '@/lib/session';
import { isJudgeable } from '@/lib/view';
import { KpiRowCells, kpiRowStyle } from '@/components/supervisor/KpiModal';

export const dynamic = 'force-dynamic';

export default async function JudgeEntryPage() {
  const s = await readSession();
  if (!s) redirect('/login');
  if (s.role !== 'supervisor') redirect('/applicant');

  const apps = await listApplications({ id: s.uid, role: 'supervisor' });

  /* 다녀온 순 — 방문일이 이른 건부터, 아직 방문 전(일자 미정)인 건은 뒤로 */
  const list = apps.filter(isJudgeable).sort((a, b) => {
    if (!a.visitDate && !b.visitDate) return a.id < b.id ? -1 : 1;
    if (!a.visitDate) return 1;
    if (!b.visitDate) return -1;
    return a.visitDate < b.visitDate ? -1 : a.visitDate > b.visitDate ? 1 : 0;
  });

  const visited = list.filter((x) => x.status === '최종판정대기').length;
  /*
   * 검토승인인데 방문일이 지난 건 = 다녀왔지만 판정을 안 넣은 것.
   * 이걸 '방문 예정' 으로 세면 한 달 지난 건이 앞으로 갈 일정처럼 보인다.
   */
  const overdue = list.filter(
    (x) => x.status === '검토승인' && !!x.visitDate && x.visitDate < today(),
  ).length;
  const upcoming = list.length - visited - overdue;

  return (
    <div
      className="ti-page"
      style={{ padding: '24px 26px 44px', display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <div className="ti-pagehead" style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ font: "700 18px/1.2 'Noto Sans KR'", letterSpacing: '-.01em' }}>
            판정 · 방문 대기
          </span>
          <span style={{ font: "400 12px/1.4 'Noto Sans KR'", color: '#6b7480' }}>
            방문일이 이른 순서입니다 · 행을 누르면 판정 화면이 열립니다
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <Link
          href="/supervisor"
          style={{
            padding: '8px 14px',
            background: '#fff',
            color: '#3c4652',
            border: '1px solid #d3d8de',
            borderRadius: 4,
            font: "500 12.5px/1.2 'Noto Sans KR'",
            whiteSpace: 'nowrap',
          }}
        >
          신청 접수 목록
        </Link>
      </div>

      <div
        style={{
          background: '#fff',
          border: '1px solid #dfe3e8',
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
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
          <span style={{ width: 3, height: 17, borderRadius: 2, background: '#0f6b8f', flex: 'none' }} />
          <span style={{ font: "500 12.5px/1 'Noto Sans KR'" }}>판정할 신청 건</span>
          <span
            style={{
              padding: '2px 9px',
              borderRadius: 10,
              background: '#eef0f3',
              font: "500 11px/1.75 'Roboto Mono',monospace",
              color: '#4a5460',
              whiteSpace: 'nowrap',
            }}
          >
            {list.length}건
          </span>
          <div style={{ flex: 1 }} />
          <span
            className="ti-cardnote"
            style={{ font: "400 11px/1.2 'Noto Sans KR'", color: '#8b95a1' }}
          >
            방문 후 최종판정 대기 {visited}건
            {overdue ? ` · 방문일 경과 ${overdue}건` : ''} · 방문 예정 {upcoming}건
          </span>
        </div>

        {list.length === 0 ? (
          <div
            style={{
              padding: '38px 18px',
              textAlign: 'center',
              font: "400 12.5px/1.6 'Noto Sans KR'",
              color: '#98a1ac',
            }}
          >
            판정을 기다리는 신청 건이 없습니다
          </div>
        ) : null}

        {list.map((x) => (
          <Link
            key={x.id}
            href={`/supervisor/${x.id}`}
            className="ti-kpirow h-f7"
            style={{ ...kpiRowStyle, color: 'inherit' }}
          >
            <KpiRowCells app={x} />
          </Link>
        ))}
      </div>
    </div>
  );
}
