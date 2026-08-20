/**
 * 날짜 유틸 — 시스템 표기는 'YYYY.MM.DD', 저장은 MySQL DATE.
 *
 * DATE 컬럼은 시각이 없으므로 항상 UTC 자정으로 만들고 UTC 로 읽는다.
 * 로컬 타임존으로 만들면 KST(+9) 에서 하루가 밀린다.
 */

const DOW = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** 'YYYY.MM.DD' 또는 'YYYY-MM-DD' → UTC 자정 Date. 형식이 아니면 null. */
export function parseDot(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/.exec(s.trim());
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Date → 'YYYY.MM.DD'. null 이면 빈 문자열(화면의 '미지정'). */
export function fmtDot(d: Date | null | undefined): string {
  if (!d) return '';
  return (
    d.getUTCFullYear() +
    '.' +
    String(d.getUTCMonth() + 1).padStart(2, '0') +
    '.' +
    String(d.getUTCDate()).padStart(2, '0')
  );
}

/** Date → 'YYYY-MM-DD' (<input type="date"> 용) */
export function fmtInput(d: Date | null | undefined): string {
  return fmtDot(d).replace(/\./g, '-');
}

/** 'YYYY.MM.DD' → '월' 같은 요일 한 글자 */
export function dowOf(s: string): string {
  const d = parseDot(s);
  return d ? DOW[d.getUTCDay()] : '';
}

/** 두 'YYYY.MM.DD' 사이의 일수 차 (b - a) */
export function daysBetween(a: string, b: string): number | null {
  const da = parseDot(a);
  const db = parseDot(b);
  if (!da || !db) return null;
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

/** 기준일이 속한 주(일요일 시작)의 7일치 'YYYY.MM.DD' */
export function weekDates(base: string): string[] {
  const d = parseDot(base);
  if (!d) return [];
  const start = new Date(d.getTime() - d.getUTCDay() * 86400000);
  return Array.from({ length: 7 }, (_, i) => fmtDot(new Date(start.getTime() + i * 86400000)));
}

/** 'YYYY.MM.DD' 에 일수를 더한다 */
export function addDays(s: string, n: number): string {
  const d = parseDot(s);
  return d ? fmtDot(new Date(d.getTime() + n * 86400000)) : '';
}

export { DOW };
