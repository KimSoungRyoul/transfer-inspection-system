/**
 * 신규 신청 마법사가 브라우저에 남겨 두는 작성 중 신청서.
 *
 * 마법사(NewWizard)와 목록의 "이 내용으로 다시 신청"(ListClient)이 같은 저장소를
 * 나눠 쓰므로 키와 형식을 한곳에 모은다. 목록 화면이 마법사 모듈(지도·leaflet 포함)을
 * 통째로 끌어오지 않게 하려는 목적도 있다.
 */
import type { ApplicationDTO, ProductCode } from '@/lib/domain';
import type { SiteLoc } from './MapPicker';

/** 항목 키 → 입력값. 키는 마법사 항목 정의(Fd.key)와 같다. */
export type Vals = Record<string, string>;

const DRAFT_KEY = 'ti:draft:new';

export interface Draft {
  v: Vals;
  step: number;
  product: ProductCode | '';
  loc: SiteLoc | null;
  at: number;
  /** 지난 신청 건을 복사해 온 초안이면 그 출처 — 배너 문구가 달라진다 */
  from?: { id: string; status: string };
}

export function readDraft(): Draft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    return d && typeof d === 'object' && d.v ? d : null;
  } catch {
    return null;
  }
}

export function writeDraft(d: Draft): void {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* 저장 공간이 없거나 차단된 브라우저 — 임시저장만 포기한다 */
  }
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* 위와 같음 */
  }
}

/** '37.123456, 127.123456' → 지도 핀. 좌표 없이 저장된 건이 많아 실패는 정상이다. */
function parseLatLng(latlng: string, addr: string): SiteLoc | null {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(latlng ?? '');
  return m ? { lat: Number(m[1]), lng: Number(m[2]), addr } : null;
}

/**
 * 지난 신청 건을 초안으로 되돌린다 — 불합격·이월 뒤 "이 내용으로 다시 신청" 용.
 *
 * 불합격 건은 현장·제품 구성이 그대로인 채 재시공만 한 것이라, 41~58개 항목을
 * 처음부터 다시 치게 두면 오타가 섞이고 그 자체가 재신청을 막는 장벽이 된다.
 * extra 는 라벨을 키로 저장해 두므로 항목 키와 그대로 맞아떨어진다.
 */
export function draftFromApplication(a: ApplicationDTO): Draft {
  const num = (n: number): string => (n ? String(n) : '');
  const v: Vals = {
    ...a.extra,
    year: a.year,
    channel: a.channel,
    code: a.code,
    moveIn: a.moveIn,
    site: a.site,
    owner: a.owner,
    pm: a.pm,
    zip: a.zip,
    region: a.region,
    addr: a.addr,

    installer: a.installer,
    installer2: a.installer2,
    manager: a.manager,
    phone: a.phone,
    witness: a.witness,
    witnessPhone: a.witnessPhone,
    worker1: a.worker1,
    worker2: a.worker2,

    qty: num(a.qty),
    link: a.link,
    linked: a.linked,
    board: a.board,
    strike: a.strike,
    other: a.other,
    lock1: a.lock1,
    topology: a.topology,
    main: a.main,
    dev1: a.dev1,
    camera: a.camera,
    lobby: a.lobby,
    dongs: num(a.dongs),

    bondNo: a.bondNo,
    issuer: a.issuer,
    months: num(a.months) || '36',
    from: a.from,
    to: a.to,

    /* 지난번 희망일자는 이미 지난 날짜다. 남겨 두면 제출 직전에 오류로 막힌다. */
    desiredDate: '',
    desiredInspectType: a.desiredInspectType,
    occupancy: a.occupancy,
    memo: a.memo,
  };

  return {
    v,
    step: 1,
    product: a.product,
    loc: parseLatLng(a.latlng, a.addr),
    at: Date.now(),
    from: { id: a.id, status: a.status },
  };
}
