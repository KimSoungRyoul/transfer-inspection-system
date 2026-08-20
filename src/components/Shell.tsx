'use client';

/**
 * 앱 셸 — 상단바(브랜드·역할탭·알림·계정) + 사이드바 메뉴.
 * 좁은 화면에서는 사이드바가 오프캔버스 드로어가 된다(globals.css).
 */
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { logoutAction } from '@/lib/actions';
import { useToast } from '@/components/Toast';
import { AnimatePresence, motion, backdrop, pressable, stagger, staggerItem } from '@/components/motion';
import type { MeDTO } from '@/lib/domain';

export interface NavItem {
  key: string;
  label: string;
  href: string;
  count: number;
}

/** 메뉴 항목을 stagger 로 등장시키려면 Link 도 motion 컴포넌트여야 한다 */
const MotionLink = motion.create(Link);

const pill = (on: boolean) => ({ background: on ? '#1f5fd0' : 'transparent', color: on ? '#fff' : '#98a1ac' });

export function Shell({
  me,
  nav,
  viaGoogle,
  children,
}: {
  me: MeDTO;
  nav: NavItem[];
  viaGoogle: boolean;
  children: React.ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const isSup = me.role === 'supervisor';
  const home = isSup ? '/supervisor' : '/applicant';
  const view = params.get('view') ?? 'list';

  useEffect(() => setNavOpen(false), [pathname, view]);

  const activeKey = (() => {
    if (pathname.startsWith('/supervisor/judge') || /^\/supervisor\/[^/]+$/.test(pathname)) return 's-judge';
    if (pathname.startsWith('/supervisor')) return view === 'cal' ? 's-cal' : 's-list';
    if (pathname.startsWith('/applicant/new')) return 'a-new';
    return 'a-list';
  })();

  const cls = navOpen ? 'ti-open' : '';

  async function onLogout() {
    const r = await logoutAction();
    toast(r.toast);
    router.replace('/login');
    router.refresh();
  }

  function switchRole(target: 'applicant' | 'supervisor') {
    if (target === me.role) return;
    toast(
      target === 'supervisor'
        ? '감독관 권한이 없는 계정입니다 · 감독관 계정으로 로그인해 주세요'
        : '이관검사 신청자 권한이 없는 계정입니다 · 신청자 계정으로 로그인해 주세요',
    );
  }

  return (
    <div
      className="ti-shell"
      style={{
        display: 'grid',
        gridTemplateColumns: '212px 1fr',
        gridTemplateRows: '52px 1fr',
        height: '100vh',
        minWidth: 1180,
        overflow: 'hidden',
      }}
    >
      <div
        className="ti-topbar"
        style={{
          gridColumn: '1 / -1',
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          padding: '0 18px',
          background: '#171b21',
          borderBottom: '1px solid #000',
        }}
      >
        <button className="ti-navtoggle" onClick={() => setNavOpen((v) => !v)} aria-label="메뉴 열기">
          <span />
        </button>
        {/* 브랜드는 곧 홈 링크다 — 어느 화면에서든 자기 메인으로 돌아올 수 있어야 한다 */}
        <Link
          href={home}
          className="ti-brand h-brand"
          title={isSup ? '신청 접수 목록으로' : '내 신청 현황으로'}
          style={{ display: 'flex', alignItems: 'baseline', gap: 9, textDecoration: 'none' }}
        >
          <span className="ti-brand-title" style={{ font: "700 14px/1 'Noto Sans KR'", color: '#fff', letterSpacing: '-.01em' }}>
            준공 이관검사 시스템
          </span>
        </Link>

        <div
          className="ti-roletabs"
          style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 12, padding: 3, background: '#22282f', borderRadius: 5 }}
        >
          <motion.button
            onClick={() => switchRole('applicant')}
            title={isSup ? '이 계정은 감독관 권한입니다' : undefined}
            {...pressable}
            style={{ padding: '5px 13px', border: 0, borderRadius: 4, font: "500 12px/1.2 'Noto Sans KR'", cursor: 'pointer', ...pill(!isSup) }}
          >
            이관검사 신청자
          </motion.button>
          <motion.button
            onClick={() => switchRole('supervisor')}
            title={!isSup ? '이 계정은 신청자 권한입니다' : undefined}
            {...pressable}
            style={{ padding: '5px 13px', border: 0, borderRadius: 4, font: "500 12px/1.2 'Noto Sans KR'", cursor: 'pointer', ...pill(isSup) }}
          >
            감독관
          </motion.button>
        </div>

        <div style={{ flex: 1 }} />

        <div className="ti-user" style={{ display: 'flex', alignItems: 'center', gap: 9, paddingLeft: 14, borderLeft: '1px solid #2c333b' }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: '#3a434e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              font: "500 11px/1 'Noto Sans KR'",
              color: '#dfe4ea',
            }}
          >
            {me.initial}
          </div>
          <div className="ti-user-meta" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ font: "500 11.5px/1 'Noto Sans KR'", color: '#eceff2' }}>{me.name}</span>
            <span className="ti-user-org" style={{ font: "400 10px/1 'Noto Sans KR'", color: '#7d8794' }}>
              {me.org}
            </span>
          </div>
          {viaGoogle ? <GoogleMark /> : null}
          <motion.button
            onClick={onLogout}
            className="ti-logout h-dark"
            {...pressable}
            style={{
              marginLeft: 4,
              padding: '5px 9px',
              background: 'transparent',
              border: '1px solid #333b45',
              borderRadius: 4,
              font: "400 11px/1.2 'Noto Sans KR'",
              color: '#9aa4b0',
              cursor: 'pointer',
            }}
          >
            로그아웃
          </motion.button>
        </div>
      </div>

      {/*
        사이드바 패널의 오프캔버스 이동은 globals.css 의 .ti-sidebar 규칙(transform + transition)이
        그대로 담당한다 — 여기서 transform 을 인라인으로 덮으면 데스크톱 그리드 배치까지 깨진다.
        motion 은 스크림 페이드와 메뉴 항목 등장에만 관여한다.
      */}
      <AnimatePresence>
        {navOpen ? (
          <motion.button
            className="ti-navscrim ti-open"
            variants={backdrop}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={() => setNavOpen(false)}
            aria-label="메뉴 닫기"
          />
        ) : null}
      </AnimatePresence>

      <motion.div
        className={`ti-sidebar ${cls}`}
        variants={stagger(0.04)}
        initial="hidden"
        animate="show"
        style={{
          background: '#fbfbfc',
          borderRight: '1px solid #dfe3e8',
          padding: '14px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          overflowY: 'auto',
        }}
      >
        <span style={{ padding: '6px 10px 8px', font: "500 10px/1 'Roboto Mono',monospace", color: '#98a1ac', letterSpacing: '.1em' }}>
          MENU
        </span>
        {nav.map((n) => {
          const on = n.key === activeKey;
          return (
            <MotionLink
              key={n.key}
              href={n.href}
              className="h-ee"
              variants={staggerItem}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                width: '100%',
                padding: '8px 10px',
                border: 0,
                borderRadius: 5,
                textAlign: 'left',
                cursor: 'pointer',
                font: "500 12.5px/1.3 'Noto Sans KR'",
                background: on ? '#eaf1fd' : 'transparent',
                color: on ? '#1a52b6' : '#4a5460',
              }}
            >
              <span style={{ width: 3, height: 14, borderRadius: 2, background: on ? '#1f5fd0' : 'transparent' }} />
              <span style={{ flex: 1 }}>{n.label}</span>
              {n.count ? (
                <span
                  style={{
                    padding: '1px 6px',
                    borderRadius: 9,
                    background: on ? '#1f5fd0' : '#e8ebef',
                    color: on ? '#fff' : '#6b7480',
                    font: "500 10.5px/1.6 'Roboto Mono',monospace",
                  }}
                >
                  {n.count}
                </span>
              ) : null}
            </MotionLink>
          );
        })}

        <div style={{ flex: 1 }} />
        <div
          className="ti-sidebar-note"
          style={{
            margin: '10px 4px 0',
            padding: '11px 12px',
            background: '#f2f4f7',
            border: '1px solid #e4e8ec',
            borderRadius: 5,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <span style={{ font: "500 11px/1.3 'Noto Sans KR'", color: '#3c4652' }}>이관검사 기준</span>
          <span style={{ font: "400 10.5px/1.55 'Noto Sans KR'", color: '#77808c' }}>
            입주개시일 이후 하자보증기간 내 신청 · 서류검사 또는 샘플링검사로 1차·최종 2단계 판정
          </span>
        </div>
      </motion.div>

      <div className="ti-content" style={{ overflowY: 'auto', position: 'relative' }}>
        {children}
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 48 48" style={{ display: 'block', flex: 'none' }}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
