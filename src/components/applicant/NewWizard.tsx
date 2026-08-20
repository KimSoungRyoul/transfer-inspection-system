'use client';

/**
 * 이관검사 신규 신청 위저드 — 프로토타입 isNew 화면.
 *
 * 제품군을 고르면(step 0) 해당 양식의 4단계 폼이 열린다. 스키마에 대응하는 컬럼이
 * 있는 항목은 최상위 필드로, 나머지(도어록2 · 세대기기2/3 · 부가장비 …)는 라벨을
 * 키로 하는 extra 객체에 담아 그대로 저장한다.
 */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { createApplicationAction } from '@/lib/actions';
import {
  AnimatePresence,
  DUR,
  EASE,
  fade,
  motion,
  pressable,
  staggerItem,
  type Variants,
} from '@/components/motion';
import { Field, type FieldType } from '@/components/Field';
import { useToast } from '@/components/Toast';
import { formatPhone, isBefore, isDate, type FieldKind, validate as validateField } from '@/lib/form';
import {
  today,
  type ChannelLabel,
  type CreateApplicationInput,
  type InspectTypeLabel,
  type MeDTO,
  type ProductCode,
} from '@/lib/domain';
import { MapPicker, PinGlyph, type SiteLoc } from '@/components/applicant/MapPicker';

/* ── 항목 정의 ────────────────────────────────────────────────────── */

interface Fd {
  /** 최상위 항목이면 페이로드 필드명, extra 항목이면 extra 의 키 */
  key: string;
  label: string;
  ph?: string;
  opts?: string[];
  ta?: boolean;
  req?: boolean;
  /** true 면 extra 객체로 실려 간다 */
  extra?: boolean;
  /** 입력 유형 — 날짜·월 선택기, 전화번호 자동 하이픈, 숫자 전용 입력 */
  type?: FieldType;
  /** 입력칸 오른쪽 단위 표기 (세대 · 개동 · 대) */
  unit?: string;
  /** 헷갈리는 항목에만 붙이는 짧은 도움말 */
  hint?: string;
  min?: number;
  max?: number;
  autoComplete?: string;
}

interface Row {
  cls: string;
  cols: string;
  fields: Fd[];
}

interface Section {
  title: string;
  rows: Row[];
}

const PMS = ['한도현', '강하늘', '오세영', '전상우', '안세림', '유진호', '정민우', '조현규', '구본영'];
const ISSUERS = [
  '이행보증보험',
  '종합보증보험',
  '통신공제조합',
  '산업공제조합',
  '소프트웨어공제회',
  '건설공제회',
  '미발행',
];
const DEV_KIND = ['W', 'BM', 'AM', 'LM', 'XM', 'EM'];
const ONOFF = ['적용', '미적용'];

const STEP1: Section[] = [
  {
    title: '현장 기본정보',
    rows: [
      {
        cls: 'ti-g4',
        cols: 'repeat(4,minmax(0,1fr))',
        fields: [
          { key: 'year', label: '연도', opts: ['2026년', '2025년', '2024년'], req: true },
          { key: 'channel', label: '구분', opts: ['직판', '유통'], req: true },
          { key: 'code', label: '프로젝트코드', ph: 'PRJ-230101', req: true, hint: '계약 시 부여된 코드' },
          { key: 'moveIn', label: '입주개시일', ph: '2026.08', req: true, type: 'month' },
        ],
      },
      {
        cls: 'ti-g3a',
        cols: '2fr 1fr 1fr',
        fields: [
          { key: 'site', label: '현장명', ph: '경기 파주 한빛건설 운정신도시 한빛채 3차', req: true },
          { key: 'owner', label: '원청', ph: '한빛건설', req: true },
          { key: 'pm', label: '현장PM', opts: PMS, req: true },
        ],
      },
      {
        cls: 'ti-g3b',
        cols: '1fr 1fr 2fr',
        fields: [
          { key: 'zip', label: '우편번호', ph: '10000', autoComplete: 'postal-code' },
          { key: 'region', label: '지역', ph: '파주시' },
          {
            key: 'addr',
            label: '주소 (도로명 또는 번지 주소 전체)',
            ph: '지도에서 위치를 지정하면 자동 입력됩니다',
            req: true,
          },
        ],
      },
    ],
  },
];

const STEP2: Section[] = [
  {
    title: '설치점 · 담당자',
    rows: [
      {
        cls: 'ti-g4',
        cols: 'repeat(4,minmax(0,1fr))',
        fields: [
          { key: 'installer', label: '설치점명', ph: '세움테크', req: true },
          { key: 'installer2', label: '설치점명2', ph: '협력 설치점' },
          { key: 'manager', label: '담당', ph: '이서준', req: true },
          { key: 'phone', label: '연락처', ph: '010-0000-0000', req: true, type: 'tel', autoComplete: 'tel' },
          { key: 'witness', label: '입회자', ph: '현장 입회자명' },
          {
            key: 'witnessPhone',
            label: '입회자 전화번호',
            ph: '010-0000-0000',
            type: 'tel',
            autoComplete: 'tel',
          },
          { key: 'worker1', label: '설치자1', ph: '곽민철' },
          { key: 'worker2', label: '설치자2', ph: '추가 설치자' },
        ],
      },
    ],
  },
];

const STEP3_DDL: Section[] = [
  {
    title: '제품 정보 · 도어록',
    rows: [
      {
        cls: 'ti-g4',
        cols: 'repeat(4,minmax(0,1fr))',
        fields: [
          { key: 'link', label: '(자사·타사) 제품 연동', opts: ['자사', '타사'], req: true },
          { key: 'linked', label: '연동 / 미연동', opts: ['연동', '미연동'], req: true },
          { key: 'HA / HN', label: 'HA / HN', opts: ['HA', 'HN', 'SA', '해당없음'], extra: true },
          {
            key: 'other',
            label: '타사 제품',
            opts: ['타사A', '타사B', '타사C', '타사D', '타사E', '타사F', '자사'],
          },
          { key: 'dev1', label: '자사 세대기기1', ph: 'HD-700W' },
          {
            key: 'board',
            label: '도어록보드',
            opts: ['DLB-100/IC', 'DLB-100', 'DLB-100/DS', 'DLB-200/CN', 'WI-FI'],
            req: true,
          },
          {
            key: 'strike',
            label: '스트라이크 Type',
            opts: ['Z28', 'Z29', 'Z30', 'Z31', 'ASR400', '일반'],
            req: true,
          },
          { key: 'qty', label: '수량 (세대)', ph: '452', req: true, type: 'number', unit: '세대', min: 1 },
        ],
      },
      {
        cls: 'ti-g6',
        cols: '2fr 1fr 1fr 2fr 1fr 1fr',
        fields: [
          { key: 'lock1', label: '도어록1 (플네임)', ph: 'DL-740/DS', req: true },
          { key: '도어록1 구분', label: '구분', ph: 'TYPE-A', extra: true },
          { key: '도어록1 수량', label: '수량', ph: '452', extra: true, type: 'number', min: 1 },
          { key: '도어록2 (플네임)', label: '도어록2 (플네임)', ph: 'DL-940/DS', extra: true },
          { key: '도어록2 구분', label: '구분', ph: 'TYPE-B', extra: true },
          { key: '도어록2 수량', label: '수량', ph: '12', extra: true, type: 'number', min: 1 },
        ],
      },
    ],
  },
];

const STEP3_HN: Section[] = [
  {
    title: '제품 정보 · 홈네트워크',
    rows: [
      {
        cls: 'ti-g4',
        cols: 'repeat(4,minmax(0,1fr))',
        fields: [
          { key: '제품군', label: '제품군', opts: ['HA', 'HN'], req: true, extra: true },
          { key: 'topology', label: '형태 (선로구성)', opts: ['BUS', 'LAN'], req: true },
          {
            key: 'main',
            label: '주장치 / 초소기',
            opts: ['HM-587', 'HM-587N', 'HM-587/ZK', 'HM-587N/ZK', 'HM-5810'],
            req: true,
          },
          {
            key: '주장치 / 초소기 수량',
            label: '수량',
            ph: '2',
            req: true,
            extra: true,
            type: 'number',
            unit: '대',
            min: 1,
          },
        ],
      },
    ],
  },
  {
    title: '세대기기',
    rows: [
      {
        cls: 'ti-g6',
        cols: '2fr 1fr 1fr 2fr 1fr 1fr',
        fields: [
          { key: 'dev1', label: '세대기기1', ph: 'HD-700', req: true },
          { key: '세대기기1 구분', label: '구분', opts: DEV_KIND, extra: true },
          { key: '세대기기1 수량', label: '수량', ph: '240', extra: true, type: 'number', min: 1 },
          { key: '세대기기2', label: '세대기기2', ph: 'HD-8820LM', extra: true },
          { key: '세대기기2 구분', label: '구분', opts: DEV_KIND, extra: true },
          { key: '세대기기2 수량', label: '수량', ph: '10', extra: true, type: 'number', min: 1 },
        ],
      },
      {
        cls: 'ti-g4',
        cols: 'repeat(4,minmax(0,1fr))',
        fields: [
          { key: '세대기기3 (인터폰)', label: '세대기기3 (인터폰)', ph: 'HD-3727EM', extra: true },
          { key: '세대기기3 수량', label: '수량', ph: '27', extra: true, type: 'number', unit: '대', min: 1 },
          { key: 'VERSION', label: 'VERSION', ph: 'FW: 2.2.0-1', extra: true },
          { key: 'ZBUS3 적용여부', label: 'ZBUS3 적용여부', opts: ONOFF, extra: true },
        ],
      },
    ],
  },
  {
    title: '부가장비 (HA/HN)',
    rows: [
      {
        cls: 'ti-g4',
        cols: 'repeat(4,minmax(0,1fr))',
        fields: [
          { key: '주방TV폰 / 수량', label: '주방TV폰 / 수량', ph: '모델 · 수량', extra: true },
          { key: '욕실폰(욕실비상) / 수량', label: '욕실폰(욕실비상) / 수량', ph: '모델 · 수량', extra: true },
          {
            key: '무선(AP·전화기)·라디오폰·비상폰',
            label: '무선(AP·전화기)·라디오폰·비상폰',
            ph: '모델 · 수량',
            extra: true,
          },
          { key: '기타1 (주차관제로비폰)', label: '기타1 (주차관제로비폰)', ph: '모델 · 수량', extra: true },
          { key: '난방', label: '난방', opts: ONOFF, extra: true },
          { key: '전등', label: '전등', opts: ONOFF, extra: true },
          { key: '가스', label: '가스', opts: ONOFF, extra: true },
          { key: '마스터 / 세대 / 초소기', label: '마스터 / 세대 / 초소기', ph: '구성 입력', extra: true },
        ],
      },
    ],
  },
  {
    title: '도어록 연동 · 로비폰 · 규모',
    rows: [
      {
        cls: 'ti-g4',
        cols: 'repeat(4,minmax(0,1fr))',
        fields: [
          { key: 'linked', label: '도어록 연동 여부', opts: ['연동', '미연동'], req: true },
          { key: 'lock1', label: '도어록 모델', ph: 'DL-740/DS' },
          { key: 'camera', label: '세대카메라', ph: 'CAM-812P' },
          { key: '세대카메라 수량', label: '수량', ph: '240', extra: true, type: 'number', unit: '대', min: 1 },
          { key: 'lobby', label: '로비폰', ph: 'LP-5380XL' },
          { key: '로비폰 수량', label: '수량', ph: '5', extra: true, type: 'number', unit: '대', min: 1 },
          { key: 'VDA 수량', label: 'VDA 수량', ph: '1', extra: true, type: 'number', unit: '대', min: 1 },
          { key: '자동문', label: '자동문', ph: '적용 여부 · 수량', extra: true },
          { key: 'dongs', label: '동수', ph: '9', req: true, type: 'number', unit: '개동', min: 1 },
          { key: 'qty', label: '총세대', ph: '1095', req: true, type: 'number', unit: '세대', min: 1 },
        ],
      },
    ],
  },
];

const STEP4: Section[] = [
  {
    title: '하자이행증권 · 하자보증기간',
    rows: [
      {
        cls: 'ti-g5',
        cols: '2fr 1fr 1fr 1fr 1fr',
        fields: [
          {
            key: 'bondNo',
            label: '하자이행증권 번호',
            ph: '제000-000-2026 0000 0001호',
            req: true,
            hint: "하자이행증권 발행 전이면 발행주체를 '미발행' 으로 두고 발행 후 재신청하세요",
          },
          { key: 'issuer', label: '발행주체', opts: ISSUERS, req: true },
          { key: 'months', label: '보증 (개월)', opts: ['36', '24', '12'], req: true },
          { key: 'from', label: '보증 시작일', ph: '2026.08.01', req: true, type: 'date' },
          { key: 'to', label: '보증 종료일', ph: '2029.07.31', req: true, type: 'date' },
        ],
      },
    ],
  },
  {
    title: '검사 요청',
    rows: [
      {
        cls: 'ti-g3b',
        cols: '1fr 1fr 2fr',
        fields: [
          {
            key: 'desiredDate',
            label: '1차이관 희망일자',
            ph: '2026.08.10',
            req: true,
            type: 'date',
            hint: '오늘 이후 날짜만 선택할 수 있습니다',
          },
          { key: 'desiredInspectType', label: '희망 검사종류', opts: ['서류검사', '샘플링검사'] },
          { key: 'occupancy', label: '입주율 / 시공 완료율', ph: '예: 입주율 92% · 시공 100%' },
        ],
      },
      {
        cls: '',
        cols: '',
        fields: [
          {
            key: 'memo',
            label: '비고 (현장 조건 및 특이 사항)',
            ta: true,
            ph: '현장 조건, 타사 하자 여부, 요청 사항 등을 기재',
          },
        ],
      },
    ],
  },
];

const ALL_SECTIONS = [...STEP1, ...STEP2, ...STEP3_DDL, ...STEP3_HN, ...STEP4];

function sectionsOf(step: number, product: ProductCode): Section[] {
  if (step === 1) return STEP1;
  if (step === 2) return STEP2;
  if (step === 3) return product === 'DDL' ? STEP3_DDL : STEP3_HN;
  return STEP4;
}

function fieldsOf(sections: Section[]): Fd[] {
  return sections.flatMap((s) => s.rows.flatMap((r) => r.fields));
}

/* ── 검증 ────────────────────────────────────────────────────────── */

type Vals = Record<string, string>;

/** 항목 정의 → validate() 가 보는 종류 */
function kindOf(f: Fd): FieldKind {
  if (f.opts && f.opts.length) return 'select';
  if (f.ta) return 'textarea';
  return (f.type ?? 'text') as FieldKind;
}

/**
 * 필수 여부는 값에 따라 달라진다 —
 * 발행주체가 '미발행' 이면 증권번호는 비워 두는 것이 정상이므로 필수에서 뺀다.
 */
function requiredOf(f: Fd, v: Vals): boolean {
  if (f.key === 'bondNo' && v.issuer === '미발행') return false;
  return !!f.req;
}

/**
 * 항목 간 관계 검증 (단계 4). 형식 검증을 통과한 뒤에만 본다.
 */
function relationError(key: string, v: Vals): string {
  if (key === 'to') {
    const { from, to } = v;
    if (isDate(from) && isDate(to) && !isBefore(from, to)) return '보증 시작일보다 뒤여야 합니다';
    return '';
  }
  if (key === 'desiredDate') {
    const d = v.desiredDate;
    if (isDate(d) && isBefore(d, today())) return '오늘 이후 날짜를 선택해 주세요';
    return '';
  }
  if (key === 'bondNo') {
    if (v.issuer === '미발행' && (v.bondNo ?? '').trim()) {
      return '발행주체가 미발행이면 하자이행증권 번호를 비워 두세요';
    }
    return '';
  }
  return '';
}

/** 한 항목의 오류 문구 — 없으면 빈 문자열 */
function errorOf(f: Fd, v: Vals): string {
  const bad = validateField(f.label, v[f.key] ?? '', {
    kind: kindOf(f),
    required: requiredOf(f, v),
    min: f.min,
    max: f.max,
  });
  return bad || relationError(f.key, v);
}

/** 값을 고치면 그 항목과 함께 지워야 할 이웃 항목 */
const LINKED: Record<string, string[]> = {
  from: ['to'],
  to: ['from'],
  issuer: ['bondNo'],
  bondNo: ['issuer'],
};

/* ── 임시저장 ────────────────────────────────────────────────────── */

const DRAFT_KEY = 'ti:draft:new';

/** 브라우저에 남겨 두는 작성 중 신청서 */
interface Draft {
  v: Vals;
  step: number;
  product: ProductCode | '';
  loc: SiteLoc | null;
  at: number;
}

function readDraft(): Draft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    return d && typeof d === 'object' && d.v ? d : null;
  } catch {
    return null;
  }
}

function writeDraft(d: Draft): void {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* 저장 공간이 없거나 차단된 브라우저 — 임시저장만 포기한다 */
  }
}

function clearDraft(): void {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* 위와 같음 */
  }
}

/** 초안 저장 시각 'MM.DD HH:MM' */
function savedAtText(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 처음 열었을 때의 값 — 로그인 정보로 채워 두는 항목이 있다 */
function initialVals(me: MeDTO): Vals {
  const init: Vals = {};
  fieldsOf(ALL_SECTIONS).forEach((f) => {
    init[f.key] = '';
  });
  init.year = '2026년';
  init.months = '36';
  init.manager = me.name;
  init.phone = formatPhone(me.phone);
  return init;
}

/* ── 위저드 ──────────────────────────────────────────────────────── */

const STEP_LABELS = ['현장 기본정보', '설치점·담당자', '제품 정보', '보증·검사요청'];

/**
 * 단계 전환 — 다음 단계는 오른쪽에서, 이전 단계는 왼쪽에서 밀려 들어온다.
 * 방향(1 | -1)은 custom 으로 받는다.
 */
const stepSlide: Variants = {
  hidden: (d: number) => ({ opacity: 0, x: 12 * d }),
  show: { opacity: 1, x: 0, transition: { duration: DUR.base, ease: EASE } },
  exit: (d: number) => ({ opacity: 0, x: -12 * d, transition: { duration: DUR.fast, ease: EASE } }),
};

/** 제품 선택 카드 두 장을 순차로 등장시킨다 */
const pickGrid: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
  exit: { opacity: 0, transition: { duration: DUR.fast, ease: EASE } },
};

export function NewWizard({ me, draftId }: { me: MeDTO; draftId: string }) {
  const router = useRouter();
  const toast = useToast();

  const [product, setProduct] = useState<ProductCode | ''>('');
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [loc, setLoc] = useState<SiteLoc | null>(null);

  /** 단계 전환 방향 — 슬라이드가 어느 쪽에서 들어올지 정한다 */
  const dirRef = useRef(1);
  const goStep = (n: number) => {
    dirRef.current = n >= step ? 1 : -1;
    setStep(n);
  };

  /** 비교 기준이 되는 초기값 — 사용자가 뭔가 입력했는지 판단하는 데 쓴다 */
  const [base] = useState<Vals>(() => initialVals(me));
  const [values, setValues] = useState<Vals>(() => ({ ...base }));

  const [errors, setErrors] = useState<Record<string, string>>({});
  /** 오류가 난 항목으로 스크롤하기 위한 필드 컨테이너 */
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  /* ── 임시저장 · 이탈 보호 ────────────────────────────────────────
   * 41~58개 항목을 채우다 탭을 닫으면 전부 사라진다. 입력을 500ms 디바운스로
   * 브라우저에 담아 두고, 다시 들어오면 이어서 쓸지 물어본다.
   */
  /** 지난번에 저장해 둔 초안 — 사용자가 이어쓸지 정할 때까지 배너로 띄운다 */
  const [draft, setDraft] = useState<Draft | null>(null);
  /** 초안 확인이 끝나기 전에는 새 값으로 덮어쓰지 않는다 */
  const [ready, setReady] = useState(false);
  /** 제출·취소가 끝났으면 이탈 경고도 임시저장도 하지 않는다 */
  const [done, setDone] = useState(false);
  /** 취소 확인 2단계 — 푸터가 "정말 취소할까요?" 로 바뀐다 */
  const [askCancel, setAskCancel] = useState(false);

  /** 하나라도 손댄 것이 있는지 */
  const dirty = useMemo(
    () => !!product || !!loc || Object.keys(values).some((k) => (values[k] ?? '') !== (base[k] ?? '')),
    [values, base, product, loc],
  );

  useEffect(() => {
    const d = readDraft();
    if (d) setDraft(d);
    else setReady(true);
  }, []);

  /*
   * 배너를 띄워 둔 채로 새로 입력을 시작했다면 그 입력이 우선이다.
   * (묻는 동안 임시저장을 멈춰 두므로, 여기서 풀지 않으면 새 입력이 저장되지 않는다.)
   */
  useEffect(() => {
    if (!draft || !dirty) return;
    setDraft(null);
    setReady(true);
  }, [draft, dirty]);

  useEffect(() => {
    if (!ready || done || !dirty) return;
    const id = window.setTimeout(() => writeDraft({ v: values, step, product, loc, at: Date.now() }), 500);
    return () => window.clearTimeout(id);
  }, [ready, done, dirty, values, step, product, loc]);

  useEffect(() => {
    if (!dirty || done) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, done]);

  /** 저장된 초안 이어쓰기 */
  function resumeDraft() {
    if (!draft) return;
    setValues({ ...base, ...draft.v });
    setProduct(draft.product);
    dirRef.current = 1;
    setStep(draft.product ? Math.min(Math.max(draft.step, 1), 4) : 0);
    setLoc(draft.loc);
    setDraft(null);
    setReady(true);
  }

  /** 저장된 초안을 버리고 새로 시작 */
  function dropDraft() {
    clearDraft();
    setDraft(null);
    setReady(true);
  }

  /** 작성을 접고 목록으로 — 임시저장분도 함께 지운다 */
  function leave() {
    clearDraft();
    setDone(true);
    router.push('/applicant');
  }

  /** 값을 고치면 그 항목(과 짝이 되는 항목)의 오류는 즉시 지운다 */
  const set = (key: string) => (v: string) => {
    setValues((p) => ({ ...p, [key]: v }));
    setErrors((p) => {
      const keys = [key, ...(LINKED[key] ?? [])].filter((k) => p[k]);
      if (!keys.length) return p;
      const n = { ...p };
      keys.forEach((k) => delete n[k]);
      return n;
    });
  };

  /** 값이 확정될 때 그 항목만 다시 본다 */
  const recheck = (f: Fd) => () =>
    setErrors((p) => {
      const e = errorOf(f, values);
      if (!e && !p[f.key]) return p;
      const n = { ...p };
      if (e) n[f.key] = e;
      else delete n[f.key];
      return n;
    });

  const sections = useMemo(
    () => (step >= 1 ? sectionsOf(step, (product || 'DDL') as ProductCode) : []),
    [step, product],
  );

  /** 이 단계의 필수 항목 충족 현황 — 단계 표시줄에 '3/5 입력' 으로 붙는다 */
  const reqStat = useMemo(() => {
    const req = fieldsOf(sections).filter((f) => requiredOf(f, values));
    const done = req.filter((f) => !errorOf(f, values)).length;
    return { done, total: req.length };
  }, [sections, values]);

  function pick(p: ProductCode) {
    setProduct(p);
    goStep(1);
  }

  /**
   * 이 단계의 항목을 전부 검사해 인라인 오류를 채운다.
   * 토스트는 첫 오류 하나만 띄우고, 그 항목으로 스크롤한다.
   */
  function checkStep(): boolean {
    const fs = fieldsOf(sections);
    const found: Record<string, string> = {};
    fs.forEach((f) => {
      const e = errorOf(f, values);
      if (e) found[f.key] = e;
    });

    setErrors((p) => {
      const n = { ...p };
      fs.forEach((f) => delete n[f.key]);
      return { ...n, ...found };
    });

    const first = fs.find((f) => found[f.key]);
    if (!first) return true;

    toast(found[first.key]);
    refs.current[first.key]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return false;
  }

  async function submit() {
    if (busy || !product) return;
    const v = values;
    const num = (s: string) => Number(String(s).replace(/[^\d.-]/g, '')) || 0;

    const extra: Record<string, string> = {};
    fieldsOf(sectionsOf(3, product)).forEach((f) => {
      if (!f.extra) return;
      const val = v[f.key]?.trim();
      if (val) extra[f.key] = val;
    });

    const input: CreateApplicationInput = {
      product,
      year: v.year,
      channel: v.channel as ChannelLabel,
      code: v.code,
      moveIn: v.moveIn,
      site: v.site,
      owner: v.owner,
      pm: v.pm,
      zip: v.zip,
      region: v.region,
      addr: v.addr,
      lat: loc ? loc.lat : undefined,
      lng: loc ? loc.lng : undefined,

      installer: v.installer,
      installer2: v.installer2,
      manager: v.manager,
      phone: v.phone,
      witness: v.witness,
      witnessPhone: v.witnessPhone,
      worker1: v.worker1,
      worker2: v.worker2,

      qty: num(v.qty),

      link: v.link,
      linked: v.linked,
      board: v.board,
      strike: v.strike,
      other: v.other,
      lock1: v.lock1,

      topology: v.topology,
      main: v.main,
      dev1: v.dev1,
      camera: v.camera,
      lobby: v.lobby,
      dongs: num(v.dongs),

      bondNo: v.bondNo,
      issuer: v.issuer,
      months: num(v.months) || 36,
      from: v.from,
      to: v.to,

      desiredDate: v.desiredDate,
      desiredInspectType: (v.desiredInspectType || '') as InspectTypeLabel | '',
      occupancy: v.occupancy,
      memo: v.memo,
      extra,
    };

    setBusy(true);
    try {
      const r = await createApplicationAction(input);
      toast(r.toast);
      if (r.ok) {
        clearDraft();
        setDone(true);
      }
      if (r.ok && r.goto) router.push(r.goto);
      if (r.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function nextStep() {
    if (!checkStep()) return;
    if (step < 4) {
      goStep(step + 1);
      return;
    }
    void submit();
  }

  /** 항목 하나 — 오류 스크롤을 위해 컨테이너 ref 를 모아 둔다 */
  const renderField = (f: Fd) => (
    <div
      key={f.key + f.label}
      ref={(el) => {
        refs.current[f.key] = el;
      }}
      style={{ minWidth: 0 }}
    >
      <Field
        label={f.label}
        value={values[f.key] ?? ''}
        onChange={set(f.key)}
        onBlur={recheck(f)}
        ph={f.ph}
        opts={f.opts}
        ta={f.ta}
        req={requiredOf(f, values)}
        type={f.type}
        unit={f.unit}
        hint={f.hint}
        min={f.min}
        max={f.max}
        autoComplete={f.autoComplete}
        error={errors[f.key]}
      />
    </div>
  );

  const chips = STEP_LABELS.map((label, i) => {
    const n = i + 1;
    const on = step === n;
    /* 지나온 단계 — 클릭해서 되돌아갈 수 있다 (앞으로 건너뛰기는 막는다) */
    const passed = step > n;
    return {
      n: String(n),
      label,
      on,
      passed,
      fg: on ? '#1a52b6' : passed ? '#4a5460' : '#98a1ac',
      nbg: on || passed ? '#1f5fd0' : '#e8ebef',
      nfg: on || passed ? '#fff' : '#8b95a1',
      step: n,
    };
  });

  const dir = dirRef.current;
  const footNote =
    step === 4
      ? '제출 시 감독관에게 접수 알림이 발송됩니다'
      : '필수 항목(*) 입력 후 다음 단계로 이동하세요';
  const nextLabel = step === 4 ? '이관검사 신청 제출' : '다음';

  const locAddrText = loc ? loc.addr || '주소 미확인' : '위치가 지정되지 않았습니다';
  const locColor = loc ? '#1a1d21' : '#98a1ac';
  const locCoordText = loc
    ? `위도 ${loc.lat.toFixed(6)} · 경도 ${loc.lng.toFixed(6)}`
    : '좌표 —';
  const mapLinkUrl = loc
    ? `https://www.openstreetmap.org/?mlat=${loc.lat.toFixed(7)}&mlon=${loc.lng.toFixed(7)}#map=17/${loc.lat.toFixed(5)}/${loc.lng.toFixed(5)}`
    : '#';

  return (
    <div
      className="ti-page"
      style={{ padding: '24px 26px 44px', display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ font: "700 18px/1.2 'Noto Sans KR'", letterSpacing: '-.01em' }}>이관검사 신청</span>
        <span style={{ font: "400 12px/1.4 'Noto Sans KR'", color: '#6b7480' }}>
          제품군을 먼저 선택하면 해당 양식의 항목만 표시됩니다
        </span>
      </div>

      {/* 지난번에 쓰다 만 신청서가 있으면 이어서 쓸지 먼저 묻는다 */}
      <AnimatePresence initial={false}>
        {draft ? (
          <motion.div
            key="draftbar"
            variants={fade}
            initial="hidden"
            animate="show"
            exit="exit"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              padding: '11px 14px',
              background: '#eaf1fd',
              border: '1px solid #cfe0fa',
              borderRadius: 5,
            }}
          >
            <span style={{ font: "500 12.5px/1.4 'Noto Sans KR'", color: '#1a52b6' }}>
              작성 중이던 신청서가 있습니다
            </span>
            <span style={{ font: "400 11.5px/1.4 'Noto Sans KR'", color: '#6b7480' }}>
              {savedAtText(draft.at)} 저장
              {draft.product ? ` · ${draft.product === 'HN' ? 'HN / HA' : 'DDL'}` : ''}
            </span>
            <div style={{ flex: 1 }} />
            <motion.button
              {...pressable}
              type="button"
              onClick={resumeDraft}
              className="h-blue"
              style={{
                padding: '7px 14px',
                background: '#1f5fd0',
                color: '#fff',
                border: '1px solid #1f5fd0',
                borderRadius: 4,
                font: "500 12px/1.2 'Noto Sans KR'",
                cursor: 'pointer',
              }}
            >
              이어서 작성
            </motion.button>
            <motion.button
              {...pressable}
              type="button"
              onClick={dropDraft}
              style={{
                padding: '7px 14px',
                background: '#fff',
                color: '#1a52b6',
                border: '1px solid #cfe0fa',
                borderRadius: 4,
                font: "500 12px/1.2 'Noto Sans KR'",
                cursor: 'pointer',
              }}
            >
              새로 시작
            </motion.button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence mode="wait" custom={dir}>
        {step === 0 ? (
          <motion.div
            key="pick"
            className="ti-g2card"
            variants={pickGrid}
            initial="hidden"
            animate="show"
            exit="exit"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,420px))', gap: 14 }}
          >
            <ProductCard
              code="DDL"
              title="도어록 이관검사"
              desc="도어록보드 · 스트라이크 Type · 타사 제품 연동 · 도어록 플네임/수량 항목으로 구성 (41개 항목)"
              onPick={() => pick('DDL')}
            />
            <ProductCard
              code="HN / HA"
              title="홈네트워크 이관검사"
              desc="형태(선로구성) · 주장치/초소기 · 세대기기 · 부가장비 · 로비폰 · VDA · 동수/총세대 항목으로 구성 (58개 항목)"
              onPick={() => pick('HN')}
            />
          </motion.div>
        ) : (
          <motion.div
            key="form"
            custom={dir}
            variants={stepSlide}
            initial="hidden"
            animate="show"
            exit="exit"
            style={{ background: '#fff', border: '1px solid #dfe3e8', borderRadius: 6, overflow: 'hidden' }}
          >
            <div
              className="ti-stepbar"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 16px',
                borderBottom: '1px solid #eceff2',
                background: '#fbfbfc',
              }}
            >
              <span
                style={{
                  padding: '2px 7px',
                  border: '1px solid #cfe0fa',
                  background: '#eaf1fd',
                  borderRadius: 3,
                  font: "500 10.5px/1.6 'Roboto Mono',monospace",
                  color: '#1f5fd0',
                }}
              >
                {product === 'HN' ? 'HN / HA' : 'DDL'}
              </span>
              {chips.map((c) => (
                <motion.button
                  key={c.n}
                  type="button"
                  {...(c.passed ? pressable : {})}
                  onClick={() => {
                    if (c.passed) goStep(c.step);
                  }}
                  /*
                   * disabled 를 쓰면 전역 button:disabled 규칙(opacity .55)이 걸려
                   * 현재 단계 칩까지 흐려진다. 이동만 막고 모양은 그대로 둔다.
                   */
                  tabIndex={c.passed ? 0 : -1}
                  aria-current={c.on ? 'step' : undefined}
                  aria-disabled={!c.passed}
                  title={c.passed ? `${c.label} 단계로 돌아가기` : undefined}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '4px 10px 4px 6px',
                    borderRadius: 14,
                    background: 'transparent',
                    border: '1px solid transparent',
                    cursor: c.passed ? 'pointer' : 'default',
                  }}
                >
                  {/* 활성 칩 배경 — layoutId 로 칩 사이를 미끄러진다 */}
                  {c.on ? (
                    <motion.span
                      layoutId="stepchip"
                      transition={{ duration: DUR.base, ease: EASE }}
                      style={{
                        position: 'absolute',
                        inset: -1,
                        borderRadius: 14,
                        background: '#eaf1fd',
                        border: '1px solid #cfe0fa',
                      }}
                    />
                  ) : null}
                  <span
                    style={{
                      position: 'relative',
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      font: "500 10px/1 'Roboto Mono',monospace",
                      background: c.nbg,
                      color: c.nfg,
                    }}
                  >
                    {c.n}
                  </span>
                  <span
                    style={{ position: 'relative', font: "500 11.5px/1.2 'Noto Sans KR'", color: c.fg }}
                  >
                    {c.label}
                  </span>
                </motion.button>
              ))}
              <div style={{ flex: 1 }} />
              <span style={{ font: "400 11px/1.2 'Noto Sans KR'", color: '#8b95a1' }}>
                식별번호 {draftId} · 자동 생성
              </span>
              {reqStat.total ? (
                <span
                  style={{
                    font: "500 11px/1.2 'Noto Sans KR'",
                    color: reqStat.done === reqStat.total ? '#1f7a43' : '#9a5b12',
                  }}
                >
                  필수 {reqStat.done}/{reqStat.total} 입력
                </span>
              ) : null}
            </div>

            <AnimatePresence mode="wait" initial={false} custom={dir}>
              <motion.div
                key={step}
                custom={dir}
                variants={stepSlide}
                initial="hidden"
                animate="show"
                exit="exit"
                style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 22 }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {sections.map((sec) => (
                    <div key={sec.title} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <span style={{ font: "700 12px/1 'Noto Sans KR'", color: '#1a1d21' }}>{sec.title}</span>
                        <span style={{ flex: 1, height: 1, background: '#eceff2' }} />
                      </div>
                      {sec.rows.map((row, ri) =>
                        row.cols ? (
                          <div
                            key={ri}
                            className={row.cls}
                            style={{ display: 'grid', gridTemplateColumns: row.cols, gap: '14px 16px' }}
                          >
                            {row.fields.map(renderField)}
                          </div>
                        ) : (
                          <Fragment key={ri}>{row.fields.map(renderField)}</Fragment>
                        ),
                      )}

                      {step === 1 && sec.title === '현장 기본정보' ? (
                        <div
                          className="ti-locrow"
                          style={{
                            display: 'flex',
                            alignItems: 'stretch',
                            gap: 12,
                            padding: 12,
                            background: '#fbfbfc',
                            border: '1px solid #eceff2',
                            borderRadius: 5,
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1, minWidth: 0 }}>
                            <span style={{ font: "500 11.5px/1.2 'Noto Sans KR'", color: '#5b6672' }}>
                              현장 위치 <b style={{ color: '#1f5fd0', fontWeight: 500 }}>*</b>
                            </span>
                            <span style={{ font: "400 12.5px/1.5 'Noto Sans KR'", color: locColor }}>
                              {locAddrText}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ font: "400 11px/1.4 'Roboto Mono',monospace", color: '#8b95a1' }}>
                                {locCoordText}
                              </span>
                              {loc ? (
                                <a
                                  href={mapLinkUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    font: "500 11px/1.4 'Noto Sans KR'",
                                    color: '#1a52b6',
                                  }}
                                >
                                  <PinGlyph size={10} fill="#1f5fd0" />
                                  <span>지도에서 열기</span>
                                </a>
                              ) : null}
                            </div>
                          </div>
                          <motion.button
                            {...pressable}
                            onClick={() => setMapOpen(true)}
                            className="h-blue"
                            style={{
                              alignSelf: 'center',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 9,
                              height: 40,
                              padding: '0 16px',
                              background: '#1f5fd0',
                              color: '#fff',
                              border: 0,
                              borderRadius: 6,
                              font: "500 13px/1.2 'Noto Sans KR'",
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <PinGlyph size={15} fill="#fff" />
                            <span>지도에서 위치 지정</span>
                          </motion.button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>

            <div
              className="ti-formfoot"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '13px 16px',
                borderTop: '1px solid #eceff2',
                background: '#fbfbfc',
              }}
            >
              {/*
               * 취소는 2단계로 받는다 — 41~58개 항목을 채운 뒤 잘못 누르면
               * 전부 사라지므로, 입력이 있으면 푸터가 확인 문구로 바뀐다.
               */}
              {askCancel ? (
                <>
                  <span style={{ font: "500 12.5px/1.3 'Noto Sans KR'", color: '#9a5b12' }}>
                    작성 중인 내용이 사라집니다. 취소할까요?
                  </span>
                  <div style={{ flex: 1 }} />
                  <motion.button
                    {...pressable}
                    type="button"
                    onClick={() => setAskCancel(false)}
                    style={{
                      padding: '8px 14px',
                      background: '#fff',
                      color: '#3c4652',
                      border: '1px solid #d3d8de',
                      borderRadius: 4,
                      font: "500 12.5px/1.2 'Noto Sans KR'",
                      cursor: 'pointer',
                    }}
                  >
                    아니오
                  </motion.button>
                  <motion.button
                    {...pressable}
                    type="button"
                    onClick={leave}
                    style={{
                      padding: '8px 18px',
                      background: '#fbf1e5',
                      color: '#9a5b12',
                      border: '1px solid #f0dcc2',
                      borderRadius: 4,
                      font: "500 12.5px/1.2 'Noto Sans KR'",
                      cursor: 'pointer',
                    }}
                  >
                    예, 취소합니다
                  </motion.button>
                </>
              ) : (
                <>
                  <motion.button
                    {...pressable}
                    type="button"
                    onClick={() => (dirty ? setAskCancel(true) : leave())}
                    style={{
                      padding: '8px 14px',
                      background: '#fff',
                      color: '#5b6672',
                      border: '1px solid #d3d8de',
                      borderRadius: 4,
                      font: "500 12.5px/1.2 'Noto Sans KR'",
                      cursor: 'pointer',
                    }}
                  >
                    취소
                  </motion.button>
                  <div style={{ flex: 1 }} />
                  <span style={{ font: "400 11.5px/1.2 'Noto Sans KR'", color: '#8b95a1' }}>
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span key={footNote} variants={fade} initial="hidden" animate="show" exit="exit">
                        {footNote}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                  {/* 1단계의 "이전" 은 제품군 선택으로 돌아간다 — 입력값은 그대로 둔다 */}
                  <motion.button
                    {...pressable}
                    type="button"
                    onClick={() => goStep(step - 1)}
                    style={{
                      padding: '8px 14px',
                      background: '#fff',
                      color: '#3c4652',
                      border: '1px solid #d3d8de',
                      borderRadius: 4,
                      font: "500 12.5px/1.2 'Noto Sans KR'",
                      cursor: 'pointer',
                    }}
                  >
                    이전
                  </motion.button>
                  <motion.button
                    {...pressable}
                    type="button"
                    onClick={nextStep}
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
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span key={nextLabel} variants={fade} initial="hidden" animate="show" exit="exit">
                        {nextLabel}
                      </motion.span>
                    </AnimatePresence>
                  </motion.button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <MapPicker
        open={mapOpen}
        initial={loc}
        onClose={() => setMapOpen(false)}
        onSave={(l) => {
          setLoc(l);
          setValues((p) => ({ ...p, addr: l.addr || p.addr }));
          setMapOpen(false);
        }}
      />
    </div>
  );
}

function ProductCard({
  code,
  title,
  desc,
  onPick,
}: {
  code: string;
  title: string;
  desc: string;
  onPick: () => void;
}) {
  return (
    <motion.button
      variants={staggerItem}
      {...pressable}
      onClick={onPick}
      className="h-ring"
      style={{
        textAlign: 'left',
        padding: 20,
        background: '#fff',
        border: '1px solid #dfe3e8',
        borderRadius: 6,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
      }}
    >
      <span
        style={{
          font: "500 10.5px/1 'Roboto Mono',monospace",
          color: '#1f5fd0',
          letterSpacing: '.1em',
        }}
      >
        {code}
      </span>
      <span style={{ font: "700 16px/1.3 'Noto Sans KR'" }}>{title}</span>
      <span style={{ font: "400 11.5px/1.6 'Noto Sans KR'", color: '#6b7480' }}>{desc}</span>
    </motion.button>
  );
}
