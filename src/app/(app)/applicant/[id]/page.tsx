/**
 * 신청 상세 — 프로토타입 isADetail 화면.
 * 진행 타임라인 · 감독관 방문 동선 · 신청 항목 표 · 최종 판정 · 하자이행증권 ·
 * 검토 이력 · 알림 발송 이력. 보완요청 건이면 재신청 영역이 함께 보인다.
 */
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { getApplication, getMe, listAllVisits, listExternalVisits } from '@/lib/data';
import { readSession } from '@/lib/session';
import { STATUS_NOTE } from '@/lib/domain';
import { buildDetail, extraInfoOf, requestInfoOf, stageOf } from '@/lib/view';
import { FixHeadButton, FixPanel } from '@/components/applicant/Resubmit';
import { AnimGroup, AnimIn, AnimItem } from '@/components/applicant/Motion';

export const dynamic = 'force-dynamic';

export default async function ApplicantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const s = await readSession();
  if (!s) redirect('/login');
  if (s.role !== 'applicant') redirect('/supervisor');

  const me = await getMe(s.uid);
  if (!me) redirect('/login');

  const app = await getApplication(id, me.id);
  if (!app || !app.mine) notFound();

  const [apps, external] = await Promise.all([listAllVisits(), listExternalVisits()]);
  const sel = buildDetail(app, apps, external);

  /*
   * 지금 어느 단계에 있는지 + 그 단계가 무슨 뜻인지.
   * 최종 상태(stage 5)는 타임라인 밖이라 마지막 단계에 붙인다.
   */
  const curStage = Math.min(stageOf(app.status), sel.stages.length - 1);
  const statusNote = STATUS_NOTE[app.status];

  /* 기본 항목표(infoOf)가 담지 않는 나머지 제출 항목 — 값이 있는 것만 */
  const reqInfo = requestInfoOf(app);
  const extraInfo = extraInfoOf(app);

  const card: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #dfe3e8',
    borderRadius: 6,
  };
  const cardHead: React.CSSProperties = {
    padding: '13px 16px',
    borderBottom: '1px solid #eceff2',
    font: "500 12.5px/1 'Noto Sans KR'",
  };

  return (
    <div
      className="ti-page"
      style={{ padding: '24px 26px 44px', display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <Link
        href="/applicant"
        style={{
          alignSelf: 'flex-start',
          padding: 0,
          border: 0,
          background: 'none',
          font: "400 12px/1.2 'Noto Sans KR'",
          color: '#6b7480',
          cursor: 'pointer',
        }}
      >
        ‹ 내 신청 현황
      </Link>

      <AnimIn className="ti-pagehead" style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span
              style={{
                padding: '2px 7px',
                border: '1px solid #dfe3e8',
                borderRadius: 3,
                font: "500 10.5px/1.6 'Roboto Mono',monospace",
                color: '#5b6672',
              }}
            >
              {sel.product}
            </span>
            <span style={{ font: "400 12px/1 'Roboto Mono',monospace", color: '#77808c' }}>{sel.id}</span>
            <span
              title={statusNote}
              style={{
                display: 'inline-block',
                padding: '3px 8px',
                borderRadius: 3,
                font: "500 11px/1.35 'Noto Sans KR'",
                background: sel.st.bg,
                color: sel.st.fg,
                border: `1px solid ${sel.st.bd}`,
              }}
            >
              {sel.st.label}
            </span>
          </div>
          <span style={{ font: "700 17px/1.3 'Noto Sans KR'", letterSpacing: '-.01em' }}>{sel.site}</span>
        </div>
        <div style={{ flex: 1 }} />
        {sel.needsFix ? <FixHeadButton app={app} /> : null}
      </AnimIn>

      <div
        className="ti-detail"
        style={{ display: 'grid', gridTemplateColumns: '1fr 336px', gap: 16, alignItems: 'start' }}
      >
        <AnimGroup each={0.05} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <AnimItem style={card}>
            <div style={cardHead}>진행 상태</div>
            <AnimGroup
              each={0.06}
              nested
              style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 0 }}
            >
              {sel.stages.map((st, i) => (
                <AnimItem key={i} style={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <span
                      style={{
                        width: 11,
                        height: 11,
                        borderRadius: '50%',
                        background: st.dotBg,
                        border: `2px solid ${st.dotBd}`,
                        marginTop: 3,
                      }}
                    />
                    <span style={{ flex: 1, width: 2, background: st.lineBg, minHeight: st.lineH }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingBottom: 14 }}>
                    <span style={{ font: "500 12.5px/1.3 'Noto Sans KR'", color: st.titleColor }}>
                      {st.label}
                    </span>
                    <span style={{ font: "400 11.5px/1.5 'Noto Sans KR'", color: '#77808c' }}>{st.sub}</span>
                    {i === curStage ? (
                      <span style={{ font: "400 11.5px/1.6 'Noto Sans KR'", color: '#6b7480' }}>
                        {statusNote}
                      </span>
                    ) : null}
                    {st.comment ? (
                      <div
                        style={{
                          marginTop: 4,
                          padding: '9px 11px',
                          background: '#f7f8fa',
                          border: '1px solid #e8ebef',
                          borderLeft: '2px solid #1f5fd0',
                          borderRadius: 3,
                          font: "400 11.5px/1.6 'Noto Sans KR'",
                          color: '#3c4652',
                        }}
                      >
                        {st.comment}
                      </div>
                    ) : null}
                  </div>
                </AnimItem>
              ))}
            </AnimGroup>
          </AnimItem>

          {sel.needsFix ? <FixPanel app={app} revComment={app.revComment} /> : null}

          {sel.hasVisit ? (
            <AnimItem style={card}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '13px 16px',
                  borderBottom: '1px solid #eceff2',
                }}
              >
                <span style={{ font: "500 12.5px/1 'Noto Sans KR'" }}>감독관 방문 일정</span>
                <div style={{ flex: 1 }} />
                <span style={{ font: "400 11px/1.2 'Noto Sans KR'", color: '#8b95a1' }}>{sel.dayLabel}</span>
              </div>
              <AnimGroup
                each={0.04}
                nested
                style={{ padding: '15px 16px 16px', display: 'flex', flexDirection: 'column', gap: 0 }}
              >
                {sel.dayItems.map((i, idx) => (
                  <AnimItem key={`${i.t}-${idx}`}>
                    {i.showTravel ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '72px 15px 1fr', gap: 12 }}>
                        <span />
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <span style={{ width: 0, borderLeft: '1px dashed #cdd3da', minHeight: 24 }} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <span style={{ font: "400 11px/1.2 'Noto Sans KR'", color: '#a2abb5' }}>
                            ↓ {i.travel}
                          </span>
                        </div>
                      </div>
                    ) : null}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '72px 15px 1fr',
                        gap: 12,
                        alignItems: 'start',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                          paddingTop: 10,
                          textAlign: 'right',
                        }}
                      >
                        <span style={{ font: "500 12.5px/1.2 'Roboto Mono',monospace", color: i.timeColor }}>
                          {i.t}
                        </span>
                        <span style={{ font: "400 10.5px/1.2 'Roboto Mono',monospace", color: '#a2abb5' }}>
                          ~{i.tEnd}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 13 }}>
                        <span
                          style={{
                            width: 11,
                            height: 11,
                            borderRadius: '50%',
                            background: i.dotBg,
                            border: `2px solid ${i.dotBd}`,
                            flex: 'none',
                          }}
                        />
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 5,
                          padding: '10px 13px',
                          borderRadius: 6,
                          background: i.cardBg,
                          border: `1px solid ${i.cardBd}`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                          <span
                            style={{
                              font: "500 12.5px/1.45 'Noto Sans KR'",
                              color: i.titleColor,
                              textWrap: 'pretty',
                            }}
                          >
                            {i.site}
                          </span>
                          <div style={{ flex: 1 }} />
                          <span
                            style={{
                              padding: '1px 6px',
                              borderRadius: 3,
                              font: "500 10px/1.65 'Noto Sans KR'",
                              background: i.tagBg,
                              color: i.tagFg,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {i.tag}
                          </span>
                        </div>
                        <div className="ti-metarow" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ font: "400 11px/1.45 'Noto Sans KR'", color: '#8b95a1' }}>
                            {i.meta}
                          </span>
                          <span style={{ width: 1, height: 9, background: '#dfe3e8' }} />
                          <span style={{ font: "400 11px/1.45 'Noto Sans KR'", color: '#8b95a1' }}>
                            {i.durText}
                          </span>
                        </div>
                      </div>
                    </div>
                  </AnimItem>
                ))}
                <span style={{ marginTop: 10, font: "400 11px/1.6 'Noto Sans KR'", color: '#8b95a1' }}>
                  앞 현장 검사가 지연되면 방문 시간이 변동될 수 있으며, 변경 시 이메일·문자로 즉시 통보됩니다.
                </span>
              </AnimGroup>
            </AnimItem>
          ) : null}

          <AnimItem style={card}>
            <div style={cardHead}>신청 정보</div>
            <InfoGrid items={sel.info} />
          </AnimItem>

          {/*
           * 기본 항목표는 양식의 절반만 담는다. 감독관이 방문일을 잡을 때 보는
           * 검사 요청·입회 정보와, 양식의 나머지 항목을 그대로 이어서 보여 준다.
           */}
          {reqInfo.length ? (
            <AnimItem style={card}>
              <div style={cardHead}>검사 요청 · 입회</div>
              <InfoGrid items={reqInfo} />
            </AnimItem>
          ) : null}

          {extraInfo.length ? (
            <AnimItem style={card}>
              <div style={cardHead}>그 밖의 신청 항목</div>
              <InfoGrid items={extraInfo} />
            </AnimItem>
          ) : null}

          <AnimItem style={card}>
            <div style={cardHead}>검토 이력</div>
            <AnimGroup each={0.03} nested style={{ padding: '6px 15px 14px' }}>
              {sel.log.map((l, i) => (
                <AnimItem
                  key={i}
                  className="ti-log3"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '96px 78px 1fr',
                    gap: 12,
                    padding: '9px 0',
                    borderBottom: '1px solid #f2f4f7',
                  }}
                >
                  <span style={{ font: "400 11.5px/1.4 'Roboto Mono',monospace", color: '#8b95a1' }}>
                    {l.at}
                  </span>
                  <span style={{ font: "500 11.5px/1.4 'Noto Sans KR'", color: '#3c4652' }}>{l.who}</span>
                  <span style={{ font: "400 11.5px/1.5 'Noto Sans KR'", color: '#3c4652' }}>{l.txt}</span>
                </AnimItem>
              ))}
            </AnimGroup>
          </AnimItem>
        </AnimGroup>

        <AnimGroup each={0.05} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <AnimItem style={card}>
            <div style={cardHead}>최종 판정</div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 78,
                    padding: '8px 12px',
                    borderRadius: 4,
                    font: "700 15px/1.2 'Noto Sans KR'",
                    background: sel.st.bg,
                    color: sel.st.fg,
                    border: `1px solid ${sel.st.bd}`,
                  }}
                >
                  {sel.finalText}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ font: "400 11px/1.3 'Noto Sans KR'", color: '#8b95a1' }}>검사종류</span>
                  <span style={{ font: "400 12.5px/1.3 'Noto Sans KR'" }}>{sel.inspectType}</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <span style={{ font: "400 10.5px/1.3 'Noto Sans KR'", color: '#8b95a1' }}>
                  1차 판정 / 최종 판정
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span
                    style={{
                      padding: '3px 9px',
                      borderRadius: 3,
                      font: "500 11.5px/1.4 'Noto Sans KR'",
                      background: sel.firstBadge.bg,
                      color: sel.firstBadge.fg,
                      border: `1px solid ${sel.firstBadge.bd}`,
                    }}
                  >
                    {sel.firstBadge.label}
                  </span>
                  <span style={{ font: "400 11px/1 'Noto Sans KR'", color: '#c9cfd6' }}>→</span>
                  <span
                    style={{
                      padding: '3px 9px',
                      borderRadius: 3,
                      font: "500 11.5px/1.4 'Noto Sans KR'",
                      background: sel.finalBadge.bg,
                      color: sel.finalBadge.fg,
                      border: `1px solid ${sel.finalBadge.bd}`,
                    }}
                  >
                    {sel.finalBadge.label}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ font: "400 10.5px/1.3 'Noto Sans KR'", color: '#8b95a1' }}>준공검사자</span>
                <span style={{ font: "400 12.5px/1.4 'Noto Sans KR'" }}>{sel.inspector}</span>
              </div>
            </div>
          </AnimItem>

          <AnimItem style={card}>
            <div style={cardHead}>하자이행증권 · 하자보증기간</div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {sel.bond.map((b) => (
                <div
                  key={b.k}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      font: "400 11.5px/1.3 'Noto Sans KR'",
                      color: '#8b95a1',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {b.k}
                  </span>
                  <span
                    style={{
                      font: "400 12px/1.4 'Roboto Mono',monospace",
                      color: '#1a1d21',
                      textAlign: 'right',
                    }}
                  >
                    {b.v}
                  </span>
                </div>
              ))}
            </div>
            <div
              style={{
                margin: '0 15px 15px',
                padding: '10px 12px',
                background: '#f7f8fa',
                border: '1px solid #e8ebef',
                borderRadius: 4,
                font: "400 11.5px/1.6 'Noto Sans KR'",
                color: '#5b6672',
              }}
            >
              {sel.bondNote}
            </div>
          </AnimItem>

          <AnimItem style={card}>
            <div style={cardHead}>알림 발송 이력</div>
            <AnimGroup
              each={0.03}
              nested
              style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 11 }}
            >
              {sel.notifs.map((n, i) => (
                <AnimItem key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                  <span
                    style={{
                      marginTop: 1,
                      padding: '1px 5px',
                      border: '1px solid #dfe3e8',
                      borderRadius: 3,
                      font: "500 10px/1.6 'Roboto Mono',monospace",
                      color: '#5b6672',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {n.ch}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <span style={{ font: "400 11.5px/1.45 'Noto Sans KR'", color: '#3c4652' }}>{n.txt}</span>
                    <span style={{ font: "400 10.5px/1.2 'Roboto Mono',monospace", color: '#98a1ac' }}>
                      {n.at} · 발송완료
                    </span>
                  </div>
                </AnimItem>
              ))}
            </AnimGroup>
          </AnimItem>
        </AnimGroup>
      </div>
    </div>
  );
}

/** 신청 항목 표 — 라벨 위, 값 아래의 4열 그리드 (ti-ginfo 가 반응형을 담당한다) */
function InfoGrid({ items }: { items: { k: string; v: string }[] }) {
  return (
    <div
      className="ti-ginfo"
      style={{
        padding: 16,
        display: 'grid',
        gridTemplateColumns: 'repeat(4,minmax(0,1fr))',
        gap: '13px 16px',
      }}
    >
      {items.map((f) => (
        <div key={f.k} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <span style={{ font: "400 10.5px/1.3 'Noto Sans KR'", color: '#8b95a1' }}>{f.k}</span>
          <span
            style={{
              font: "400 12.5px/1.4 'Noto Sans KR'",
              color: '#1a1d21',
              wordBreak: 'break-all',
            }}
          >
            {f.v}
          </span>
        </div>
      ))}
    </div>
  );
}
