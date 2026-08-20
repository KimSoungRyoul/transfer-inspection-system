/**
 * 이관검사 도메인 어휘 — 서버·클라이언트 공용.
 *
 * DB 는 ASCII enum 으로 저장하고, API 경계에서는 업무 용어(한글 라벨)로 주고받는다.
 * 프로토타입(index.html)의 화면 로직이 한글 라벨을 그대로 쓰기 때문에
 * 라벨을 그대로 실어 보내면 UI 포팅에서 변환 계층이 필요 없다.
 */

export type RoleKey = 'applicant' | 'supervisor';

export type ProductCode = 'DDL' | 'HN';

export type StatusLabel =
  | '작성중'
  | '신청완료'
  | '검토예정'
  | '검토승인'
  | '보완요청'
  | '최종판정대기'
  | '최종합격'
  | '조건부합격'
  | '불합격'
  | '보류'
  | '이월';

export type ResultLabel = '합격' | '조건부합격' | '불합격' | '보류' | '이월';

export type InspectTypeLabel = '서류검사' | '샘플링검사';

export type ChannelLabel = '직판' | '유통';

export type NotifyChannel = 'MAIL' | 'SMS';

/* ── DB enum ↔ 한글 라벨 ─────────────────────────────────────────── */

export const STATUS_ENUM = {
  작성중: 'DRAFT',
  신청완료: 'SUBMITTED',
  검토예정: 'REVIEW_PLANNED',
  검토승인: 'REVIEW_APPROVED',
  보완요청: 'FIX_REQUESTED',
  최종판정대기: 'FINAL_PENDING',
  최종합격: 'PASSED',
  조건부합격: 'CONDITIONAL',
  불합격: 'FAILED',
  보류: 'HOLD',
  이월: 'CARRIED_OVER',
} as const satisfies Record<StatusLabel, string>;

export type StatusEnum = (typeof STATUS_ENUM)[StatusLabel];

export const STATUS_LABEL = Object.fromEntries(
  Object.entries(STATUS_ENUM).map(([label, value]) => [value, label]),
) as Record<StatusEnum, StatusLabel>;

export const RESULT_ENUM = {
  합격: 'PASS',
  조건부합격: 'CONDITIONAL',
  불합격: 'FAIL',
  보류: 'HOLD',
  이월: 'CARRY_OVER',
} as const satisfies Record<ResultLabel, string>;

export type ResultEnum = (typeof RESULT_ENUM)[ResultLabel];

export const RESULT_LABEL = Object.fromEntries(
  Object.entries(RESULT_ENUM).map(([label, value]) => [value, label]),
) as Record<ResultEnum, ResultLabel>;

export const INSPECT_TYPE_ENUM = {
  서류검사: 'DOCUMENT',
  샘플링검사: 'SAMPLING',
} as const satisfies Record<InspectTypeLabel, string>;

export type InspectTypeEnum = (typeof INSPECT_TYPE_ENUM)[InspectTypeLabel];

export const INSPECT_TYPE_LABEL = Object.fromEntries(
  Object.entries(INSPECT_TYPE_ENUM).map(([label, value]) => [value, label]),
) as Record<InspectTypeEnum, InspectTypeLabel>;

export const CHANNEL_ENUM = {
  직판: 'DIRECT',
  유통: 'DISTRIBUTION',
} as const satisfies Record<ChannelLabel, string>;

export type ChannelEnum = (typeof CHANNEL_ENUM)[ChannelLabel];

export const CHANNEL_LABEL = Object.fromEntries(
  Object.entries(CHANNEL_ENUM).map(([label, value]) => [value, label]),
) as Record<ChannelEnum, ChannelLabel>;

/** 최종 판정 결과 → 신청 건의 최종 상태 */
export const RESULT_TO_STATUS: Record<ResultLabel, StatusLabel> = {
  합격: '최종합격',
  조건부합격: '조건부합격',
  불합격: '불합격',
  보류: '보류',
  이월: '이월',
};

/** 진행 단계(0~5) — 상세 화면 타임라인이 어디까지 채워지는지 결정한다. */
export const STAGE: Partial<Record<StatusLabel, number>> = {
  작성중: 0,
  신청완료: 1,
  보완요청: 1,
  검토예정: 2,
  검토승인: 3,
  최종판정대기: 4,
};

/** 상태 배지 색 — [라벨, 배경, 글자, 테두리] */
export const STATUS_STYLE: Record<StatusLabel, [string, string, string, string]> = {
  작성중: ['작성중', '#f0f1f3', '#6b7480', '#e2e5e9'],
  신청완료: ['신청완료', '#eaf1fd', '#1f5fd0', '#cfe0fa'],
  검토예정: ['검토예정', '#f0edfd', '#5b46c9', '#ddd6fa'],
  검토승인: ['검토승인', '#e4f3ef', '#0f7b6c', '#c4e6de'],
  보완요청: ['보완요청', '#fbf1e5', '#9a5b12', '#f0dcc2'],
  최종판정대기: ['최종판정 대기', '#e9f2f8', '#0f6b8f', '#cde3ef'],
  최종합격: ['최종합격', '#1f7a43', '#ffffff', '#1f7a43'],
  조건부합격: ['조건부합격', '#eaf6ee', '#1f7a43', '#1f7a43'],
  불합격: ['불합격', '#fdecea', '#a32b25', '#f3d2ce'],
  보류: ['보류', '#fdf4e6', '#8a6410', '#f0e2c4'],
  이월: ['이월', '#f0f1f3', '#6b7480', '#e2e5e9'],
};

/**
 * 상태별 한 줄 설명 — 신청자가 "지금 뭘 기다리면 되는지" 알 수 있게.
 * 배지 툴팁과 상세 타임라인의 현재 단계 안내에 쓴다.
 */
export const STATUS_NOTE: Record<StatusLabel, string> = {
  작성중: '아직 제출되지 않은 신청서입니다.',
  신청완료: '접수되었습니다. 감독관이 검토 후 방문예정일을 잡습니다.',
  검토예정: '감독관이 방문예정일을 등록했습니다. 검토승인을 기다리는 단계입니다.',
  검토승인: '검토가 승인되어 방문예정일이 확정되었습니다. 방문 검사를 기다립니다.',
  보완요청: '보완이 필요합니다. 사유를 확인해 수정한 뒤 재신청해 주세요.',
  최종판정대기: '1차 판정이 끝났습니다. 최종 합격·불합격 판정을 기다리는 단계입니다.',
  최종합격: '최종 합격으로 이관이 완료되었습니다.',
  조건부합격: '지적 사항 조치를 조건으로 합격 처리되었습니다.',
  불합격: '불합격입니다. 재시공 후 이관검사를 다시 신청해 주세요.',
  보류: '판정이 보류되었습니다. 차월 재검사 대상입니다.',
  이월: '차년도로 이월되었습니다.',
};

/** 판정 결과 글자색 */
export const RESULT_COLOR: Record<ResultLabel, string> = {
  합격: '#1f7a43',
  조건부합격: '#1f7a43',
  불합격: '#a32b25',
  보류: '#8a6410',
  이월: '#6b7480',
};

export const RESULTS: ResultLabel[] = ['합격', '조건부합격', '불합격', '보류', '이월'];

export const INSPECT_TYPES: InspectTypeLabel[] = ['서류검사', '샘플링검사'];

/**
 * 데모 기준일. 시드 데이터가 2026-07 기준이라 "이번주 방문 일정"·D-day·KPI 가
 * 의미를 가지려면 오늘 날짜를 고정해야 한다. 실서비스로 돌릴 때는 빈 값으로 두면
 * 실제 오늘 날짜를 쓴다.
 */
export const DEMO_TODAY = process.env.NEXT_PUBLIC_DEMO_TODAY ?? '2026.07.26';

/** 'YYYY.MM.DD' — 시스템 전역에서 쓰는 날짜 표기 */
export function today(): string {
  if (DEMO_TODAY) return DEMO_TODAY;
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('.');
}

/* ── API DTO ─────────────────────────────────────────────────────── */

export interface LogEntry {
  at: string;
  who: string;
  txt: string;
}

export interface NotifEntry {
  ch: NotifyChannel;
  txt: string;
  at: string;
}

/** 신청 건 1건. 날짜는 모두 'YYYY.MM.DD', 미지정은 빈 문자열. */
export interface ApplicationDTO {
  id: string;
  product: ProductCode;
  year: string;
  site: string;
  owner: string;
  pm: string;
  channel: ChannelLabel;
  code: string;
  moveIn: string;

  installer: string;
  manager: string;
  phone: string;
  qty: number;
  region: string;
  zip: string;
  addr: string;
  latlng: string;

  /* DDL 전용 */
  link: string;
  linked: string;
  board: string;
  strike: string;
  other: string;
  lock1: string;

  /* HN/HA 전용 */
  topology: string;
  main: string;
  dev1: string;
  camera: string;
  lobby: string;
  dongs: number;

  /* 설치점 · 입회 */
  installer2: string;
  witness: string;
  witnessPhone: string;
  worker1: string;
  worker2: string;

  /* 신청자가 적어 낸 희망 검사 조건 */
  desiredDate: string;
  desiredInspectType: '' | InspectTypeLabel;
  occupancy: string;

  /** 양식의 나머지 항목 — 라벨 그대로 보관한다 */
  extra: Record<string, string>;

  status: StatusLabel;
  reqDate: string;
  visitDate: string;
  inspectType: '' | InspectTypeLabel;
  first: '' | ResultLabel;
  final: '' | ResultLabel;
  inspector: string;
  memo: string;

  bondNo: string;
  issuer: string;
  months: number;
  from: string;
  to: string;

  revComment: string;
  firstComment: string;
  finalComment: string;

  log: LogEntry[];
  notifs: NotifEntry[];

  /** 로그인한 사용자가 신청한 건인지 */
  mine: boolean;
}

/** 감독관 동선 참고용 외부(타 신청) 일정 */
export interface ExternalVisitDTO {
  d: string;
  t: string;
  site: string;
  region: string;
  product: string;
  installer: string;
  manager: string;
}

export interface MeDTO {
  id: number;
  name: string;
  email: string;
  org: string;
  initial: string;
  role: RoleKey;
  phone: string;
}

export interface ApplicationsResponse {
  apps: ApplicationDTO[];
  external: ExternalVisitDTO[];
  today: string;
}

/** 신청서 작성(4단계 폼) 제출 페이로드 */
export interface CreateApplicationInput {
  product: ProductCode;
  year: string;
  site: string;
  owner: string;
  pm: string;
  channel: ChannelLabel;
  code: string;
  moveIn: string;
  installer: string;
  qty: number;
  region: string;
  zip: string;
  addr?: string;
  lat?: number;
  lng?: number;
  link?: string;
  linked?: string;
  board?: string;
  strike?: string;
  other?: string;
  lock1?: string;
  topology?: string;
  main?: string;
  dev1?: string;
  camera?: string;
  lobby?: string;
  dongs?: number;
  installer2?: string;
  manager: string;
  phone: string;
  witness?: string;
  witnessPhone?: string;
  worker1?: string;
  worker2?: string;
  desiredDate?: string;
  desiredInspectType?: InspectTypeLabel | '';
  occupancy?: string;
  extra?: Record<string, string>;
  bondNo?: string;
  issuer?: string;
  months?: number;
  from?: string;
  to?: string;
  memo?: string;
}
