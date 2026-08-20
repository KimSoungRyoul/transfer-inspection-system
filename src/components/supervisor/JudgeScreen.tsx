'use client';

/**
 * 판정 상세 — 엑셀 양식 전 항목 · 하자이행증권 확인 · 검토 이력 + 우측 판정 입력 패널.
 * 증권 확인 체크가 좌측 카드와 우측 패널에 함께 걸려 있어 화면 전체가 한 컴포넌트다.
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  confirmJudgeAction,
  requestFixAction,
  saveFirstResultAction,
  type ActionResult,
} from '@/lib/actions';
import {
  INSPECT_TYPES,
  RESULTS,
  RESULT_COLOR,
  STATUS_NOTE,
  type ApplicationDTO,
  type ExternalVisitDTO,
  type ResultLabel,
} from '@/lib/domain';
import {
  chip,
  extraInfoOf,
  isJudgeable,
  isPending,
  requestInfoOf,
  resultChip,
  type DetailVM,
} from '@/lib/view';
import { euro } from '@/lib/form';
import { useToast } from '@/components/Toast';
import {
  AnimatePresence,
  DUR,
  EASE,
  fade,
  fadeUp,
  motion,
  pressable,
  stagger,
  staggerItem,
} from '@/components/motion';
import { ProcessDrawer } from '@/components/supervisor/ProcessDrawer';

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #dfe3e8',
  borderRadius: 6,
};

const cardTitleStyle: React.CSSProperties = {
  padding: '13px 16px',
  borderBottom: '1px solid #eceff2',
  font: "500 12.5px/1 'Noto Sans KR'",
};

const gridInfoStyle: React.CSSProperties = {
  padding: 16,
  display: 'grid',
  gridTemplateColumns: 'repeat(4,minmax(0,1fr))',
  gap: '13px 16px',
};

const labelStyle: React.CSSProperties = {
  font: "500 11.5px/1.2 'Noto Sans KR'",
  color: '#5b6672',
};

const checkRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  cursor: 'pointer',
};

/** 코멘트 최대 길이 — ProcessDrawer 와 같은 기준 */
const MAX_COMMENT = 500;

/** 조건이 안 맞아 막힌 버튼 — 색은 그대로 두고 흐리게만 한다 */
const blockedLook = (blocked: boolean): React.CSSProperties =>
  blocked ? { opacity: 0.55, cursor: 'not-allowed' } : {};

/**
 * 하자이행증권이 확인되지 않은 상태 — 서버 confirmJudgeAction 과 같은 기준.
 * 이 건은 합격·조건부합격으로 닫을 수 없다.
 */
const isBondMissing = (a: ApplicationDTO): boolean =>
  a.issuer === '미발행' || a.bondNo === '입력 요망' || a.bondNo === '추후발행' || !a.bondNo;

/** 증권 미확인이면 고를 수 없는 판정 */
const PASS_RESULTS: ResultLabel[] = ['합격', '조건부합격'];

/** 주의 팔레트 — 회색 안내문은 현장에서 읽히지 않는다 */
const warnBoxStyle: React.CSSProperties = {
  background: '#fbf1e5',
  border: '1px solid #f0dcc2',
  color: '#9a5b12',
};

const warnTextStyle: React.CSSProperties = {
  font: "400 11px/1.5 'Noto Sans KR'",
  color: '#9a5b12',
  wordBreak: 'keep-all',
};

/** 확인 단계 문구 */
const confirmTextStyle: React.CSSProperties = {
  font: "400 11.5px/1.5 'Noto Sans KR'",
  color: '#3c4652',
  wordBreak: 'keep-all',
};

/** 좌측 카드 3장 · 우측 판정 패널을 순서대로 올린다 */
const sectionStagger = stagger(0.05);
const logStagger = stagger(0.05);

const chipStyle = (
  c: { bg: string; fg: string; bd: string },
  wide: boolean,
): React.CSSProperties => ({
  position: 'relative',
  flex: wide ? 1 : undefined,
  padding: wide ? '7px 10px' : '6px 11px',
  borderRadius: 4,
  font: "500 12px/1.2 'Noto Sans KR'",
  cursor: 'pointer',
  background: c.bg,
  color: c.fg,
  border: `1px solid ${c.bd}`,
});

/**
 * 선택된 칩 표시 — 칩 자신의 테두리 위에 같은 색으로 겹쳐 두므로 정지 상태에선 보이지 않고,
 * 선택이 옮겨갈 때만 layoutId 로 미끄러진다. (칩 배경을 옮기면 글자색이 먼저 바뀌어 깜빡인다)
 */
function ChipRing({ id, color }: { id: string; color: string }) {
  return (
    <motion.span
      layoutId={id}
      transition={{ duration: DUR.base, ease: EASE }}
      style={{
        position: 'absolute',
        inset: -1,
        borderRadius: 4,
        border: `1px solid ${color}`,
        pointerEvents: 'none',
      }}
    />
  );
}

/**
 * 확정 전 한 번 더 — 무엇으로 확정되어 어디까지 통보되는지 보여 준다.
 * 모달 없이 버튼 자리를 그대로 바꾸므로 현장에서 손이 가는 위치가 유지된다.
 */
function ConfirmPanel({
  busy,
  color,
  title,
  text,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  color: string;
  title: string;
  text: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
        padding: '12px 13px',
        background: '#fbfbfc',
        border: '1px solid #eceff2',
        borderRadius: 4,
      }}
    >
      <span style={{ font: "700 17px/1.2 'Noto Sans KR'", color }}>{title}</span>
      <span style={confirmTextStyle}>{text}</span>
      <div style={{ display: 'flex', gap: 8 }}>
        <motion.button
          onClick={onCancel}
          className="h-bd"
          {...pressable}
          style={{
            flex: 1,
            padding: 10,
            background: '#fff',
            color: '#3c4652',
            border: '1px solid #d3d8de',
            borderRadius: 4,
            font: "500 12.5px/1.2 'Noto Sans KR'",
            cursor: 'pointer',
          }}
        >
          취소
        </motion.button>
        <motion.button
          onClick={onConfirm}
          disabled={busy}
          {...pressable}
          style={{
            flex: 1,
            padding: 10,
            background: color,
            color: '#fff',
            border: `1px solid ${color}`,
            borderRadius: 4,
            font: "500 12.5px/1.2 'Noto Sans KR'",
            cursor: 'pointer',
          }}
        >
          {busy ? '처리 중…' : '확정'}
        </motion.button>
      </div>
    </div>
  );
}

/** 항목 카드 — 값이 있는 항목만 담긴 배열을 그대로 그린다 (비면 카드를 그리지 않는다) */
function InfoCard({ title, items }: { title: string; items: { k: string; v: string }[] }) {
  if (!items.length) return null;
  return (
    <motion.div variants={staggerItem} style={cardStyle}>
      <div style={cardTitleStyle}>{title}</div>
      <div className="ti-ginfo" style={gridInfoStyle}>
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
    </motion.div>
  );
}

export function JudgeScreen({
  app,
  sel,
  apps,
  external,
}: {
  app: ApplicationDTO;
  sel: DetailVM;
  /** 방문 동선 계산용 — 처리 드로어에 그대로 넘긴다 */
  apps: ApplicationDTO[];
  external: ExternalVisitDTO[];
}) {
  const router = useRouter();
  const toast = useToast();

  const [inspectType, setInspectType] = useState<string>(app.inspectType || '');
  const [firstResult, setFirstResult] = useState<string>(app.first || '');
  const [finalResult, setFinalResult] = useState<string>(app.final || '');
  const [judgeComment, setJudgeComment] = useState(app.finalComment || app.firstComment || '');
  const [bondOk, setBondOk] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySms, setNotifySms] = useState(true);
  const [busy, setBusy] = useState(false);
  /* 확정·반려는 한 번 누르면 3곳에 통보가 나간다 — 버튼 줄을 확인 단계로 바꾼다 */
  const [confirmStep, setConfirmStep] = useState<'' | 'judge' | 'fix'>('');
  /* 검토 단계의 건은 이 화면에서 바로 처리 드로어를 연다 */
  const [reviewOpen, setReviewOpen] = useState(false);

  const itype = inspectType || '샘플링검사';
  /* 아직 1차 판정 전이면 1차만 먼저 기록할 수 있다 */
  const canSaveFirst = app.status === '검토승인';

  /**
   * 우측 패널은 상태를 가린다.
   * 검토 전 건에 판정 칩을 열어 두면 다 입력한 뒤에야 서버가 거부한다.
   */
  const inReview = isPending(app);
  const inJudge = isJudgeable(app);
  const bondMissing = isBondMissing(app);
  const finalColor = RESULT_COLOR[finalResult as ResultLabel] ?? '#1f7a43';
  const reqInfo = requestInfoOf(app);
  const extraInfo = extraInfoOf(app);

  /* 최종 판정과 증권 확인이 모두 있어야 확정할 수 있다 — 막힌 이유를 버튼 위에 적는다 */
  const judgeBlocks = [
    finalResult ? '' : '최종 판정',
    bondOk ? '' : '하자이행증권 · 하자보증기간 확인',
  ].filter(Boolean);
  const judgeBlocked = judgeBlocks.length > 0;

  /* 1차 판정 저장도 1차 판정이 있어야 한다 */
  const firstBlocked = !firstResult;

  async function run(fn: () => Promise<ActionResult>, goList: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fn();
      toast(r.toast);
      if (r.ok) {
        if (goList) router.push('/supervisor');
        router.refresh();
      } else {
        // 서버가 막았으면 확인 줄을 접어, 무엇을 고쳐야 할지 다시 고를 수 있게 한다
        setConfirmStep('');
      }
    } finally {
      setBusy(false);
    }
  }

  const confirmJudge = () =>
    run(
      () =>
        confirmJudgeAction({
          id: app.id,
          firstResult,
          finalResult,
          inspectType: itype,
          comment: judgeComment,
          bondOk,
          notifyEmail,
          notifySms,
        }),
      true,
    );

  const saveFirst = () =>
    run(
      () =>
        saveFirstResultAction({
          id: app.id,
          firstResult,
          inspectType: itype,
          comment: judgeComment,
        }),
      false,
    );

  const sendFix = () => run(() => requestFixAction({ id: app.id, comment: judgeComment }), true);

  const typeChips = INSPECT_TYPES.map((t) => chip(t, itype === t));
  const firstChips = RESULTS.map((r) => resultChip(r, firstResult === r));
  const finalChips = RESULTS.map((r) => resultChip(r, finalResult === r));

  return (
    <div
      className="ti-page"
      style={{ padding: '24px 26px 44px', display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <button
        onClick={() => router.push('/supervisor')}
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
        ‹ 신청 접수 목록
      </button>

      <motion.div
        className="ti-pagehead"
        variants={fadeUp}
        initial="hidden"
        animate="show"
        style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}
      >
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
            <span style={{ font: "400 12px/1 'Roboto Mono',monospace", color: '#77808c' }}>
              {sel.id}
            </span>
            <span
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
          <span style={{ font: "700 17px/1.3 'Noto Sans KR'", letterSpacing: '-.01em' }}>
            {sel.site}
          </span>
          <span style={{ font: "400 11.5px/1.4 'Noto Sans KR'", color: '#77808c' }}>
            방문예정 {sel.visitText} · 검사종류 {sel.inspectType} · 담당 {sel.manager} {sel.phone}
          </span>
        </div>
      </motion.div>

      <motion.div
        className="ti-detail"
        variants={sectionStagger}
        initial="hidden"
        animate="show"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 384px',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <motion.div
          variants={sectionStagger}
          style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          <motion.div variants={staggerItem} style={cardStyle}>
            <div style={cardTitleStyle}>신청 정보 (엑셀 양식 전 항목)</div>
            <div className="ti-ginfo" style={gridInfoStyle}>
              {sel.info.map((f) => (
                <div
                  key={f.k}
                  style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}
                >
                  <span style={{ font: "400 10.5px/1.3 'Noto Sans KR'", color: '#8b95a1' }}>
                    {f.k}
                  </span>
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
          </motion.div>

          {/* 신청자가 적어 낸 검사 요청·입회 정보 — 방문일을 잡을 때 필요한 값 */}
          <InfoCard title="검사 요청 · 입회" items={reqInfo} />
          <InfoCard title="그 밖의 신청 항목" items={extraInfo} />

          <motion.div variants={staggerItem} style={cardStyle}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '13px 16px',
                borderBottom: '1px solid #eceff2',
              }}
            >
              <span style={{ font: "500 12.5px/1 'Noto Sans KR'" }}>
                하자이행증권 · 하자보증기간 확인
              </span>
              <div style={{ flex: 1 }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={bondOk}
                  onChange={() => setBondOk((v) => !v)}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ font: "400 11.5px/1.2 'Noto Sans KR'", color: '#3c4652' }}>
                  하자이행증권 · 하자보증기간 확인 완료
                </span>
              </label>
            </div>
            <div className="ti-ginfo" style={gridInfoStyle}>
              {sel.bond.map((b) => (
                <div
                  key={b.k}
                  style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}
                >
                  <span style={{ font: "400 10.5px/1.3 'Noto Sans KR'", color: '#8b95a1' }}>
                    {b.k}
                  </span>
                  <span
                    style={{
                      font: "400 12px/1.4 'Roboto Mono',monospace",
                      color: '#1a1d21',
                      wordBreak: 'break-all',
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
                /* 증권 미확인은 회색으로 두면 읽히지 않는다 */
                ...(bondMissing ? warnBoxStyle : null),
              }}
            >
              {sel.bondNote}
            </div>
          </motion.div>

          <motion.div variants={staggerItem} style={cardStyle}>
            <div style={cardTitleStyle}>검토 이력</div>
            <motion.div variants={logStagger} style={{ padding: '6px 15px 14px' }}>
              {sel.log.map((l, i) => (
                <motion.div
                  key={i}
                  variants={staggerItem}
                  className="ti-log3"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '96px 78px 1fr',
                    gap: 12,
                    padding: '9px 0',
                    borderBottom: '1px solid #f2f4f7',
                  }}
                >
                  <span
                    style={{ font: "400 11.5px/1.4 'Roboto Mono',monospace", color: '#8b95a1' }}
                  >
                    {l.at}
                  </span>
                  <span style={{ font: "500 11.5px/1.4 'Noto Sans KR'", color: '#3c4652' }}>
                    {l.who}
                  </span>
                  <span style={{ font: "400 11.5px/1.5 'Noto Sans KR'", color: '#3c4652' }}>
                    {l.txt}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </motion.div>

        <motion.div
          className="ti-judgepanel"
          variants={staggerItem}
          style={{
            background: '#fff',
            border: '1px solid #dfe3e8',
            borderRadius: 6,
            position: 'sticky',
            top: 24,
          }}
        >
          {/* 검토 전 건 — 판정 칩을 열어 두면 다 입력한 뒤에야 서버가 거부한다 */}
          {inReview ? (
            <>
              <div style={cardTitleStyle}>검토 처리</div>
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 13 }}>
                <span
                  style={{
                    font: "400 12px/1.65 'Noto Sans KR'",
                    color: '#5b6672',
                    wordBreak: 'keep-all',
                  }}
                >
                  검토승인 후 판정할 수 있습니다. 방문예정일과 검사종류를 확정해 검토승인하면 1차 ·
                  최종 판정을 입력할 수 있습니다.
                </span>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 7,
                    padding: '11px 12px',
                    background: '#fbfbfc',
                    border: '1px solid #eceff2',
                    borderRadius: 4,
                  }}
                >
                  <span style={{ font: "400 10.5px/1.3 'Noto Sans KR'", color: '#8b95a1' }}>
                    현재 상태
                  </span>
                  <span
                    style={{
                      alignSelf: 'flex-start',
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
                  <span
                    style={{
                      font: "400 11px/1.55 'Noto Sans KR'",
                      color: '#5b6672',
                      wordBreak: 'keep-all',
                    }}
                  >
                    {STATUS_NOTE[app.status]}
                  </span>
                </div>

                <motion.button
                  onClick={() => setReviewOpen(true)}
                  className="h-teal"
                  {...pressable}
                  style={{
                    width: '100%',
                    padding: 11,
                    background: '#0f7b6c',
                    color: '#fff',
                    border: '1px solid #0f7b6c',
                    borderRadius: 4,
                    font: "500 13px/1.2 'Noto Sans KR'",
                    cursor: 'pointer',
                  }}
                >
                  검토 처리하기
                </motion.button>
              </div>
            </>
          ) : null}

          {/* 판정이 끝난 건 — 읽기 전용 결과 카드 */}
          {!inReview && !inJudge ? (
            <>
              <div style={cardTitleStyle}>이관검사 결과</div>
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    padding: 14,
                    background: '#fbfbfc',
                    border: '1px solid #eceff2',
                    borderRadius: 4,
                  }}
                >
                  <span style={{ font: "400 10.5px/1.3 'Noto Sans KR'", color: '#8b95a1' }}>
                    1차 판정 → 최종 판정
                  </span>
                  <div
                    style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}
                  >
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 4,
                        font: "500 12.5px/1.4 'Noto Sans KR'",
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
                        padding: '4px 10px',
                        borderRadius: 4,
                        font: "500 12.5px/1.4 'Noto Sans KR'",
                        background: sel.finalBadge.bg,
                        color: sel.finalBadge.fg,
                        border: `1px solid ${sel.finalBadge.bd}`,
                      }}
                    >
                      {sel.finalBadge.label}
                    </span>
                    <div style={{ flex: 1 }} />
                    <span style={{ font: "400 11.5px/1.3 'Noto Sans KR'", color: '#5b6672' }}>
                      {sel.inspectType}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ font: "400 11px/1.3 'Noto Sans KR'", color: '#8b95a1' }}>
                      방문 {sel.visitText}
                    </span>
                    <span style={{ width: 1, height: 9, background: '#dfe3e8' }} />
                    <span style={{ font: "400 11px/1.3 'Noto Sans KR'", color: '#8b95a1' }}>
                      준공검사자 {sel.inspector}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={labelStyle}>판정 비고</span>
                  <div
                    style={{
                      padding: '11px 12px',
                      background: '#fff',
                      border: '1px solid #eceff2',
                      borderLeft: '2px solid #1f7a43',
                      borderRadius: 3,
                      font: "400 12px/1.65 'Noto Sans KR'",
                      color: '#3c4652',
                    }}
                  >
                    {sel.finalCommentText}
                  </div>
                </div>

                <span style={{ font: "400 11px/1.5 'Noto Sans KR'", color: '#8b95a1' }}>
                  판정이 확정된 건입니다. 결과를 바꾸려면 새 이관검사 신청을 접수해야 합니다.
                </span>
              </div>
            </>
          ) : null}

          {inJudge ? (
            <>
            <div style={cardTitleStyle}>이관검사 판정 입력</div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={labelStyle}>검사종류</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {typeChips.map((c) => (
                    <motion.button
                      key={c.label}
                      onClick={() => setInspectType(c.label)}
                      aria-pressed={c.label === itype}
                      {...pressable}
                      style={chipStyle(c, true)}
                    >
                      {c.label === itype ? <ChipRing id="judge-type" color={c.bd} /> : null}
                      {c.label === itype ? `✓ ${c.label}` : c.label}
                    </motion.button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={labelStyle}>1차 판정</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {firstChips.map((c) => {
                    const on = c.label === firstResult;
                    return (
                      <motion.button
                        key={c.label}
                        onClick={() => setFirstResult(c.label)}
                        aria-pressed={on}
                        {...pressable}
                        style={chipStyle(c, false)}
                      >
                        {on ? <ChipRing id="judge-first" color={c.bd} /> : null}
                        {on ? `✓ ${c.label}` : c.label}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={labelStyle}>최종 판정</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {finalChips.map((c) => {
                    const on = c.label === finalResult;
                    /* 증권 미확인 건은 서버가 합격·조건부합격을 거부한다 — 아예 못 고르게 */
                    const locked = bondMissing && PASS_RESULTS.includes(c.label as ResultLabel);
                    return (
                      <motion.button
                        key={c.label}
                        onClick={() => (locked ? undefined : setFinalResult(c.label))}
                        disabled={locked}
                        aria-pressed={on}
                        {...(locked ? {} : pressable)}
                        style={{ ...chipStyle(c, false), ...blockedLook(locked) }}
                      >
                        {on ? <ChipRing id="judge-final" color={c.bd} /> : null}
                        {on ? `✓ ${c.label}` : c.label}
                      </motion.button>
                    );
                  })}
                </div>
                {bondMissing ? (
                  <span style={warnTextStyle}>
                    하자이행증권 확인 전에는 합격 처리할 수 없습니다 · 보완요청으로 반려하세요
                  </span>
                ) : null}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={labelStyle}>비고 (현장 조건 및 특기 사항)</span>
                <textarea
                  className="ti-field"
                  rows={5}
                  maxLength={MAX_COMMENT}
                  value={judgeComment}
                  onChange={(e) => setJudgeComment(e.target.value.slice(0, MAX_COMMENT))}
                  placeholder="예: 방화문 유격 하자는 건설사 책임으로 회의록 작성함. 자사 도어록 정상 동작 확인."
                  style={{
                    width: '100%',
                    padding: '8px 9px',
                    border: '1px solid #d3d8de',
                    borderRadius: 4,
                    font: "400 12.5px/1.55 'Noto Sans KR'",
                    color: '#1a1d21',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
                <span
                  style={{
                    alignSelf: 'flex-end',
                    font: "400 10.5px/1 'Roboto Mono',monospace",
                    color: judgeComment.length >= MAX_COMMENT ? '#a32b25' : '#98a1ac',
                  }}
                >
                  {judgeComment.length} / {MAX_COMMENT}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: '11px 12px',
                  background: '#fbfbfc',
                  border: '1px solid #eceff2',
                  borderRadius: 4,
                }}
              >
                <span style={labelStyle}>판정 결과 통보</span>
                <label style={checkRowStyle}>
                  <input
                    type="checkbox"
                    checked={notifyEmail}
                    onChange={() => setNotifyEmail((v) => !v)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ font: "400 11.5px/1.3 'Noto Sans KR'", color: '#3c4652' }}>
                    이메일 · 신청자 + 현장PM + 설치점
                  </span>
                </label>
                <label style={checkRowStyle}>
                  <input
                    type="checkbox"
                    checked={notifySms}
                    onChange={() => setNotifySms((v) => !v)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ font: "400 11.5px/1.3 'Noto Sans KR'", color: '#3c4652' }}>
                    문자(SMS) · 담당자 {sel.phone}
                  </span>
                </label>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                {confirmStep ? (
                  <motion.div
                    key={`confirm-${confirmStep}`}
                    variants={fade}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                  >
                    <ConfirmPanel
                      busy={busy}
                      color={confirmStep === 'judge' ? finalColor : '#9a5b12'}
                      title={confirmStep === 'judge' ? finalResult : '보완요청'}
                      text={
                        confirmStep === 'judge'
                          ? `‘${finalResult}’${euro(finalResult)} 확정하고 신청자·현장PM·설치점에 통보합니다`
                          : '보완요청으로 반려하고 신청자에게 통보합니다'
                      }
                      onCancel={() => setConfirmStep('')}
                      onConfirm={confirmStep === 'judge' ? confirmJudge : sendFix}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="actions"
                    variants={fade}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    style={{ display: 'flex', flexDirection: 'column', gap: 7 }}
                  >
                    {judgeBlocked ? (
                      <span
                        style={{
                          font: "400 11px/1.45 'Noto Sans KR'",
                          color: '#8b95a1',
                          wordBreak: 'keep-all',
                        }}
                      >
                        {judgeBlocks.join(' · ')} 항목을 마치면 최종 판정을 확정할 수 있습니다
                      </span>
                    ) : null}

                    <motion.button
                      onClick={() => setConfirmStep('judge')}
                      disabled={busy || judgeBlocked}
                      className="h-green"
                      {...pressable}
                      style={{
                        width: '100%',
                        padding: 11,
                        background: '#1f7a43',
                        color: '#fff',
                        border: '1px solid #1f7a43',
                        borderRadius: 4,
                        font: "500 13px/1.2 'Noto Sans KR'",
                        cursor: 'pointer',
                        ...blockedLook(judgeBlocked),
                      }}
                    >
                      최종 판정 확정
                    </motion.button>

                    {canSaveFirst ? (
                      <motion.button
                        onClick={saveFirst}
                        disabled={busy || firstBlocked}
                        {...pressable}
                        style={{
                          width: '100%',
                          padding: 9,
                          background: '#fff',
                          color: '#1a52b6',
                          border: '1px solid #cfe0fa',
                          borderRadius: 4,
                          font: "500 12.5px/1.2 'Noto Sans KR'",
                          cursor: 'pointer',
                          ...blockedLook(firstBlocked),
                        }}
                      >
                        1차 판정 저장
                      </motion.button>
                    ) : null}

                    <motion.button
                      onClick={() => setConfirmStep('fix')}
                      disabled={busy}
                      {...pressable}
                      style={{
                        width: '100%',
                        padding: 9,
                        background: '#fff',
                        color: '#9a5b12',
                        border: '1px solid #ecd9bd',
                        borderRadius: 4,
                        font: "500 12.5px/1.2 'Noto Sans KR'",
                        cursor: 'pointer',
                      }}
                    >
                      보완요청으로 반려
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            </>
          ) : null}
        </motion.div>
      </motion.div>

      {/* 검토 단계 건은 같은 화면에서 처리 드로어를 연다 */}
      <AnimatePresence>
        {reviewOpen ? (
          <ProcessDrawer
            app={app}
            apps={apps}
            external={external}
            mode="review"
            onClose={() => setReviewOpen(false)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
