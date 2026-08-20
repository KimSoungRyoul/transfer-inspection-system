'use client';

/**
 * Google 계정 선택 모달 — 프로토타입 마크업 그대로.
 * 데모용이라 계정 목록은 시드 계정과 같은 값을 하드코딩한다.
 *
 * 닫힐 때 exit 전환을 보이려면 조건부 렌더가 AnimatePresence 안쪽이어야 하므로,
 * 호출부에서 조건부로 그리지 않고 open 을 받아 이 안에서 판단한다.
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { googleLoginAction } from '@/lib/actions';
import { useToast } from '@/components/Toast';
import { AnimatePresence, motion, backdrop, modalPanel, pressable, stagger, staggerItem } from '@/components/motion';

import { GoogleG } from './GoogleG';

interface GAccount {
  name: string;
  email: string;
  initial: string;
  role: string;
}

const G_ACCOUNTS: GAccount[] = [
  { name: '이서준', email: 'user1@gmail.com', initial: '이', role: '이관검사 신청자' },
  { name: '박지훈', email: 'user2@gmail.com', initial: '박', role: '감독관' },
];

export function GoogleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  const pick = async (email: string) => {
    if (pending) return;
    setPending(true);
    const r = await googleLoginAction(email);
    toast(r.toast);
    if (r.ok) {
      router.replace(r.goto!);
      router.refresh();
      return;
    }
    setPending(false);
  };

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
            className="ti-modal-sm"
            variants={modalPanel}
            style={{
              width: 396,
              background: '#fff',
              borderRadius: 8,
              boxShadow: '0 12px 40px rgba(20,24,29,.3)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 11,
                padding: '17px 20px',
                borderBottom: '1px solid #eceff2',
              }}
            >
              <GoogleG size={20} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ font: "500 13px/1.2 Roboto,'Noto Sans KR',sans-serif", color: '#1f1f1f' }}>
                  계정 선택
                </span>
                <span style={{ font: "400 11.5px/1.2 'Noto Sans KR'", color: '#8b95a1' }}>
                  계속하려면 준공 이관검사 시스템으로 이동
                </span>
              </div>
            </div>

            <motion.div variants={stagger(0.04)} style={{ display: 'flex', flexDirection: 'column' }}>
              {G_ACCOUNTS.map((g) => (
                <motion.button
                  key={g.email}
                  type="button"
                  className="h-f7"
                  disabled={pending}
                  onClick={() => pick(g.email)}
                  variants={staggerItem}
                  {...pressable}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '13px 20px',
                    border: 0,
                    borderBottom: '1px solid #f2f4f7',
                    background: '#fff',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      background: '#eaf1fd',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      font: "500 12px/1 'Noto Sans KR'",
                      color: '#1a52b6',
                      flex: 'none',
                    }}
                  >
                    {g.initial}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <span style={{ font: "500 12.5px/1.3 'Noto Sans KR'", color: '#1a1d21' }}>{g.name}</span>
                    <span style={{ font: "400 11.5px/1.3 'Roboto Mono',monospace", color: '#8b95a1' }}>
                      {g.email}
                    </span>
                  </div>
                  <div style={{ flex: 1 }} />
                  <span
                    style={{
                      padding: '2px 7px',
                      border: '1px solid #dfe3e8',
                      borderRadius: 3,
                      font: "400 10.5px/1.6 'Noto Sans KR'",
                      color: '#6b7480',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {g.role}
                  </span>
                </motion.button>
              ))}
            </motion.div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '14px 20px',
                background: '#fbfbfc',
              }}
            >
              <span style={{ font: "400 11px/1.6 'Noto Sans KR'", color: '#77808c' }}>
                계속 진행하면 이름, 이메일 주소, 프로필 사진이 시스템과 공유됩니다.
              </span>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                disabled={pending}
                onClick={onClose}
                style={{
                  padding: '7px 12px',
                  background: '#fff',
                  border: '1px solid #d3d8de',
                  borderRadius: 4,
                  font: "500 12px/1.2 'Noto Sans KR'",
                  color: '#3c4652',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                취소
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
