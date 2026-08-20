'use client';

/**
 * KPI 목록 모달 — 접수 목록의 KPI 카드를 누르면 해당 신청 건만 모아 보여 준다.
 * 행을 누르면 그대로 처리 드로어가 열린다.
 */
import { useEffect, useRef } from 'react';

import type { ApplicationDTO } from '@/lib/domain';
import { actLabelOf, actStyleOf, rowBase, type KpiDef } from '@/lib/view';
import {
  DUR,
  EASE,
  backdrop,
  cappedDelay,
  modalPanel,
  motion,
  pressable,
} from '@/components/motion';

/**
 * 행의 처리 버튼 — 기본은 view.ts 의 actLabelOf/actStyleOf 그대로.
 *
 * 보완요청만 예외로 낮춘다. 공이 신청자에게 넘어간 상태인데 보라색 '검토예정 등록' 이
 * 붙어 있으면 감독관이 지금 해야 할 일처럼 보인다. (누르면 열리는 화면은 그대로다)
 * 목록과 KPI 모달이 같은 규칙을 써야 해서 여기 두고 양쪽에서 가져다 쓴다.
 */
export function rowAction(x: ApplicationDTO): {
  label: string;
  actBg: string;
  actFg: string;
  actBd: string;
} {
  if (x.status === '보완요청') {
    return { label: '재신청 대기', actBg: '#fff', actFg: '#9a5b12', actBd: '#f0dcc2' };
  }
  return { label: actLabelOf(x), ...actStyleOf(x) };
}

/** KPI 모달과 판정 대기 목록이 함께 쓰는 행 레이아웃 */
export const kpiRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '96px minmax(0,1fr) 128px 112px',
  gap: 12,
  alignItems: 'center',
  width: '100%',
  padding: '11px 18px',
  border: 0,
  borderBottom: '1px solid #f2f4f7',
  background: '#fff',
  cursor: 'pointer',
  textAlign: 'left',
};

/** 행 내용 — 식별번호·제품군 / 현장·메타 / 상태·방문일 / 처리 버튼 */
export function KpiRowCells({ app }: { app: ApplicationDTO }) {
  const r = rowBase(app);
  const act = rowAction(app);
  const subMeta = `${app.owner} · 현장PM ${app.pm} · ${app.installer} ${app.manager}`;
  const visitLabel = app.visitDate ? `방문 ${app.visitDate}` : '방문일 미정';
  const visitColor = app.visitDate ? '#1a52b6' : '#a2abb5';
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <span style={{ font: "400 11.5px/1.3 'Roboto Mono',monospace", color: '#4a5460' }}>
          {r.id}
        </span>
        <span
          style={{
            padding: '1px 5px',
            border: '1px solid #dfe3e8',
            borderRadius: 3,
            font: "500 10px/1.6 'Roboto Mono',monospace",
            color: '#5b6672',
            alignSelf: 'flex-start',
          }}
        >
          {r.product}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <span
          style={{
            font: "500 12.5px/1.4 'Noto Sans KR'",
            color: '#1a1d21',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
          }}
        >
          {r.site}
        </span>
        <span
          style={{
            font: "400 10.5px/1.35 'Noto Sans KR'",
            color: '#8b95a1',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
          }}
        >
          {subMeta}
        </span>
      </div>

      <div
        className="ti-kpirow-st"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          alignItems: 'flex-start',
          minWidth: 0,
        }}
      >
        <span
          style={{
            padding: '3px 8px',
            borderRadius: 3,
            font: "500 11px/1.35 'Noto Sans KR'",
            background: r.st.bg,
            color: r.st.fg,
            border: `1px solid ${r.st.bd}`,
            whiteSpace: 'nowrap',
          }}
        >
          {r.st.label}
        </span>
        <span
          style={{
            font: "400 10.5px/1.3 'Roboto Mono',monospace",
            color: visitColor,
            whiteSpace: 'nowrap',
          }}
        >
          {visitLabel}
        </span>
      </div>

      <span
        style={{
          justifySelf: 'end',
          padding: '6px 11px',
          borderRadius: 4,
          font: "500 11.5px/1.2 'Noto Sans KR'",
          background: act.actBg,
          color: act.actFg,
          border: `1px solid ${act.actBd}`,
          whiteSpace: 'nowrap',
        }}
      >
        {act.label}
      </span>
    </>
  );
}

export function KpiModal({
  def,
  list,
  onClose,
  onOpen,
}: {
  def: KpiDef;
  list: ApplicationDTO[];
  onClose: () => void;
  onOpen: (app: ApplicationDTO) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  /* Escape 로 닫기 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /* 열릴 때 모달 안으로 포커스를 옮긴다 — 키보드 사용자가 뒤 화면에 갇히지 않게 */
  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>('button,input,textarea,select,[href]')?.focus();
  }, []);

  return (
    <motion.div
      className="ti-modal-wrap"
      variants={backdrop}
      initial="hidden"
      animate="show"
      exit="exit"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20,24,29,.42)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 65,
      }}
    >
      <div onClick={onClose} style={{ position: 'absolute', inset: 0 }} />

      <motion.div
        ref={panelRef}
        className="ti-modal-lg"
        variants={modalPanel}
        initial="hidden"
        animate="show"
        exit="exit"
        style={{
          position: 'relative',
          width: 820,
          maxWidth: '94vw',
          maxHeight: '86vh',
          background: '#fff',
          borderRadius: 8,
          boxShadow: '0 14px 44px rgba(20,24,29,.3)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          className="ti-cardhead"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '15px 18px',
            borderBottom: '1px solid #eceff2',
          }}
        >
          <span style={{ width: 3, height: 17, borderRadius: 2, background: def.color, flex: 'none' }} />
          <span style={{ font: "700 14px/1.3 'Noto Sans KR'" }}>{def.label}</span>
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
          <motion.button
            onClick={onClose}
            className="h-bd"
            {...pressable}
            style={{
              padding: '5px 11px',
              border: '1px solid #dfe3e8',
              background: '#fff',
              borderRadius: 4,
              font: "400 12px/1.2 'Noto Sans KR'",
              color: '#6b7480',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flex: 'none',
            }}
          >
            닫기
          </motion.button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {list.length === 0 ? (
            <div
              style={{
                padding: '38px 18px',
                textAlign: 'center',
                font: "400 12.5px/1.6 'Noto Sans KR'",
                color: '#98a1ac',
              }}
            >
              해당하는 신청 건이 없습니다
            </div>
          ) : null}

          {list.map((x, i) => (
            <motion.button
              key={x.id}
              onClick={() => onOpen(x)}
              className="ti-kpirow h-f7"
              initial={{ opacity: 0, y: 6 }}
              animate={{
                opacity: 1,
                y: 0,
                /* 건수가 많을 수 있어 앞쪽만 순차, 나머지는 곧바로 */
                transition: { duration: DUR.base, ease: EASE, delay: cappedDelay(i, 0.03) },
              }}
              {...pressable}
              style={kpiRowStyle}
            >
              <KpiRowCells app={x} />
            </motion.button>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 18px',
            borderTop: '1px solid #eceff2',
            background: '#fbfbfc',
          }}
        >
          <span style={{ font: "400 11px/1.55 'Noto Sans KR'", color: '#77808c' }}>{def.hint}</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
