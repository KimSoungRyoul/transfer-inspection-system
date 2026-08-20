'use client';

/**
 * 신청서 입력 항목 — 프로토타입 Field 컴포넌트를 확장한 것.
 *
 * 부모는 언제나 업무 표기('YYYY.MM.DD' · '010-0000-0000')로만 값을 다루고,
 * 브라우저 선택기가 요구하는 'YYYY-MM-DD' 변환이나 전화번호 자동 하이픈은
 * 이 컴포넌트 안에서 끝낸다.
 *
 *   opts 가 있으면 select, ta 면 textarea, 그 외에는 type 에 맞는 input.
 */
import {
  formatCount,
  formatPhone,
  formatZip,
  fromDateInput,
  fromMonthInput,
  toDateInput,
  toMonthInput,
} from '@/lib/form';

export type FieldType = 'text' | 'date' | 'month' | 'number' | 'tel' | 'email' | 'password';

export interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  ph?: string;
  opts?: string[];
  ta?: boolean;
  req?: boolean;
  type?: FieldType;
  disabled?: boolean;
  /** 값 아래에 띄우는 도움말 (오류가 있으면 오류가 우선한다) */
  hint?: string;
  /** 인라인 오류 문구. 있으면 테두리와 문구가 붉게 바뀐다 */
  error?: string;
  /** 입력칸 오른쪽에 붙는 단위 표기 (세대 · 개동 · 개월 …) */
  unit?: string;
  min?: number;
  max?: number;
  autoComplete?: string;
  /** 값이 확정될 때(blur) 알려 준다 — 단계 이동 전 검증에 쓴다 */
  onBlur?: () => void;
}

const OK = { bd: '#d3d8de', ring: '#e6eefb', focus: '#1f5fd0' };
const BAD = { bd: '#e3a9a3', ring: '#fbe3e0', focus: '#a32b25' };

export function Field({
  label,
  value,
  onChange,
  ph = '',
  opts,
  ta = false,
  req = false,
  type = 'text',
  disabled = false,
  hint = '',
  error = '',
  unit = '',
  min,
  max,
  autoComplete,
  onBlur,
}: FieldProps) {
  const isSelect = !!opts && opts.length > 0;
  const c = error ? BAD : OK;

  const box: React.CSSProperties = {
    width: '100%',
    padding: unit ? '7px 34px 7px 9px' : '7px 9px',
    border: `1px solid ${c.bd}`,
    borderRadius: 4,
    font: "400 12.5px/1.4 'Noto Sans KR',system-ui",
    color: '#1a1d21',
    background: disabled ? '#f7f8fa' : '#fff',
    outline: 'none',
  };

  /** 화면에 보여 줄 값 — 날짜·월은 네이티브 선택기 형식으로 바꿔 준다 */
  const shown =
    type === 'date' ? toDateInput(value) : type === 'month' ? toMonthInput(value) : value;

  /** 입력값을 업무 표기로 되돌리고, 종류에 따라 자동 정리한다 */
  function handle(raw: string) {
    if (type === 'date') return onChange(fromDateInput(raw));
    if (type === 'month') return onChange(fromMonthInput(raw));
    if (type === 'tel') return onChange(formatPhone(raw));
    if (type === 'number') return onChange(formatCount(raw));
    if (label.includes('우편번호')) return onChange(formatZip(raw));
    onChange(raw);
  }

  const common = {
    className: error ? 'ti-field ti-field-bad' : 'ti-field',
    disabled,
    onBlur,
    'aria-invalid': error ? true : undefined,
  } as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
      <span
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 3,
          font: "500 11.5px/1.35 'Noto Sans KR',system-ui",
          color: '#5b6672',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
        {req ? <b style={{ color: '#1f5fd0', fontWeight: 500 }}>*</b> : null}
      </span>

      <div style={{ position: 'relative', minWidth: 0 }}>
        {isSelect ? (
          <select
            {...common}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{ ...box, padding: '7px 8px', appearance: 'none' }}
          >
            <option value="">선택</option>
            {opts!.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : ta ? (
          <textarea
            {...common}
            rows={3}
            placeholder={ph}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{ ...box, padding: '7px 9px', lineHeight: 1.5, resize: 'vertical' }}
          />
        ) : (
          <input
            {...common}
            type={type === 'number' ? 'text' : type}
            inputMode={type === 'number' ? 'numeric' : type === 'tel' ? 'tel' : undefined}
            placeholder={ph}
            value={shown}
            min={type === 'number' ? min : undefined}
            max={type === 'number' ? max : undefined}
            autoComplete={autoComplete}
            onChange={(e) => handle(e.target.value)}
            style={box}
          />
        )}

        {unit && !isSelect && !ta ? (
          <span
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              font: "400 11.5px/1 'Noto Sans KR'",
              color: '#98a1ac',
              pointerEvents: 'none',
            }}
          >
            {unit}
          </span>
        ) : null}
      </div>

      {error || hint ? (
        <span
          style={{
            font: "400 10.5px/1.45 'Noto Sans KR'",
            color: error ? '#a32b25' : '#98a1ac',
            wordBreak: 'keep-all',
          }}
        >
          {error || hint}
        </span>
      ) : null}
    </div>
  );
}
