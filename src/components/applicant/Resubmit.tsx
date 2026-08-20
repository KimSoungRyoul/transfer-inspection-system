'use client';

/**
 * 보완요청 건의 재신청 영역.
 *
 * 화면 머리의 "보완 후 재신청" 버튼과 아래 보완 입력 카드는 DOM 상 떨어져 있지만
 * 같은 모듈을 공유하므로, 카드가 들고 있는 입력값을 모듈 스코프에 두고 두 버튼이
 * 같은 값으로 저장 → 재신청을 수행한다.
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { resubmitAction, updateApplicationAction } from '@/lib/actions';
import { AnimatePresence, fade, motion, pressable, staggerItem } from '@/components/motion';
import { Field, type FieldType } from '@/components/Field';
import { useToast } from '@/components/Toast';
import { isBefore, isDate, type FieldKind, validate } from '@/lib/form';
import type { ApplicationDTO } from '@/lib/domain';

export interface FixValues {
  bondNo: string;
  issuer: string;
  months: string;
  from: string;
  to: string;
  memo: string;
}

const ISSUERS = [
  '이행보증보험',
  '종합보증보험',
  '통신공제조합',
  '산업공제조합',
  '소프트웨어공제회',
  '건설공제회',
  '미발행',
];

interface Fx {
  key: keyof FixValues;
  label: string;
  ph?: string;
  opts?: string[];
  req?: boolean;
  type?: FieldType;
}

/** 보증 정보 5개 항목 — 화면 순서 그대로 검증에도 쓴다 */
const FIX_FIELDS: Fx[] = [
  { key: 'bondNo', label: '하자이행증권 번호', ph: '제000-000-2026 0000 0001호', req: true },
  { key: 'issuer', label: '발행주체', opts: ISSUERS, req: true },
  { key: 'months', label: '보증 (개월)', opts: ['36', '24', '12'], req: true },
  { key: 'from', label: '보증 시작일', ph: '2026.08.01', req: true, type: 'date' },
  { key: 'to', label: '보증 종료일', ph: '2029.07.31', req: true, type: 'date' },
];

type FixErrors = Partial<Record<keyof FixValues, string>>;

/** 발행주체가 '미발행' 이면 증권번호는 비워 두는 것이 정상이다 */
function requiredOf(f: Fx, v: FixValues): boolean {
  if (f.key === 'bondNo' && v.issuer === '미발행') return false;
  return !!f.req;
}

/** 항목 간 관계 — 보증 기간의 앞뒤, 미발행 증권번호 */
function relationError(key: keyof FixValues, v: FixValues): string {
  if (key === 'to' && isDate(v.from) && isDate(v.to) && !isBefore(v.from, v.to)) {
    return '보증 시작일보다 뒤여야 합니다';
  }
  if (key === 'bondNo' && v.issuer === '미발행' && v.bondNo.trim()) {
    return '발행주체가 미발행이면 하자이행증권 번호를 비워 두세요';
  }
  return '';
}

function errorOf(f: Fx, v: FixValues): string {
  const kind: FieldKind = f.opts ? 'select' : ((f.type ?? 'text') as FieldKind);
  return (
    validate(f.label, v[f.key] ?? '', { kind, required: requiredOf(f, v) }) ||
    relationError(f.key, v)
  );
}

/** 값을 고치면 함께 지워야 할 이웃 항목 */
const LINKED: Partial<Record<keyof FixValues, (keyof FixValues)[]>> = {
  from: ['to'],
  to: ['from'],
  issuer: ['bondNo'],
  bondNo: ['issuer'],
};

const draft: { current: FixValues | null } = { current: null };

/**
 * 화면 머리의 재신청 버튼도 카드와 같은 검증을 거치게 한다.
 * 카드가 켜져 있으면 인라인 오류·스크롤까지 카드 쪽에서 처리한다.
 */
const panel: { check: (() => boolean) | null } = { check: null };

function runCheck(
  v: FixValues,
  setErrors: (e: FixErrors) => void,
  refs: { current: Record<string, HTMLDivElement | null> },
  toast: (m: string) => void,
): boolean {
  const found: FixErrors = {};
  FIX_FIELDS.forEach((f) => {
    const e = errorOf(f, v);
    if (e) found[f.key] = e;
  });
  setErrors(found);

  const first = FIX_FIELDS.find((f) => found[f.key]);
  if (!first) return true;

  toast(found[first.key] ?? '');
  refs.current[first.key]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  return false;
}

export function initialFixValues(a: ApplicationDTO): FixValues {
  return {
    bondNo: a.bondNo,
    issuer: a.issuer,
    months: String(a.months || 36),
    from: a.from,
    to: a.to,
    memo: a.memo,
  };
}

async function save(id: string, v: FixValues) {
  return updateApplicationAction({
    id,
    bondNo: v.bondNo,
    issuer: v.issuer,
    months: Number(v.months) || 36,
    from: v.from,
    to: v.to,
    memo: v.memo,
  });
}

export function FixHeadButton({ app }: { app: ApplicationDTO }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    const v = draft.current ?? initialFixValues(app);
    if (panel.check ? !panel.check() : FIX_FIELDS.some((f) => errorOf(f, v))) {
      if (!panel.check) toast('보증 정보를 다시 확인해 주세요');
      return;
    }
    setBusy(true);
    try {
      const u = await save(app.id, v);
      if (!u.ok) {
        toast(u.toast);
        return;
      }
      const r = await resubmitAction(app.id);
      toast(r.toast);
      if (r.goto) router.push(r.goto);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.button
      {...pressable}
      onClick={() => void onClick()}
      disabled={busy}
      className="h-blue"
      style={{
        padding: '9px 16px',
        background: '#1f5fd0',
        color: '#fff',
        border: '1px solid #1f5fd0',
        borderRadius: 4,
        font: "500 12.5px/1.2 'Noto Sans KR'",
        cursor: busy ? 'default' : 'pointer',
      }}
    >
      보완 후 재신청
    </motion.button>
  );
}

export function FixPanel({ app, revComment }: { app: ApplicationDTO; revComment: string }) {
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState<FixValues>(() => initialFixValues(app));
  const [errors, setErrors] = useState<FixErrors>({});
  const [busy, setBusy] = useState(false);
  /** 오류가 난 항목으로 스크롤하기 위한 필드 컨테이너 */
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    draft.current = v;
    panel.check = () => runCheck(v, setErrors, refs, toast);
    return () => {
      panel.check = null;
    };
  }, [v, toast]);

  /** 값을 고치면 그 항목(과 짝이 되는 항목)의 오류는 즉시 지운다 */
  const set = (k: keyof FixValues) => (val: string) => {
    setV((p) => ({ ...p, [k]: val }));
    setErrors((p) => {
      const keys = [k, ...(LINKED[k] ?? [])].filter((x) => p[x]);
      if (!keys.length) return p;
      const n = { ...p };
      keys.forEach((x) => delete n[x]);
      return n;
    });
  };

  /** 값이 확정될 때 그 항목만 다시 본다 */
  const recheck = (f: Fx) => () =>
    setErrors((p) => {
      const e = errorOf(f, v);
      if (!e && !p[f.key]) return p;
      const n = { ...p };
      if (e) n[f.key] = e;
      else delete n[f.key];
      return n;
    });

  const check = () => runCheck(v, setErrors, refs, toast);

  async function onSave() {
    if (busy || !check()) return;
    setBusy(true);
    try {
      const r = await save(app.id, v);
      toast(r.toast);
      if (r.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onResubmit() {
    if (busy || !check()) return;
    setBusy(true);
    try {
      const u = await save(app.id, v);
      if (!u.ok) {
        toast(u.toast);
        return;
      }
      const r = await resubmitAction(app.id);
      toast(r.toast);
      if (r.goto) router.push(r.goto);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      variants={staggerItem}
      style={{ background: '#fff', border: '1px solid #dfe3e8', borderRadius: 6 }}
    >
      <div
        style={{
          padding: '13px 16px',
          borderBottom: '1px solid #eceff2',
          font: "500 12.5px/1 'Noto Sans KR'",
        }}
      >
        보완 내용 입력 · 재신청
      </div>
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 13 }}>
        <AnimatePresence initial={false}>
          {revComment ? (
            <motion.div
              key={revComment}
              variants={fade}
              initial="hidden"
              animate="show"
              exit="exit"
              style={{
                padding: '10px 12px',
                background: '#fbf1e5',
                border: '1px solid #f0dcc2',
                borderRadius: 4,
                font: "400 11.5px/1.6 'Noto Sans KR'",
                color: '#9a5b12',
              }}
            >
              {revComment}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div
          className="ti-g5"
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
            gap: '14px 16px',
          }}
        >
          {FIX_FIELDS.map((f) => (
            <div
              key={f.key}
              ref={(el) => {
                refs.current[f.key] = el;
              }}
              style={{ minWidth: 0 }}
            >
              <Field
                label={f.label}
                value={v[f.key]}
                onChange={set(f.key)}
                onBlur={recheck(f)}
                ph={f.ph}
                opts={f.opts}
                type={f.type}
                req={requiredOf(f, v)}
                error={errors[f.key]}
              />
            </div>
          ))}
        </div>

        <Field
          label="비고 (현장 조건 및 특이 사항)"
          value={v.memo}
          onChange={set('memo')}
          ta
          ph="현장 조건, 타사 하자 여부, 요청 사항 등을 기재"
        />

        <div className="ti-formfoot" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ font: "400 11.5px/1.2 'Noto Sans KR'", color: '#8b95a1' }}>
            보완 내용을 저장한 뒤 재신청하면 감독관에게 검토 요청이 다시 발송됩니다
          </span>
          <div style={{ flex: 1 }} />
          <motion.button
            {...pressable}
            onClick={() => void onSave()}
            disabled={busy}
            className="h-bd"
            style={{
              padding: '8px 14px',
              background: '#fff',
              color: '#3c4652',
              border: '1px solid #d3d8de',
              borderRadius: 4,
              font: "500 12.5px/1.2 'Noto Sans KR'",
              cursor: busy ? 'default' : 'pointer',
            }}
          >
            보완 내용 저장
          </motion.button>
          <motion.button
            {...pressable}
            onClick={() => void onResubmit()}
            disabled={busy}
            className="h-blue"
            style={{
              padding: '8px 18px',
              background: '#1f5fd0',
              color: '#fff',
              border: '1px solid #1f5fd0',
              borderRadius: 4,
              font: "500 12.5px/1.2 'Noto Sans KR'",
              cursor: busy ? 'default' : 'pointer',
            }}
          >
            보완 후 재신청
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
