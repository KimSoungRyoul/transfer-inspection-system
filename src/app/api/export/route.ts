/**
 * 접수 목록 내보내기 — 엑셀에서 바로 열리는 UTF-8 BOM CSV.
 * 목록 화면의 필터(연도/제품/상태/검색)를 그대로 반영한다.
 */
import { readSession } from '@/lib/session';
import { listApplications } from '@/lib/data';
import { today } from '@/lib/domain';

export const dynamic = 'force-dynamic';

const COLUMNS: [string, (a: Awaited<ReturnType<typeof listApplications>>[number]) => string][] = [
  ['식별번호', (a) => a.id],
  ['연도', (a) => a.year],
  ['제품군', (a) => (a.product === 'HN' ? 'HN/HA' : 'DDL')],
  ['구분', (a) => a.channel],
  ['프로젝트코드', (a) => a.code],
  ['현장명', (a) => a.site],
  ['원청', (a) => a.owner],
  ['현장PM', (a) => a.pm],
  ['입주개시일', (a) => a.moveIn],
  ['설치점명', (a) => a.installer],
  ['담당', (a) => a.manager],
  ['연락처', (a) => a.phone],
  ['수량(세대)', (a) => String(a.qty)],
  ['지역', (a) => a.region],
  ['우편번호', (a) => a.zip],
  ['주소', (a) => a.addr],
  ['좌표', (a) => a.latlng],
  ['상태', (a) => a.status],
  ['신청일', (a) => a.reqDate],
  ['방문예정일', (a) => a.visitDate],
  ['검사종류', (a) => a.inspectType],
  ['1차판정', (a) => a.first],
  ['최종판정', (a) => a.final],
  ['감독관', (a) => a.inspector],
  ['하자이행증권 번호', (a) => a.bondNo],
  ['발행주체', (a) => a.issuer],
  ['보증(개월)', (a) => String(a.months)],
  ['보증시작', (a) => a.from],
  ['보증종료', (a) => a.to],
  ['비고', (a) => a.memo],
];

const cell = (v: string): string => `"${(v ?? '').replace(/"/g, '""')}"`;

export async function GET(req: Request) {
  const s = await readSession();
  if (!s) return new Response('unauthorized', { status: 401 });

  const url = new URL(req.url);
  const fYear = url.searchParams.get('year') ?? '';
  const fProduct = url.searchParams.get('product') ?? '';
  const fStatus = url.searchParams.get('status') ?? '';
  const q = (url.searchParams.get('q') ?? '').toLowerCase();

  let apps = await listApplications({ id: s.uid, role: s.role });
  if (fYear) apps = apps.filter((x) => x.year === fYear);
  if (fProduct) apps = apps.filter((x) => x.product === fProduct);
  if (fStatus) {
    apps = apps.filter((x) =>
      fStatus === '완료'
        ? ['최종합격', '조건부합격', '불합격', '보류', '이월'].includes(x.status)
        : x.status === fStatus,
    );
  }
  // 목록 화면(ListClient)과 같은 필드를 봐야 한다. 화면은 식별번호·지역·설치점까지
  // 검색하는데 여기만 3개 필드를 보면, 화면에 13건이 떠도 CSV 는 0행이 된다.
  if (q) {
    apps = apps.filter((x) =>
      (x.id + x.site + x.owner + x.code + x.region + x.installer + x.manager + x.pm)
        .toLowerCase()
        .includes(q),
    );
  }

  const head = COLUMNS.map(([k]) => cell(k)).join(',');
  const body = apps.map((a) => COLUMNS.map(([, f]) => cell(f(a))).join(',')).join('\r\n');
  const csv = `﻿${head}\r\n${body}\r\n`;

  const name = `이관검사_접수목록_${today().replace(/\./g, '')}.csv`;
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
}
