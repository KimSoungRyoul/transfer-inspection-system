'use client';

/**
 * 애니메이션 공통 어휘 — motion(motion.dev) 기반.
 *
 * 화면마다 제각각 값을 정하지 않도록 여기 정의된 variants/transition 만 쓴다.
 * 업무 시스템이라 과장된 움직임은 피하고, 짧고(0.16~0.28s) 절제된 전환만 넣는다.
 *
 * 접근성: MotionShell 이 MotionConfig(reducedMotion="user") 로 감싸므로
 * OS 의 "동작 줄이기" 설정을 켠 사용자에게는 자동으로 전환이 사라진다.
 */
import { AnimatePresence, MotionConfig, motion, useReducedMotion, type Variants } from 'motion/react';

export { AnimatePresence, motion, useReducedMotion };
export type { Variants };

/** 표준 이징 — 빠르게 시작해 부드럽게 멈춘다 */
export const EASE = [0.22, 0.61, 0.36, 1] as const;

export const DUR = {
  fast: 0.16,
  base: 0.22,
  slow: 0.28,
} as const;

/* ── 페이지 · 섹션 ────────────────────────────────────────────────── */

/** 화면 진입 — 아래에서 살짝 올라오며 나타난다 */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE } },
};

/** 단순 페이드 (레이아웃을 흔들면 안 되는 곳) */
export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DUR.base, ease: EASE } },
  exit: { opacity: 0, transition: { duration: DUR.fast, ease: EASE } },
};

/**
 * 자식들을 순차로 등장시킨다.
 * delayChildren 없이 짧은 간격만 준다 — 카드 4장 기준 총 0.1s 안쪽.
 */
export const stagger = (each = 0.035): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: each } },
});

/** stagger 의 자식 */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE } },
};

/* ── 오버레이 ────────────────────────────────────────────────────── */

export const backdrop: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DUR.fast, ease: EASE } },
  exit: { opacity: 0, transition: { duration: DUR.fast, ease: EASE } },
};

/** 가운데 모달 */
export const modalPanel: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: DUR.base, ease: EASE } },
  exit: { opacity: 0, y: 6, scale: 0.99, transition: { duration: DUR.fast, ease: EASE } },
};

/** 우측 드로어 */
export const drawerPanel: Variants = {
  hidden: { x: '100%' },
  show: { x: 0, transition: { duration: DUR.slow, ease: EASE } },
  exit: { x: '100%', transition: { duration: DUR.base, ease: EASE } },
};

/** 좌측 오프캔버스 사이드바(모바일) */
export const sidebarPanel: Variants = {
  hidden: { x: '-101%' },
  show: { x: 0, transition: { duration: DUR.base, ease: EASE } },
  exit: { x: '-101%', transition: { duration: DUR.fast, ease: EASE } },
};

/** 토스트 */
export const toastPop: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: DUR.base, ease: EASE } },
  exit: { opacity: 0, y: 8, scale: 0.98, transition: { duration: DUR.fast, ease: EASE } },
};

/* ── 인터랙션 ────────────────────────────────────────────────────── */

/** 카드형 버튼 — 눌림 반응만 준다 (hover 는 CSS 가 담당) */
export const pressable = {
  whileHover: { y: -1 },
  whileTap: { scale: 0.99 },
  transition: { duration: DUR.fast, ease: EASE },
} as const;

/** 목록 행 — 대량 데이터라 y 이동 없이 페이드만 */
export const rowFade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DUR.fast, ease: EASE } },
};

/**
 * 목록이 길 때 stagger 를 그대로 걸면 마지막 행이 수 초 뒤에 나타난다.
 * 앞의 몇 개만 순차로 등장시키고 나머지는 즉시 보여 준다.
 */
export const cappedDelay = (index: number, each = 0.02, cap = 12): number =>
  index < cap ? index * each : cap * each;

/* ── 셸 ──────────────────────────────────────────────────────────── */

/** 앱 전체를 감싸 reduced-motion 을 존중하게 한다 */
export function MotionShell({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: DUR.base, ease: EASE }}>
      {children}
    </MotionConfig>
  );
}
