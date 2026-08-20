'use client';

/**
 * 로그인 · 회원가입 화면 — 프로토타입의 인증 화면을 그대로 옮긴 것.
 * 좌측 히어로 + 우측 패널 2단 그리드이며, 반응형은 globals.css 의 ti-auth* 규칙이 담당한다.
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { loginAction, signupAction } from '@/lib/actions';
import type { RoleKey } from '@/lib/domain';
import { formatPhone, validate } from '@/lib/form';
import { useToast } from '@/components/Toast';
import {
  AnimatePresence,
  motion,
  fade,
  pressable,
  stagger,
  staggerItem,
  DUR,
  EASE,
} from '@/components/motion';

import { GoogleG } from './GoogleG';
import { GoogleModal } from './GoogleModal';

/* 프로토타입 chip() 과 같은 색 규칙 */
const ROLES: [string, RoleKey][] = [
  ['이관검사 신청자', 'applicant'],
  ['감독관', 'supervisor'],
];

const CAP: React.CSSProperties = { font: "500 11.5px/1.2 'Noto Sans KR'", color: '#5b6672' };
const LABEL: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 };
const FIELD: React.CSSProperties = {
  width: '100%',
  padding: '9px 10px',
  border: '1px solid #d3d8de',
  borderRadius: 4,
  font: "400 12.5px/1.4 'Noto Sans KR'",
  outline: 'none',
};
const PRIMARY: React.CSSProperties = {
  width: '100%',
  padding: 12,
  background: '#1f5fd0',
  color: '#fff',
  border: '1px solid #1f5fd0',
  borderRadius: 4,
  font: "500 13px/1.2 'Noto Sans KR'",
  cursor: 'pointer',
};
const GBTN: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  width: '100%',
  height: 40,
  padding: '0 12px',
  background: '#fff',
  border: '1px solid #747775',
  borderRadius: 20,
  cursor: 'pointer',
  font: "500 14px/20px Roboto,'Noto Sans KR',arial,sans-serif",
  color: '#1f1f1f',
  letterSpacing: '.25px',
};
const LINKBTN: React.CSSProperties = {
  padding: 0,
  border: 0,
  background: 'none',
  font: "500 12px/1.4 'Noto Sans KR'",
  color: '#1f5fd0',
  cursor: 'pointer',
};
/** 비밀번호 칸은 눈 아이콘 자리를 오른쪽에 비워 둔다 */
const PWFIELD: React.CSSProperties = { ...FIELD, paddingRight: 34 };

/* ── 인라인 검증 표시 ─────────────────────────────────────────────── */

const ERR: React.CSSProperties = {
  font: "400 10.5px/1.45 'Noto Sans KR'",
  color: '#a32b25',
  wordBreak: 'keep-all',
};

/** 오류가 있으면 globals.css 의 ti-field-bad 가 테두리를 붉게 바꾼다 */
const fieldClass = (bad: boolean) => (bad ? 'ti-field ti-field-bad' : 'ti-field');

function Err({ msg }: { msg?: string }) {
  return msg ? <span style={ERR}>{msg}</span> : null;
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {off ? (
        <>
          <path d="M10.6 5.2A9.6 9.6 0 0 1 12 5.1c5.5 0 9 6.9 9 6.9a17 17 0 0 1-3.2 4.1" />
          <path d="M6.3 6.7A17 17 0 0 0 3 12s3.5 6.9 9 6.9a9.5 9.5 0 0 0 4.3-1" />
          <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
          <path d="M3.4 3.4l17.2 17.2" />
        </>
      ) : (
        <>
          <path d="M3 12s3.5-6.9 9-6.9 9 6.9 9 6.9-3.5 6.9-9 6.9S3 12 3 12Z" />
          <circle cx="12" cy="12" r="2.9" />
        </>
      )}
    </svg>
  );
}

/** 입력칸 오른쪽에 겹쳐 두는 비밀번호 보기 토글 */
function PwToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  const [hover, setHover] = useState(false);
  const label = shown ? '비밀번호 숨기기' : '비밀번호 보기';
  return (
    <button
      type="button"
      onClick={onToggle}
      /* 눌러도 입력 포커스를 뺏지 않는다 */
      onMouseDown={(e) => e.preventDefault()}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={label}
      title={label}
      style={{
        position: 'absolute',
        right: 7,
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 22,
        padding: 0,
        border: 0,
        background: 'none',
        color: hover ? '#5b6672' : '#98a1ac',
        cursor: 'pointer',
      }}
    >
      <EyeIcon off={shown} />
    </button>
  );
}

/**
 * 비밀번호 강도 — 8자 이상 · 영문 · 숫자 · (12자 이상 또는 기호) 4가지를 센다.
 * 색은 기존 팔레트만 쓴다.
 */
const STRENGTH: [string, string][] = [
  ['', '#e8ebef'],
  ['약함', '#a32b25'],
  ['약함', '#a32b25'],
  ['보통', '#9a5b12'],
  ['좋음', '#1f7a43'],
];

function pwScore(v: string): number {
  if (!v) return 0;
  let n = 0;
  if (v.length >= 8) n += 1;
  if (/[A-Za-z]/.test(v)) n += 1;
  if (/\d/.test(v)) n += 1;
  if (v.length >= 12 || /[^A-Za-z0-9]/.test(v)) n += 1;
  return n;
}

function PwStrength({ value }: { value: string }) {
  const n = pwScore(value);
  const [label, color] = STRENGTH[n];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ display: 'flex', gap: 3, flex: 1, minWidth: 0 }}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background: i < n ? color : '#e8ebef',
              transition: 'background-color .16s ease',
            }}
          />
        ))}
      </div>
      <span
        style={{
          font: "400 10.5px/1.45 'Noto Sans KR'",
          color: n ? color : '#98a1ac',
          whiteSpace: 'nowrap',
        }}
      >
        {label || '영문·숫자 8자 이상'}
      </span>
    </div>
  );
}

function RoleChips({ role, onPick }: { role: RoleKey; onPick: (r: RoleKey) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={CAP}>사용자 유형</span>
      <div style={{ display: 'flex', gap: 6 }}>
        {ROLES.map(([label, r]) => {
          const active = role === r;
          return (
            <motion.button
              key={r}
              type="button"
              onClick={() => onPick(r)}
              {...pressable}
              style={{
                position: 'relative',
                overflow: 'hidden',
                flex: 1,
                padding: '9px 10px',
                borderRadius: 4,
                font: "500 12.5px/1.2 'Noto Sans KR'",
                cursor: 'pointer',
                /* 활성 배경은 layoutId 를 가진 아래 span 이 그린다 — 칩 사이를 미끄러지듯 옮겨간다 */
                background: '#fff',
                color: active ? '#fff' : '#3c4652',
                border: `1px solid ${active ? '#1f5fd0' : '#d3d8de'}`,
                transition: 'border-color .16s ease, color .16s ease',
              }}
            >
              {active ? (
                <motion.span
                  layoutId="ti-role-chip"
                  transition={{ duration: DUR.base, ease: EASE }}
                  style={{ position: 'absolute', inset: 0, background: '#1f5fd0', borderRadius: 3 }}
                />
              ) : null}
              <span style={{ position: 'relative' }}>{label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

export function AuthScreen() {
  const router = useRouter();
  const toast = useToast();

  const [screen, setScreen] = useState<'login' | 'signup'>('login');
  const [loginRole, setLoginRole] = useState<RoleKey>('applicant');
  const [gOpen, setGOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [keepLogin, setKeepLogin] = useState(true);

  const [suName, setSuName] = useState('');
  const [suPhone, setSuPhone] = useState('');
  const [suEmail, setSuEmail] = useState('');
  const [suOrg, setSuOrg] = useState('');
  const [suPw, setSuPw] = useState('');
  const [suPw2, setSuPw2] = useState('');
  const [agree, setAgree] = useState(false);

  const [errs, setErrs] = useState<Record<string, string>>({});
  const [showPw, setShowPw] = useState(false);
  const [showSuPw, setShowSuPw] = useState(false);
  const [showSuPw2, setShowSuPw2] = useState(false);

  /** 값을 고치면 그 항목 오류는 즉시 지운다 */
  const clearErr = (key: string) =>
    setErrs((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });

  const edit = (set: (v: string) => void, key: string) => (v: string) => {
    set(v);
    clearErr(key);
  };

  const goScreen = (s: 'login' | 'signup') => {
    setErrs({});
    setScreen(s);
  };

  /**
   * 제출 전 검사 — 서버 스키마와 같은 기준으로 본다.
   * 오류가 있으면 인라인 문구를 띄우고 첫 문구를 토스트로도 알린다.
   */
  function check(pairs: [string, string][]): boolean {
    const bad = pairs.filter(([, m]) => m);
    setErrs(Object.fromEntries(bad));
    if (!bad.length) return true;
    toast(bad[0][1]);
    return false;
  }

  /** 성공하면 이동하므로 pending 을 풀지 않는다 — 이동 중 재제출을 막는다 */
  const run = async (call: () => Promise<{ ok: boolean; toast: string; goto?: string }>) => {
    if (pending) return;
    setPending(true);
    const r = await call();
    toast(r.toast);
    if (r.ok && r.goto) {
      router.replace(r.goto);
      router.refresh();
      return;
    }
    setPending(false);
  };

  const doLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = check([
      ['email', validate('이메일', email, { kind: 'email', required: true })],
      ['pw', validate('비밀번호', pw, { required: true })],
    ]);
    if (!ok) return;
    void run(() => loginAction({ email, password: pw, role: loginRole, keepLogin }));
  };

  const doSignup = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = check([
      ['suName', validate('이름', suName, { required: true })],
      /* 연락처·소속은 서버에서도 선택 항목이다 — 적었을 때만 형식을 본다 */
      ['suPhone', validate('연락처', suPhone, { kind: 'tel' })],
      ['suEmail', validate('이메일', suEmail, { kind: 'email', required: true })],
      [
        'suPw',
        validate('비밀번호', suPw, { required: true }) ||
          (suPw.length < 8 ? '비밀번호는 8자 이상이어야 합니다' : ''),
      ],
      [
        'suPw2',
        validate('비밀번호 확인', suPw2, { required: true }) ||
          (suPw2 !== suPw ? '비밀번호가 일치하지 않습니다' : ''),
      ],
      ['agree', agree ? '' : '개인정보 수집·이용 동의가 필요합니다'],
    ]);
    if (!ok) return;
    void run(() =>
      signupAction({
        name: suName,
        phone: suPhone,
        email: suEmail,
        org: suOrg,
        password: suPw,
        password2: suPw2,
        role: loginRole,
        agree,
      }),
    );
  };

  return (
    <>
      <div
        className="ti-auth"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 468px',
          height: '100vh',
          minWidth: 1180,
          overflow: 'hidden',
        }}
      >
        <div
          className="ti-auth-hero"
          style={{
            background: '#171b21',
            padding: '44px 48px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <motion.div
            variants={stagger(0.05)}
            initial="hidden"
            animate="show"
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <motion.span
              variants={staggerItem}
              style={{
                font: "400 10.5px/1 'Roboto Mono',monospace",
                color: '#7d8794',
                letterSpacing: '.14em',
              }}
            >
              TRANSFER INSPECTION SYSTEM
            </motion.span>
            <motion.span
              variants={staggerItem}
              style={{ font: "700 26px/1.35 'Noto Sans KR'", color: '#fff', letterSpacing: '-.02em' }}
            >
              준공 이관검사 시스템
            </motion.span>
            <motion.span
              variants={staggerItem}
              style={{ maxWidth: 420, font: "400 13px/1.75 'Noto Sans KR'", color: '#9aa4b0' }}
            >
              이관검사 신청부터 감독관 검토승인, 1차·최종 합격·불합격 판정과 결과 통보까지 한 곳에서
              처리합니다.
            </motion.span>
          </motion.div>
          <div
            className="ti-auth-hero-foot"
            style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 440 }}
          >
            <div style={{ height: 1, background: '#2c333b' }} />
            <motion.div
              className="ti-auth-stats"
              variants={stagger()}
              initial="hidden"
              animate="show"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}
            >
              <motion.div variants={staggerItem} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ font: "500 16px/1 'Roboto Mono',monospace", color: '#4d8ef0' }}>DDL</span>
                <span style={{ font: "400 11px/1.55 'Noto Sans KR'", color: '#7d8794' }}>
                  도어록 양식 41개 항목
                </span>
              </motion.div>
              <motion.div variants={staggerItem} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ font: "500 16px/1 'Roboto Mono',monospace", color: '#4d8ef0' }}>
                  HN/HA
                </span>
                <span style={{ font: "400 11px/1.55 'Noto Sans KR'", color: '#7d8794' }}>
                  홈네트워크 양식 58개 항목
                </span>
              </motion.div>
              <motion.div variants={staggerItem} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ font: "500 16px/1 'Roboto Mono',monospace", color: '#4d8ef0' }}>
                  2단계
                </span>
                <span style={{ font: "400 11px/1.55 'Noto Sans KR'", color: '#7d8794' }}>
                  1차 판정 · 최종 판정
                </span>
              </motion.div>
            </motion.div>
          </div>
        </div>

        <div
          className="ti-auth-panel"
          style={{
            background: '#fff',
            borderLeft: '1px solid #dfe3e8',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '0 54px',
            overflowY: 'auto',
          }}
        >
          {/* 로그인 ↔ 회원가입 — 내용 높이가 달라 y 이동 없이 페이드로만 교체한다 */}
          <AnimatePresence mode="wait">
            {screen === 'login' ? (
              <motion.form
                key="login"
                variants={fade}
                initial="hidden"
                animate="show"
                exit="exit"
                onSubmit={doLogin}
                /* 브라우저 기본 말풍선 대신 아래 인라인 오류를 쓴다 */
                noValidate
                style={{
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 20,
                  padding: '40px 0',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ font: "700 19px/1.3 'Noto Sans KR'", letterSpacing: '-.01em' }}>
                    로그인
                  </span>
                  <span style={{ font: "400 12px/1.5 'Noto Sans KR'", color: '#6b7480' }}>
                    사내 계정 또는 협력사 계정으로 접속하세요
                  </span>
                </div>

                <RoleChips role={loginRole} onPick={setLoginRole} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                  <label style={LABEL}>
                    <span style={CAP}>이메일 (사번)</span>
                    <input
                      className={fieldClass(!!errs.email)}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      aria-invalid={errs.email ? true : undefined}
                      value={email}
                      onChange={(e) => edit(setEmail, 'email')(e.target.value)}
                      placeholder="user1@gmail.com"
                      style={{ ...FIELD, color: '#1a1d21' }}
                    />
                    <Err msg={errs.email} />
                  </label>
                  <label style={LABEL}>
                    <span style={CAP}>비밀번호</span>
                    <div style={{ position: 'relative' }}>
                      <input
                        className={fieldClass(!!errs.pw)}
                        type={showPw ? 'text' : 'password'}
                        autoComplete="current-password"
                        aria-invalid={errs.pw ? true : undefined}
                        value={pw}
                        onChange={(e) => edit(setPw, 'pw')(e.target.value)}
                        placeholder="••••••••"
                        style={{ ...PWFIELD, color: '#1a1d21' }}
                      />
                      <PwToggle shown={showPw} onToggle={() => setShowPw((v) => !v)} />
                    </div>
                    <Err msg={errs.pw} />
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={keepLogin}
                        onChange={(e) => setKeepLogin(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ font: "400 11.5px/1.2 'Noto Sans KR'", color: '#3c4652' }}>
                        로그인 상태 유지
                      </span>
                    </label>
                    <div style={{ flex: 1 }} />
                    <a href="#" style={{ font: "400 11.5px/1.2 'Noto Sans KR'" }}>
                      비밀번호 찾기
                    </a>
                  </div>
                </div>

                <motion.button type="submit" className="h-blue" disabled={pending} {...pressable} style={PRIMARY}>
                  로그인
                </motion.button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ flex: 1, height: 1, background: '#eceff2' }} />
                  <span style={{ font: "400 11px/1 'Noto Sans KR'", color: '#98a1ac' }}>또는</span>
                  <span style={{ flex: 1, height: 1, background: '#eceff2' }} />
                </div>

                <button
                  type="button"
                  className="h-f2"
                  disabled={pending}
                  onClick={() => setGOpen(true)}
                  style={GBTN}
                >
                  <GoogleG size={18} />
                  <span>Sign in with Google</span>
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 2 }}>
                  <span style={{ font: "400 12px/1.4 'Noto Sans KR'", color: '#6b7480' }}>
                    계정이 없으신가요?
                  </span>
                  <button type="button" onClick={() => goScreen('signup')} style={LINKBTN}>
                    회원가입
                  </button>
                </div>

                <div
                  style={{
                    padding: '11px 13px',
                    background: '#fbfbfc',
                    border: '1px solid #eceff2',
                    borderRadius: 4,
                    font: "400 11px/1.65 'Noto Sans KR'",
                    color: '#77808c',
                  }}
                >
                  협력사(설치점) 계정은 회원가입 후 담당 현장PM 승인 시 이관검사 신청 권한이
                  부여됩니다.
                </div>

                <span
                  style={{
                    marginTop: -8,
                    font: "400 11px/1.65 'Noto Sans KR'",
                    color: '#98a1ac',
                    wordBreak: 'keep-all',
                  }}
                >
                  데모 계정 — 신청자 user1@gmail.com · 감독관 user2@gmail.com · 비밀번호
                  1234
                </span>
              </motion.form>
            ) : (
              <motion.form
                key="signup"
                variants={fade}
                initial="hidden"
                animate="show"
                exit="exit"
                onSubmit={doSignup}
                noValidate
                style={{
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 17,
                  padding: '40px 0',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ font: "700 19px/1.3 'Noto Sans KR'", letterSpacing: '-.01em' }}>
                    회원가입
                  </span>
                  <span style={{ font: "400 12px/1.5 'Noto Sans KR'", color: '#6b7480' }}>
                    이관검사 신청자 또는 감독관 계정을 생성합니다
                  </span>
                </div>

                <RoleChips role={loginRole} onPick={setLoginRole} />

                <div
                  className="ti-g2"
                  style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '13px 14px' }}
                >
                  <label style={LABEL}>
                    <span style={CAP}>이름</span>
                    <input
                      className={fieldClass(!!errs.suName)}
                      autoComplete="name"
                      aria-invalid={errs.suName ? true : undefined}
                      value={suName}
                      onChange={(e) => edit(setSuName, 'suName')(e.target.value)}
                      placeholder="이서준"
                      style={FIELD}
                    />
                    <Err msg={errs.suName} />
                  </label>
                  <label style={LABEL}>
                    <span style={CAP}>연락처</span>
                    <input
                      className={fieldClass(!!errs.suPhone)}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      aria-invalid={errs.suPhone ? true : undefined}
                      value={suPhone}
                      /* 입력하는 대로 하이픈을 넣는다 */
                      onChange={(e) => edit(setSuPhone, 'suPhone')(formatPhone(e.target.value))}
                      placeholder="010-0000-0000"
                      style={FIELD}
                    />
                    <Err msg={errs.suPhone} />
                  </label>
                  <label style={{ ...LABEL, gridColumn: '1 / -1' }}>
                    <span style={CAP}>이메일</span>
                    <input
                      className={fieldClass(!!errs.suEmail)}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      aria-invalid={errs.suEmail ? true : undefined}
                      value={suEmail}
                      onChange={(e) => edit(setSuEmail, 'suEmail')(e.target.value)}
                      placeholder="user1@gmail.com"
                      style={FIELD}
                    />
                    <Err msg={errs.suEmail} />
                  </label>
                  <label style={{ ...LABEL, gridColumn: '1 / -1' }}>
                    <span style={CAP}>소속 (설치점명 · 원청 · 부서)</span>
                    <input
                      className="ti-field"
                      autoComplete="organization"
                      value={suOrg}
                      onChange={(e) => setSuOrg(e.target.value)}
                      placeholder="세움테크 / 서비스 준공검사팀"
                      style={FIELD}
                    />
                  </label>
                  <label style={LABEL}>
                    <span style={CAP}>비밀번호</span>
                    <div style={{ position: 'relative' }}>
                      <input
                        className={fieldClass(!!errs.suPw)}
                        type={showSuPw ? 'text' : 'password'}
                        autoComplete="new-password"
                        aria-invalid={errs.suPw ? true : undefined}
                        value={suPw}
                        onChange={(e) => edit(setSuPw, 'suPw')(e.target.value)}
                        placeholder="영문·숫자 8자 이상"
                        style={PWFIELD}
                      />
                      <PwToggle shown={showSuPw} onToggle={() => setShowSuPw((v) => !v)} />
                    </div>
                    <PwStrength value={suPw} />
                    <Err msg={errs.suPw} />
                  </label>
                  <label style={LABEL}>
                    <span style={CAP}>비밀번호 확인</span>
                    <div style={{ position: 'relative' }}>
                      <input
                        className={fieldClass(!!errs.suPw2)}
                        type={showSuPw2 ? 'text' : 'password'}
                        autoComplete="new-password"
                        aria-invalid={errs.suPw2 ? true : undefined}
                        value={suPw2}
                        onChange={(e) => edit(setSuPw2, 'suPw2')(e.target.value)}
                        placeholder="다시 입력"
                        style={PWFIELD}
                      />
                      <PwToggle shown={showSuPw2} onToggle={() => setShowSuPw2((v) => !v)} />
                    </div>
                    <Err msg={errs.suPw2} />
                  </label>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}
                  >
                    <input
                      type="checkbox"
                      checked={agree}
                      onChange={(e) => {
                        setAgree(e.target.checked);
                        clearErr('agree');
                      }}
                      style={{ marginTop: 2, cursor: 'pointer' }}
                    />
                    <span style={{ font: "400 11.5px/1.6 'Noto Sans KR'", color: '#3c4652' }}>
                      이관검사 업무 처리를 위한 개인정보(이름·연락처·소속) 수집·이용에 동의합니다.{' '}
                      <span style={{ color: '#98a1ac' }}>(필수)</span>
                    </span>
                  </label>
                  <Err msg={errs.agree} />
                </div>

                <motion.button type="submit" className="h-blue" disabled={pending} {...pressable} style={PRIMARY}>
                  가입 후 로그인
                </motion.button>

                <button
                  type="button"
                  className="h-f2"
                  disabled={pending}
                  onClick={() => setGOpen(true)}
                  style={GBTN}
                >
                  <GoogleG size={18} />
                  <span>Sign up with Google</span>
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ font: "400 12px/1.4 'Noto Sans KR'", color: '#6b7480' }}>
                    이미 계정이 있으신가요?
                  </span>
                  <button type="button" onClick={() => goScreen('login')} style={LINKBTN}>
                    로그인
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>

      <GoogleModal open={gOpen} onClose={() => setGOpen(false)} />
    </>
  );
}
