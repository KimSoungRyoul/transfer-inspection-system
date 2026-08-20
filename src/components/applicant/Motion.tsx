'use client';

/**
 * 서버 컴포넌트에서 쓰는 전환 래퍼.
 *
 * `motion` 은 클라이언트 모듈이라 서버 컴포넌트에서 `motion.div` 로 dot 접근하면
 * RSC 가 막는다 ("You cannot dot into a client module from a server component").
 * 서버에서 그리는 신청 화면(`/a`, `/applicant/[id]`)은 여기 래퍼를 대신 쓴다.
 *
 * 래퍼는 div 를 새로 덧씌우지 않고 원래 div 를 그대로 대체한다 — className·style 을
 * 넘겨받아 그대로 쓰므로 `ti-*` 반응형 CSS 와 레이아웃이 유지된다.
 */
import { fadeUp, motion, pressable, stagger, staggerItem } from '@/components/motion';

interface BoxProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/** 섹션 진입 — 아래에서 살짝 올라오며 나타난다 */
export function AnimIn({ className, style, children }: BoxProps) {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" className={className} style={style}>
      {children}
    </motion.div>
  );
}

/**
 * 자식 AnimItem 들을 순차로 등장시키는 컨테이너.
 * `nested` 를 주면 스스로 시작하지 않고 상위 전환(AnimIn/AnimItem)에 맞춰 따라 붙는다.
 */
export function AnimGroup({
  each,
  nested,
  className,
  style,
  children,
}: BoxProps & { each?: number; nested?: boolean }) {
  return (
    <motion.div
      variants={stagger(each)}
      initial={nested ? undefined : 'hidden'}
      animate={nested ? undefined : 'show'}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

/** AnimGroup 의 자식 — press 를 주면 눌림 반응이 함께 붙는다 */
export function AnimItem({
  press,
  className,
  style,
  children,
}: BoxProps & { press?: boolean }) {
  return (
    <motion.div
      variants={staggerItem}
      {...(press ? pressable : {})}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}
