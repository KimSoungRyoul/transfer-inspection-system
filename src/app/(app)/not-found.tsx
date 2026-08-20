import Link from 'next/link';

import { readSession } from '@/lib/session';

/**
 * 인증 영역의 404 — 셸(상단바·사이드바) 안에서 보인다.
 * "없는 건" 과 "내 건이 아닌 건" 을 구분해 알려 줄 수 없으므로 둘 다 담는다.
 *
 * 돌아갈 곳은 역할에 맞는 목록 하나만 보여 준다 — 신청자에게 감독관 목록을
 * 권하면 눌러도 되돌려보내질 뿐이다.
 */
export default async function AppNotFound() {
  const s = await readSession();
  const isSup = s?.role === 'supervisor';
  const backHref = isSup ? '/supervisor' : '/applicant';
  const backLabel = isSup ? '신청 접수 목록으로' : '내 신청 현황으로';

  return (
    <div
      className="ti-page"
      style={{
        padding: '24px 26px 44px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        minHeight: '60vh',
      }}
    >
      <span style={{ font: "500 11px/1 'Roboto Mono',monospace", color: '#a2abb5', letterSpacing: '.12em' }}>
        404
      </span>
      <span style={{ font: "700 17px/1.3 'Noto Sans KR'", letterSpacing: '-.01em' }}>
        신청 건을 찾을 수 없습니다
      </span>
      <span
        style={{
          font: "400 12.5px/1.7 'Noto Sans KR'",
          color: '#6b7480',
          textAlign: 'center',
          maxWidth: 380,
          wordBreak: 'keep-all',
        }}
      >
        식별번호가 잘못되었거나, 본인이 신청한 건이 아닐 수 있습니다.
        번호를 다시 확인하거나 목록에서 찾아 주세요.
      </span>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <Link
          href={backHref}
          className="h-blue"
          style={{
            padding: '9px 16px',
            background: '#1f5fd0',
            color: '#fff',
            border: '1px solid #1f5fd0',
            borderRadius: 4,
            font: "500 12.5px/1.2 'Noto Sans KR'",
          }}
        >
          {backLabel}
        </Link>
      </div>
    </div>
  );
}
