'use server';

/**
 * 서버 액션 — 화면의 모든 상태 변화를 여기서 처리한다.
 *
 * 반환값은 { ok, toast } 형태로 통일한다. 프로토타입이 처리 결과를 토스트로
 * 알려 주므로 클라이언트는 그 문구를 그대로 띄우기만 하면 된다.
 */
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';

import { prisma } from './db';
import { createSession, destroySession, readSession } from './session';
import { getMe, nextApplicationId } from './data';
import { parseDot, dowOf } from './date';
import {
  CHANNEL_ENUM,
  INSPECT_TYPE_ENUM,
  RESULT_ENUM,
  RESULT_TO_STATUS,
  STATUS_ENUM,
  today,
  type ChannelLabel,
  type InspectTypeLabel,
  type ResultLabel,
  type StatusEnum,
} from './domain';

export interface ActionResult {
  ok: boolean;
  toast: string;
  /** 신규 신청 등 이동이 필요한 경우 */
  goto?: string;
}

const fail = (toast: string): ActionResult => ({ ok: false, toast });
const done = (toast: string, goto?: string): ActionResult => ({ ok: true, toast, goto });

function revalidateAll(): void {
  revalidatePath('/', 'layout');
}

/* ── 인증 ────────────────────────────────────────────────────────── */

const loginSchema = z.object({
  email: z.string().trim().min(1, '이메일을 입력해 주세요').email('이메일 형식이 올바르지 않습니다'),
  password: z.string().min(1, '비밀번호를 입력해 주세요'),
  role: z.enum(['applicant', 'supervisor']),
  keepLogin: z.boolean().default(true),
});

export async function loginAction(input: unknown): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.errors[0].message);
  const { email, password, role, keepLogin } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return fail('이메일 또는 비밀번호가 올바르지 않습니다');
  }

  const actual = user.role === 'SUPERVISOR' ? 'supervisor' : 'applicant';
  if (actual !== role) {
    return fail(
      `${role === 'supervisor' ? '감독관' : '이관검사 신청자'} 권한이 없는 계정입니다 · ${
        actual === 'supervisor' ? '감독관으로' : '이관검사 신청자로'
      } 선택해 주세요`,
    );
  }

  await createSession({ uid: user.id, role: actual }, keepLogin);
  revalidateAll();
  return done(
    `${user.name}님, ${actual === 'supervisor' ? '감독관' : '이관검사 신청자'} 계정으로 로그인했습니다`,
    actual === 'supervisor' ? '/supervisor' : '/applicant',
  );
}

/** 데모용 Google 계정 선택 — 비밀번호 없이 해당 계정으로 진입한다 */
export async function googleLoginAction(email: string): Promise<ActionResult> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return fail('등록되지 않은 Google 계정입니다');
  const role = user.role === 'SUPERVISOR' ? 'supervisor' : 'applicant';
  await createSession({ uid: user.id, role, google: true }, true);
  revalidateAll();
  return done(`Google 계정 ${user.email} 으로 로그인했습니다`, role === 'supervisor' ? '/supervisor' : '/applicant');
}

const signupSchema = z
  .object({
    name: z.string().trim().min(1, '이름을 입력해 주세요'),
    phone: z.string().trim().default(''),
    email: z.string().trim().email('이메일 형식이 올바르지 않습니다'),
    org: z.string().trim().default(''),
    password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다'),
    password2: z.string(),
    role: z.enum(['applicant', 'supervisor']),
    agree: z.boolean(),
  })
  .refine((v) => v.agree, { message: '개인정보 수집·이용 동의가 필요합니다' })
  .refine((v) => v.password === v.password2, { message: '비밀번호가 일치하지 않습니다' });

export async function signupAction(input: unknown): Promise<ActionResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.errors[0].message);
  const { name, phone, email, org, password, role } = parsed.data;

  const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (exists) return fail('이미 가입된 이메일입니다');

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      name,
      phone,
      org: org || (role === 'supervisor' ? '서비스 준공검사팀 · 감독관' : '이관검사 신청자'),
      password: await bcrypt.hash(password, 10),
      role: role === 'supervisor' ? 'SUPERVISOR' : 'APPLICANT',
    },
  });

  await createSession({ uid: user.id, role }, true);
  revalidateAll();
  return done(
    `가입이 완료되었습니다 · ${role === 'supervisor' ? '감독관' : '이관검사 신청자'} 권한으로 로그인`,
    role === 'supervisor' ? '/supervisor' : '/applicant',
  );
}

export async function logoutAction(): Promise<ActionResult> {
  await destroySession();
  revalidateAll();
  return done('로그아웃되었습니다');
}

/* ── 권한 확인 ───────────────────────────────────────────────────── */

async function requireSupervisor() {
  const s = await readSession();
  if (!s || s.role !== 'supervisor') return null;
  return getMe(s.uid);
}

async function requireApplicant() {
  const s = await readSession();
  if (!s || s.role !== 'applicant') return null;
  return getMe(s.uid);
}

/** 처리 이력 한 줄 추가 */
function logEntry(who: string, txt: string): Prisma.ApplicationLogCreateWithoutApplicationInput {
  return { at: parseDot(today())!, who, txt };
}

function notifyEntry(
  channel: 'MAIL' | 'SMS',
  txt: string,
): Prisma.NotificationCreateWithoutApplicationInput {
  return { channel, txt, at: parseDot(today())! };
}

/* ── 감독관: 검토예정 등록 ───────────────────────────────────────── */

const reviewSchema = z.object({
  id: z.string().min(1),
  visitDate: z.string().min(1, '방문예정일을 선택해 주세요'),
  inspectType: z.enum(['서류검사', '샘플링검사']),
  revComment: z.string().default(''),
});

export async function schedulePlanAction(input: unknown): Promise<ActionResult> {
  const me = await requireSupervisor();
  if (!me) return fail('감독관 권한이 필요합니다');
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.errors[0].message);
  const { id, visitDate, inspectType, revComment } = parsed.data;

  const d = parseDot(visitDate);
  if (!d) return fail('방문예정일을 선택해 주세요');
  const dot = visitDate.replace(/-/g, '.');

  const app = await prisma.application.findUnique({ where: { id } });
  if (!app) return fail('신청 건을 찾을 수 없습니다');
  if (!['SUBMITTED', 'FIX_REQUESTED', 'REVIEW_PLANNED'].includes(app.status)) {
    return fail('이미 검토승인 이후 단계인 신청 건입니다');
  }

  await prisma.application.update({
    where: { id },
    data: {
      status: 'REVIEW_PLANNED',
      visitDate: d,
      inspectType: INSPECT_TYPE_ENUM[inspectType],
      revComment,
      inspectorId: me.id,
      logs: {
        create: [
          logEntry(
            `${me.name} (감독관)`,
            `검토예정 등록 · 방문예정일 ${dot} (${inspectType})`,
          ),
        ],
      },
      notifications: {
        create: [notifyEntry('SMS', `검토예정 등록 · 방문예정일 ${dot} (${inspectType})`)],
      },
    },
  });

  revalidateAll();
  return done(
    `검토예정으로 변경 · 방문예정일 ${dot} ${dowOf(dot)}요일 · 신청자에게 일정 통보`,
  );
}

/* ── 감독관: 검토승인 ────────────────────────────────────────────── */

const approveSchema = reviewSchema.extend({
  notifyEmail: z.boolean().default(true),
  notifySms: z.boolean().default(true),
});

export async function approveReviewAction(input: unknown): Promise<ActionResult> {
  const me = await requireSupervisor();
  if (!me) return fail('감독관 권한이 필요합니다');
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.errors[0].message);
  const { id, visitDate, inspectType, revComment, notifyEmail, notifySms } = parsed.data;

  const d = parseDot(visitDate);
  if (!d) return fail('방문예정일을 선택해 주세요');
  const dot = visitDate.replace(/-/g, '.');

  const app = await prisma.application.findUnique({ where: { id } });
  if (!app) return fail('신청 건을 찾을 수 없습니다');
  if (!APPROVABLE.includes(app.status)) {
    return fail('이미 검토승인 이후 단계인 신청 건입니다');
  }

  const channels: Prisma.NotificationCreateWithoutApplicationInput[] = [];
  const text = `검토승인 · 방문예정일 ${dot} (${inspectType})`;
  if (notifyEmail) channels.push(notifyEntry('MAIL', text));
  if (notifySms) channels.push(notifyEntry('SMS', text));

  await prisma.application.update({
    where: { id },
    data: {
      status: 'REVIEW_APPROVED',
      visitDate: d,
      inspectType: INSPECT_TYPE_ENUM[inspectType],
      revComment,
      inspectorId: me.id,
      logs: {
        create: [
          logEntry(`${me.name} (감독관)`, `검토승인 · 방문예정일 ${dot} 지정 (${inspectType})`),
        ],
      },
      notifications: { create: channels },
    },
  });

  revalidateAll();
  const via = [notifyEmail ? '이메일' : '', notifySms ? '문자' : ''].filter(Boolean).join('/');
  return done(`검토승인 완료 · 방문예정일 ${dot} · 신청자에게 ${via || '알림'} 발송`);
}

/* ── 감독관: 보완요청 반려 ───────────────────────────────────────── */

export async function requestFixAction(input: unknown): Promise<ActionResult> {
  const me = await requireSupervisor();
  if (!me) return fail('감독관 권한이 필요합니다');
  const parsed = z
    .object({ id: z.string().min(1), comment: z.string().default('') })
    .safeParse(input);
  if (!parsed.success) return fail('보완요청 정보를 확인해 주세요');
  const { id, comment } = parsed.data;

  const text = comment.trim() || '하자이행증권 및 하자보증기간 정보를 보완해 주세요.';
  const app = await prisma.application.findUnique({ where: { id } });
  if (!app) return fail('신청 건을 찾을 수 없습니다');
  // 판정이 끝난 건을 되돌리면 신청자에게 통보까지 나간다.
  // 화면이 오래된 상태(드로어를 열어 둔 사이 다른 곳에서 확정)에서 도달할 수 있다.
  if (CLOSED.includes(app.status)) {
    return fail('판정이 확정된 신청 건은 보완요청으로 되돌릴 수 없습니다');
  }

  await prisma.application.update({
    where: { id },
    data: {
      status: 'FIX_REQUESTED',
      revComment: text,
      inspectorId: me.id,
      logs: { create: [logEntry(`${me.name} (감독관)`, '보완요청으로 반려')] },
      notifications: {
        create: [
          notifyEntry('MAIL', '보완요청 · 신청 내용 보완 후 재신청 필요'),
          notifyEntry('SMS', '보완요청 · 신청 내용 보완 후 재신청 필요'),
        ],
      },
    },
  });

  revalidateAll();
  return done('보완요청으로 반려되었습니다 · 신청자에게 이메일/문자 발송');
}

/* ── 감독관: 1차 · 최종 판정 ─────────────────────────────────────── */

const RESULT_VALUES = ['합격', '조건부합격', '불합격', '보류', '이월'] as const;

/** 검토승인(일괄 포함)을 걸 수 있는 상태 */
const APPROVABLE: StatusEnum[] = ['SUBMITTED', 'FIX_REQUESTED', 'REVIEW_PLANNED'];
/** 판정을 넣을 수 있는 상태 */
const JUDGEABLE: StatusEnum[] = ['REVIEW_APPROVED', 'FINAL_PENDING'];

/** 판정이 끝나 더는 되돌릴 수 없는 상태 */
const CLOSED: StatusEnum[] = ['PASSED', 'CONDITIONAL', 'FAILED', 'HOLD', 'CARRIED_OVER'];

/**
 * 하자이행증권이 확인되지 않은 건인지.
 * 화면의 안내 문구(view.ts bondNote)와 같은 기준을 서버에서도 강제한다.
 */
function bondMissing(a: { issuer: string; bondNo: string }): boolean {
  return a.issuer === '미발행' || a.bondNo === '입력 요망' || a.bondNo === '추후발행' || !a.bondNo;
}

const judgeSchema = z.object({
  id: z.string().min(1),
  firstResult: z.enum(RESULT_VALUES).or(z.literal('')).default(''),
  finalResult: z.enum(RESULT_VALUES),
  inspectType: z.enum(['서류검사', '샘플링검사']),
  comment: z.string().default(''),
  bondOk: z.boolean(),
  notifyEmail: z.boolean().default(true),
  notifySms: z.boolean().default(true),
});

export async function confirmJudgeAction(input: unknown): Promise<ActionResult> {
  const me = await requireSupervisor();
  if (!me) return fail('감독관 권한이 필요합니다');
  const parsed = judgeSchema.safeParse(input);
  if (!parsed.success) return fail('최종 판정을 선택해 주세요');
  const { id, firstResult, finalResult, inspectType, comment, bondOk, notifyEmail, notifySms } =
    parsed.data;

  if (!bondOk) return fail('하자이행증권 · 하자보증기간 확인을 완료해 주세요');

  const app = await prisma.application.findUnique({ where: { id } });
  if (!app) return fail('신청 건을 찾을 수 없습니다');
  if (!JUDGEABLE.includes(app.status)) {
    return fail('검토승인 이후에만 판정할 수 있습니다');
  }

  // 증권이 확인되지 않은 건은 합격·조건부합격으로 닫을 수 없다.
  // (불합격·보류·이월은 증권과 무관하게 확정할 수 있어야 한다)
  if (bondMissing(app) && (finalResult === '합격' || finalResult === '조건부합격')) {
    return fail(
      '하자이행증권이 확인되지 않아 합격 처리할 수 없습니다 · 하자이행증권 발행 후 진행하거나 보완요청으로 반려하세요',
    );
  }

  /**
   * 1차 판정을 건너뛰고 최종만 확정한 경우, 하지 않은 1차 판정을 지어내지 않는다.
   * 이력에는 "1차 판정 없이 최종 확정" 으로 사실대로 남는다.
   */
  const first = firstResult ? (firstResult as ResultLabel) : null;
  const status = RESULT_TO_STATUS[finalResult as ResultLabel];

  const channels: Prisma.NotificationCreateWithoutApplicationInput[] = [];
  const text = `최종 판정 ${finalResult} 통보 · 신청자, 현장PM, 설치점 발송`;
  if (notifyEmail) channels.push(notifyEntry('MAIL', text));
  if (notifySms) channels.push(notifyEntry('SMS', text));

  await prisma.application.update({
    where: { id },
    data: {
      status: STATUS_ENUM[status],
      firstResult: first ? RESULT_ENUM[first] : app.firstResult,
      finalResult: RESULT_ENUM[finalResult as ResultLabel],
      inspectType: INSPECT_TYPE_ENUM[inspectType as InspectTypeLabel],
      finalComment: comment,
      inspectorId: me.id,
      logs: {
        create: [
          logEntry(
            `${me.name} (감독관)`,
            `최종 판정 ${finalResult} · ${inspectType}` +
              (!first && !app.firstResult ? ' (1차 판정 없이 확정)' : ''),
          ),
        ],
      },
      notifications: { create: channels },
    },
  });

  revalidateAll();
  return done(`최종 판정 ${finalResult} 확정 · 신청자·현장PM·설치점에 결과 통보 발송`);
}

/** 1차 판정만 먼저 기록한다 (방문 직후) */
export async function saveFirstResultAction(input: unknown): Promise<ActionResult> {
  const me = await requireSupervisor();
  if (!me) return fail('감독관 권한이 필요합니다');
  const parsed = z
    .object({
      id: z.string().min(1),
      firstResult: z.enum(RESULT_VALUES),
      inspectType: z.enum(['서류검사', '샘플링검사']),
      comment: z.string().default(''),
    })
    .safeParse(input);
  if (!parsed.success) return fail('1차 판정을 선택해 주세요');
  const { id, firstResult, inspectType, comment } = parsed.data;

  const app = await prisma.application.findUnique({ where: { id } });
  if (!app) return fail('신청 건을 찾을 수 없습니다');
  if (!JUDGEABLE.includes(app.status)) {
    return fail('검토승인 이후에만 1차 판정을 입력할 수 있습니다');
  }

  await prisma.application.update({
    where: { id },
    data: {
      status: 'FINAL_PENDING',
      firstResult: RESULT_ENUM[firstResult],
      inspectType: INSPECT_TYPE_ENUM[inspectType as InspectTypeLabel],
      firstComment: comment,
      inspectorId: me.id,
      logs: {
        create: [logEntry(`${me.name} (감독관)`, `1차 판정 ${firstResult} · ${inspectType}`)],
      },
      notifications: {
        create: [notifyEntry('MAIL', `1차 판정 ${firstResult} · 최종 판정 대기`)],
      },
    },
  });

  revalidateAll();
  return done(`1차 판정 ${firstResult} 저장 · 최종 판정 대기로 이동했습니다`);
}

/* ── 감독관: 일괄 검토승인 ───────────────────────────────────────── */

export async function bulkApproveAction(input: unknown): Promise<ActionResult> {
  const me = await requireSupervisor();
  if (!me) return fail('감독관 권한이 필요합니다');
  const parsed = z
    .object({
      ids: z.array(z.string()).min(1, '일괄 검토승인할 신청을 선택해 주세요'),
      visitDate: z.string().default(''),
      inspectType: z.enum(['서류검사', '샘플링검사']).default('서류검사'),
    })
    .safeParse(input);
  if (!parsed.success) return fail(parsed.error.errors[0].message);
  const { ids, inspectType } = parsed.data;

  // 비면 오늘로 채우던 것을 막는다 — 데모 기준일이 일요일이라
  // 날짜를 만지지 않고 누르면 수십 명에게 일요일 방문이 확정 발송됐다.
  const visitDate = parsed.data.visitDate;
  const d = visitDate ? parseDot(visitDate) : null;
  if (!d) return fail('방문예정일을 선택해 주세요');
  const dot = visitDate.replace(/-/g, '.');

  // 완료된 건까지 되돌리지 않도록, 승인 가능한 상태만 골라 처리한다.
  const picked = await prisma.application.findMany({ where: { id: { in: ids } } });
  const targets = picked.filter((t) => APPROVABLE.includes(t.status));
  const skipped = picked.length - targets.length;

  if (!targets.length) {
    return fail(
      skipped
        ? `선택한 ${skipped}건은 이미 검토승인 이후 단계라 일괄 승인할 수 없습니다`
        : '일괄 검토승인할 신청을 선택해 주세요',
    );
  }

  await prisma.$transaction(
    targets.map((t) =>
      prisma.application.update({
        where: { id: t.id },
        data: {
          status: 'REVIEW_APPROVED',
          visitDate: d,
          inspectType: t.inspectType ?? INSPECT_TYPE_ENUM[inspectType],
          inspectorId: me.id,
          logs: {
            create: [
              logEntry(`${me.name} (감독관)`, `일괄 검토승인 · 방문예정일 ${dot} 지정`),
            ],
          },
          notifications: {
            create: [
              notifyEntry('MAIL', `검토승인 · 방문예정일 ${dot}`),
              notifyEntry('SMS', `검토승인 · 방문예정일 ${dot}`),
            ],
          },
        },
      }),
    ),
  );

  revalidateAll();
  return done(
    `${targets.length}건 검토승인 · 방문예정일 ${dot} · 신청자에게 이메일/문자 발송` +
      (skipped ? ` (승인 대상이 아닌 ${skipped}건 제외)` : ''),
  );
}

/* ── 신청자: 신규 신청 ───────────────────────────────────────────── */

const createSchema = z.object({
  product: z.enum(['DDL', 'HN']),
  year: z.string().trim().min(1, '연도를 선택해 주세요'),
  channel: z.enum(['직판', '유통']),
  code: z.string().trim().min(1, '프로젝트코드를 입력해 주세요'),
  moveIn: z.string().trim().min(1, '입주개시일을 입력해 주세요'),
  site: z.string().trim().min(1, '현장명을 입력해 주세요'),
  owner: z.string().trim().min(1, '원청을 입력해 주세요'),
  pm: z.string().trim().min(1, '현장PM을 선택해 주세요'),
  zip: z.string().trim().default(''),
  region: z.string().trim().default(''),
  addr: z.string().trim().default(''),
  lat: z.number().nullable().default(null),
  lng: z.number().nullable().default(null),

  installer: z.string().trim().min(1, '설치점명을 입력해 주세요'),
  installer2: z.string().trim().default(''),
  manager: z.string().trim().min(1, '담당을 입력해 주세요'),
  phone: z.string().trim().min(1, '연락처를 입력해 주세요'),
  witness: z.string().trim().default(''),
  witnessPhone: z.string().trim().default(''),
  worker1: z.string().trim().default(''),
  worker2: z.string().trim().default(''),

  qty: z.coerce.number().int().min(1, '수량(세대)을 입력해 주세요'),

  link: z.string().default(''),
  linked: z.string().default(''),
  board: z.string().default(''),
  strike: z.string().default(''),
  other: z.string().default(''),
  lock1: z.string().default(''),

  topology: z.string().default(''),
  main: z.string().default(''),
  dev1: z.string().default(''),
  camera: z.string().default(''),
  lobby: z.string().default(''),
  dongs: z.coerce.number().int().min(0).default(0),

  bondNo: z.string().trim().min(1, '하자이행증권 번호를 입력해 주세요'),
  issuer: z.string().trim().min(1, '발행주체를 선택해 주세요'),
  months: z.coerce.number().int().default(36),
  from: z.string().default(''),
  to: z.string().default(''),

  desiredDate: z.string().default(''),
  desiredInspectType: z.enum(['서류검사', '샘플링검사']).or(z.literal('')).default(''),
  occupancy: z.string().default(''),
  memo: z.string().default(''),
  extra: z.record(z.string()).default({}),
});

export async function createApplicationAction(input: unknown): Promise<ActionResult> {
  const me = await requireApplicant();
  if (!me) return fail('이관검사 신청자 권한이 필요합니다');
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.errors[0].message);
  const v = parsed.data;

  const year = Number(v.year.replace(/\D/g, '')) || new Date().getUTCFullYear();
  const id = await nextApplicationId(year);
  const reqDate = parseDot(today())!;

  const supervisor = await prisma.user.findFirst({ where: { role: 'SUPERVISOR' } });

  await prisma.application.create({
    data: {
      id,
      product: v.product,
      year,
      site: v.site,
      owner: v.owner,
      pm: v.pm,
      channel: CHANNEL_ENUM[v.channel as ChannelLabel],
      code: v.code,
      moveIn: v.moveIn,
      installer: v.installer,
      installer2: v.installer2,
      managerName: v.manager,
      managerPhone: v.phone,
      witness: v.witness,
      witnessPhone: v.witnessPhone,
      worker1: v.worker1,
      worker2: v.worker2,
      qty: v.qty,
      region: v.region,
      zip: v.zip,
      addr: v.addr,
      lat: v.lat,
      lng: v.lng,

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
      dongs: v.dongs,

      status: 'SUBMITTED',
      reqDate,

      bondNo: v.bondNo,
      issuer: v.issuer,
      months: v.months,
      bondFrom: parseDot(v.from),
      bondTo: parseDot(v.to),

      desiredDate: parseDot(v.desiredDate),
      desiredInspectType: v.desiredInspectType
        ? INSPECT_TYPE_ENUM[v.desiredInspectType as InspectTypeLabel]
        : null,
      occupancy: v.occupancy,
      memo: v.memo,
      extra: v.extra as Prisma.InputJsonValue,

      applicantId: me.id,
      inspectorId: supervisor?.id ?? null,

      logs: {
        create: [
          logEntry(
            me.name,
            `이관검사 신청서 제출 (${v.product === 'DDL' ? 'DDL 양식 41개 항목' : 'HN 양식 58개 항목'})`,
          ),
        ],
      },
      notifications: {
        create: [
          notifyEntry(
            'MAIL',
            `이관검사 신청이 접수되었습니다 · 감독관 배정 ${supervisor?.name ?? '미배정'}`,
          ),
        ],
      },
    },
  });

  revalidateAll();
  return done(
    `이관검사 신청이 접수되었습니다 (식별번호 ${id}) · 감독관 ${supervisor?.name ?? ''}에게 이메일 발송`,
    '/applicant',
  );
}

/* ── 신청자: 보완 후 재신청 ──────────────────────────────────────── */

export async function resubmitAction(id: string): Promise<ActionResult> {
  const me = await requireApplicant();
  if (!me) return fail('이관검사 신청자 권한이 필요합니다');

  const app = await prisma.application.findUnique({ where: { id } });
  if (!app) return fail('신청 건을 찾을 수 없습니다');
  if (app.applicantId !== me.id) return fail('본인이 신청한 건만 재신청할 수 있습니다');
  if (app.status !== 'FIX_REQUESTED') return fail('보완요청 상태에서만 재신청할 수 있습니다');

  await prisma.application.update({
    where: { id },
    data: {
      status: 'SUBMITTED',
      reqDate: parseDot(today())!,
      /*
       * 지난 라운드의 판정 흔적을 지운다. 남겨 두면 재승인 뒤 판정 화면에
       * 옛 1차 판정(예: 조건부합격)이 미리 선택된 채로 열려, 이번 방문 결과
       * 대신 그것을 그대로 확정할 위험이 있다. 이력은 logs 에 남아 있다.
       */
      visitDate: null,
      inspectType: null,
      firstResult: null,
      finalResult: null,
      firstComment: '',
      finalComment: '',
      logs: { create: [logEntry(me.name, '보완 내용 반영 후 재신청')] },
      notifications: {
        create: [notifyEntry('MAIL', '보완 내용이 반영되어 재신청되었습니다 · 감독관 검토 대기')],
      },
    },
  });

  revalidateAll();
  return done('보완 내용이 반영되어 재신청되었습니다 · 감독관에게 이메일 발송', '/applicant');
}

/* ── 신청자: 신청 내용 수정 (보완요청 상태에서만) ───────────────── */

export async function updateApplicationAction(input: unknown): Promise<ActionResult> {
  const me = await requireApplicant();
  if (!me) return fail('이관검사 신청자 권한이 필요합니다');
  const parsed = z
    .object({
      id: z.string().min(1),
      bondNo: z.string().trim().default(''),
      issuer: z.string().trim().default(''),
      months: z.coerce.number().int().default(36),
      from: z.string().default(''),
      to: z.string().default(''),
      memo: z.string().default(''),
    })
    .safeParse(input);
  if (!parsed.success) return fail('입력값을 확인해 주세요');
  const v = parsed.data;

  const app = await prisma.application.findUnique({ where: { id: v.id } });
  if (!app || app.applicantId !== me.id) return fail('본인이 신청한 건만 수정할 수 있습니다');
  if (app.status !== 'FIX_REQUESTED') return fail('보완요청 상태에서만 수정할 수 있습니다');

  await prisma.application.update({
    where: { id: v.id },
    data: {
      bondNo: v.bondNo,
      issuer: v.issuer,
      months: v.months,
      bondFrom: parseDot(v.from),
      bondTo: parseDot(v.to),
      memo: v.memo,
    },
  });

  revalidateAll();
  return done('보완 내용이 저장되었습니다');
}
