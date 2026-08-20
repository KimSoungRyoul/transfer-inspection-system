'use client';

/**
 * 토스트 — 프로토타입과 같은 위치·모양으로 4.2초간 떠 있다.
 * 서버 액션 결과 문구를 그대로 띄우는 용도.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { AnimatePresence, motion, toastPop } from '@/components/motion';

type ToastFn = (msg: string) => void;

const Ctx = createContext<ToastFn>(() => {});

export function useToast(): ToastFn {
  return useContext(Ctx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((m: string) => {
    if (!m) return;
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 4200);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <Ctx.Provider value={toast}>
      {children}
      <AnimatePresence>
        {msg ? (
        <motion.div
          className="ti-toast"
          role="status"
          aria-live="polite"
          variants={toastPop}
          initial="hidden"
          animate="show"
          exit="exit"
          style={{
            position: 'fixed',
            right: 22,
            bottom: 22,
            zIndex: 200,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            maxWidth: 400,
            padding: '13px 15px',
            background: '#171b21',
            borderRadius: 6,
            boxShadow: '0 6px 22px rgba(20,24,29,.24)',
          }}
        >
          <span
            style={{ marginTop: 4, width: 6, height: 6, borderRadius: '50%', background: '#4d8ef0', flex: 'none' }}
          />
          <span style={{ font: "400 12px/1.55 'Noto Sans KR'", color: '#e8ebef' }}>{msg}</span>
        </motion.div>
        ) : null}
      </AnimatePresence>
    </Ctx.Provider>
  );
}
