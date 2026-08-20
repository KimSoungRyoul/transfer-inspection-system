/**
 * 화면 파생 로직 — 프로토타입 renderVals() 의 계산부를 그대로 옮긴 순수 함수 모음.
 *
 * 서버 컴포넌트·클라이언트 컴포넌트 양쪽에서 쓰므로 부수효과가 없어야 한다.
 * 색·문구는 프로토타입과 1:1 로 맞춘다.
 */
import { DOW, daysBetween, dowOf, parseDot, fmtDot, weekDates } from './date';
import {
  RESULT_COLOR,
  RESULT_TO_STATUS,
  STAGE,
  STATUS_STYLE,
  today,
  type ApplicationDTO,
  type ExternalVisitDTO,
  type ResultLabel,
  type StatusLabel,
} from './domain';

export interface Badge {
  label: string;
  bg: string;
  fg: string;
  bd: string;
}

/** 상태 배지 */
export function st(status: string): Badge {
  const m = STATUS_STYLE[status as StatusLabel] ?? STATUS_STYLE['작성중'];
  return { label: m[0], bg: m[1], fg: m[2], bd: m[3] };
}

/** 판정 결과 배지 — 결과에 대응하는 상태 색을 쓴다 */
export function resultBadge(result: string): Badge {
  if (!result) return { label: '판정 전', bg: '#f0f1f3', fg: '#98a1ac', bd: '#e2e5e9' };
  const status = RESULT_TO_STATUS[result as ResultLabel];
  return { ...st(status), label: result };
}

export function resultColor(result: string): string {
  return result ? (RESULT_COLOR[result as ResultLabel] ?? '#1f5fd0') : '#98a1ac';
}

/** 진행 단계 0~5 */
export function stageOf(status: string): number {
  const n = STAGE[status as StatusLabel];
  return n === undefined ? 5 : n;
}

/* ── 처리 버튼 ────────────────────────────────────────────────────── */

export const isPending = (x: ApplicationDTO): boolean =>
  ['신청완료', '보완요청', '검토예정'].includes(x.status);

export const isJudgeable = (x: ApplicationDTO): boolean =>
  x.status === '검토승인' || x.status === '최종판정대기';

export function actLabelOf(x: ApplicationDTO): string {
  if (x.status === '검토예정') return '검토승인';
  if (isPending(x)) return '검토예정 등록';
  if (isJudgeable(x)) return '판정 입력';
  return '결과 보기';
}

export interface ActStyle {
  actBg: string;
  actFg: string;
  actBd: string;
}

export function actStyleOf(x: ApplicationDTO): ActStyle {
  return {
    actBg: x.status === '검토예정' ? '#0f7b6c' : isPending(x) ? '#5b46c9' : '#fff',
    actFg: isPending(x) ? '#fff' : isJudgeable(x) ? '#1f7a43' : '#3c4652',
    actBd:
      x.status === '검토예정'
        ? '#0f7b6c'
        : isPending(x)
          ? '#5b46c9'
          : isJudgeable(x)
            ? '#1f7a43'
            : '#d3d8de',
  };
}

/** 드로어를 어느 모드로 열지 */
export function drawerModeOf(x: ApplicationDTO): 'review' | 'judge' | 'result' {
  if (isPending(x)) return 'review';
  return x.final ? 'result' : 'judge';
}

/* ── 목록 행 ──────────────────────────────────────────────────────── */

export interface RowBase {
  id: string;
  /** 상태 배지에 설명 툴팁을 달려면 라벨만으로는 부족하다 */
  status: StatusLabel;
  product: string;
  site: string;
  owner: string;
  pm: string;
  installer: string;
  qty: string;
  reqDate: string;
  visitText: string;
  st: Badge;
  finalText: string;
  finalColor: string;
}

export function rowBase(x: ApplicationDTO): RowBase {
  return {
    id: x.id,
    status: x.status,
    product: x.product === 'HN' ? 'HN/HA' : 'DDL',
    site: x.site,
    owner: x.owner,
    pm: x.pm,
    installer: x.installer,
    qty: x.qty.toLocaleString('ko-KR'),
    reqDate: x.reqDate,
    visitText: x.visitDate || '—',
    st: st(x.status),
    finalText: x.final || '—',
    finalColor: resultColor(x.final),
  };
}

/* ── 상세: 항목 표 ────────────────────────────────────────────────── */

export interface InfoItem {
  k: string;
  v: string;
}

export function infoOf(a: ApplicationDTO): InfoItem[] {
  const base: [string, string][] = [
    ['연도', a.year],
    ['식별번호', a.id],
    ['구분', a.channel],
    ['프로젝트코드', a.code],
    ['현장명', a.site],
    ['원청', a.owner],
    ['현장PM', a.pm],
    ['입주개시일', a.moveIn],
    ['설치점명', a.installer],
    ['담당', a.manager],
    ['연락처', a.phone],
    ['지역 · 우편번호', `${a.region} · ${a.zip}`],
    ['주소 (지도 저장값)', a.addr],
    ['현장 좌표 (위도, 경도)', a.latlng],
  ];
  const ddl: [string, string][] = [
    ['(자사·타사) 연동', a.link],
    ['연동 / 미연동', a.linked],
    ['도어록보드', a.board],
    ['스트라이크 Type', a.strike],
    ['타사 제품', a.other],
    ['도어록1 (플네임)', a.lock1],
    ['수량 (세대)', String(a.qty)],
    ['HA / HN', 'HN'],
  ];
  const hn: [string, string][] = [
    ['형태 (선로구성)', a.topology],
    ['주장치 / 초소기', a.main],
    ['세대기기1', a.dev1],
    ['세대카메라', a.camera],
    ['로비폰', a.lobby],
    ['동수', `${a.dongs}개동`],
    ['총세대', `${a.qty}세대`],
    ['도어록 연동', '연동'],
  ];
  return base.concat(a.product === 'DDL' ? ddl : hn).map(([k, v]) => ({ k, v: v || '—' }));
}

/**
 * 신청자가 적어 낸 검사 요청·입회 정보.
 *
 * 감독관이 방문예정일을 잡을 때 가장 먼저 봐야 할 값인데 기본 항목표에는 없었다.
 * 값이 있는 것만 돌려주므로, 비어 있으면 카드 자체를 그리지 않으면 된다.
 */
export function requestInfoOf(a: ApplicationDTO): InfoItem[] {
  const rows: [string, string][] = [
    ['1차이관 희망일자', a.desiredDate],
    ['희망 검사종류', a.desiredInspectType],
    ['입주율 · 시공 완료율', a.occupancy],
    ['입회자', a.witness],
    ['입회자 연락처', a.witnessPhone],
    ['설치자', [a.worker1, a.worker2].filter(Boolean).join(' · ')],
    ['설치점명2', a.installer2],
  ];
  return rows.filter(([, v]) => !!v).map(([k, v]) => ({ k, v }));
}

/** 양식의 나머지 항목(extra) — 라벨 그대로, 값 있는 것만 */
export function extraInfoOf(a: ApplicationDTO): InfoItem[] {
  return Object.entries(a.extra ?? {})
    .filter(([, v]) => !!v)
    .map(([k, v]) => ({ k, v }));
}

/* ── 감독관 방문 동선 ─────────────────────────────────────────────── */

/** 접수 건에 배정하는 방문 시각 — 프로토타입과 동일하게 순서대로 채운다 */
export const MY_TIMES = ['11:00', '14:00', '16:00'];

export interface ItineraryItem {
  order: string;
  t: string;
  tEnd: string;
  site: string;
  meta: string;
  durText: string;
  tag: string;
  tagBg: string;
  tagFg: string;
  cardBg: string;
  cardBd: string;
  titleColor: string;
  timeColor: string;
  cursor: string;
  dotBg: string;
  dotBd: string;
  travel: string;
  showTravel: boolean;
  lineBg: string;
  showOpen: boolean;
  appId: string;
}

const mins = (t: string): number => {
  const [h, m] = t.split(':');
  return Number(h) * 60 + Number(m);
};
const fmtMin = (m: number): string =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/**
 * 하루치 방문 동선. 접수 건과 외부 일정을 시간순으로 합치고 이동/대기 시간을 계산한다.
 * @param myId 이 신청 건을 "내 현장"으로 강조할 때의 식별번호. 없으면 mine 플래그 기준.
 */
export function dayItinerary(
  apps: ApplicationDTO[],
  external: ExternalVisitDTO[],
  date: string,
  myId?: string | null,
): ItineraryItem[] {
  const mine = apps.filter((a) => a.visitDate === date);
  type Raw = {
    t: string;
    site: string;
    region: string;
    product: string;
    installer: string;
    manager: string;
    isApp: boolean;
    id?: string;
    mineOrg?: boolean;
  };

  const raw: Raw[] = external
    .filter((o) => o.d === date)
    .map((o) => ({
      t: o.t,
      site: o.site,
      region: o.region,
      product: o.product,
      installer: o.installer,
      manager: o.manager,
      isApp: false,
    }))
    .concat(
      mine.map((a, i) => ({
        t: MY_TIMES[i] ?? '17:00',
        site: a.site,
        region: a.region,
        product: a.product === 'HN' ? 'HN/HA' : 'DDL',
        installer: a.installer,
        manager: a.manager,
        isApp: true,
        id: a.id,
        mineOrg: a.mine,
      })),
    );

  raw.sort((a, b) => (a.t < b.t ? -1 : 1));
  const dur = (x: Raw): number => (x.isApp ? 100 : 80);

  return raw.map((x, i) => {
    const isMe = myId ? x.id === myId : !!(x.isApp && x.mineOrg);
    let travel = '';
    if (i > 0) {
      const g = Math.max(mins(x.t) - (mins(raw[i - 1].t) + dur(raw[i - 1])), 0);
      travel =
        '이동 · 대기 ' +
        (g >= 60
          ? `${Math.floor(g / 60)}시간${g % 60 ? ` ${g % 60}분` : ''}`
          : `${g}분`);
    }
    return {
      order: String(i + 1),
      t: x.t,
      tEnd: fmtMin(mins(x.t) + dur(x)),
      site: x.site,
      meta: `${x.region} · ${x.product} · ${x.installer} ${x.manager || ''}`,
      durText: `${dur(x)}분 예상`,
      tag: isMe ? '내 현장' : '타 신청 건',
      tagBg: isMe ? '#1f5fd0' : '#eef0f3',
      tagFg: isMe ? '#fff' : '#6b7480',
      cardBg: isMe ? '#f4f8ff' : '#fff',
      cardBd: isMe ? '#1f5fd0' : '#e4e8ec',
      titleColor: isMe ? '#1a52b6' : '#1a1d21',
      timeColor: isMe ? '#1a52b6' : '#6b7480',
      cursor: x.isApp && x.mineOrg ? 'pointer' : 'default',
      dotBg: isMe ? '#1f5fd0' : '#fff',
      dotBd: isMe ? '#1f5fd0' : '#c9cfd6',
      travel,
      showTravel: !!travel,
      lineBg: i === raw.length - 1 ? 'transparent' : '#e4e8ec',
      showOpen: !!(x.isApp && x.mineOrg),
      appId: x.isApp ? (x.id ?? '') : '',
    };
  });
}

export interface ScheduleDay {
  date: string;
  dow: string;
  full: string;
  items: ItineraryItem[];
  stops: string;
  mineText: string;
  mineColor: string;
  span: string;
}

/** 기준일 이후의 방문 예정일들 */
export function scheduleDays(
  apps: ApplicationDTO[],
  external: ExternalVisitDTO[],
  from: string,
  myId?: string | null,
): ScheduleDay[] {
  const dates = new Set<string>();
  apps.forEach((a) => {
    if (a.visitDate && a.visitDate >= from) dates.add(a.visitDate);
  });
  external.forEach((o) => {
    if (o.d >= from) dates.add(o.d);
  });

  return [...dates].sort().map((d) => {
    const items = dayItinerary(apps, external, d, myId);
    const my = items.filter((i) => i.tag === '내 현장').length;
    return {
      date: d.slice(5),
      dow: dowOf(d),
      full: d,
      items,
      stops: `${items.length}개 현장`,
      mineText: my ? `내 현장 ${my}건 포함` : '내 현장 없음',
      mineColor: my ? '#1a52b6' : '#98a1ac',
      span: items.length ? `${items[0].t} – ${items[items.length - 1].tEnd}` : '',
    };
  });
}

/* ── 상세 화면 뷰모델 ─────────────────────────────────────────────── */

export interface StageItem {
  label: string;
  sub: string;
  comment: string;
  dotBg: string;
  dotBd: string;
  lineBg: string;
  lineH: string;
  titleColor: string;
}

export interface DetailVM {
  id: string;
  product: string;
  site: string;
  manager: string;
  phone: string;
  st: Badge;
  stages: StageItem[];
  info: InfoItem[];
  hasVisit: boolean;
  dayLabel: string;
  dayItems: ItineraryItem[];
  inspectType: string;
  inspector: string;
  visitText: string;
  finalText: string;
  resultPair: string;
  firstBadge: Badge;
  finalBadge: Badge;
  bond: InfoItem[];
  bondNote: string;
  brief: InfoItem[];
  log: { at: string; who: string; txt: string }[];
  finalCommentText: string;
  notifs: { ch: string; txt: string; at: string }[];
  needsFix: boolean;
}

export function buildDetail(
  a: ApplicationDTO,
  apps: ApplicationDTO[],
  external: ExternalVisitDTO[],
): DetailVM {
  const stg = stageOf(a.status);
  const labels = ['신청 접수', '검토예정 (방문예정일 등록)', '검토승인', '1차 판정', '최종 판정'];
  const subs = [
    `${a.reqDate} 신청 · ${a.manager}`,
    a.visitDate
      ? `방문예정 ${a.visitDate} ${dowOf(a.visitDate)}요일 · ${a.inspector}`
      : // 위와 같은 이유 — 다음 차례가 감독관이 아니라 신청자다
        a.status === '보완요청'
        ? '보완 후 재신청 필요'
        : '감독관 일정 등록 대기',
    a.status === '검토예정'
      ? '검토승인 대기'
      : a.visitDate
        ? `검토승인 완료 · ${a.inspectType || '검사종류 미정'}`
        : '대기',
    a.first ? `${a.first} · ${a.inspectType || '—'}` : '판정 대기',
    a.final ? `${a.final} · ${a.inspector}` : '판정 대기',
  ];
  /*
   * 보완요청은 검토 단계(1)에서 걸린다. 검토승인(2) 아래에 붙이면 아직 오지도 않은
   * 단계에 사유가 달려, 회색으로 죽어 있는 줄을 읽어야 이유를 알 수 있었다.
   */
  const comments = ['', a.revComment, '', a.firstComment, a.finalComment];

  const stages: StageItem[] = labels.map((label, i) => {
    const done = i < stg;
    const cur = i === stg;
    return {
      label,
      sub: subs[i],
      comment: comments[i] || '',
      dotBg: done ? '#1f5fd0' : '#fff',
      dotBd: done || cur ? '#1f5fd0' : '#cdd3da',
      lineBg: done ? '#cfe0fa' : '#eceff2',
      lineH: i === 4 ? '0px' : '14px',
      titleColor: done || cur ? '#1a1d21' : '#98a1ac',
    };
  });

  const bondMissing =
    a.issuer === '미발행' || a.bondNo === '입력 요망' || a.bondNo === '추후발행' || !a.bondNo;

  return {
    id: a.id,
    product: a.product === 'HN' ? 'HN / HA' : 'DDL',
    site: a.site,
    manager: a.manager,
    phone: a.phone,
    st: st(a.status),
    stages,
    info: infoOf(a),
    hasVisit: !!a.visitDate,
    dayLabel: a.visitDate
      ? `${a.visitDate} (${dowOf(a.visitDate)}) · 감독관 ${a.inspector} 방문 동선`
      : '',
    dayItems: a.visitDate ? dayItinerary(apps, external, a.visitDate, a.id) : [],
    inspectType: a.inspectType || '미지정',
    inspector: a.inspector,
    visitText: a.visitDate || '미지정',
    finalText: a.final || (a.status === '보완요청' ? '보완요청' : '판정 전'),
    resultPair: `${a.first || '—'} / ${a.final || '—'}`,
    firstBadge: resultBadge(a.first),
    finalBadge: resultBadge(a.final),
    bond: [
      { k: '하자이행증권 번호', v: a.bondNo || '—' },
      { k: '발행주체', v: a.issuer || '—' },
      { k: '보증', v: `${a.months}개월` },
      { k: '보증 시작', v: a.from || '—' },
      { k: '보증 종료', v: a.to || '—' },
    ],
    bondNote: bondMissing
      ? '하자이행증권이 확인되지 않습니다. 하자이행증권 발행 전에는 최종 합격 처리가 제한됩니다.'
      : `하자보증기간 ${a.from} ~ ${a.to} (${a.months}개월). 입주개시일 ${a.moveIn} 기준 유효합니다.`,
    brief: [
      { k: '식별번호', v: a.id },
      { k: '제품군', v: a.product === 'HN' ? 'HN / HA' : 'DDL' },
      { k: '원청 · 현장PM', v: `${a.owner} · ${a.pm}` },
      { k: '설치점명', v: a.installer },
      { k: '담당 · 연락처', v: `${a.manager} ${a.phone}` },
      { k: '수량', v: `${a.qty}세대` },
      { k: '신청일', v: a.reqDate },
      { k: '입주개시일', v: a.moveIn },
    ],
    log: a.log,
    finalCommentText: a.finalComment || a.firstComment || a.memo || '기재된 비고가 없습니다',
    notifs: a.notifs,
    needsFix: a.status === '보완요청',
  };
}

/* ── 감독관 KPI ───────────────────────────────────────────────────── */

export interface KpiDef {
  key: string;
  label: string;
  color: string;
  pick: (x: ApplicationDTO, week: string[]) => boolean;
  hint: string;
}

export const KPI_DEFS: KpiDef[] = [
  {
    key: 'new',
    label: '신규 신청 (일정 등록 대기)',
    color: '#1f5fd0',
    pick: (x) => x.status === '신청완료',
    hint: '검토예정으로 등록하거나 방문예정일을 지정해 검토승인하세요',
  },
  {
    key: 'plan',
    label: '검토예정 (승인 대기)',
    color: '#5b46c9',
    pick: (x) => x.status === '검토예정',
    hint: '방문예정일과 검사종류를 확정해 검토승인 처리하세요',
  },
  {
    key: 'week',
    label: '이번주 방문예정',
    color: '#0f7b6c',
    pick: (x, week) => week.includes(x.visitDate),
    hint: '방문 후 1차·최종 판정을 입력하세요',
  },
  {
    key: 'judge',
    label: '최종판정 대기',
    color: '#0f6b8f',
    pick: (x) => x.status === '최종판정대기',
    hint: '하자이행증권 · 하자보증기간을 확인한 뒤 최종 합격·불합격을 확정하세요',
  },
  {
    /*
     * 방문일이 지났는데 검토승인에 머물러 있는 건 — 다녀왔지만 판정을 안 넣은 것이다.
     * 다른 KPI 넷은 '신청완료 / 검토예정 / 이번주 방문 / 최종판정대기' 라
     * 이 건들은 어디에도 잡히지 않고 조용히 쌓인다.
     */
    key: 'overdue',
    label: '판정 지연 (방문일 경과)',
    color: '#a32b25',
    pick: (x) => x.status === '검토승인' && !!x.visitDate && x.visitDate < today(),
    hint: '방문을 마친 건입니다 · 1차 또는 최종 판정을 입력하세요',
  },
];

/* ── 월 캘린더 ───────────────────────────────────────────────────── */

export interface CalCell {
  d: string;
  bg: string;
  numColor: string;
  more: string;
  visits: { id: string; label: string }[];
  /** 그날 이미 잡혀 있는 타 신청 건 수 — 겹쳐 잡는 것을 막으려고 표시만 한다 */
  ext: number;
}

/** 기준일이 속한 달의 5주(35칸) 그리드 */
export function calendarCells(
  apps: ApplicationDTO[],
  base: string,
  external: ExternalVisitDTO[] = [],
): CalCell[] {
  const b = parseDot(base);
  if (!b) return [];
  const y = b.getUTCFullYear();
  const m = b.getUTCMonth();
  const first = new Date(Date.UTC(y, m, 1));
  const firstDow = first.getUTCDay();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const prefix = `${y}.${String(m + 1).padStart(2, '0')}.`;
  const withVisit = apps.filter((x) => x.visitDate.startsWith(prefix));
  /*
   * 주간 카드는 외부 일정을 보여 주는데 월 그리드만 숨기고 있었다.
   * 다음 달 방문일을 잡을 때 이미 차 있는 날이 빈 날로 보여 겹쳐 잡게 된다.
   * 클릭 대상은 아니므로 건수만 적는다 — 상세는 날짜를 눌러 동선에서 본다.
   */
  const withExt = external.filter((x) => x.d.startsWith(prefix));

  const cells: CalCell[] = [];
  const total = Math.ceil((firstDow + lastDay) / 7) * 7;
  for (let i = 0; i < total; i++) {
    const d = i - firstDow + 1;
    const inMonth = d >= 1 && d <= lastDay;
    const ds = prefix + String(d).padStart(2, '0');
    const dayVisits = withVisit.filter((x) => x.visitDate === ds);
    cells.push({
      d: inMonth ? String(d) : '',
      bg: inMonth ? (ds === base ? '#f7faff' : '#fff') : '#fafbfc',
      numColor: inMonth ? (i % 7 === 0 ? '#a32b25' : '#4a5460') : '#cdd3da',
      more: dayVisits.length > 2 ? `+${dayVisits.length - 2}건 더보기` : '',
      visits: dayVisits.slice(0, 2).map((x) => ({
        id: x.id,
        label: /^\[/.test(x.site) ? x.site : `${x.product === 'DDL' ? '[DDL] ' : '[HN] '}${x.site}`,
      })),
      ext: inMonth ? withExt.filter((x) => x.d === ds).length : 0,
    });
  }
  return cells;
}

/** 캘린더가 표시하는 달의 방문 건수 */
export function monthVisitCount(apps: ApplicationDTO[], base: string): number {
  const b = parseDot(base);
  if (!b) return 0;
  const prefix = `${b.getUTCFullYear()}.${String(b.getUTCMonth() + 1).padStart(2, '0')}.`;
  return apps.filter((x) => x.visitDate.startsWith(prefix)).length;
}

export function monthLabel(base: string): string {
  const b = parseDot(base);
  return b ? `${b.getUTCFullYear()}년 ${b.getUTCMonth() + 1}월` : '';
}

/* ── 신청자: 내 방문 일정 ─────────────────────────────────────────── */

export interface MyVisit {
  id: string;
  site: string;
  st: Badge;
  dateText: string;
  timeText: string;
  timeColor: string;
  dday: string;
  ddayBg: string;
  ddayFg: string;
  /** 방문이 이미 지난 건 — 화면에서 접어 둘 수 있도록 표시한다 */
  past: boolean;
}

export function myVisits(
  apps: ApplicationDTO[],
  external: ExternalVisitDTO[],
  today: string,
  /**
   * 동선 계산용 전체 방문 건. 감독관의 하루 일정에서 몇 번째로 방문하는지에 따라
   * 도착 시각이 정해지므로, 내 건만 넘기면 상세 화면과 시각이 어긋난다.
   */
  allVisits: ApplicationDTO[] = apps,
): MyVisit[] {
  return apps.map((x) => {
    const has = !!x.visitDate;
    const it = has
      ? dayItinerary(allVisits, external, x.visitDate, x.id).find((i) => i.tag === '내 현장')
      : undefined;
    const dd = has ? daysBetween(today, x.visitDate) : null;
    return {
      id: x.id,
      site: x.site,
      st: st(x.status),
      dateText: has ? `${x.visitDate} (${dowOf(x.visitDate)})` : '방문일자 미정',
      timeText: it
        ? dd !== null && dd < 0
          ? `${it.t} 방문 완료 · ${it.tEnd} 검사 종료`
          : dd === 0
            ? `${it.t} 도착 예정 (오늘)`
            : `${it.t} 도착 예정 · ${it.tEnd} 종료 예정`
        : // 보완요청은 기다린다고 풀리지 않는다 — 신청자가 재신청해야 일정 등록으로 넘어간다
          x.status === '보완요청'
          ? '보완 후 재신청 필요 · 재신청해야 일정이 잡힙니다'
          : '감독관 일정 등록 대기',
      timeColor: dd !== null && dd < 0 ? '#6b7480' : '#1a52b6',
      dday: dd === null ? '—' : dd === 0 ? '오늘' : dd > 0 ? `D-${dd}` : '완료',
      ddayBg: dd !== null && dd >= 0 ? '#1f5fd0' : '#eef0f3',
      ddayFg: dd !== null && dd >= 0 ? '#fff' : '#6b7480',
      past: dd !== null && dd < 0,
    };
  })
    /*
     * 앞으로 갈 곳을 먼저 본다.
     *   1) 일정이 잡힌 예정 건 — 가까운 날짜 순
     *   2) 아직 일정이 없는 건 — 감독관 등록을 기다리는 중
     *   3) 이미 다녀간 건 — 최근 순 (화면에서는 접어 둔다)
     */
    .sort((p, q) => {
      const rank = (v: MyVisit) => (v.past ? 2 : v.dday === '—' ? 1 : 0);
      const rp = rank(p);
      const rq = rank(q);
      if (rp !== rq) return rp - rq;
      if (rp === 2) return p.dateText < q.dateText ? 1 : -1;
      return p.dateText < q.dateText ? -1 : 1;
    });
}

/* ── 공용 ────────────────────────────────────────────────────────── */

export function chip(label: string, active: boolean, hue = '#1f5fd0') {
  return {
    label,
    bg: active ? hue : '#fff',
    fg: active ? '#fff' : '#3c4652',
    bd: active ? hue : '#d3d8de',
  };
}

export function resultChip(label: string, active: boolean) {
  if (!active) return { label, bg: '#fff', fg: '#3c4652', bd: '#d3d8de' };
  const m = st(RESULT_TO_STATUS[label as ResultLabel]);
  return { label, bg: m.bg, fg: m.fg, bd: m.bd };
}

export function pill(on: boolean) {
  return { bg: on ? '#1f5fd0' : 'transparent', fg: on ? '#fff' : '#98a1ac' };
}

export { DOW, dowOf, fmtDot, weekDates };
