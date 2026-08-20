'use client';

/**
 * 처리 드로어 — 목록·KPI 모달·이번주 일정 카드가 모두 이 경로로 열린다.
 * 신청 건의 현재 단계에 따라 review / judge / result 3모드로 나뉜다.
 */
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  approveReviewAction,
  confirmJudgeAction,
  requestFixAction,
  saveFirstResultAction,
  schedulePlanAction,
  type ActionResult,
} from '@/lib/actions';
import {
  INSPECT_TYPES,
  RESULTS,
  RESULT_COLOR,
  today,
  type ApplicationDTO,
  type ExternalVisitDTO,
  type ResultLabel,
} from '@/lib/domain';
import { addDays, dowOf } from '@/lib/date';
import { euro, fromDateInput, isBefore, toDateInput, validate } from '@/lib/form';
import { buildDetail, chip, resultChip } from '@/lib/view';
import { useToast } from '@/components/Toast';
import {
  AnimatePresence,
  DUR,
  EASE,
  backdrop,
  drawerPanel,
  fade,
  motion,
  pressable,
} from '@/components/motion';

export type DrawerMode = 'review' | 'judge' | 'result';

/** 프로토타입의 빠른 선택 칩 — 감독관이 자주 쓰는 방문일 (업무 표기) */
/**
 * 방문예정일 빠른 선택 — 오늘 기준으로 계산한다.
 * 날짜를 박아 두면 데모 기준일(NEXT_PUBLIC_DEMO_TODAY)을 해제하는 순간
 * 과거 날짜가 기본값으로 남는다.
 * 주말은 건너뛴다 — 현장 방문은 평일에만 잡는다.
 */
function nextWeekday(from: string, n: number): string {
  let d = from;
  let left = n;
  while (left > 0) {
    d = addDays(d, 1);
    if (dowOf(d) !== '토' && dowOf(d) !== '일') left -= 1;
  }
  return d;
}

function quickDates(base: string): [string, string][] {
  return [3, 5, 10].map((n) => {
    const v = nextWeekday(base, n);
    const [, m, day] = v.split('.');
    return [v, `${Number(m)}/${Number(day)} (${dowOf(v)})`] as [string, string];
  });
}

/** 코멘트 최대 길이 — 넘으면 입력을 막고 글자 수를 붉게 표시한다 */
const MAX_COMMENT = 500;

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 9px',
  border: '1px solid #d3d8de',
  borderRadius: 4,
  color: '#1a1d21',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  font: "500 11.5px/1.2 'Noto Sans KR'",
  color: '#5b6672',
};

const noteBoxStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '11px 12px',
  background: '#fbfbfc',
  border: '1px solid #eceff2',
  borderRadius: 4,
};

const checkRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  cursor: 'pointer',
};

const errStyle: React.CSSProperties = {
  font: "400 10.5px/1.45 'Noto Sans KR'",
  color: '#a32b25',
  wordBreak: 'keep-all',
};

/** 확정 버튼이 막힌 이유 — 토스트 대신 버튼 바로 위에 조용히 적어 둔다 */
const blockNoteStyle: React.CSSProperties = {
  padding: '9px 18px 0',
  background: '#fbfbfc',
  borderTop: '1px solid #eceff2',
  font: "400 11px/1.45 'Noto Sans KR'",
  color: '#8b95a1',
  wordBreak: 'keep-all',
};

/** 조건이 안 맞아 막힌 버튼 — 색은 그대로 두고 흐리게만 한다 */
const blockedLook = (blocked: boolean): React.CSSProperties =>
  blocked ? { opacity: 0.55, cursor: 'not-allowed' } : {};

/**
 * 하자이행증권이 확인되지 않은 상태.
 * 서버(confirmJudgeAction)가 이 조건에서 합격·조건부합격을 거부하므로,
 * 화면에서도 같은 기준으로 미리 막는다.
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

/** 확인 단계 문구 — 무엇이 어디로 나가는지 한 줄로 */
const confirmTextStyle: React.CSSProperties = {
  font: "400 11.5px/1.45 'Noto Sans KR'",
  color: '#3c4652',
  wordBreak: 'keep-all',
};

/** 확인 단계의 취소 · 확정 버튼 — 판정 색을 그대로 확정 버튼에 쓴다 */
function ConfirmActions({
  busy,
  color,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  color: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <motion.button
        onClick={onCancel}
        className="h-bd"
        {...pressable}
        style={{
          padding: '9px 13px',
          background: '#fff',
          color: '#3c4652',
          border: '1px solid #d3d8de',
          borderRadius: 4,
          font: "500 12.5px/1.2 'Noto Sans KR'",
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        취소
      </motion.button>
      <motion.button
        onClick={onConfirm}
        disabled={busy}
        {...pressable}
        style={{
          padding: '9px 20px',
          background: color,
          color: '#fff',
          border: `1px solid ${color}`,
          borderRadius: 4,
          font: "500 12.5px/1.2 'Noto Sans KR'",
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {busy ? '처리 중…' : '확정'}
      </motion.button>
    </>
  );
}

/** textarea 오른쪽 아래 글자 수 */
function CharCount({ n }: { n: number }) {
  return (
    <span
      style={{
        alignSelf: 'flex-end',
        font: "400 10.5px/1 'Roboto Mono',monospace",
        color: n >= MAX_COMMENT ? '#a32b25' : '#98a1ac',
      }}
    >
      {n} / {MAX_COMMENT}
    </span>
  );
}

const chipStyle = (c: { bg: string; fg: string; bd: string }, wide: boolean): React.CSSProperties => ({
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

export function ProcessDrawer({
  app,
  apps,
  external,
  mode,
  onClose,
}: {
  app: ApplicationDTO;
  apps: ApplicationDTO[];
  external: ExternalVisitDTO[];
  mode: DrawerMode;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const sel = useMemo(() => buildDetail(app, apps, external), [app, apps, external]);

  /* 기존 값이 있으면 그대로, 없으면 오늘 기준 다음 영업일 몇 개 중 첫 번째 */
  const [visitInput, setVisitInput] = useState(app.visitDate || nextWeekday(today(), 3));
  const [inspectType, setInspectType] = useState<string>(app.inspectType || '');
  const [revComment, setRevComment] = useState(app.revComment || '');
  const [firstResult, setFirstResult] = useState<string>(app.first || '');
  const [finalResult, setFinalResult] = useState<string>(app.final || '');
  const [judgeComment, setJudgeComment] = useState(app.finalComment || app.firstComment || '');
  const [bondOk, setBondOk] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySms, setNotifySms] = useState(true);
  const [busy, setBusy] = useState(false);
  /**
   * 확정·반려는 누르는 즉시 3곳에 통보가 나가고 되돌릴 수 없다.
   * 현장에서 칩을 잘못 탭한 채 확정하는 사고를 막으려고 버튼 줄을 확인 단계로 바꾼다.
   */
  const [confirmStep, setConfirmStep] = useState<'' | 'judge' | 'fix'>('');

  const panelRef = useRef<HTMLDivElement>(null);

  /* Escape 로 닫기 — 확인 단계가 열려 있으면 그 단계만 먼저 접는다 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setConfirmStep((step) => {
        if (!step) onClose();
        return '';
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /* 열릴 때 드로어 안으로 포커스를 옮겨, 키보드 사용자가 뒤 화면에 갇히지 않게 한다 */
  useEffect(() => {
    panelRef.current
      ?.querySelector<HTMLElement>('button,input,textarea,select,[href]')
      ?.focus();
  }, []);

  const quickPicks = quickDates(today());

  const itype = inspectType || '샘플링검사';
  const isRevMode = mode === 'review';
  const isJudgeMode = mode === 'judge';
  const isResultMode = mode === 'result';
  const canSchedule = ['신청완료', '보완요청', '검토예정'].includes(app.status);
  /* 드로어에서도 1차만 먼저 기록할 수 있어야 한다 — JudgeScreen 과 같은 조건 */
  const canSaveFirst = app.status === '검토승인';
  const bondMissing = isBondMissing(app);

  /** 신청자가 적어 낸 희망 검사 조건 — 방문예정일을 잡을 때 가장 먼저 봐야 하는 값 */
  const wish = [
    app.desiredInspectType,
    /* 시드/양식에 따라 '입주율 87% · 시공 100%' 처럼 이미 말이 되는 값이 온다 — 겹쳐 쓰지 않는다 */
    app.occupancy ? (/^입주율/.test(app.occupancy) ? app.occupancy : `입주율 ${app.occupancy}`) : '',
    app.witness ? `입회 ${app.witness}` : '',
  ].filter(Boolean);
  const hasWish = !!(app.desiredDate || wish.length);

  /* ── 방문예정일 검증 — 비어 있거나 오늘 이전이면 승인·등록을 막는다 ── */
  const now = today();
  const visitErr =
    validate('방문예정일', visitInput, { kind: 'date', required: true }) ||
    (isBefore(visitInput, now) ? '오늘 이전 날짜는 선택할 수 없습니다' : '');

  /* 확정 버튼이 막힌 이유 — 판정 모드는 최종 판정과 증권 확인이 모두 있어야 한다 */
  const judgeBlocks = [
    finalResult ? '' : '최종 판정',
    bondOk ? '' : '하자이행증권 · 하자보증기간 확인',
  ].filter(Boolean);
  const judgeBlocked = judgeBlocks.length > 0;
  /* 1차 판정 저장도 1차 판정이 있어야 한다 */
  const firstBlocked = !firstResult;
  /* 확인 단계에서 결과를 크게 보여 줄 색 */
  const finalColor = RESULT_COLOR[finalResult as ResultLabel] ?? '#1f7a43';
  const blockNote = isRevMode
    ? visitErr && `방문예정일을 확인해 주세요 — ${visitErr}`
    : isJudgeMode && judgeBlocked
      ? `${judgeBlocks.join(' · ')} 항목을 마치면 최종 판정을 확정할 수 있습니다`
      : '';

  const setComment = (set: (v: string) => void) => (v: string) => set(v.slice(0, MAX_COMMENT));

  const drawerTitle = isRevMode
    ? '검토예정 등록 · 검토승인'
    : isJudgeMode
      ? '이관검사 판정 입력'
      : '이관검사 결과';

  async function run(fn: () => Promise<ActionResult>) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fn();
      toast(r.toast);
      if (r.ok) {
        onClose();
        router.refresh();
      } else {
        // 서버가 막았으면 확인 줄을 접어, 무엇을 고쳐야 할지 다시 고를 수 있게 한다
        setConfirmStep('');
      }
    } finally {
      setBusy(false);
    }
  }

  const setSchedule = () =>
    run(() =>
      schedulePlanAction({ id: app.id, visitDate: visitInput, inspectType: itype, revComment }),
    );

  const approveReview = () =>
    run(() =>
      approveReviewAction({
        id: app.id,
        visitDate: visitInput,
        inspectType: itype,
        revComment,
        notifyEmail,
        notifySms,
      }),
    );

  /*
   * 반려 사유는 지금 열려 있는 모드에서 감독관이 실제로 쓴 칸을 보낸다.
   * 판정 모드에는 revComment 입력란이 없는데도 state 초기값(app.revComment)이
   * 우선해서, 검토승인 때 적어 둔 방문 안내문이 반려 사유로 나가고
   * 방금 쓴 사유는 유실됐다.
   */
  const sendFix = () =>
    run(() => requestFixAction({ id: app.id, comment: isRevMode ? revComment : judgeComment }));

  const saveFirst = () =>
    run(() =>
      saveFirstResultAction({
        id: app.id,
        firstResult,
        inspectType: itype,
        comment: judgeComment,
      }),
    );

  const confirmJudge = () =>
    run(() =>
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
    );

  const openFullDetail = () => router.push(`/supervisor/${app.id}`);

  const typeChips = INSPECT_TYPES.map((t) => chip(t, itype === t));
  const firstChips = RESULTS.map((r) => resultChip(r, firstResult === r));
  const finalChips = RESULTS.map((r) => resultChip(r, finalResult === r));

  return (
    <motion.div
      className="ti-drawer-wrap"
      variants={backdrop}
      initial="hidden"
      animate="show"
      exit="exit"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20,24,29,.34)',
        display: 'flex',
        justifyContent: 'flex-end',
        zIndex: 40,
      }}
    >
      <div onClick={onClose} style={{ flex: 1 }} />

      <motion.div
        ref={panelRef}
        className="ti-drawer"
        variants={drawerPanel}
        initial="hidden"
        animate="show"
        exit="exit"
        style={{
          width: 432,
          height: '100%',
          background: '#fff',
          borderLeft: '1px solid #cfd5dc',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 28px rgba(20,24,29,.14)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '16px 18px',
            borderBottom: '1px solid #eceff2',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <span style={{ font: "700 14px/1.35 'Noto Sans KR'" }}>{drawerTitle}</span>
            <span
              style={{
                font: "400 11.5px/1.45 'Noto Sans KR'",
                color: '#6b7480',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {sel.site}
            </span>
          </div>
          <div style={{ flex: 1 }} />
          <motion.button
            onClick={onClose}
            {...pressable}
            style={{
              padding: '4px 8px',
              border: '1px solid #dfe3e8',
              background: '#fff',
              borderRadius: 4,
              font: "400 12px/1.2 'Noto Sans KR'",
              color: '#6b7480',
              cursor: 'pointer',
            }}
          >
            닫기
          </motion.button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <div
            className="ti-ginfo"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px 14px',
              padding: 12,
              background: '#fbfbfc',
              border: '1px solid #eceff2',
              borderRadius: 4,
            }}
          >
            {sel.brief.map((b) => (
              <div key={b.k} style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <span style={{ font: "400 10.5px/1.3 'Noto Sans KR'", color: '#8b95a1' }}>{b.k}</span>
                <span style={{ font: "400 12px/1.4 'Noto Sans KR'", color: '#1a1d21' }}>{b.v}</span>
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {isRevMode ? (
              <motion.div
                key="review"
                variants={fade}
                initial="hidden"
                animate="show"
                exit="exit"
                style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
              >
                {/*
                  검토 단계에서도 증권 상태를 알려 준다. 여기서 모르면 방문을
                  다녀온 뒤 판정 화면에서야 "합격 처리할 수 없습니다" 를 만난다.
                  헛걸음을 막으려면 승인 전에 보여야 한다.
                */}
                {bondMissing ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      padding: '10px 12px',
                      borderRadius: 5,
                      ...warnBoxStyle,
                    }}
                  >
                    <span style={{ font: "500 11.5px/1.3 'Noto Sans KR'", color: '#9a5b12' }}>
                      하자이행증권 미발행
                    </span>
                    <span style={warnTextStyle}>
                      이대로 방문해도 합격 처리할 수 없습니다 · 증권 발행을 먼저 요청하거나
                      보완요청으로 반려하세요
                    </span>
                  </div>
                ) : null}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {/* 방문일을 잡을 때 가장 먼저 봐야 할 값 — 신청자가 적어 낸 희망 조건 */}
                  {hasWish ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 6,
                        padding: '7px 9px',
                        background: '#eaf1fd',
                        border: '1px solid #cfe0fa',
                        borderRadius: 4,
                      }}
                    >
                      <span style={{ font: "400 11px/1.4 'Noto Sans KR'", color: '#1a52b6' }}>
                        신청자 희망
                      </span>
                      {app.desiredDate ? (
                        <motion.button
                          onClick={() => setVisitInput(app.desiredDate)}
                          title="희망일을 방문예정일에 넣기"
                          className="h-bdbluefg"
                          {...pressable}
                          style={{
                            padding: '3px 8px',
                            background: '#fff',
                            border: '1px solid #cfe0fa',
                            borderRadius: 3,
                            font: "500 11px/1.3 'Roboto Mono',monospace",
                            color: '#1a52b6',
                            cursor: 'pointer',
                          }}
                        >
                          {app.desiredDate}
                        </motion.button>
                      ) : null}
                      {wish.length ? (
                        <span style={{ font: "400 11px/1.4 'Noto Sans KR'", color: '#1a52b6' }}>
                          {app.desiredDate ? '· ' : ''}
                          {wish.join(' · ')}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <span style={labelStyle}>방문예정일 (검토 방문일자)</span>
                  <input
                    className={visitErr ? 'ti-field ti-field-bad' : 'ti-field'}
                    type="date"
                    /* state 는 업무 표기('2026.08.01'), 선택기만 ISO 로 주고받는다 */
                    value={toDateInput(visitInput)}
                    min={toDateInput(now)}
                    aria-invalid={visitErr ? true : undefined}
                    onChange={(e) => setVisitInput(fromDateInput(e.target.value))}
                    style={{ ...inputStyle, font: "400 12.5px/1.4 'Roboto Mono',monospace" }}
                  />
                  {visitErr ? <span style={errStyle}>{visitErr}</span> : null}
                  <div style={{ display: 'flex', gap: 6 }}>
                    {quickPicks.map(([value, label]) => (
                      <motion.button
                        key={value}
                        onClick={() => setVisitInput(value)}
                        className="h-bdbluefg"
                        {...pressable}
                        style={{
                          padding: '5px 9px',
                          background: '#fff',
                          border: '1px solid #dfe3e8',
                          borderRadius: 3,
                          font: "400 11px/1.2 'Noto Sans KR'",
                          color: '#5b6672',
                          cursor: 'pointer',
                        }}
                      >
                        {label}
                      </motion.button>
                    ))}
                  </div>
                </div>

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
                        {c.label === itype ? <ChipRing id="drawer-type-rev" color={c.bd} /> : null}
                        {c.label === itype ? `✓ ${c.label}` : c.label}
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={labelStyle}>검토 코멘트 (신청자에게 노출)</span>
                  <textarea
                    className="ti-field"
                    rows={5}
                    maxLength={MAX_COMMENT}
                    value={revComment}
                    onChange={(e) => setComment(setRevComment)(e.target.value)}
                    placeholder="예: 8월 3일 오전 10시 현장 방문 예정. 세대 샘플링 5% 진행하므로 설치점 담당 입회 필요."
                    style={{ ...inputStyle, font: "400 12.5px/1.55 'Noto Sans KR'", resize: 'vertical' }}
                  />
                  <CharCount n={revComment.length} />
                </div>

                <div style={noteBoxStyle}>
                  <span style={labelStyle}>승인 시 통보</span>
                  <label style={checkRowStyle}>
                    <input
                      type="checkbox"
                      checked={notifyEmail}
                      onChange={() => setNotifyEmail((v) => !v)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ font: "400 11.5px/1.3 'Noto Sans KR'", color: '#3c4652' }}>
                      이메일 발송
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
                      문자(SMS) 발송
                    </span>
                  </label>
                </div>
              </motion.div>
            ) : null}

            {isJudgeMode ? (
              <motion.div
                key="judge"
                variants={fade}
                initial="hidden"
                animate="show"
                exit="exit"
                style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: 12,
                    background: '#fbfbfc',
                    border: '1px solid #eceff2',
                    borderRadius: 4,
                    /* 증권 미확인은 회색 안내로는 눈에 띄지 않는다 — 카드째 주의 색으로 */
                    ...(bondMissing ? warnBoxStyle : null),
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span style={labelStyle}>하자이행증권 · 하자보증기간</span>
                    <div style={{ flex: 1 }} />
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={bondOk}
                        onChange={() => setBondOk((v) => !v)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ font: "400 11px/1.2 'Noto Sans KR'", color: '#3c4652' }}>확인 완료</span>
                    </label>
                  </div>
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
                        style={{ font: "400 11px/1.3 'Noto Sans KR'", color: '#8b95a1', whiteSpace: 'nowrap' }}
                      >
                        {b.k}
                      </span>
                      <span
                        style={{
                          font: "400 11.5px/1.4 'Roboto Mono',monospace",
                          color: '#1a1d21',
                          textAlign: 'right',
                        }}
                      >
                        {b.v}
                      </span>
                    </div>
                  ))}
                  <span
                    style={{
                      font: "400 10.5px/1.55 'Noto Sans KR'",
                      color: bondMissing ? '#9a5b12' : '#8b95a1',
                    }}
                  >
                    {sel.bondNote}
                  </span>
                </div>

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
                        {c.label === itype ? <ChipRing id="drawer-type-judge" color={c.bd} /> : null}
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
                          {on ? <ChipRing id="drawer-first" color={c.bd} /> : null}
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
                          {on ? <ChipRing id="drawer-final" color={c.bd} /> : null}
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
                    rows={4}
                    maxLength={MAX_COMMENT}
                    value={judgeComment}
                    onChange={(e) => setComment(setJudgeComment)(e.target.value)}
                    placeholder="예: 방화문 유격 하자는 건설사 책임으로 회의록 작성함."
                    style={{ ...inputStyle, font: "400 12.5px/1.55 'Noto Sans KR'", resize: 'vertical' }}
                  />
                  <CharCount n={judgeComment.length} />
                </div>

                <div style={noteBoxStyle}>
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

                <button
                  onClick={openFullDetail}
                  style={{
                    alignSelf: 'flex-start',
                    padding: 0,
                    border: 0,
                    background: 'none',
                    font: "500 11.5px/1.2 'Noto Sans KR'",
                    color: '#1f5fd0',
                    cursor: 'pointer',
                  }}
                >
                  엑셀 양식 전 항목 상세보기 ›
                </button>
              </motion.div>
            ) : null}

            {isResultMode ? (
              <motion.div
                key="result"
                variants={fade}
                initial="hidden"
                animate="show"
                exit="exit"
                style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
              >
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={labelStyle}>검토 이력</span>
                  {sel.log.map((l, i) => (
                    <div
                      key={i}
                      className="ti-log2"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '84px 1fr',
                        gap: 10,
                        padding: '7px 0',
                        borderBottom: '1px solid #f2f4f7',
                      }}
                    >
                      <span style={{ font: "400 11px/1.4 'Roboto Mono',monospace", color: '#8b95a1' }}>
                        {l.at}
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ font: "500 11px/1.4 'Noto Sans KR'", color: '#3c4652' }}>{l.who}</span>
                        <span style={{ font: "400 11px/1.5 'Noto Sans KR'", color: '#5b6672' }}>{l.txt}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {blockNote && !confirmStep ? <div style={blockNoteStyle}>{blockNote}</div> : null}

        <div
          className="ti-formfoot"
          style={{
            display: 'flex',
            gap: 8,
            padding: '14px 18px',
            /* 위에 사유 문구가 붙으면 구분선은 그쪽이 그린다 */
            borderTop: blockNote && !confirmStep ? 0 : '1px solid #eceff2',
            background: '#fbfbfc',
            ...(confirmStep ? { alignItems: 'center', flexWrap: 'wrap' as const } : null),
          }}
        >
          {/* 확인 단계 — 모달 없이 버튼 줄 자리를 그대로 바꾼다 */}
          {confirmStep === 'judge' ? (
            <>
              <span style={{ font: "700 15px/1.2 'Noto Sans KR'", color: finalColor }}>
                {finalResult}
              </span>
              <span style={confirmTextStyle}>
                ‘{finalResult}’{euro(finalResult)} 확정하고 신청자·현장PM·설치점에 통보합니다
              </span>
              <div style={{ flex: 1 }} />
              <ConfirmActions
                busy={busy}
                color={finalColor}
                onCancel={() => setConfirmStep('')}
                onConfirm={confirmJudge}
              />
            </>
          ) : null}

          {confirmStep === 'fix' ? (
            <>
              <span style={{ font: "700 15px/1.2 'Noto Sans KR'", color: '#9a5b12' }}>보완요청</span>
              <span style={confirmTextStyle}>
                보완요청으로 반려하고 신청자에게 통보합니다
              </span>
              <div style={{ flex: 1 }} />
              <ConfirmActions
                busy={busy}
                color="#9a5b12"
                onCancel={() => setConfirmStep('')}
                onConfirm={sendFix}
              />
            </>
          ) : null}

          {isRevMode && !confirmStep ? (
            <>
              <motion.button
                onClick={() => setConfirmStep('fix')}
                disabled={busy}
                {...pressable}
                style={{
                  padding: '9px 13px',
                  background: '#fff',
                  color: '#9a5b12',
                  border: '1px solid #ecd9bd',
                  borderRadius: 4,
                  font: "500 12.5px/1.2 'Noto Sans KR'",
                  cursor: 'pointer',
                }}
              >
                보완요청
              </motion.button>
              <div style={{ flex: 1 }} />
              {canSchedule ? (
                <motion.button
                  onClick={setSchedule}
                  disabled={busy || !!visitErr}
                  className="h-purple"
                  {...pressable}
                  style={{
                    padding: '9px 15px',
                    background: '#5b46c9',
                    color: '#fff',
                    border: '1px solid #5b46c9',
                    borderRadius: 4,
                    font: "500 12.5px/1.2 'Noto Sans KR'",
                    cursor: 'pointer',
                    ...blockedLook(!!visitErr),
                  }}
                >
                  검토예정 등록
                </motion.button>
              ) : null}
              <motion.button
                onClick={approveReview}
                disabled={busy || !!visitErr}
                className="h-teal"
                {...pressable}
                style={{
                  padding: '9px 20px',
                  background: '#0f7b6c',
                  color: '#fff',
                  border: '1px solid #0f7b6c',
                  borderRadius: 4,
                  font: "500 12.5px/1.2 'Noto Sans KR'",
                  cursor: 'pointer',
                  ...blockedLook(!!visitErr),
                }}
              >
                검토승인 확정
              </motion.button>
            </>
          ) : null}

          {isJudgeMode && !confirmStep ? (
            <>
              <motion.button
                onClick={() => setConfirmStep('fix')}
                disabled={busy}
                {...pressable}
                style={{
                  padding: '9px 13px',
                  background: '#fff',
                  color: '#9a5b12',
                  border: '1px solid #ecd9bd',
                  borderRadius: 4,
                  font: "500 12.5px/1.2 'Noto Sans KR'",
                  cursor: 'pointer',
                }}
              >
                보완요청 반려
              </motion.button>
              <div style={{ flex: 1 }} />
              {/* 방문 직후 1차만 기록하고 나가는 경로 — 상세 화면으로 우회하지 않게 */}
              {canSaveFirst ? (
                <motion.button
                  onClick={saveFirst}
                  disabled={busy || firstBlocked}
                  {...pressable}
                  style={{
                    padding: '9px 13px',
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
                onClick={() => setConfirmStep('judge')}
                disabled={busy || judgeBlocked}
                className="h-green"
                {...pressable}
                style={{
                  padding: '9px 20px',
                  background: '#1f7a43',
                  color: '#fff',
                  border: '1px solid #1f7a43',
                  borderRadius: 4,
                  font: "500 12.5px/1.2 'Noto Sans KR'",
                  cursor: 'pointer',
                  ...blockedLook(judgeBlocked),
                }}
              >
                최종 판정 확정
              </motion.button>
            </>
          ) : null}

          {isResultMode && !confirmStep ? (
            <>
              <motion.button
                onClick={openFullDetail}
                className="h-bd"
                {...pressable}
                style={{
                  padding: '9px 14px',
                  background: '#fff',
                  color: '#3c4652',
                  border: '1px solid #d3d8de',
                  borderRadius: 4,
                  font: "500 12.5px/1.2 'Noto Sans KR'",
                  cursor: 'pointer',
                }}
              >
                전 항목 상세보기
              </motion.button>
              <div style={{ flex: 1 }} />
              <motion.button
                onClick={onClose}
                className="h-blue"
                {...pressable}
                style={{
                  padding: '9px 20px',
                  background: '#1f5fd0',
                  color: '#fff',
                  border: '1px solid #1f5fd0',
                  borderRadius: 4,
                  font: "500 12.5px/1.2 'Noto Sans KR'",
                  cursor: 'pointer',
                }}
              >
                닫기
              </motion.button>
            </>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  );
}
