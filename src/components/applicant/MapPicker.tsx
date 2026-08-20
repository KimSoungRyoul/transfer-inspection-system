'use client';

/**
 * 현장 위치 지정 모달 — 프로토타입의 mapOpen 모달을 그대로 옮긴 것.
 *
 * leaflet 은 window 를 직접 만지므로 useEffect 안에서 동적 import 한다.
 * 주소 조회는 Nominatim 을 직접 부르지 않고 /api/geocode 프록시를 거친다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

import { createMap, geocode, DEFAULT_CENTER, type MapEngine } from './mapEngine';

import { AnimatePresence, backdrop, fade, modalPanel, motion, pressable } from '@/components/motion';
import { useToast } from '@/components/Toast';

export interface SiteLoc {
  lat: number;
  lng: number;
  addr: string;
}

const FAIL_ADDR = '주소 자동조회 실패 · 주소 항목에 직접 입력';

const MAP_SOURCE = '현장명 또는 주소로 검색한 뒤 지도를 클릭하거나 마커를 드래그해 위치를 지정하세요';

export function MapPicker({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: SiteLoc | null;
  onClose: () => void;
  onSave: (loc: SiteLoc) => void;
}) {
  const toast = useToast();
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapEngine | null>(null);
  const initialRef = useRef<SiteLoc | null>(initial);

  const [pin, setPin] = useState<SiteLoc | null>(initial);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [provider, setProvider] = useState<'naver' | 'osm'>('osm');

  useEffect(() => {
    initialRef.current = initial;
  }, [initial]);

  /** 좌표를 찍고 역지오코딩으로 주소를 채운다 */
  const applyPin = useCallback(async (lat: number, lng: number) => {
    setPin({ lat, lng, addr: '주소 조회 중…' });
    try {
      const { results } = await geocode(`lat=${lat}&lon=${lng}`);
      const addr = results[0]?.addr || FAIL_ADDR;
      setPin((p) => (p ? { ...p, addr } : p));
    } catch {
      setPin((p) => (p ? { ...p, addr: FAIL_ADDR } : p));
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setPin(initialRef.current);

    let disposed = false;
    let local: MapEngine | null = null;

    void (async () => {
      if (!elRef.current || mapRef.current) return;
      const engine = await createMap({
        el: elRef.current,
        center: initialRef.current ?? DEFAULT_CENTER,
        onPick: (lat, lng) => void applyPin(lat, lng),
      });
      if (disposed) {
        engine.destroy();
        return;
      }
      local = engine;
      mapRef.current = engine;
      setProvider(engine.provider);
      setTimeout(() => {
        if (!disposed) engine.refresh();
      }, 120);
    })();

    return () => {
      disposed = true;
      (mapRef.current ?? local)?.destroy();
      mapRef.current = null;
    };
  }, [open, applyPin]);

  async function searchMap() {
    const q = query.trim();
    if (!q) {
      toast('검색할 현장명 또는 주소를 입력해 주세요');
      return;
    }
    setSearching(true);
    try {
      const { results } = await geocode(`q=${encodeURIComponent(q)}`);
      if (!results.length) {
        toast('검색 결과가 없습니다 · 지도를 직접 클릭해 위치를 지정하세요');
        return;
      }
      const [hit] = results;
      mapRef.current?.moveTo(hit.lat, hit.lng, 16);
      setPin({ lat: hit.lat, lng: hit.lng, addr: hit.addr });
    } catch {
      toast('지도 검색에 실패했습니다 · 지도를 직접 클릭해 위치를 지정하세요');
    } finally {
      setSearching(false);
    }
  }

  function saveLoc() {
    if (!pin) {
      toast('지도에서 위치를 먼저 지정해 주세요');
      return;
    }
    onSave(pin);
    toast(`현장 위치가 저장되었습니다 · ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`);
  }

  const pickAddrText = pin
    ? pin.addr || '주소 조회 중…'
    : '지도를 클릭하거나 마커를 드래그해 위치를 지정하세요';
  const pickColor = pin ? '#1a1d21' : '#98a1ac';
  const pickCoordText = pin ? `${pin.lat.toFixed(6)}, ${pin.lng.toFixed(6)}` : '—';
  const mapSearchUrl = `https://www.openstreetmap.org/search?query=${encodeURIComponent(query || '아파트 현장')}`;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="ti-modal-wrap"
          variants={backdrop}
          initial="hidden"
          animate="show"
          exit="exit"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(20,24,29,.42)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 70,
          }}
        >
          <motion.div
            className="ti-modal-lg"
            variants={modalPanel}
            style={{
              width: 860,
              maxWidth: '94vw',
              background: '#fff',
              borderRadius: 8,
              boxShadow: '0 14px 44px rgba(20,24,29,.3)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 17px',
                borderBottom: '1px solid #eceff2',
              }}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  background: '#1f5fd0',
                  borderRadius: 6,
                  flex: 'none',
                }}
              >
                <PinGlyph size={13} fill="#fff" />
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ font: "700 14px/1.2 'Noto Sans KR'" }}>현장 위치 지정</span>
                <span style={{ font: "400 11.5px/1.3 'Noto Sans KR'", color: '#8b95a1' }}>
                  {MAP_SOURCE}
                  <span style={{ marginLeft: 6, color: '#a2abb5' }}>
                    · {provider === 'naver' ? '네이버 지도' : 'OpenStreetMap'}
                  </span>
                </span>
              </div>
              <div style={{ flex: 1 }} />
              <motion.button
                {...pressable}
                onClick={onClose}
                style={{
                  padding: '5px 10px',
                  border: '1px solid #dfe3e8',
                  background: '#fff',
                  borderRadius: 4,
                  font: "400 12px/1.2 'Noto Sans KR'",
                  color: '#6b7480',
                  cursor: 'pointer',
                }}
              >
                닫기
              </motion.button>
            </div>

            <div
              className="ti-mapsearch"
              style={{
                display: 'flex',
                gap: 8,
                padding: '11px 17px',
                borderBottom: '1px solid #eceff2',
                background: '#fbfbfc',
              }}
            >
              <input
                className="ti-field"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="예: 경기 파주 운정신도시 한빛채 3차"
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  border: '1px solid #d3d8de',
                  borderRadius: 4,
                  font: "400 12.5px/1.4 'Noto Sans KR'",
                  outline: 'none',
                }}
              />
              <motion.button
                {...pressable}
                onClick={() => void searchMap()}
                disabled={searching}
                style={{
                  padding: '8px 14px',
                  background: '#1f5fd0',
                  color: '#fff',
                  border: '1px solid #1f5fd0',
                  borderRadius: 4,
                  font: "500 12.5px/1.2 'Noto Sans KR'",
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {searching ? '검색 중…' : '검색'}
              </motion.button>
              <motion.a
                {...pressable}
                href={mapSearchUrl}
                target="_blank"
                rel="noreferrer"
                className="h-f4"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  height: 37,
                  padding: '0 13px',
                  border: '1px solid #1f5fd0',
                  borderRadius: 4,
                  font: "500 12.5px/1.2 'Noto Sans KR'",
                  color: '#1a52b6',
                  whiteSpace: 'nowrap',
                  background: '#fff',
                }}
              >
                <PinGlyph size={12} fill="#1f5fd0" />
                <span>지도에서 열기</span>
              </motion.a>
            </div>

            <div ref={elRef} className="ti-map" style={{ height: 420, width: '100%', background: '#eef0f3' }} />

            <div
              className="ti-mapfoot"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '13px 17px',
                borderTop: '1px solid #eceff2',
                background: '#fbfbfc',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
                <span style={{ font: "400 10.5px/1.3 'Noto Sans KR'", color: '#8b95a1' }}>선택한 주소</span>
                <motion.span
                  key={pickAddrText}
                  variants={fade}
                  initial="hidden"
                  animate="show"
                  style={{ font: "400 12.5px/1.45 'Noto Sans KR'", color: pickColor }}
                >
                  {pickAddrText}
                </motion.span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ font: "400 10.5px/1.3 'Noto Sans KR'", color: '#8b95a1' }}>위도 / 경도</span>
                <span style={{ font: "400 12px/1.45 'Roboto Mono',monospace", color: '#1a1d21' }}>{pickCoordText}</span>
              </div>
              <motion.button
                {...pressable}
                onClick={saveLoc}
                className="h-blue"
                style={{
                  padding: '10px 18px',
                  background: '#1f5fd0',
                  color: '#fff',
                  border: '1px solid #1f5fd0',
                  borderRadius: 4,
                  font: "500 12.5px/1.2 'Noto Sans KR'",
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                이 위치로 저장
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function PinGlyph({ size, fill }: { size: number; fill: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={{ display: 'block', flex: 'none' }}>
      <path
        fill={fill}
        d="M10 1.7c-3.3 0-6 2.7-6 6 0 4.5 6 10.6 6 10.6s6-6.1 6-10.6c0-3.3-2.7-6-6-6zm0 8.3a2.3 2.3 0 1 1 0-4.6 2.3 2.3 0 0 1 0 4.6z"
      />
    </svg>
  );
}
