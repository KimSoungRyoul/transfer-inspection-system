/**
 * 폼 입력 포맷·검증 — 서버/클라이언트 공용 순수 함수.
 *
 * 화면과 DB 는 날짜를 'YYYY.MM.DD'(월은 'YYYY.MM') 로 다루지만,
 * 브라우저 기본 날짜 선택기는 'YYYY-MM-DD' / 'YYYY-MM' 을 요구한다.
 * 그 변환과 입력 자동 정리를 여기서 담당한다.
 */

/* ── 날짜 ↔ 네이티브 입력값 ──────────────────────────────────────── */

/** '2026.08.01' → '2026-08-01' (<input type="date"> 값). 형식이 아니면 빈 문자열 */
export function toDateInput(dot: string): string {
  const m = /^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/.exec((dot ?? '').trim());
  if (!m) return '';
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

/** '2026-08-01' → '2026.08.01' */
export function fromDateInput(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso ?? '').trim());
  return m ? `${m[1]}.${m[2]}.${m[3]}` : '';
}

/** '2026.08' → '2026-08' (<input type="month"> 값) */
export function toMonthInput(dot: string): string {
  const m = /^(\d{4})[.\-/](\d{1,2})$/.exec((dot ?? '').trim());
  return m ? `${m[1]}-${m[2].padStart(2, '0')}` : '';
}

/** '2026-08' → '2026.08' */
export function fromMonthInput(iso: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec((iso ?? '').trim());
  return m ? `${m[1]}.${m[2]}` : '';
}

/* ── 자동 포맷 ───────────────────────────────────────────────────── */

export const digitsOnly = (v: string): string => (v ?? '').replace(/\D/g, '');

/**
 * 전화번호를 입력하는 대로 다듬는다.
 * 010-1234-5678 / 02-123-4567 / 031-123-4567 형태를 지원한다.
 */
export function formatPhone(v: string): string {
  const d = digitsOnly(v).slice(0, 11);
  if (!d) return '';
  if (d.startsWith('02')) {
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)}-${d.slice(2)}`;
    if (d.length <= 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}`;
  }
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 11)}`;
}

/** 우편번호 — 숫자 5자리 */
export const formatZip = (v: string): string => digitsOnly(v).slice(0, 5);

/** 수량 — 숫자만, 앞자리 0 제거 */
export function formatCount(v: string): string {
  const d = digitsOnly(v).replace(/^0+(?=\d)/, '');
  return d.slice(0, 7);
}

/** 1234567 → '1,234,567' (표시 전용) */
export const withComma = (v: string | number): string =>
  Number(digitsOnly(String(v)) || 0).toLocaleString('ko-KR');

/* ── 검증 ────────────────────────────────────────────────────────── */

export const isDate = (v: string): boolean => /^\d{4}\.\d{2}\.\d{2}$/.test(v ?? '');
export const isMonth = (v: string): boolean => /^\d{4}\.\d{2}$/.test(v ?? '');
export const isPhone = (v: string): boolean => /^0\d{1,2}-\d{3,4}-\d{4}$/.test(v ?? '');
export const isZip = (v: string): boolean => /^\d{5}$/.test(v ?? '');
export const isEmail = (v: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((v ?? '').trim());

/** 'YYYY.MM.DD' 문자열 비교 — 사전순이 곧 시간순이다 */
export const isBefore = (a: string, b: string): boolean => !!a && !!b && a < b;

export type FieldKind =
  | 'text'
  | 'date'
  | 'month'
  | 'number'
  | 'tel'
  | 'email'
  | 'password'
  | 'select'
  | 'textarea';

/**
 * 한 항목의 값 검증. 통과하면 빈 문자열, 아니면 화면에 띄울 문구.
 * 필수 여부와 형식만 본다 — 항목 간 관계(보증 시작 < 종료 등)는 호출부에서 따로 본다.
 */
export function validate(
  label: string,
  value: string,
  opts: { kind?: FieldKind; required?: boolean; min?: number; max?: number } = {},
): string {
  const { kind = 'text', required = false, min, max } = opts;
  const v = (value ?? '').trim();

  if (!v) return required ? `${josa(label, '을', '를')} 입력해 주세요` : '';

  switch (kind) {
    case 'date':
      return isDate(v) ? '' : '날짜 형식이 올바르지 않습니다';
    case 'month':
      return isMonth(v) ? '' : '연·월 형식이 올바르지 않습니다';
    case 'tel':
      return isPhone(v) ? '' : '전화번호 형식이 올바르지 않습니다 (예: 010-0000-0000)';
    case 'email':
      return isEmail(v) ? '' : '이메일 형식이 올바르지 않습니다';
    case 'number': {
      const n = Number(digitsOnly(v));
      if (!Number.isFinite(n)) return '숫자만 입력해 주세요';
      if (min !== undefined && n < min) return `${min} 이상이어야 합니다`;
      if (max !== undefined && n > max) return `${max} 이하여야 합니다`;
      return '';
    }
    default:
      return '';
  }
}

/**
 * 받침 유무에 따라 조사를 고른다. ('현장명을' / '원청를' 같은 어색함 방지)
 * 숫자로 끝나면 읽는 소리 기준(1→일→받침 O), 영문·기호로 끝나면 받침 있는 쪽을 쓴다.
 */
/**
 * '으로 / 로' — 받침 규칙이 다른 조사.
 * 받침이 없거나 ㄹ 받침이면 '로' 를 쓴다(서울로 · 이월로 · 보류로).
 * josa() 로는 ㄹ 예외를 처리할 수 없어 따로 둔다.
 */
export function euro(word: string): string {
  const bare = (word ?? '').trim().replace(/\s*\(.*\)\s*$/, '');
  const last = bare.slice(-1);
  if (!last) return '로';
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return '으로';
  const jong = (code - 0xac00) % 28;
  // 0 = 받침 없음, 8 = ㄹ
  return jong === 0 || jong === 8 ? '로' : '으로';
}

export function josa(word: string, withBatchim: string, without: string): string {
  const bare = (word ?? '').trim().replace(/\s*\(.*\)\s*$/, '');
  const last = bare.slice(-1);
  if (!last) return `${word}${without}`;

  // 숫자로 끝나면 읽는 소리의 받침을 따른다 — 도어록1(일) → '을', 세대기기2(이) → '를'
  if (/[0-9]/.test(last)) {
    return `${word}${'013678'.includes(last) ? withBatchim : without}`;
  }

  const code = last.charCodeAt(0);
  // 한글이 아니면(영문·기호) 받침 있는 쪽을 쓴다 — 'DDL을' 이 'DDL를' 보다 자연스럽다
  if (code < 0xac00 || code > 0xd7a3) return `${word}${withBatchim}`;
  return `${word}${(code - 0xac00) % 28 ? withBatchim : without}`;
}
