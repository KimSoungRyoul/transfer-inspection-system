/**
 * 샘플 신청 건 생성기 — 프로토타입의 12건 위에 대량의 더미 데이터를 얹는다.
 *
 * 커밋되는 init SQL(docker/initdb)의 원본이 되므로 **결정적**이어야 한다.
 * Math.random 대신 고정 시드 PRNG 를 쓰고, 같은 입력이면 항상 같은 결과가 나온다.
 */

import type { InspectTypeLabel, ResultLabel, StatusLabel } from '../src/lib/domain';

export interface RawLog {
  at: string;
  who: string;
  txt: string;
}

export interface RawApp {
  id: string;
  product: 'DDL' | 'HN';
  year: string;
  site: string;
  owner: string;
  pm: string;
  channel: '직판' | '유통';
  code: string;
  moveIn: string;
  installer: string;
  manager: string;
  phone: string;
  qty: number;
  region: string;
  zip: string;
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
  log: RawLog[];
  revComment?: string;
  firstComment?: string;
  finalComment?: string;
  occupancy?: string;
}

/* ── 결정적 난수 ──────────────────────────────────────────────────── */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── 어휘 사전 ───────────────────────────────────────────────────── */

const OWNERS = [
  '한빛건설', '새롬건설', '도담건설', '온누리건설', '두레엔지니어링', '미르건설',
  '아람종합건설', '보람건설', '나눔건설', '슬기건설', '예람건설', '다솜건설',
  '이룸중공업', '하람건설', '세움건설', '청우건설', '가온종합건설', '벼리건설',
  '해든건설', '너울산업개발', '큰들건설', '마루종합건설', '단하건설', '윤슬디앤씨',
];

const SUFFIX = [
  '리버파크', '센트럴시티', '더퍼스트', '스카이뷰', '포레나', '에듀타운',
  '레이크뷰', '프라임', '아이파크뷰', '메트로시티', '그린빌리지', '하이엔드',
  '스테이트', '캐슬', '루체하임', '아르떼', '파크뷰', '더샵스퀘어',
];

const REGIONS: [string, string][] = [
  ['파주시', '10000'], ['화성시', '18000'], ['오산시', '18100'], ['청주시', '28400'],
  ['광주 서구', '61900'], ['서울 중랑구', '02100'], ['대구 달서구', '42700'], ['안성시', '17500'],
  ['인천 남동구', '21500'], ['서울 금천구', '08600'], ['수원시', '16300'], ['고양시', '10400'],
  ['성남시', '13500'], ['천안시', '31100'], ['용인시', '16900'], ['김포시', '10100'],
  ['부산 해운대구', '48000'], ['대전 유성구', '34100'], ['울산 남구', '44700'], ['창원시', '51500'],
  ['전주시', '55000'], ['제주시', '63200'], ['평택시', '17800'], ['시흥시', '15000'],
  ['남양주시', '12200'], ['광명시', '14200'], ['안산시', '15400'], ['원주시', '26300'],
];

/** 지역 → 광역 접두어 */
const PROVINCE: Record<string, string> = {
  파주시: '경기', 화성시: '경기', 오산시: '경기', 안성시: '경기', 수원시: '경기',
  고양시: '경기', 성남시: '경기', 용인시: '경기', 김포시: '경기', 평택시: '경기',
  시흥시: '경기', 남양주시: '경기', 광명시: '경기', 안산시: '경기',
  청주시: '충북', 천안시: '충남', 원주시: '강원', 창원시: '경남', 전주시: '전북',
  제주시: '제주',
};

const INSTALLERS = [
  ['세움테크', '이서준'], ['우진테크', '임재훈'], ['도담티엔엠', '윤성재'], ['한결이엔지', '서다은'],
  ['가람정보통신', '노태윤'], ['케이엠', '배준영'], ['다온정보통신', '문수빈'], ['에스디티', '신동주'],
  ['새길정보통신', '황보람'], ['남부네트존', '심우재'], ['우리아이엔디', '하은채'], ['한솔산업', '백승우'],
  ['대성통신', '곽민철'], ['미래정보통신', '차유진'], ['정우시스템', '남기현'], ['한빛네트웍스', '독고현'],
];

const PMS = ['한도현', '강하늘', '오세영', '전상우', '안세림', '유진호', '정민우', '조현규', '구본영'];

const ISSUERS = [
  '이행보증보험', '종합보증보험', '통신공제조합', '산업공제조합', '소프트웨어공제회', '건설공제회',
];

const DDL_BOARD = ['DLB-100/IC', 'DLB-100', 'DLB-100/DS', 'DLB-200/CN', 'WI-FI'];
const DDL_STRIKE = ['Z28', 'Z29', 'Z30', 'Z31', 'ASR400', '일반'];
const DDL_OTHER = ['타사A', '타사B', '타사C', '타사D', '타사E', '자사'];
const DDL_LOCK = ['DL-710/DS', 'DL-715', 'DL-740/DS', 'DL-940/DS', 'DL-710/NP', 'DLB-100'];

const HN_MAIN = ['HM-587', 'HM-587N', 'HM-587/ZK', 'HM-587N/ZK', 'HM-5810'];
const HN_DEV = ['HD-700', 'HD-810', 'HD-3527', 'HD-3625', 'HD-8820'];
const HN_CAM = ['CAM-810P', 'CAM-812P', 'CAM-812N', 'CAM-812W', 'CAM-820FR'];
const HN_LOBBY = ['LP-5380XL', 'LP-5380NL', 'LP-5380FR', 'LP-5380XL/ZK', 'LP-5380NL/ZK'];

/* ── 날짜 유틸 (UTC 고정) ────────────────────────────────────────── */

const dot = (d: Date): string =>
  `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}`;
const ym = (d: Date): string => `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * 86400000);

/* ── 생성 ────────────────────────────────────────────────────────── */

/**
 * @param count  생성할 건수
 * @param today  기준일 'YYYY.MM.DD' — 상태 분포를 이 날짜 기준으로 정한다
 * @param seed   PRNG 시드. 고정하면 항상 같은 데이터가 나온다
 */
export function generateSamples(count: number, today: string, seed = 20260726): RawApp[] {
  const rnd = mulberry32(seed);
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
  const int = (min: number, max: number): number => min + Math.floor(rnd() * (max - min + 1));

  const [ty, tm, td] = today.split('.').map(Number);
  const TODAY = new Date(Date.UTC(ty, tm - 1, td));

  const out: RawApp[] = [];
  const perYear: Record<number, number> = { 2024: 1000, 2025: 1000, 2026: 1000 };

  for (let i = 0; i < count; i++) {
    // 신청일: 오늘로부터 5 ~ 900일 전. 최근일수록 촘촘하게 뽑아 진행중 건이 충분히 생긴다.
    const ageBias = rnd();
    const age = ageBias < 0.35 ? int(2, 60) : ageBias < 0.65 ? int(61, 300) : int(301, 900);
    const reqD = addDays(TODAY, -age);
    const year = reqD.getUTCFullYear();

    const id = `${year}${++perYear[year]}`;
    const product: 'DDL' | 'HN' = rnd() < 0.52 ? 'DDL' : 'HN';
    const [region, zip] = pick(REGIONS);
    const owner = pick(OWNERS);
    const [installer, manager] = pick(INSTALLERS);
    const managerIdx = INSTALLERS.findIndex((x) => x[0] === installer);
    const prov = PROVINCE[region] ?? '';
    const isOld = rnd() < 0.12; // 기축 현장
    const site =
      (isOld ? `[${product === 'HN' ? 'HN' : 'HA'}]기축 ` : '') +
      `${prov ? `${prov} ` : ''}${region.replace(/시$|구$/, (m) => (m === '시' ? '' : '구'))} ${owner} ${owner.replace(/(건설|종합건설|엔지니어링|중공업|산업개발|디앤씨)$/, '')}${pick(SUFFIX)}`;

    const qty = int(40, 1400);
    const moveInD = addDays(reqD, -int(20, 400));

    /* 상태 — 신청일이 오래됐을수록 완료 쪽으로 */
    let status: StatusLabel;
    if (age <= 7) status = rnd() < 0.7 ? '신청완료' : '검토예정';
    else if (age <= 20) status = pick<StatusLabel>(['검토예정', '검토승인', '보완요청', '신청완료']);
    else if (age <= 45) status = pick<StatusLabel>(['검토승인', '최종판정대기', '보완요청', '최종합격']);
    else {
      const r = rnd();
      status = r < 0.55 ? '최종합격' : r < 0.7 ? '조건부합격' : r < 0.8 ? '불합격' : r < 0.9 ? '보류' : '이월';
    }

    const done = ['최종합격', '조건부합격', '불합격', '보류', '이월'].includes(status);
    const hasVisit = done || status === '검토승인' || status === '검토예정' || status === '최종판정대기';
    const visitD = hasVisit ? addDays(reqD, int(8, 28)) : null;
    const inspectType: '' | InspectTypeLabel = hasVisit
      ? rnd() < 0.45
        ? '서류검사'
        : '샘플링검사'
      : '';

    const RESULT_OF: Partial<Record<StatusLabel, ResultLabel>> = {
      최종합격: '합격', 조건부합격: '조건부합격', 불합격: '불합격', 보류: '보류', 이월: '이월',
    };
    const final: '' | ResultLabel = done ? (RESULT_OF[status] ?? '') : '';
    const first: '' | ResultLabel =
      status === '최종판정대기' ? pick<ResultLabel>(['합격', '조건부합격', '보류']) : final;

    /* 하자이행증권 */
    const noBond = status === '보완요청' && rnd() < 0.6;
    const issuer = noBond ? '미발행' : pick(ISSUERS);
    const bondNo = noBond
      ? rnd() < 0.5 ? '미발행' : '입력 요망'
      : `제000-000-${year} ${String(int(1, 9999)).padStart(4, '0')} ${String(int(1, 9999)).padStart(4, '0')}호`;
    const months = pick([36, 36, 36, 24, 12]);
    const bondFrom = addDays(moveInD, int(0, 30));
    const bondTo = new Date(
      Date.UTC(bondFrom.getUTCFullYear() + Math.floor(months / 12), bondFrom.getUTCMonth(), bondFrom.getUTCDate() - 1),
    );

    /* 처리 이력 */
    const log: RawLog[] = [
      {
        at: dot(reqD),
        who: manager,
        txt: `이관검사 신청서 제출 (${product === 'DDL' ? 'DDL 양식 41개 항목' : 'HN 양식 58개 항목'})`,
      },
    ];
    let revComment = '';
    let firstComment = '';
    let finalComment = '';

    if (status === '보완요청') {
      log.push({
        at: dot(addDays(reqD, int(2, 6))),
        who: '박지훈 (감독관)',
        txt: noBond ? '보완요청 · 하자이행증권 미발행, 발행 후 재신청 요청' : '보완요청 · 신청 항목 누락',
      });
      revComment = noBond
        ? '하자이행증권 번호와 발행주체가 미입력입니다. 증권 발행 후 보증기간(시작/종료)까지 기재하여 재신청해 주세요.'
        : '제품 정보 항목에 누락이 있습니다. 보완 후 재신청해 주세요.';
    } else if (visitD) {
      const planAt = dot(addDays(reqD, int(2, 7)));
      if (status === '검토예정') {
        log.push({ at: planAt, who: '박지훈 (감독관)', txt: `검토예정 등록 · 방문예정일 ${dot(visitD)} (${inspectType})` });
        revComment = `${visitD.getUTCMonth() + 1}월 ${visitD.getUTCDate()}일 방문 예정입니다. 설치점 담당 입회 부탁드립니다.`;
      } else {
        log.push({ at: planAt, who: '박지훈 (감독관)', txt: `검토승인 · 방문예정일 ${dot(visitD)} 지정 (${inspectType})` });
        revComment =
          inspectType === '샘플링검사'
            ? '세대 샘플링 5% 진행하므로 설치점 담당 입회 필요합니다.'
            : '서류검사로 진행합니다. 준공도면과 시공 완료 확인서를 방문 전까지 업로드해 주세요.';

        if (first) {
          log.push({ at: dot(visitD), who: '박지훈 (감독관)', txt: `1차 판정 ${first} · ${inspectType}` });
          firstComment =
            first === '합격'
              ? '전 세대 통신·동작 양호.'
              : first === '조건부합격'
                ? `불량 ${int(1, 6)}세대 확인. 재시공 완료 후 최종 판정 예정입니다.`
                : first === '보류'
                  ? `입주율 ${int(60, 88)}%로 기준(90%) 미달. 차월 재검사 예정으로 보류합니다.`
                  : '시공 불량 다수 확인.';
        }
        if (final) {
          log.push({
            at: dot(addDays(visitD, int(0, 3))),
            who: '박지훈 (감독관)',
            txt: `최종 판정 ${final} · ${inspectType}`,
          });
          finalComment =
            final === '합격'
              ? '전 세대 정상 동작 확인. 이관 완료 처리합니다.'
              : final === '조건부합격'
                ? '지적 사항 재시공 조건으로 조건부합격 처리합니다.'
                : final === '불합격'
                  ? '시공 불량으로 불합격. 재시공 완료 후 이관검사를 재신청해 주세요.'
                  : final === '보류'
                    ? '입주율 미달로 차월 재검사 예정입니다.'
                    : '차년도로 이월 처리합니다.';
        }
      }
    }

    const base: RawApp = {
      id,
      product,
      year: `${year}년`,
      site,
      owner,
      pm: pick(PMS),
      channel: rnd() < 0.72 ? '직판' : '유통',
      code:
        product === 'DDL'
          ? `PRJ-${String(year).slice(2)}${String(int(1, 999)).padStart(4, '0')}`
          : `PRJ-HN-${int(1000, 1999)}-${pick(['A0', 'A1', 'B2', 'Z1'])}`,
      moveIn: ym(moveInD),
      installer,
      manager,
      phone: `010-1000-${String(managerIdx + 1).padStart(4, '0')}`,
      qty,
      region,
      zip,
      status,
      reqDate: dot(reqD),
      visitDate: visitD ? dot(visitD) : '',
      inspectType,
      first,
      final,
      inspector: '박지훈',
      memo: rnd() < 0.3 ? `입주율 ${int(85, 100)}% · 시공 ${int(95, 100)}%` : '',
      occupancy: `입주율 ${int(85, 100)}% · 시공 ${int(95, 100)}%`,
      bondNo,
      issuer,
      months,
      from: dot(bondFrom),
      to: dot(bondTo),
      log,
      revComment,
      firstComment,
      finalComment,
    };

    if (product === 'DDL') {
      Object.assign(base, {
        link: rnd() < 0.7 ? '타사' : '자사',
        linked: rnd() < 0.9 ? '연동' : '미연동',
        board: pick(DDL_BOARD),
        strike: pick(DDL_STRIKE),
        other: pick(DDL_OTHER),
        lock1: pick(DDL_LOCK),
      });
    } else {
      Object.assign(base, {
        topology: rnd() < 0.6 ? 'BUS' : 'LAN',
        main: pick(HN_MAIN),
        dev1: pick(HN_DEV),
        camera: pick(HN_CAM),
        lobby: pick(HN_LOBBY),
        dongs: int(1, 12),
      });
    }

    out.push(base);
  }

  return out;
}

/**
 * 데모 계정이 모든 단계를 겪어 볼 수 있게 보정한다.
 *
 * 생성기는 설치점을 무작위로 고르므로, 대표 신청자 계정(세움테크 이서준)에
 * 보완요청 건이 하나도 안 걸릴 수 있다. 그러면 로그인해도 "보완 후 재신청"
 * 흐름을 시연할 수 없다. 빠진 상태가 있으면 이 계정 건 중 하나를 그 상태로 돌린다.
 *
 * @param apps  기준 12건 + 생성분을 합친 목록 (제자리에서 고친다)
 * @param today 기준일 'YYYY.MM.DD'
 */
export function ensureDemoCoverage(apps: RawApp[], today: string): void {
  const DEMO_MANAGER = '이서준';
  /** 데모 계정이 최소 한 건씩은 가지고 있어야 할 단계 */
  const WANTED: StatusLabel[] = ['보완요청', '검토예정', '최종판정대기'];

  const mine = apps.filter((a) => a.manager === DEMO_MANAGER);
  const have = new Set(mine.map((a) => a.status));

  // 손대도 되는 후보 — 이미 판정이 끝나 흐름 시연에 쓰이지 않는 건부터
  const spare = mine.filter((a) => ['최종합격', '이월', '보류'].includes(a.status));

  for (const want of WANTED) {
    if (have.has(want)) continue;
    const target = spare.pop();
    if (!target) break;

    target.status = want;
    target.first = '';
    target.final = '';
    target.finalComment = '';
    target.log = target.log.slice(0, 1);

    if (want === '보완요청') {
      target.visitDate = '';
      target.inspectType = '';
      target.bondNo = '입력 요망';
      target.issuer = '미발행';
      target.revComment =
        '하자이행증권 번호와 발행주체가 미입력입니다. 증권 발행 후 보증기간(시작/종료)까지 기재하여 재신청해 주세요.';
      target.firstComment = '';
      target.log.push({
        at: today,
        who: '박지훈 (감독관)',
        txt: '보완요청 · 하자이행증권 미발행, 발행 후 재신청 요청',
      });
    } else if (want === '검토예정') {
      target.inspectType = target.inspectType || '샘플링검사';
      target.visitDate = target.visitDate || addDaysDot(today, 6);
      target.revComment = '방문 예정입니다. 설치점 담당 입회 부탁드립니다.';
      target.firstComment = '';
      target.log.push({
        at: today,
        who: '박지훈 (감독관)',
        txt: `검토예정 등록 · 방문예정일 ${target.visitDate} (${target.inspectType})`,
      });
    } else if (want === '최종판정대기') {
      target.inspectType = target.inspectType || '샘플링검사';
      target.visitDate = target.visitDate || addDaysDot(today, -3);
      target.first = '조건부합격';
      target.firstComment = '불량 3세대 확인. 재시공 완료 후 최종 판정 예정입니다.';
      target.log.push({
        at: target.visitDate,
        who: '박지훈 (감독관)',
        txt: `1차 판정 조건부합격 · ${target.inspectType}`,
      });
    }

    have.add(want);
  }

  /*
   * 증권 발행 전에는 합격 처리할 수 없다 — 이 시스템의 핵심 규칙이다.
   * 그런데 미발행 건이 전부 보완요청 단계에만 있으면 감독관이 판정 화면에서
   * 이 규칙이 걸리는 장면을 볼 일이 없다. 판정 가능한 단계에 한 건 남겨 둔다.
   */
  const JUDGEABLE: StatusLabel[] = ['검토승인', '최종판정대기'];
  const bondShown = apps.some((a) => JUDGEABLE.includes(a.status) && a.issuer === '미발행');
  if (!bondShown) {
    const target =
      mine.find((a) => a.status === '검토승인' && a.issuer !== '미발행') ??
      apps.find((a) => a.status === '검토승인' && a.issuer !== '미발행');
    if (target) {
      target.issuer = '미발행';
      target.bondNo = '입력 요망';
      target.from = '';
      target.to = '';
      target.log.push({
        at: today,
        who: '박지훈 (감독관)',
        txt: '방문 완료 · 하자이행증권 미발행 확인, 증권 발행 전까지 합격 처리 불가',
      });
    }
  }
}

/** 'YYYY.MM.DD' 에 일수를 더한다 */
function addDaysDot(s: string, n: number): string {
  const [y, m, d] = s.split('.').map(Number);
  return dot(addDays(new Date(Date.UTC(y, m - 1, d)), n));
}

/** 감독관 동선 참고용 외부 일정도 늘려 둔다 */
export function generateExternalVisits(
  count: number,
  today: string,
  seed = 777,
): { d: string; t: string; site: string; region: string; product: string; installer: string; manager: string }[] {
  const rnd = mulberry32(seed);
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
  const int = (min: number, max: number): number => min + Math.floor(rnd() * (max - min + 1));

  const [ty, tm, td] = today.split('.').map(Number);
  const TODAY = new Date(Date.UTC(ty, tm - 1, td));
  const TIMES = ['09:00', '09:30', '10:00', '13:00', '13:30', '15:30'];

  const out = [];
  for (let i = 0; i < count; i++) {
    const d = addDays(TODAY, int(0, 45));
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) continue; // 주말 방문은 없다
    const [region] = pick(REGIONS);
    const owner = pick(OWNERS);
    const [installer, manager] = pick(INSTALLERS);
    out.push({
      d: dot(d),
      t: pick(TIMES),
      site: `${PROVINCE[region] ? `${PROVINCE[region]} ` : ''}${region} ${owner} ${pick(SUFFIX)}`,
      region,
      product: rnd() < 0.5 ? 'DDL' : 'HN',
      installer,
      manager,
    });
  }
  return out.sort((a, b) => (a.d === b.d ? (a.t < b.t ? -1 : 1) : a.d < b.d ? -1 : 1));
}
