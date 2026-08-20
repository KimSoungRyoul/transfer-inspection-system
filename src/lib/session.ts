/**
 * 세션 — JWT 를 httpOnly 쿠키에 담는다.
 *
 * 서버 액션과 서버 컴포넌트 양쪽에서 쓰이므로 next/headers 의 cookies() 를 직접 만진다.
 */
import 'server-only';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

import type { RoleKey } from './domain';

const COOKIE = 'ti_session';
const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? 'change-me-please-32-chars-minimum-secret',
);

export interface SessionPayload {
  uid: number;
  role: RoleKey;
  /** Google 계정으로 로그인했는지 — 상단바 배지에만 쓰인다 */
  google?: boolean;
}

const DAY = 60 * 60 * 24;

export async function createSession(payload: SessionPayload, keepLogin: boolean): Promise<void> {
  const maxAge = keepLogin ? DAY * 14 : DAY;
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(SECRET);

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: keepLogin ? maxAge : undefined,
  });
}

export async function readSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET, { algorithms: ['HS256'] });
    if (typeof payload.uid !== 'number') return null;
    if (payload.role !== 'applicant' && payload.role !== 'supervisor') return null;
    return { uid: payload.uid, role: payload.role, google: payload.google === true };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
