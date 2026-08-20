/**
 * 지오코딩 프록시 — 지도 모달의 주소 검색 / 좌표→주소 변환.
 *
 * 제공자는 환경변수로 결정한다.
 *   NAVER_MAP_CLIENT_ID + NAVER_MAP_CLIENT_SECRET 이 있으면 → 네이버 지도 API
 *   없으면                                              → OpenStreetMap Nominatim
 *
 * 브라우저에서 직접 부르지 않고 서버를 거치는 이유
 *   - 네이버: 시크릿 키가 클라이언트에 노출되면 안 된다
 *   - Nominatim: CORS·User-Agent 정책을 맞춰야 한다
 *
 * 응답 형식은 제공자와 무관하게 아래로 통일한다.
 *   { provider, results: [{ lat, lng, addr, road?, jibun? }] }
 */
import { NextResponse } from 'next/server';

import { readSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

const UA = 'transfer-inspection-system/1.0 (self-hosted)';
const OSM = 'https://nominatim.openstreetmap.org';

/** 네이버 지도 API 게이트웨이. 계정 마이그레이션 상황에 따라 달라져 환경변수로 뺀다. */
const NAVER_BASE = process.env.NAVER_MAP_API_BASE ?? 'https://maps.apigw.ntruss.com';

export interface GeoResult {
  lat: number;
  lng: number;
  addr: string;
  road?: string;
  jibun?: string;
}

const naverKeys = () => {
  const id = process.env.NAVER_MAP_CLIENT_ID;
  const secret = process.env.NAVER_MAP_CLIENT_SECRET;
  return id && secret ? { id, secret } : null;
};

const naverHeaders = (k: { id: string; secret: string }) => ({
  'x-ncp-apigw-api-key-id': k.id,
  'x-ncp-apigw-api-key': k.secret,
  Accept: 'application/json',
});

/* ── 네이버 ──────────────────────────────────────────────────────── */

async function naverSearch(q: string, k: { id: string; secret: string }): Promise<GeoResult[]> {
  const url = `${NAVER_BASE}/map-geocode/v2/geocode?query=${encodeURIComponent(q)}&count=5`;
  const res = await fetch(url, { headers: naverHeaders(k), signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`naver geocode ${res.status}`);
  const data = (await res.json()) as {
    addresses?: { x: string; y: string; roadAddress?: string; jibunAddress?: string }[];
  };
  return (data.addresses ?? []).map((a) => ({
    lat: Number(a.y),
    lng: Number(a.x),
    addr: a.roadAddress || a.jibunAddress || q,
    road: a.roadAddress,
    jibun: a.jibunAddress,
  }));
}

async function naverReverse(
  lat: number,
  lng: number,
  k: { id: string; secret: string },
): Promise<GeoResult[]> {
  const url =
    `${NAVER_BASE}/map-reversegeocode/v2/gc?coords=${lng},${lat}` +
    '&output=json&orders=roadaddr,addr';
  const res = await fetch(url, { headers: naverHeaders(k), signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`naver reverse ${res.status}`);
  const data = (await res.json()) as {
    results?: {
      region?: Record<string, { name?: string }>;
      land?: { name?: string; number1?: string; number2?: string; addition0?: { value?: string } };
    }[];
  };

  const first = data.results?.[0];
  if (!first) return [];
  const r = first.region ?? {};
  const area = [r.area1?.name, r.area2?.name, r.area3?.name, r.area4?.name].filter(Boolean).join(' ');
  const land = first.land;
  const num = [land?.number1, land?.number2].filter(Boolean).join('-');
  const building = land?.addition0?.value;
  const addr = [area, land?.name, num, building].filter(Boolean).join(' ').trim();

  return [{ lat, lng, addr: addr || `${lat.toFixed(6)}, ${lng.toFixed(6)}` }];
}

/* ── Nominatim ───────────────────────────────────────────────────── */

async function osmSearch(q: string): Promise<GeoResult[]> {
  const url = `${OSM}/search?format=jsonv2&limit=5&accept-language=ko&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`osm search ${res.status}`);
  const data = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  return data.map((d) => ({ lat: Number(d.lat), lng: Number(d.lon), addr: d.display_name }));
}

async function osmReverse(lat: number, lng: number): Promise<GeoResult[]> {
  const url = `${OSM}/reverse?format=jsonv2&accept-language=ko&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`osm reverse ${res.status}`);
  const d = (await res.json()) as { display_name?: string };
  return d.display_name ? [{ lat, lng, addr: d.display_name }] : [];
}

/* ── 핸들러 ──────────────────────────────────────────────────────── */

export async function GET(req: Request) {
  // 지도 모달은 로그인한 신청자만 연다. 열어 두면 외부에서 이 앱을 공짜
  // 지오코딩 프록시로 쓸 수 있고, Nominatim 이용정책상 서버 IP 가 막힌다.
  if (!(await readSession())) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get('q');
  const lat = url.searchParams.get('lat');
  const lon = url.searchParams.get('lon');
  const keys = naverKeys();
  const provider = keys ? 'naver' : 'osm';

  if (!q && !(lat && lon)) {
    return NextResponse.json({ error: 'q 또는 lat/lon 이 필요합니다' }, { status: 400 });
  }

  try {
    let results: GeoResult[];
    if (q) {
      results = keys ? await naverSearch(q, keys) : await osmSearch(q);
    } else {
      const la = Number(lat);
      const ln = Number(lon);
      if (!Number.isFinite(la) || !Number.isFinite(ln)) {
        return NextResponse.json({ error: '좌표가 올바르지 않습니다' }, { status: 400 });
      }
      results = keys ? await naverReverse(la, ln, keys) : await osmReverse(la, ln);
    }
    return NextResponse.json({ provider, results });
  } catch (e) {
    // 네이버가 실패하면(키 만료·쿼터 초과 등) 조용히 OSM 으로 한 번 더 시도한다.
    if (keys) {
      try {
        const results = q
          ? await osmSearch(q)
          : await osmReverse(Number(lat), Number(lon));
        return NextResponse.json({ provider: 'osm', results, fallback: true });
      } catch {
        /* 아래 공통 오류로 */
      }
    }
    console.error('[geocode]', e);
    return NextResponse.json({ error: 'geocode unavailable', provider, results: [] }, { status: 502 });
  }
}
