/**
 * 시드 — 프로토타입(index.html)의 더미 데이터를 그대로 DB 로 옮긴다.
 *
 * prisma/data/apps.json, external.json 은 tools/extract-seed.mjs 가
 * 프로토타입에서 뽑아낸 것이다. 여러 번 실행해도 같은 결과가 되도록 upsert 한다.
 */
import { PrismaClient, Role, type Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CHANNEL_ENUM,
  INSPECT_TYPE_ENUM,
  RESULT_ENUM,
  STATUS_ENUM,
  type ChannelLabel,
  type InspectTypeLabel,
  type ResultLabel,
  today,
  type StatusLabel,
} from '../src/lib/domain';
import { parseDot } from '../src/lib/date';
import {
  ensureDemoCoverage,
  generateExternalVisits,
  generateSamples,
  type RawApp,
  type RawLog,
} from './samples';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = <T,>(f: string): T => JSON.parse(fs.readFileSync(path.join(here, 'data', f), 'utf8')) as T;

interface RawExternal {
  d: string;
  t: string;
  site: string;
  region: string;
  product: string;
  installer: string;
  manager: string;
}

const prisma = new PrismaClient();

/** 데모 계정 비밀번호 — 전 계정 공통. README 에 안내된 값 */
const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? '1234';

/** 프로토타입 12건 위에 얹을 샘플 신청 건 수 (0 이면 원본 12건만) */
const SAMPLE_COUNT = Number(process.env.SEED_SAMPLES ?? 240);
/** 감독관 동선 참고용 외부 일정 추가 건수 */
const SAMPLE_VISITS = Number(process.env.SEED_VISITS ?? 60);

const SUPERVISOR = {
  email: 'user2@gmail.com',
  name: '박지훈',
  phone: '010-2000-0001',
  org: '서비스 준공검사팀 · 감독관',
} as const;


/** 설치점 담당자 → 로그인 계정. 이서준이 대표 신청자 계정(user1)이다. */
const APPLICANT_EMAIL: Record<string, string> = {
  이서준: 'user1@gmail.com',
  임재훈: 'jaehun.lim@example.com',
  윤성재: 'seongjae.yoon@example.com',
  서다은: 'daeun.seo@example.com',
  노태윤: 'taeyoon.noh@example.com',
  배준영: 'junyoung.bae@example.com',
  문수빈: 'subin.moon@example.com',
  신동주: 'dongju.shin@example.com',
  황보람: 'boram.hwang@example.com',
};

/** 프로토타입의 알림 파생 규칙을 그대로 옮긴다. */
function notificationsOf(a: RawApp): Prisma.NotificationCreateManyApplicationInput[] {
  const out: Prisma.NotificationCreateManyApplicationInput[] = [
    {
      channel: 'MAIL',
      txt: `이관검사 신청이 접수되었습니다 · 감독관 배정 ${a.inspector}`,
      at: parseDot(a.reqDate)!,
    },
  ];
  const second = a.log[1] ? a.log[1].at : a.reqDate;
  if (a.visitDate) {
    out.push({
      channel: 'SMS',
      txt: `검토승인 · 방문예정일 ${a.visitDate} (${a.inspectType || '검사종류 미정'})`,
      at: parseDot(second)!,
    });
  }
  if (a.status === '보완요청') {
    out.push({
      channel: 'MAIL',
      txt: '보완요청 · 하자이행증권 정보 보완 후 재신청 필요',
      at: parseDot(second)!,
    });
  }
  if (a.final) {
    out.push({
      channel: 'MAIL',
      txt: `최종 판정 ${a.final} 통보 · 신청자, 현장PM, 설치점 발송`,
      at: parseDot(a.log[a.log.length - 1].at)!,
    });
  }
  return out;
}

async function main() {
  // init SQL(docker/initdb) 이 이미 데이터를 넣어 둔 경우 중복 작업을 건너뛴다.
  if (process.env.SEED_ONLY_IF_EMPTY === '1' && (await prisma.application.count()) > 0) {
    const n = await prisma.application.count();
    console.log(`이미 신청 ${n}건이 있어 시드를 건너뜁니다 (init SQL 로 적재됨)`);
    return;
  }

  const curated = read<RawApp[]>('apps.json');
  const external = read<RawExternal[]>('external.json').concat(
    SAMPLE_VISITS > 0 ? generateExternalVisits(SAMPLE_VISITS, today()) : [],
  );
  // 프로토타입의 12건은 화면 시연용 기준 데이터라 그대로 두고, 그 위에 샘플을 얹는다.
  const apps = curated.concat(SAMPLE_COUNT > 0 ? generateSamples(SAMPLE_COUNT, today()) : []);
  // 데모 계정이 보완요청·검토예정·최종판정대기를 한 번씩은 겪어 볼 수 있게 맞춰 둔다
  ensureDemoCoverage(apps, today());
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  /* ── 계정 ── */
  const supervisor = await prisma.user.upsert({
    where: { email: SUPERVISOR.email },
    update: { name: SUPERVISOR.name, org: SUPERVISOR.org, phone: SUPERVISOR.phone, role: Role.SUPERVISOR },
    create: { ...SUPERVISOR, password: hash, role: Role.SUPERVISOR },
  });

  const byManager = new Map<string, number>();
  for (const a of apps) {
    if (byManager.has(a.manager)) continue;
    const email = APPLICANT_EMAIL[a.manager] ?? `${a.installer.toLowerCase().replace(/[^a-z0-9]/g, '') || 'partner'}${byManager.size + 1}@example.com`;
    const org = `${a.installer} · 이관검사 신청자`;
    const user = await prisma.user.upsert({
      where: { email },
      update: { name: a.manager, org, phone: a.phone, role: Role.APPLICANT },
      create: { email, name: a.manager, org, phone: a.phone, password: hash, role: Role.APPLICANT },
    });
    byManager.set(a.manager, user.id);
  }

  /* ── 신청 건 ── */
  for (const a of apps) {
    const applicantId = byManager.get(a.manager)!;
    const data = {
      product: a.product,
      year: Number(a.year.replace(/\D/g, '')),
      site: a.site,
      owner: a.owner,
      pm: a.pm,
      channel: CHANNEL_ENUM[a.channel],
      code: a.code,
      moveIn: a.moveIn,
      installer: a.installer,
      managerName: a.manager,
      managerPhone: a.phone,
      qty: a.qty,
      region: a.region,
      zip: a.zip,
      addr: '',
      lat: null,
      lng: null,
      link: a.link ?? '',
      linked: a.linked ?? '',
      board: a.board ?? '',
      strike: a.strike ?? '',
      other: a.other ?? '',
      lock1: a.lock1 ?? '',
      topology: a.topology ?? '',
      main: a.main ?? '',
      dev1: a.dev1 ?? '',
      camera: a.camera ?? '',
      lobby: a.lobby ?? '',
      dongs: a.dongs ?? 0,
      status: STATUS_ENUM[a.status],
      reqDate: parseDot(a.reqDate)!,
      visitDate: parseDot(a.visitDate),
      inspectType: a.inspectType ? INSPECT_TYPE_ENUM[a.inspectType] : null,
      firstResult: a.first ? RESULT_ENUM[a.first] : null,
      finalResult: a.final ? RESULT_ENUM[a.final] : null,
      memo: a.memo ?? '',
      occupancy: a.occupancy ?? '',
      revComment: a.revComment ?? '',
      firstComment: a.firstComment ?? '',
      finalComment: a.finalComment ?? '',
      bondNo: a.bondNo ?? '',
      issuer: a.issuer ?? '',
      months: a.months ?? 36,
      bondFrom: parseDot(a.from),
      bondTo: parseDot(a.to),
      applicantId,
      inspectorId: supervisor.id,
    } satisfies Omit<Prisma.ApplicationUncheckedCreateInput, 'id'>;

    await prisma.application.upsert({
      where: { id: a.id },
      update: data,
      create: { id: a.id, ...data },
    });

    // 이력·통보는 매번 새로 깐다 (upsert 시 중복 누적 방지)
    await prisma.applicationLog.deleteMany({ where: { applicationId: a.id } });
    await prisma.applicationLog.createMany({
      data: a.log.map((l) => ({ applicationId: a.id, at: parseDot(l.at)!, who: l.who, txt: l.txt })),
    });

    await prisma.notification.deleteMany({ where: { applicationId: a.id } });
    await prisma.notification.createMany({
      data: notificationsOf(a).map((n) => ({ ...n, applicationId: a.id })),
    });
  }

  /* ── 외부 방문 일정 ── */
  await prisma.externalVisit.deleteMany({});
  await prisma.externalVisit.createMany({
    data: external.map((o) => ({
      date: parseDot(o.d)!,
      time: o.t,
      site: o.site,
      region: o.region,
      product: o.product,
      installer: o.installer,
      manager: o.manager,
    })),
  });

  const [users, count, visits] = await Promise.all([
    prisma.user.count(),
    prisma.application.count(),
    prisma.externalVisit.count(),
  ]);
  console.log(
    `seed 완료 — 계정 ${users}명 / 신청 ${count}건 (기준 ${curated.length} + 샘플 ${SAMPLE_COUNT}) / 외부일정 ${visits}건`,
  );
  console.log(
    `로그인: 신청자 user1@gmail.com · 감독관 user2@gmail.com · 비밀번호 ${DEMO_PASSWORD}`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
