/**
 * 지도 엔진 — 네이버 지도와 Leaflet(OSM) 중 하나를 골라 붙인다.
 *
 *   NEXT_PUBLIC_NAVER_MAP_CLIENT_ID 가 있으면  → 네이버 지도
 *   없으면                                     → Leaflet + OpenStreetMap 타일
 *
 * 호출부는 provider 를 몰라도 되도록 아래 한 가지 인터페이스만 쓴다.
 * 네이버 지도 JS SDK 는 타입 정의를 제공하지 않아, 쓰는 부분만 최소로 선언해 둔다.
 */
import { PIN_SVG } from './pin';

export type MapProvider = 'naver' | 'osm';

export interface MapEngine {
  provider: MapProvider;
  /** 지도 중심과 마커를 함께 옮긴다 */
  moveTo(lat: number, lng: number, zoom?: number): void;
  /** 마커만 옮긴다 */
  setMarker(lat: number, lng: number): void;
  /** 컨테이너 크기가 바뀐 뒤 다시 그린다 */
  refresh(): void;
  destroy(): void;
}

export const NAVER_CLIENT_ID = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID ?? '';
/** SDK 쿼리 파라미터 이름. NCP 계정 유형에 따라 ncpKeyId / ncpClientId 로 갈린다. */
const NAVER_KEY_PARAM = process.env.NEXT_PUBLIC_NAVER_MAP_KEY_PARAM ?? 'ncpKeyId';

export const mapProvider = (): MapProvider => (NAVER_CLIENT_ID ? 'naver' : 'osm');

export const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 };

/* ── 네이버 지도 SDK 최소 타입 ───────────────────────────────────── */

interface NaverLatLng {
  lat(): number;
  lng(): number;
}
interface NaverMap {
  setCenter(latlng: NaverLatLng): void;
  setZoom(z: number): void;
  refresh(force?: boolean): void;
  destroy(): void;
}
interface NaverMarker {
  setPosition(latlng: NaverLatLng): void;
  getPosition(): NaverLatLng;
  setMap(map: NaverMap | null): void;
}
interface NaverMapsNS {
  LatLng: new (lat: number, lng: number) => NaverLatLng;
  Point: new (x: number, y: number) => unknown;
  Map: new (el: HTMLElement, opts: Record<string, unknown>) => NaverMap;
  Marker: new (opts: Record<string, unknown>) => NaverMarker;
  Event: {
    addListener(target: unknown, event: string, handler: (e: { coord: NaverLatLng }) => void): void;
  };
}

declare global {
  interface Window {
    naver?: { maps?: NaverMapsNS };
  }
}

let naverLoading: Promise<NaverMapsNS> | null = null;

/** SDK 스크립트를 한 번만 붙이고 재사용한다 */
function loadNaver(): Promise<NaverMapsNS> {
  if (window.naver?.maps) return Promise.resolve(window.naver.maps);
  if (naverLoading) return naverLoading;

  naverLoading = new Promise<NaverMapsNS>((resolve, reject) => {
    const src = `https://oapi.map.naver.com/openapi/v3/maps.js?${NAVER_KEY_PARAM}=${encodeURIComponent(NAVER_CLIENT_ID)}`;
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = () => {
      const ns = window.naver?.maps;
      if (ns) resolve(ns);
      else reject(new Error('네이버 지도 SDK 를 불러오지 못했습니다'));
    };
    el.onerror = () => reject(new Error('네이버 지도 SDK 로드 실패'));
    document.head.appendChild(el);
  });
  // 실패하면 다음 시도에서 다시 붙일 수 있게 캐시를 비운다
  naverLoading.catch(() => {
    naverLoading = null;
  });
  return naverLoading;
}

/* ── 생성 ────────────────────────────────────────────────────────── */

export interface CreateOpts {
  el: HTMLElement;
  center: { lat: number; lng: number };
  zoom?: number;
  /** 지도 클릭 · 마커 드래그로 좌표가 정해질 때 */
  onPick: (lat: number, lng: number) => void;
}

/**
 * 지도를 만든다. 네이버 키가 있으면 네이버로 붙이고, 로드에 실패하면 OSM 으로 물러선다.
 * 그래서 키가 잘못돼 있어도 화면이 비지 않는다.
 */
export async function createMap(opts: CreateOpts): Promise<MapEngine> {
  if (NAVER_CLIENT_ID) {
    try {
      return await createNaverMap(opts);
    } catch (e) {
      console.warn('[map] 네이버 지도 초기화 실패 — OSM 으로 대체합니다', e);
    }
  }
  return createLeafletMap(opts);
}

async function createNaverMap({ el, center, zoom = 16, onPick }: CreateOpts): Promise<MapEngine> {
  const maps = await loadNaver();
  const map = new maps.Map(el, {
    center: new maps.LatLng(center.lat, center.lng),
    zoom,
    scaleControl: false,
    mapDataControl: false,
    logoControlOptions: { position: 3 },
  });
  const marker = new maps.Marker({
    position: new maps.LatLng(center.lat, center.lng),
    map,
    draggable: true,
    icon: { content: PIN_SVG, anchor: new maps.Point(13, 33) },
  });

  maps.Event.addListener(map, 'click', (e) => {
    marker.setPosition(e.coord);
    onPick(e.coord.lat(), e.coord.lng());
  });
  maps.Event.addListener(marker, 'dragend', () => {
    const p = marker.getPosition();
    onPick(p.lat(), p.lng());
  });

  return {
    provider: 'naver',
    moveTo(lat, lng, z) {
      map.setCenter(new maps.LatLng(lat, lng));
      if (z) map.setZoom(z);
      marker.setPosition(new maps.LatLng(lat, lng));
    },
    setMarker(lat, lng) {
      marker.setPosition(new maps.LatLng(lat, lng));
    },
    refresh() {
      map.refresh(true);
    },
    destroy() {
      marker.setMap(null);
      map.destroy();
    },
  };
}

async function createLeafletMap({ el, center, zoom = 15, onPick }: CreateOpts): Promise<MapEngine> {
  const L = (await import('leaflet')).default;
  const map = L.map(el, { center: [center.lat, center.lng], zoom });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap',
  }).addTo(map);

  const icon = L.divIcon({ className: '', iconSize: [26, 34], iconAnchor: [13, 33], html: PIN_SVG });
  const marker = L.marker([center.lat, center.lng], { draggable: true, icon }).addTo(map);

  marker.on('dragend', () => {
    const p = marker.getLatLng();
    onPick(p.lat, p.lng);
  });
  map.on('click', (e) => {
    marker.setLatLng(e.latlng);
    onPick(e.latlng.lat, e.latlng.lng);
  });

  return {
    provider: 'osm',
    moveTo(lat, lng, z) {
      map.setView([lat, lng], z ?? map.getZoom());
      marker.setLatLng([lat, lng]);
    },
    setMarker(lat, lng) {
      marker.setLatLng([lat, lng]);
    },
    refresh() {
      map.invalidateSize();
    },
    destroy() {
      map.remove();
    },
  };
}

/* ── 지오코딩 응답 ───────────────────────────────────────────────── */

export interface GeoHit {
  lat: number;
  lng: number;
  addr: string;
  road?: string;
  jibun?: string;
}

/** /api/geocode 응답을 파싱한다 (제공자와 무관하게 같은 형태) */
export async function geocode(params: string): Promise<{ provider: MapProvider; results: GeoHit[] }> {
  const res = await fetch(`/api/geocode?${params}`);
  const data = (await res.json()) as { provider?: MapProvider; results?: GeoHit[] };
  return { provider: data.provider ?? 'osm', results: data.results ?? [] };
}
