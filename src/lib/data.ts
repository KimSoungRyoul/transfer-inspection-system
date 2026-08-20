/**
 * 조회 계층 — Prisma 레코드를 화면이 그대로 쓰는 DTO 로 옮긴다.
 *
 * 화면 로직(src/lib/view.ts)이 프로토타입과 같은 한글 라벨·'YYYY.MM.DD' 문자열을
 * 전제로 하므로 변환은 전부 여기서 끝낸다.
 */
import 'server-only';
import type { Prisma } from '@prisma/client';

import { prisma } from './db';
import { fmtDot } from './date';
import {
  CHANNEL_LABEL,
  INSPECT_TYPE_LABEL,
  RESULT_LABEL,
  STATUS_LABEL,
  type ApplicationDTO,
  type ExternalVisitDTO,
  type MeDTO,
  type NotifyChannel,
  type RoleKey,
} from './domain';

const include = {
  logs: { orderBy: { id: 'asc' } },
  notifications: { orderBy: { id: 'asc' } },
  inspector: { select: { name: true } },
  applicant: { select: { id: true, name: true, phone: true } },
} satisfies Prisma.ApplicationInclude;

/**
 * 목록 화면용 — 처리 이력과 통보 이력을 빼고 가져온다.
 *
 * 목록·캘린더·처리 드로어는 이력을 쓰지 않는데, 수백 건을 그릴 때 이 두 배열이
 * 클라이언트로 넘어가는 payload 의 대부분을 차지한다. 이력이 필요한 상세 화면은
 * getApplication() 으로 따로 가져간다.
 */
const includeLite = {
  inspector: { select: { name: true } },
  applicant: { select: { id: true, name: true, phone: true } },
} satisfies Prisma.ApplicationInclude;

type AppRow = Prisma.ApplicationGetPayload<{ include: typeof include }>;
type AppRowLite = Prisma.ApplicationGetPayload<{ include: typeof includeLite }>;

function toDTO(a: AppRow | AppRowLite, viewerId: number | null): ApplicationDTO {
  const lat = a.lat === null ? null : Number(a.lat);
  const lng = a.lng === null ? null : Number(a.lng);
  return {
    id: a.id,
    product: a.product,
    year: `${a.year}년`,
    site: a.site,
    owner: a.owner,
    pm: a.pm,
    channel: CHANNEL_LABEL[a.channel],
    code: a.code,
    moveIn: a.moveIn,

    installer: a.installer,
    manager: a.managerName,
    phone: a.managerPhone,
    qty: a.qty,
    region: a.region,
    zip: a.zip,
    addr: a.addr,
    latlng: lat !== null && lng !== null ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : '',

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
    dongs: a.dongs,

    installer2: a.installer2,
    witness: a.witness,
    witnessPhone: a.witnessPhone,
    worker1: a.worker1,
    worker2: a.worker2,

    desiredDate: fmtDot(a.desiredDate),
    desiredInspectType: a.desiredInspectType ? INSPECT_TYPE_LABEL[a.desiredInspectType] : '',
    occupancy: a.occupancy,
    extra: (a.extra as Record<string, string> | null) ?? {},

    status: STATUS_LABEL[a.status],
    reqDate: fmtDot(a.reqDate),
    visitDate: fmtDot(a.visitDate),
    inspectType: a.inspectType ? INSPECT_TYPE_LABEL[a.inspectType] : '',
    first: a.firstResult ? RESULT_LABEL[a.firstResult] : '',
    final: a.finalResult ? RESULT_LABEL[a.finalResult] : '',
    inspector: a.inspector?.name ?? '',
    memo: a.memo,

    bondNo: a.bondNo,
    issuer: a.issuer,
    months: a.months,
    from: fmtDot(a.bondFrom),
    to: fmtDot(a.bondTo),

    revComment: a.revComment,
    firstComment: a.firstComment,
    finalComment: a.finalComment,

    log: 'logs' in a ? a.logs.map((l) => ({ at: fmtDot(l.at), who: l.who, txt: l.txt })) : [],
    notifs:
      'notifications' in a
        ? a.notifications.map((n) => ({
            ch: n.channel as NotifyChannel,
            txt: n.txt,
            at: fmtDot(n.at),
          }))
        : [],

    mine: viewerId !== null && a.applicantId === viewerId,
  };
}

/**
 * 신청 목록.
 * 감독관은 전 건, 신청자는 본인이 올린 건만 본다.
 */
export async function listApplications(
  viewer: { id: number; role: RoleKey } | null,
): Promise<ApplicationDTO[]> {
  const where: Prisma.ApplicationWhereInput =
    viewer && viewer.role === 'applicant' ? { applicantId: viewer.id } : {};

  const rows = await prisma.application.findMany({
    where,
    include: includeLite,
    orderBy: [{ reqDate: 'desc' }, { id: 'desc' }],
  });
  return rows.map((r) => toDTO(r, viewer?.id ?? null));
}

/** 감독관 동선 계산에는 다른 신청자의 건까지 필요하다. */
export async function listAllVisits(): Promise<ApplicationDTO[]> {
  const rows = await prisma.application.findMany({
    include: includeLite,
    orderBy: [{ reqDate: 'desc' }],
  });
  return rows.map((r) => toDTO(r, null));
}

export async function getApplication(
  id: string,
  viewerId: number | null,
): Promise<ApplicationDTO | null> {
  const row = await prisma.application.findUnique({ where: { id }, include });
  return row ? toDTO(row, viewerId) : null;
}

export async function listExternalVisits(): Promise<ExternalVisitDTO[]> {
  const rows = await prisma.externalVisit.findMany({ orderBy: [{ date: 'asc' }, { time: 'asc' }] });
  return rows.map((o) => ({
    d: fmtDot(o.date),
    t: o.time,
    site: o.site,
    region: o.region,
    product: o.product,
    installer: o.installer,
    manager: o.manager,
  }));
}

export async function getMe(uid: number): Promise<MeDTO | null> {
  const u = await prisma.user.findUnique({ where: { id: uid } });
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    org: u.org,
    initial: u.name.slice(0, 1),
    role: u.role === 'SUPERVISOR' ? 'supervisor' : 'applicant',
    phone: u.phone,
  };
}

/** 다음 식별번호 — '2026' + 4자리 일련번호 */
export async function nextApplicationId(year: number): Promise<string> {
  const prefix = String(year);
  const last = await prisma.application.findFirst({
    where: { id: { startsWith: prefix } },
    orderBy: { id: 'desc' },
    select: { id: true },
  });
  const n = last ? Number(last.id.slice(prefix.length)) + 1 : 1;
  return prefix + String(n).padStart(4, '0');
}
