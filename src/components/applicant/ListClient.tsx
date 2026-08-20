'use client';

/**
 * 내 신청 현황 화면의 상호작용 부분 — 클릭하면 상세로 이동하는 카드·행들.
 * 뷰모델 계산은 서버 컴포넌트가 끝내고 여기서는 그리기만 한다.
 *
 * KPI 카드는 표 필터를 겸하므로(누르면 그 상태만 남는다) KPI 와 표가 같은 상태를
 * 공유해야 한다. 둘 사이에 끼는 "감독관 방문 일정" 카드는 서버가 그린 그대로
 * children 으로 받아 통과시킨다.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  AnimatePresence,
  DUR,
  EASE,
  cappedDelay,
  fadeUp,
  motion,
  pressable,
  stagger,
  staggerItem,
} from '@/components/motion';
import { useToast } from '@/components/Toast';
import { STATUS_NOTE, STATUS_STYLE, type StatusLabel } from '@/lib/domain';
import type { ItineraryItem, MyVisit, RowBase } from '@/lib/view';
import { draftFromApplication, readDraft, writeDraft } from '@/components/applicant/draft';
import { loadForReapplyAction } from '@/components/applicant/reapply';

/** 목록 행 + 필터·툴팁에 쓰는 원래 상태값 (배지 라벨은 표기용이라 키로 못 쓴다) */
export interface MyRow extends RowBase {
  status: StatusLabel;
}

/**
 * 배지 라벨 → 상태 설명. MyVisit 은 배지만 들고 오는데 '최종판정 대기' 처럼
 * 라벨과 상태 키가 다른 값이 있어 STATUS_STYLE 의 라벨로 되짚는다.
 */
const NOTE_BY_BADGE: Record<string, string> = Object.fromEntries(
  (Object.keys(STATUS_NOTE) as StatusLabel[]).map((s) => [STATUS_STYLE[s][0], STATUS_NOTE[s]]),
);

/** KPI 카드 정의 — statuses 가 비면 "전체"(필터 해제) */
export interface KpiCard {
  key: string;
  label: string;
  color: string;
  statuses: StatusLabel[];
}

export function NewApplicationButton() {
  const router = useRouter();
  return (
    <motion.button
      {...pressable}
      onClick={() => router.push('/applicant/new')}
      className="h-blue"
      style={{
        padding: '9px 16px',
        background: '#1f5fd0',
        color: '#fff',
        border: '1px solid #1f5fd0',
        borderRadius: 4,
        font: "500 12.5px/1.2 'Noto Sans KR'",
        cursor: 'pointer',
      }}
    >
      ＋ 이관검사 신청
    </motion.button>
  );
}

/* ── 내 현장 방문 예정 ────────────────────────────────────────────── */

function VisitCard({ v, onOpen }: { v: MyVisit; onOpen: () => void }) {
  return (
    <motion.button
      variants={staggerItem}
      {...pressable}
      onClick={onOpen}
      className="h-ring-soft"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 7,
        padding: '13px 14px',
        background: '#fff',
        border: '1px solid #e4e8ec',
        borderRadius: 6,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span
          style={{
            padding: '3px 8px',
            borderRadius: 4,
            font: "500 11px/1.35 'Noto Sans KR'",
            background: v.ddayBg,
            color: v.ddayFg,
            whiteSpace: 'nowrap',
          }}
        >
          {v.dday}
        </span>
        <span style={{ font: "500 12.5px/1.2 'Roboto Mono',monospace", color: '#1a1d21' }}>
          {v.dateText}
        </span>
        <div style={{ flex: 1 }} />
        <span
          title={NOTE_BY_BADGE[v.st.label]}
          style={{
            padding: '3px 8px',
            borderRadius: 3,
            font: "500 11px/1.35 'Noto Sans KR'",
            background: v.st.bg,
            color: v.st.fg,
            border: `1px solid ${v.st.bd}`,
            whiteSpace: 'nowrap',
          }}
        >
          {v.st.label}
        </span>
      </div>
      <span style={{ font: "500 12.5px/1.45 'Noto Sans KR'", color: '#1a1d21', textWrap: 'pretty' }}>
        {v.site}
      </span>
      <span style={{ font: "400 11.5px/1.4 'Roboto Mono',monospace", color: v.timeColor }}>
        {v.timeText}
      </span>
    </motion.button>
  );
}

/**
 * 예정 건만 펼쳐 두고 지난 방문은 접는다.
 * (myVisits 가 예정 → 일정 미정 → 지난 순으로 정렬해 주므로 past 로 자르기만 하면 된다.)
 */
export function MyVisitCards({ visits }: { visits: MyVisit[] }) {
  const router = useRouter();
  const [openPast, setOpenPast] = useState(false);

  const upcoming = visits.filter((v) => !v.past);
  const past = visits.filter((v) => v.past);

  const note = (txt: string) => (
    <motion.div
      variants={staggerItem}
      style={{
        padding: '14px 14px',
        background: '#fbfbfc',
        border: '1px dashed #dfe3e8',
        borderRadius: 6,
        font: "400 11.5px/1.6 'Noto Sans KR'",
        color: '#8b95a1',
      }}
    >
      {txt}
    </motion.div>
  );

  return (
    <>
      {upcoming.map((v) => (
        <VisitCard key={v.id} v={v} onOpen={() => router.push(`/applicant/${v.id}`)} />
      ))}

      {visits.length === 0
        ? note('아직 방문 일정이 없습니다 · 감독관이 검토승인하면 일정이 표시됩니다')
        : upcoming.length === 0
          ? note('예정된 방문이 없습니다 · 지난 방문 기록만 있습니다')
          : null}

      {past.length ? (
        <motion.button
          variants={staggerItem}
          onClick={() => setOpenPast((p) => !p)}
          style={{
            alignSelf: 'flex-start',
            padding: '5px 0 0',
            border: 0,
            background: 'none',
            font: "500 11.5px/1.2 'Noto Sans KR'",
            color: '#1f5fd0',
            cursor: 'pointer',
          }}
        >
          {openPast ? `지난 방문 ${past.length}건 접기 ▲` : `지난 방문 ${past.length}건 보기 ▼`}
        </motion.button>
      ) : null}

      <AnimatePresence initial={false}>
        {openPast
          ? past.map((v) => (
              <motion.div
                key={v.id}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: DUR.fast, ease: EASE }}
                style={{ display: 'flex', flexDirection: 'column' }}
              >
                <VisitCard v={v} onOpen={() => router.push(`/applicant/${v.id}`)} />
              </motion.div>
            ))
          : null}
      </AnimatePresence>
    </>
  );
}

/** 동선 항목의 현장명 줄 — 열 수 있는 건은 button, 아닌 건은 span 으로 같은 모양을 쓴다 */
const TL_TITLE: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: 0,
  border: 0,
  background: 'none',
  textAlign: 'left',
  font: "500 12.5px/1.4 'Noto Sans KR'",
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

export function PlanTimeline({ items }: { items: ItineraryItem[] }) {
  const router = useRouter();
  return (
    <>
      {items.map((i, idx) => (
        <motion.div
          key={`${i.t}-${idx}`}
          variants={staggerItem}
          className="ti-tl"
          style={{ display: 'grid', gridTemplateColumns: '13px 1fr', gap: 14, alignItems: 'stretch' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span
              style={{
                width: 11,
                height: 11,
                borderRadius: '50%',
                background: i.dotBg,
                border: `2px solid ${i.dotBd}`,
                marginTop: 4,
                flex: 'none',
              }}
            />
            <span style={{ flex: 1, width: 1, background: i.lineBg, minHeight: 18 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
              <span style={{ font: "500 12px/1.2 'Roboto Mono',monospace", color: i.timeColor }}>{i.t}</span>
              {/*
               * 타 신청 건은 열어 볼 권한이 없다. 그래도 button 으로 두면 Tab 포커스를
               * 받아 놓고 Enter 에 아무 반응이 없어, 키보드로는 막다른 골목이 된다.
               */}
              {i.showOpen && i.appId ? (
                <button
                  onClick={() => router.push(`/applicant/${i.appId}`)}
                  style={{ ...TL_TITLE, cursor: i.cursor, color: i.titleColor }}
                >
                  {i.site}
                  <span style={{ color: '#98a1ac' }}> ›</span>
                </button>
              ) : (
                <span style={{ ...TL_TITLE, color: i.titleColor }}>{i.site}</span>
              )}
              <span
                style={{
                  padding: '2px 7px',
                  borderRadius: 3,
                  font: "500 10px/1.65 'Noto Sans KR'",
                  background: i.tagBg,
                  color: i.tagFg,
                  whiteSpace: 'nowrap',
                  flex: 'none',
                }}
              >
                {i.tag}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ font: "400 11px/1.5 'Noto Sans KR'", color: '#8b95a1' }}>{i.meta}</span>
              <span style={{ font: "400 11px/1.5 'Noto Sans KR'", color: '#8b95a1' }}>
                검사 {i.durText} · 종료 예정 {i.tEnd}
              </span>
              {i.showTravel ? (
                <span style={{ font: "400 11px/1.5 'Noto Sans KR'", color: '#a2abb5' }}>
                  이전 현장에서 {i.travel}
                </span>
              ) : null}
            </div>
          </div>
        </motion.div>
      ))}
    </>
  );
}

/* ── KPI · 목록 (필터 공유) ───────────────────────────────────────── */

/**
 * KPI 4장 + (서버가 그린 방문 일정 카드) + 신청 목록.
 * KPI 카드를 누르면 그 상태만 표에 남는다 — 눌리는 척만 하던 카드에 동작을 붙였다.
 */
export function MyBoard({
  kpi,
  rows,
  children,
}: {
  kpi: KpiCard[];
  rows: MyRow[];
  children: React.ReactNode;
}) {
  const [filter, setFilter] = useState('');

  const active = kpi.find((k) => k.key === filter && k.statuses.length) ?? null;
  const shown = active ? rows.filter((r) => active.statuses.includes(r.status)) : rows;

  return (
    <>
      <motion.div
        variants={stagger(0.04)}
        initial="hidden"
        animate="show"
        className="ti-kpi"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}
      >
        {kpi.map((k) => {
          const n = k.statuses.length
            ? rows.filter((r) => k.statuses.includes(r.status)).length
            : rows.length;
          const on = active?.key === k.key;
          return (
            <motion.button
              key={k.key}
              variants={staggerItem}
              {...pressable}
              onClick={() => setFilter(k.statuses.length && !on ? k.key : '')}
              title={
                k.statuses.length
                  ? on
                    ? '필터 해제'
                    : `${k.label} 건만 표에 표시`
                  : '전체 신청 건 표시'
              }
              style={{
                background: '#fff',
                border: `1px solid ${on ? '#1f5fd0' : '#dfe3e8'}`,
                borderRadius: 6,
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span style={{ font: "500 11.5px/1 'Noto Sans KR'", color: on ? '#1a52b6' : '#6b7480' }}>
                {k.label}
              </span>
              <span style={{ font: "500 22px/1 'Roboto Mono',monospace", color: k.color }}>{n}</span>
            </motion.button>
          );
        })}
      </motion.div>

      {children}

      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        style={{ background: '#fff', border: '1px solid #dfe3e8', borderRadius: 6, overflow: 'hidden' }}
      >
        <AnimatePresence initial={false}>
          {active ? (
            <motion.div
              key="filterbar"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DUR.fast, ease: EASE }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '10px 14px',
                borderBottom: '1px solid #eceff2',
                background: '#eaf1fd',
              }}
            >
              <span style={{ font: "500 11.5px/1.2 'Noto Sans KR'", color: '#1a52b6' }}>
                필터: {active.label}
              </span>
              <span style={{ font: "400 11.5px/1.2 'Noto Sans KR'", color: '#8b95a1' }}>
                {shown.length}건
              </span>
              <div style={{ flex: 1 }} />
              <button
                onClick={() => setFilter('')}
                style={{
                  padding: '3px 10px',
                  background: '#fff',
                  border: '1px solid #cfe0fa',
                  borderRadius: 3,
                  font: "500 11.5px/1.4 'Noto Sans KR'",
                  color: '#1a52b6',
                  cursor: 'pointer',
                }}
              >
                해제
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {rows.length === 0 ? (
          <EmptyList />
        ) : shown.length === 0 ? (
          <div
            style={{
              padding: '34px 16px',
              textAlign: 'center',
              font: "400 12px/1.6 'Noto Sans KR'",
              color: '#8b95a1',
            }}
          >
            선택한 상태의 신청 건이 없습니다
          </div>
        ) : (
          <MyTable rows={shown} />
        )}
      </motion.div>
    </>
  );
}

/** 신청 건이 하나도 없는 신규 가입자 화면 — 빈 표 대신 다음 할 일을 보여 준다 */
function EmptyList() {
  return (
    <div
      style={{
        padding: '46px 20px 50px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <span style={{ font: "500 13px/1.4 'Noto Sans KR'", color: '#3c4652' }}>
          아직 신청한 이관검사가 없습니다
        </span>
        <span style={{ font: "400 11.5px/1.6 'Noto Sans KR'", color: '#8b95a1', textAlign: 'center' }}>
          제품군을 고르고 현장 정보를 입력하면 감독관에게 접수 알림이 발송됩니다
        </span>
      </div>
      <NewApplicationButton />
    </div>
  );
}

/**
 * 여기서 끝난 건은 기다린다고 풀리지 않는다 — 신청자가 새 건을 올려야 다음이 있다.
 * (보완요청은 상세 화면의 "보완 후 재신청" 이 같은 건을 되살리므로 여기 넣지 않는다.)
 */
const REAPPLY: StatusLabel[] = ['불합격', '이월'];

/**
 * "이 내용으로 다시 신청" — 지난 건의 값을 마법사 임시저장에 심고 신규 신청으로 보낸다.
 *
 * 불합격은 현장·제품 구성이 그대로인 채 재시공만 한 것이라, 빈 폼에서 41~58개 항목을
 * 다시 치게 두면 그 자체가 재신청을 막는 장벽이 된다. 마법사가 "이어서 작성" 배너로
 * 받아 주므로, 심어 둔 값이 사용자 확인 없이 폼에 들어가지는 않는다.
 */
function ReapplyButton({ row }: { row: MyRow }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  /** 쓰다 만 신청서를 말없이 덮어쓰지 않도록 한 번 더 묻는다 */
  const [asking, setAsking] = useState(false);

  async function go() {
    if (busy) return;
    if (!asking && readDraft()) {
      setAsking(true);
      toast('작성 중이던 신청서가 있습니다 · 한 번 더 누르면 이 내용으로 바뀝니다');
      return;
    }
    setBusy(true);
    try {
      const a = await loadForReapplyAction(row.id);
      if (!a) {
        toast('신청 내용을 불러오지 못했습니다 · 새 신청서로 작성해 주세요');
        return;
      }
      writeDraft(draftFromApplication(a));
      router.push('/applicant/new');
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.button
      {...pressable}
      onClick={(e) => {
        e.stopPropagation();
        void go();
      }}
      disabled={busy}
      className="h-f4"
      title={`${row.id} 의 입력 내용을 그대로 옮겨 새 신청서를 시작합니다`}
      style={{
        marginRight: 10,
        padding: '3px 9px',
        background: asking ? '#fbf1e5' : '#fff',
        color: asking ? '#9a5b12' : '#1a52b6',
        border: `1px solid ${asking ? '#f0dcc2' : '#cfe0fa'}`,
        borderRadius: 3,
        font: "500 11.5px/1.4 'Noto Sans KR'",
        cursor: busy ? 'default' : 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {busy ? '불러오는 중…' : asking ? '덮어쓰고 작성' : '이 내용으로 다시 신청'}
    </motion.button>
  );
}

const TH: React.CSSProperties = {
  padding: '9px 12px',
  font: "500 11.5px/1.2 'Noto Sans KR'",
  color: '#6b7480',
  textAlign: 'left',
  background: '#f7f8fa',
  borderBottom: '1px solid #dfe3e8',
  whiteSpace: 'nowrap',
};
const TD: React.CSSProperties = {
  padding: '9px 12px',
  borderBottom: '1px solid #eceff2',
};

export function MyTable({ rows }: { rows: MyRow[] }) {
  const router = useRouter();
  return (
    <div className="ti-tablewrap">
      <table className="ti-table-my" style={{ width: '100%', minWidth: 860, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={TH}>식별번호</th>
            <th style={TH}>제품군</th>
            <th style={{ ...TH, whiteSpace: 'normal' }}>현장명</th>
            <th style={TH}>원청</th>
            <th style={TH}>신청일</th>
            <th style={TH}>방문예정일</th>
            <th style={TH}>진행상태</th>
            <th style={TH}>최종 합격·불합격</th>
            <th style={{ background: '#f7f8fa', borderBottom: '1px solid #dfe3e8' }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            /*
             * 신청 건이 수백 개라 행마다 stagger 를 걸면 마지막 행이 한참 뒤에 뜬다.
             * cappedDelay 로 앞 12행만 순차 등장시키고 나머지는 즉시 보여 준다.
             * (rowFade 는 variant 안에 transition 을 들고 있어 delay 를 얹을 수 없으므로
             *  같은 값을 그대로 펼쳐 쓴다.)
             */
            <motion.tr
              key={r.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: DUR.fast, ease: EASE, delay: cappedDelay(i) }}
              onClick={() => router.push(`/applicant/${r.id}`)}
              className="h-f8"
              style={{ cursor: 'pointer' }}
            >
              <td
                style={{
                  ...TD,
                  whiteSpace: 'nowrap',
                }}
              >
                {/*
                 * 행 전체가 클릭 대상이지만 tr 은 포커스를 못 받는다.
                 * 키보드·스크린리더 사용자를 위해 식별번호와 "상세 ›" 를 진짜 링크로 둔다.
                 */}
                <Link
                  href={`/applicant/${r.id}`}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    font: "400 12px/1.4 'Roboto Mono',monospace",
                    color: '#4a5460',
                    textDecoration: 'none',
                  }}
                >
                  {r.id}
                </Link>
              </td>
              <td style={TD}>
                <span
                  style={{
                    padding: '2px 6px',
                    border: '1px solid #dfe3e8',
                    borderRadius: 3,
                    font: "500 10.5px/1.5 'Roboto Mono',monospace",
                    color: '#5b6672',
                  }}
                >
                  {r.product}
                </span>
              </td>
              <td
                style={{
                  ...TD,
                  font: "400 12.5px/1.4 'Noto Sans KR'",
                  color: '#1a1d21',
                  maxWidth: 340,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.site}
              </td>
              <td
                style={{
                  ...TD,
                  font: "400 12.5px/1.4 'Noto Sans KR'",
                  color: '#4a5460',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.owner}
              </td>
              <td
                style={{
                  ...TD,
                  font: "400 12px/1.4 'Roboto Mono',monospace",
                  color: '#4a5460',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.reqDate}
              </td>
              <td
                style={{
                  ...TD,
                  font: "400 12px/1.4 'Roboto Mono',monospace",
                  color: '#4a5460',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.visitText}
              </td>
              <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                <span
                  title={STATUS_NOTE[r.status]}
                  style={{
                    display: 'inline-block',
                    padding: '3px 8px',
                    borderRadius: 3,
                    font: "500 11px/1.35 'Noto Sans KR'",
                    background: r.st.bg,
                    color: r.st.fg,
                    border: `1px solid ${r.st.bd}`,
                  }}
                >
                  {r.st.label}
                </span>
              </td>
              <td
                style={{
                  ...TD,
                  font: "500 12.5px/1.4 'Noto Sans KR'",
                  color: r.finalColor,
                  whiteSpace: 'nowrap',
                }}
              >
                {r.finalText}
              </td>
              <td style={{ ...TD, textAlign: 'right', whiteSpace: 'nowrap' }}>
                {REAPPLY.includes(r.status) ? <ReapplyButton row={r} /> : null}
                <Link
                  href={`/applicant/${r.id}`}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    font: "400 12px/1.4 'Noto Sans KR'",
                    color: '#1f5fd0',
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  상세 ›
                </Link>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
