'use client';

/**
 * 감독관 접수 목록 — KPI 4장 · 이번주 방문 일정 · 필터/정렬 표 · 일괄 검토승인.
 * view=cal 이면 같은 카드 안에서 방문 캘린더로 바뀐다.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { bulkApproveAction } from '@/lib/actions';
import { STATUS_NOTE, today, type ApplicationDTO, type ExternalVisitDTO } from '@/lib/domain';
import { fmtInput, parseDot, weekDates } from '@/lib/date';
import { INSPECT_TYPES, type InspectTypeLabel } from '@/lib/domain';
import {
  KPI_DEFS,
  drawerModeOf,
  isPending,
  pill,
  rowBase,
  scheduleDays,
  type KpiDef,
} from '@/lib/view';
import { useToast } from '@/components/Toast';
import {
  AnimatePresence,
  DUR,
  EASE,
  fade,
  fadeUp,
  motion,
  pressable,
  stagger,
  staggerItem,
} from '@/components/motion';
import { CalendarView } from '@/components/supervisor/CalendarView';
import { KpiModal, rowAction } from '@/components/supervisor/KpiModal';
import { ProcessDrawer, type DrawerMode } from '@/components/supervisor/ProcessDrawer';

type SortKey = 'reqDate' | 'visitDate';

const COMPLETED = ['최종합격', '조건부합격', '불합격', '보류', '이월'];

const VIEWS: ['list' | 'cal', string][] = [
  ['list', '목록'],
  ['cal', '방문 캘린더'],
];

const kpiStagger = stagger(0.04);
const dayStagger = stagger(0.05);
const dayItemStagger = stagger(0.03);

/**
 * 표가 길어 헤더가 스크롤 밖으로 사라지면 어느 열인지 알 수 없다.
 * 배경색을 반드시 함께 두어야 행이 헤더 뒤로 비쳐 보이지 않는다.
 */
const stickyHead: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 1,
  background: '#f7f8fa',
};

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  font: "500 11.5px/1.2 'Noto Sans KR'",
  color: '#6b7480',
  textAlign: 'left',
  borderBottom: '1px solid #dfe3e8',
  whiteSpace: 'nowrap',
  ...stickyHead,
};

/** 감독관이 처리할 수 있는(= 일괄 검토승인 대상) 행인지 */
const canBulk = isPending;

/**
 * KPI 정의는 view.ts 가 갖고 있지만, 감독관 목록에는 "보완요청 회신 대기" 가 하나 더 필요하다.
 * 보완요청은 공이 신청자에게 넘어간 상태라 감독관 화면에서 놓치기 쉽다.
 */
const KPI_LIST: KpiDef[] = [
  ...KPI_DEFS.slice(0, 2),
  {
    key: 'fix',
    label: '보완요청 회신 대기',
    color: '#9a5b12',
    pick: (x) => x.status === '보완요청',
    hint: '신청자의 재신청을 기다리는 건입니다 · 회신이 늦으면 담당자에게 연락하세요',
  },
  ...KPI_DEFS.slice(2),
];

const tdMono: React.CSSProperties = {
  padding: '9px 12px',
  font: "400 12px/1.4 'Roboto Mono',monospace",
  color: '#4a5460',
  borderBottom: '1px solid #eceff2',
  whiteSpace: 'nowrap',
};

const tdText: React.CSSProperties = {
  padding: '9px 12px',
  font: "400 12.5px/1.4 'Noto Sans KR'",
  color: '#4a5460',
  borderBottom: '1px solid #eceff2',
  whiteSpace: 'nowrap',
};

const selectStyle: React.CSSProperties = {
  padding: '6px 8px',
  border: '1px solid #d3d8de',
  borderRadius: 4,
  font: "400 12px/1.2 'Noto Sans KR'",
  background: '#fff',
  color: '#1a1d21',
};

/** 목록의 상태 — URL 로 올려 두면 상세를 보고 돌아와도 그대로 남는다 */
export interface ListFilters {
  year: string;
  product: string;
  status: string;
  q: string;
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
}

export function ListClient({
  apps,
  external,
  view,
  filters,
}: {
  apps: ApplicationDTO[];
  external: ExternalVisitDTO[];
  view: 'list' | 'cal';
  filters: ListFilters;
}) {
  const router = useRouter();
  const toast = useToast();

  const [fYear, setFYear] = useState(filters.year);
  const [fProduct, setFProduct] = useState(filters.product);
  const [fStatus, setFStatus] = useState(filters.status);
  const [q, setQ] = useState(filters.q);
  /**
   * 252건을 매 타이핑마다 필터링하면 입력이 버벅인다.
   * 화면 입력은 q 가 즉시 받고, 실제 필터는 250ms 쉰 뒤의 값으로 돈다.
   */
  const [qDebounced, setQDebounced] = useState(filters.q);
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const [sortKey, setSortKey] = useState<SortKey>(filters.sortKey);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(filters.sortDir);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [kpiModal, setKpiModal] = useState<string | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('review');
  const [busy, setBusy] = useState(false);

  const base = today();
  const week = useMemo(() => weekDates(base), [base]);

  /* ── 필터 · 정렬 (프로토타입 supList 그대로) ── */
  const supList = useMemo(() => {
    let list = apps;
    if (fYear) list = list.filter((x) => x.year === fYear);
    if (fProduct) list = list.filter((x) => x.product === fProduct);
    if (fStatus) {
      list = list.filter((x) =>
        fStatus === '완료' ? COMPLETED.includes(x.status) : x.status === fStatus,
      );
    }
    if (qDebounced) {
      // 전화로 불러 주는 식별번호, 지역·설치점·담당자로도 찾을 수 있어야 한다
      const needle = qDebounced.toLowerCase();
      list = list.filter((x) =>
        (x.id + x.site + x.owner + x.code + x.region + x.installer + x.manager + x.pm)
          .toLowerCase()
          .includes(needle),
      );
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    const key = (x: ApplicationDTO) => (sortKey === 'reqDate' ? x.reqDate : x.visitDate);
    return list.slice().sort((p, q2) => {
      const a1 = key(p) || '';
      const b1 = key(q2) || '';
      if (!a1 && !b1) return 0;
      if (!a1) return 1;
      if (!b1) return -1;
      return a1 < b1 ? -dir : a1 > b1 ? dir : 0;
    });
  }, [apps, fYear, fProduct, fStatus, qDebounced, sortKey, sortDir]);

  /**
   * 일괄 검토승인은 한 번에 수십 건의 방문일을 확정한다.
   * 바로 실행하지 않고 확인 단계를 거쳐, 날짜와 검사종류를 직접 정하게 한다.
   */
  /**
   * 접수 건이 수백 건까지 쌓이므로 표를 한 번에 다 그리지 않는다.
   * 캘린더의 '+N건 더보기' 와 같은 어휘로 필요한 만큼만 펼친다.
   */
  const PAGE = 50;
  const [shown, setShown] = useState(PAGE);

  const [bulkConfirm, setBulkConfirm] = useState(false);
  /*
   * 기본값을 비워 둔다. 오늘로 채워 두면 날짜를 만지지 않고 누른 순간
   * 수십 명에게 그 날짜가 확정 통보된다 — 데모 기준일은 일요일이다.
   * 확정 버튼은 이미 !bulkDate 일 때 비활성이라 빈 값이 안전하게 막힌다.
   */
  const [bulkDate, setBulkDate] = useState('');
  const [bulkType, setBulkType] = useState<InspectTypeLabel>('서류검사');

  /**
   * 필터·정렬을 URL 로 올린다 — 상세를 보고 뒤로 오면 좁혀 둔 목록이 그대로 복원된다.
   * 히스토리가 더러워지지 않도록 replace 로만 갱신하고, 스크롤 위치도 건드리지 않는다.
   */
  const hrefOf = (v: 'list' | 'cal') => {
    const p = new URLSearchParams();
    if (v === 'cal') p.set('view', 'cal');
    if (fYear) p.set('year', fYear);
    if (fProduct) p.set('product', fProduct);
    if (fStatus) p.set('status', fStatus);
    if (qDebounced) p.set('q', qDebounced);
    if (sortKey !== 'reqDate') p.set('sort', sortKey);
    if (sortDir !== 'desc') p.set('dir', sortDir);
    const qs = p.toString();
    return qs ? `/supervisor?${qs}` : '/supervisor';
  };
  const href = hrefOf(view);
  const lastHref = useRef(href);
  useEffect(() => {
    if (lastHref.current === href) return;
    lastHref.current = href;
    router.replace(href, { scroll: false });
  }, [href, router]);

  const hasFilter = !!(fYear || fProduct || fStatus || q);
  const resetFilters = () => {
    setFYear('');
    setFProduct('');
    setFStatus('');
    setQ('');
  };

  const sortHead = (key: SortKey) => ({
    arrow: sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : '↕',
    color: sortKey === key ? '#1f5fd0' : '#a2abb5',
    labelColor: sortKey === key ? '#1f5fd0' : '#6b7480',
    sort: () => {
      setSortDir((d) => (sortKey === key && d === 'desc' ? 'asc' : 'desc'));
      setSortKey(key);
    },
  });
  const sortReq = sortHead('reqDate');
  const sortVisit = sortHead('visitDate');

  /* ── 처리 드로어 ── */
  const openProcess = (x: ApplicationDTO) => {
    setKpiModal(null);
    setDrawerId(x.id);
    setDrawerMode(drawerModeOf(x));
  };
  const drawerApp = drawerId ? apps.find((a) => a.id === drawerId) : undefined;

  /* ── 이번주 방문 일정 ── */
  const weekDays = useMemo(() => {
    const from = week[0] ?? base;
    const to = week[6] ?? base;
    return scheduleDays(apps, external, from)
      .filter((d) => d.full >= from && d.full <= to)
      .map((d) => {
        const isToday = d.full === base;
        return {
          full: d.full,
          label: `${d.date} (${d.dow})`,
          showToday: isToday,
          stops: d.stops,
          span: d.span,
          headBg: isToday ? '#eaf1fd' : '#f7f8fa',
          headFg: isToday ? '#1a52b6' : '#4a5460',
          bd: isToday ? '#cfe0fa' : '#e4e8ec',
          items: d.items.map((it, i) => {
            const app = it.appId ? (apps.find((a) => a.id === it.appId) ?? null) : null;
            return {
              key: `${d.full}-${i}`,
              t: it.t,
              site: it.site,
              meta: it.meta,
              app,
              tag: app ? '접수 건' : '외부 일정',
              tagBg: app ? '#eaf1fd' : '#eef0f3',
              tagFg: app ? '#1a52b6' : '#6b7480',
              cardBg: app ? '#f7faff' : '#fff',
              cardBd: app ? '#cfe0fa' : '#e8ebef',
              titleColor: app ? '#1a52b6' : '#3c4652',
              timeColor: app ? '#1a52b6' : '#8b95a1',
              cursor: app ? 'pointer' : 'default',
              showAct: !!app,
              actText: app ? `${rowAction(app).label} ›` : '',
              actColor: '#1f5fd0',
            };
          }),
        };
      });
  }, [apps, external, week, base]);

  const weekStops = weekDays.reduce((n, d) => n + d.items.length, 0);
  const weekOwn = weekDays.reduce((n, d) => n + d.items.filter((i) => i.showAct).length, 0);
  const weekRange = week.length ? `${week[0]} – ${week[6].slice(5)}` : '';
  const weekSummary = `총 ${weekStops}개 현장 · 접수 건 ${weekOwn}건 (클릭하면 처리 화면이 열립니다)`;

  /* ── KPI ── */
  const supKpi = KPI_LIST.map((k) => ({
    ...k,
    n: apps.filter((x) => k.pick(x, week)).length,
    sub: '건',
  }));
  const kpiDef = KPI_LIST.find((k) => k.key === kpiModal) ?? null;
  const kpiList = kpiDef ? apps.filter((x) => kpiDef.pick(x, week)) : [];

  /* ── 체크박스 · 일괄 처리 ── */
  const checkedIds = Object.keys(checked).filter((k) => checked[k]);
  /**
   * 전체 선택은 **화면에 보이는 행**까지만 잡는다.
   * 접힌 행까지 함께 선택되면, 일괄 승인 때 본 적 없는 건이 딸려 들어간다.
   */
  const visible = useMemo(() => supList.slice(0, shown), [supList, shown]);
  /**
   * 일괄 검토승인은 승인 가능한 상태에만 걸린다.
   * 서버가 걸러 내기는 하지만, 애초에 고를 수 없어야 "62건 선택 → 3건만 처리" 같은 일이 없다.
   */
  const selectable = useMemo(() => visible.filter(canBulk), [visible]);
  const allChecked = checkedIds.length > 0 && checkedIds.length === selectable.length;
  /** 이미 잡아 둔 방문예정일을 덮어쓰게 되는 건수 */
  const overwrites = apps.filter((x) => checked[x.id] && x.visitDate).length;
  /* 서버는 기존 검사종류가 있으면 칩 선택을 무시하고 그대로 둔다 */
  const keepsType = apps.filter((x) => checked[x.id] && x.inspectType).length;
  useEffect(() => {
    if (!checkedIds.length) setBulkConfirm(false);
  }, [checkedIds.length]);

  useEffect(() => {
    setShown(PAGE);
  }, [fYear, fProduct, fStatus, qDebounced, sortKey, sortDir]);

  const toggleAll = () => {
    const all = selectable.length > 0 && checkedIds.length === selectable.length;
    const next: Record<string, boolean> = {};
    if (!all) selectable.forEach((x) => (next[x.id] = true));
    setChecked(next);
  };

  /** 확인 단계를 연다 (실제 실행은 runBulkApprove) */
  function askBulkApprove() {
    if (!checkedIds.length) {
      toast('일괄 검토승인할 신청을 선택해 주세요');
      return;
    }
    setBulkConfirm(true);
  }

  async function runBulkApprove() {
    if (busy) return;
    if (!bulkDate) {
      toast('방문예정일을 선택해 주세요');
      return;
    }
    setBusy(true);
    try {
      const r = await bulkApproveAction({
        ids: checkedIds,
        visitDate: bulkDate,
        inspectType: bulkType,
      });
      toast(r.toast);
      if (r.ok) {
        setChecked({});
        setBulkConfirm(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    const p = new URLSearchParams();
    if (fYear) p.set('year', fYear);
    if (fProduct) p.set('product', fProduct);
    if (fStatus) p.set('status', fStatus);
    if (q) p.set('q', q);
    const qs = p.toString();
    window.location.href = `/api/export${qs ? `?${qs}` : ''}`;
    toast(
      `이관검사_접수목록_${today().replace(/\./g, '')}.csv 내보내는 중 · ${supList.length}건`,
    );
  }

  return (
    <div
      className="ti-page"
      style={{ padding: '24px 26px 44px', display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <motion.div
        className="ti-pagehead"
        variants={fadeUp}
        initial="hidden"
        animate="show"
        style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ font: "700 18px/1.2 'Noto Sans KR'", letterSpacing: '-.01em' }}>
            신청 접수 목록
          </span>
          <span style={{ font: "400 12px/1.4 'Noto Sans KR'", color: '#6b7480' }}>
            검토승인 시 방문예정일과 코멘트를 입력하고, 판정 화면에서 1차·최종 합격·불합격을 결정합니다
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <motion.button
          onClick={exportCsv}
          className="h-bd"
          {...pressable}
          style={{
            padding: '8px 14px',
            background: '#fff',
            color: '#3c4652',
            border: '1px solid #d3d8de',
            borderRadius: 4,
            font: "500 12.5px/1.2 'Noto Sans KR'",
            cursor: 'pointer',
          }}
        >
          엑셀 내보내기
        </motion.button>
      </motion.div>

      <motion.div
        className="ti-kpi"
        variants={kpiStagger}
        initial="hidden"
        animate="show"
        /* 카드가 5장이라 고정 4열이면 한 장이 줄바꿈된다 — 폭에 맞춰 열 수를 정한다 */
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(178px,1fr))',
          gap: 10,
        }}
      >
        {supKpi.map((k) => (
          <motion.button
            key={k.key}
            onClick={() => setKpiModal(k.key)}
            className="h-ring"
            variants={staggerItem}
            {...pressable}
            style={{
              background: '#fff',
              border: '1px solid #dfe3e8',
              borderRadius: 6,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              width: '100%',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ font: "500 11.5px/1.3 'Noto Sans KR'", color: '#6b7480' }}>
                {k.label}
              </span>
              <div style={{ flex: 1 }} />
              <span
                style={{ font: "400 11px/1 'Noto Sans KR'", color: '#a2abb5', flex: 'none' }}
              >
                ›
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ font: "500 22px/1 'Roboto Mono',monospace", color: k.color }}>
                {k.n}
              </span>
              <span style={{ font: "400 11px/1 'Noto Sans KR'", color: '#98a1ac' }}>{k.sub}</span>
            </div>
          </motion.button>
        ))}
      </motion.div>

      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        style={{ background: '#fff', border: '1px solid #dfe3e8', borderRadius: 6 }}
      >
        <div
          className="ti-cardhead"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '13px 16px',
            borderBottom: '1px solid #eceff2',
          }}
        >
          <span style={{ font: "500 12.5px/1 'Noto Sans KR'" }}>이번주 방문 일정</span>
          <span
            style={{
              padding: '2px 7px',
              border: '1px solid #dfe3e8',
              borderRadius: 3,
              font: "400 10.5px/1.6 'Roboto Mono',monospace",
              color: '#5b6672',
            }}
          >
            {weekRange}
          </span>
          <div style={{ flex: 1 }} />
          <span
            className="ti-cardnote"
            style={{ font: "400 11px/1.2 'Noto Sans KR'", color: '#8b95a1' }}
          >
            {weekSummary}
          </span>
        </div>

        {weekDays.length ? (
          <motion.div
            className="ti-week"
            variants={dayStagger}
            initial="hidden"
            animate="show"
            style={{
              padding: '14px 16px 16px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(212px,1fr))',
              gap: 10,
              alignItems: 'start',
            }}
          >
            {weekDays.map((d) => (
              <motion.div
                key={d.full}
                variants={staggerItem}
                style={{
                  border: `1px solid ${d.bd}`,
                  borderRadius: 6,
                  overflow: 'hidden',
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 10px',
                    background: d.headBg,
                    borderBottom: `1px solid ${d.bd}`,
                  }}
                >
                  <span
                    style={{
                      font: "500 12px/1.2 'Roboto Mono',monospace",
                      color: d.headFg,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {d.label}
                  </span>
                  {d.showToday ? (
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: 3,
                        background: '#1f5fd0',
                        color: '#fff',
                        font: "500 10px/1.65 'Noto Sans KR'",
                        whiteSpace: 'nowrap',
                      }}
                    >
                      오늘
                    </span>
                  ) : null}
                  <div style={{ flex: 1 }} />
                  <span
                    style={{
                      font: "400 10.5px/1.2 'Noto Sans KR'",
                      color: '#8b95a1',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {d.stops}
                  </span>
                </div>

                <motion.div
                  variants={dayItemStagger}
                  style={{
                    padding: '8px 10px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    minWidth: 0,
                  }}
                >
                  <span style={{ font: "400 10.5px/1.2 'Roboto Mono',monospace", color: '#a2abb5' }}>
                    {d.span}
                  </span>

                  {d.items.map((i) => (
                    <motion.button
                      key={i.key}
                      onClick={() => (i.app ? openProcess(i.app) : undefined)}
                      className="h-bdblue"
                      variants={staggerItem}
                      {...pressable}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        minWidth: 0,
                        padding: '7px 8px',
                        border: `1px solid ${i.cardBd}`,
                        background: i.cardBg,
                        borderRadius: 4,
                        textAlign: 'left',
                        cursor: i.cursor,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <span
                          style={{
                            font: "500 11px/1.2 'Roboto Mono',monospace",
                            color: i.timeColor,
                          }}
                        >
                          {i.t}
                        </span>
                        <div style={{ flex: 1 }} />
                        <span
                          style={{
                            padding: '1px 5px',
                            borderRadius: 3,
                            font: "500 10px/1.65 'Noto Sans KR'",
                            background: i.tagBg,
                            color: i.tagFg,
                            whiteSpace: 'nowrap',
                            flex: 'none',
                          }}
                        >
                          {i.tag}
                        </span>
                      </div>
                      <span
                        style={{
                          font: "500 11.5px/1.4 'Noto Sans KR'",
                          color: i.titleColor,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '100%',
                        }}
                      >
                        {i.site}
                      </span>
                      <span
                        style={{
                          font: "400 10.5px/1.35 'Noto Sans KR'",
                          color: '#8b95a1',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '100%',
                        }}
                      >
                        {i.meta}
                      </span>
                      {i.showAct ? (
                        <span
                          style={{ font: "500 10.5px/1.2 'Noto Sans KR'", color: i.actColor }}
                        >
                          {i.actText}
                        </span>
                      ) : null}
                    </motion.button>
                  ))}
                </motion.div>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div
            style={{
              padding: '26px 16px',
              textAlign: 'center',
              font: "400 12px/1.6 'Noto Sans KR'",
              color: '#98a1ac',
            }}
          >
            이번주에 예정된 방문 일정이 없습니다
          </div>
        )}
      </motion.div>

      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        style={{
          background: '#fff',
          border: '1px solid #dfe3e8',
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        <div
          className="ti-filterbar"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            borderBottom: '1px solid #eceff2',
            background: '#fbfbfc',
          }}
        >
          <select value={fYear} onChange={(e) => setFYear(e.target.value)} style={selectStyle}>
            <option value="">연도별 · 전체</option>
            <option value="2026년">2026년</option>
            <option value="2025년">2025년</option>
            <option value="2024년">2024년</option>
          </select>
          <select value={fProduct} onChange={(e) => setFProduct(e.target.value)} style={selectStyle}>
            <option value="">제품군 · 전체</option>
            <option value="DDL">DDL</option>
            <option value="HN">HN / HA</option>
          </select>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={selectStyle}>
            <option value="">진행상태 · 전체</option>
            <option value="신청완료">신청완료</option>
            <option value="검토예정">검토예정</option>
            <option value="검토승인">검토승인</option>
            <option value="보완요청">보완요청</option>
            <option value="최종판정대기">최종판정 대기</option>
            <option value="완료">판정 완료</option>
          </select>
          <div
            className="ti-search"
            style={{ flex: 1, maxWidth: 300, display: 'flex', position: 'relative' }}
          >
            <input
              type="search"
              inputMode="search"
              placeholder="식별번호 · 현장명 · 지역 · 설치점 검색"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{
                width: '100%',
                padding: q ? '6px 26px 6px 9px' : '6px 9px',
                border: '1px solid #d3d8de',
                borderRadius: 4,
                font: "400 12px/1.2 'Noto Sans KR'",
                background: '#fff',
                outline: 'none',
              }}
            />
            {/* type=search 의 브라우저 기본 지우기 버튼 — 아래 × 와 겹치므로 지운다 */}
            <style>{
              '.ti-search input[type="search"]::-webkit-search-cancel-button{-webkit-appearance:none;appearance:none;display:none}'
            }</style>
            {q ? (
              <button
                type="button"
                onClick={() => setQ('')}
                aria-label="검색어 지우기"
                style={{
                  position: 'absolute',
                  right: 4,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 18,
                  height: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  border: 0,
                  borderRadius: 9,
                  background: '#eef0f3',
                  color: '#6b7480',
                  font: "400 11px/1 'Noto Sans KR'",
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            ) : null}
          </div>
          <div style={{ flex: 1 }} />

          {/* 지금 몇 건을 보고 있는지 — 필터를 걸지 않았을 때도 늘 보인다 */}
          <span
            style={{
              font: "400 11.5px/1.2 'Roboto Mono',monospace",
              color: '#6b7480',
              whiteSpace: 'nowrap',
            }}
          >
            {supList.length.toLocaleString('ko-KR')}건 / {apps.length.toLocaleString('ko-KR')}건
          </span>

          {/* 필터가 하나라도 걸려 있을 때만 노출 — 지금 몇 건으로 좁혀졌는지 함께 보여 준다 */}
          <AnimatePresence>
            {hasFilter ? (
              <motion.button
                {...pressable}
                variants={fade}
                initial="hidden"
                animate="show"
                exit="exit"
                onClick={resetFilters}
                className="h-bd"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  background: '#fff',
                  border: '1px solid #d3d8de',
                  borderRadius: 4,
                  font: "500 11.5px/1.2 'Noto Sans KR'",
                  color: '#3c4652',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>필터 초기화</span>
                <span style={{ font: "500 10.5px/1.6 'Roboto Mono',monospace", color: '#1a52b6' }}>
                  {supList.length}
                </span>
              </motion.button>
            ) : null}
          </AnimatePresence>

          <div
            style={{ display: 'flex', gap: 2, padding: 2, background: '#eef0f3', borderRadius: 5 }}
          >
            {VIEWS.map(([key, label]) => {
              const p = pill(view === key);
              return (
                <button
                  key={key}
                  onClick={() => router.push(hrefOf(key), { scroll: false })}
                  style={{
                    position: 'relative',
                    padding: '5px 11px',
                    border: 0,
                    borderRadius: 3,
                    font: "500 11.5px/1.2 'Noto Sans KR'",
                    cursor: 'pointer',
                    background: 'transparent',
                  }}
                >
                  {view === key ? (
                    <motion.span
                      layoutId="viewpill"
                      transition={{ duration: DUR.fast, ease: EASE }}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: 3,
                        background: p.bg,
                      }}
                    />
                  ) : null}
                  {/* 배경이 도착한 뒤에 글자색을 바꾼다 — 흰 글자가 회색 트레이 위에 먼저 뜨지 않게 */}
                  <motion.span
                    initial={false}
                    animate={{ color: p.fg }}
                    transition={{ duration: 0.01, delay: view === key ? DUR.fast : 0 }}
                    style={{ position: 'relative' }}
                  >
                    {label}
                  </motion.span>
                </button>
              );
            })}
          </div>
        </div>

        <AnimatePresence initial={false}>
          {checkedIds.length ? (
            <motion.div
              key="bulkbar"
              className="ti-bulkbar"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE } }}
              exit={{ opacity: 0, y: -6, transition: { duration: DUR.fast, ease: EASE } }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderBottom: '1px solid #dfe3e8',
                background: '#eaf1fd',
              }}
            >
              <span style={{ font: "500 12px/1.3 'Noto Sans KR'", color: '#1a52b6' }}>
                {checkedIds.length}건 선택됨
              </span>
              <div style={{ flex: 1 }} />
              <motion.button
                onClick={() => setChecked({})}
                {...pressable}
                style={{
                  padding: '6px 11px',
                  background: '#fff',
                  border: '1px solid #cfe0fa',
                  borderRadius: 4,
                  font: "500 11.5px/1.2 'Noto Sans KR'",
                  color: '#1a52b6',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                선택 해제
              </motion.button>
              <motion.button
                onClick={askBulkApprove}
                disabled={busy}
                className="h-teal"
                {...pressable}
                style={{
                  padding: '6px 13px',
                  background: '#0f7b6c',
                  border: '1px solid #0f7b6c',
                  borderRadius: 4,
                  font: "500 11.5px/1.2 'Noto Sans KR'",
                  color: '#fff',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                일괄 검토승인
              </motion.button>
            </motion.div>
          ) : null}

          {/* 확인 단계 — 무엇이 몇 건에 적용되는지 보여 주고 그 자리에서 값을 고치게 한다 */}
          {checkedIds.length && bulkConfirm ? (
            <motion.div
              key="bulkconfirm"
              className="ti-bulkbar"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE } }}
              exit={{ opacity: 0, y: -6, transition: { duration: DUR.fast, ease: EASE } }}
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 10,
                padding: '10px 12px',
                borderBottom: '1px solid #dfe3e8',
                background: '#f7faff',
              }}
            >
              <span style={{ font: "500 12px/1.3 'Noto Sans KR'", color: '#1a1d21' }}>
                선택한 {checkedIds.length}건을 검토승인합니다
              </span>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  font: "400 11.5px/1.2 'Noto Sans KR'",
                  color: '#5b6672',
                }}
              >
                방문예정일
                <input
                  type="date"
                  value={bulkDate}
                  min={fmtInput(parseDot(today()))}
                  onChange={(e) => setBulkDate(e.target.value)}
                  className="ti-field"
                  style={{
                    padding: '5px 8px',
                    border: '1px solid #d3d8de',
                    borderRadius: 4,
                    font: "400 12px/1.2 'Noto Sans KR'",
                    background: '#fff',
                    outline: 'none',
                  }}
                />
              </label>

              <div style={{ display: 'flex', gap: 5 }}>
                {INSPECT_TYPES.map((t) => {
                  const on = bulkType === t;
                  return (
                    <motion.button
                      key={t}
                      {...pressable}
                      onClick={() => setBulkType(t)}
                      style={{
                        padding: '5px 10px',
                        background: on ? '#1f5fd0' : '#fff',
                        border: `1px solid ${on ? '#1f5fd0' : '#d3d8de'}`,
                        borderRadius: 4,
                        font: "500 11.5px/1.2 'Noto Sans KR'",
                        color: on ? '#fff' : '#3c4652',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {t}
                    </motion.button>
                  );
                })}
              </div>

              <span
                style={{
                  font: "400 11px/1.4 'Noto Sans KR'",
                  color: '#8a6410',
                  wordBreak: 'keep-all',
                }}
              >
                신청자 {checkedIds.length}명에게 즉시 통보되며 되돌릴 수 없습니다
              </span>

              {/*
                방문예정일은 덮어쓰지만 검사종류는 기존 값이 있으면 유지된다
                (서버 bulkApproveAction). 비대칭이라 적어 두지 않으면
                칩을 바꿔 놓고 안 바뀐 줄 모른다.
              */}
              {keepsType ? (
                <span
                  style={{
                    font: "400 11px/1.4 'Noto Sans KR'",
                    color: '#5b6672',
                    wordBreak: 'keep-all',
                  }}
                >
                  검사종류가 이미 정해진 {keepsType}건은 기존 값을 유지합니다
                </span>
              ) : null}

              {/* 이미 일정이 잡힌 건을 함께 고르면 그 날짜가 사라진다 */}
              {overwrites ? (
                <span
                  style={{
                    font: "500 11px/1.4 'Noto Sans KR'",
                    color: '#9a5b12',
                    wordBreak: 'keep-all',
                  }}
                >
                  기존 방문예정일 {overwrites}건이 덮어써집니다
                </span>
              ) : null}

              <div style={{ flex: 1 }} />

              <motion.button
                {...pressable}
                onClick={() => setBulkConfirm(false)}
                className="h-bd"
                style={{
                  padding: '6px 11px',
                  background: '#fff',
                  border: '1px solid #d3d8de',
                  borderRadius: 4,
                  font: "500 11.5px/1.2 'Noto Sans KR'",
                  color: '#3c4652',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                취소
              </motion.button>
              <motion.button
                {...pressable}
                onClick={runBulkApprove}
                disabled={busy || !bulkDate}
                className="h-teal"
                style={{
                  padding: '6px 13px',
                  background: '#0f7b6c',
                  border: '1px solid #0f7b6c',
                  borderRadius: 4,
                  font: "500 11.5px/1.2 'Noto Sans KR'",
                  color: '#fff',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {busy ? '처리 중…' : `${checkedIds.length}건 승인`}
              </motion.button>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* 표는 252건이 한 번에 그려지므로 행에는 애니메이션을 걸지 않는다 — 뷰 전환만 페이드 */}
        <AnimatePresence mode="wait" initial={false}>
          {view === 'list' ? (
            <motion.div
              key="list"
              className="ti-tablewrap"
              variants={fade}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              <table
                className="ti-table-sup"
                style={{ width: '100%', minWidth: 1000, borderCollapse: 'collapse' }}
              >
                <thead>
                  <tr>
                    <th
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: 34,
                        padding: '10px 0 10px 12px',
                        borderBottom: '1px solid #dfe3e8',
                        ...stickyHead,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={allChecked}
                        onChange={toggleAll}
                        disabled={!selectable.length}
                        title="승인 가능한 건 전체 선택"
                        aria-label="승인 가능한 건 전체 선택"
                        style={{ cursor: selectable.length ? 'pointer' : 'not-allowed' }}
                      />
                    </th>
                    <th style={thStyle}>식별번호</th>
                    <th style={thStyle}>제품군</th>
                    <th style={{ ...thStyle, whiteSpace: 'normal' }}>현장명</th>
                    <th style={thStyle}>원청</th>
                    <th style={thStyle}>현장PM</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>수량</th>
                    <th
                      style={{
                        padding: 0,
                        borderBottom: '1px solid #dfe3e8',
                        whiteSpace: 'nowrap',
                        ...stickyHead,
                      }}
                    >
                      <button
                        onClick={sortReq.sort}
                        className="h-ef"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          width: '100%',
                          padding: '10px 12px',
                          border: 0,
                          background: 'none',
                          cursor: 'pointer',
                          font: "500 11.5px/1.2 'Noto Sans KR'",
                          color: sortReq.labelColor,
                        }}
                      >
                        신청일
                        <span
                          style={{
                            font: "500 10px/1 'Roboto Mono',monospace",
                            color: sortReq.color,
                          }}
                        >
                          {sortReq.arrow}
                        </span>
                      </button>
                    </th>
                    <th
                      style={{
                        padding: 0,
                        borderBottom: '1px solid #dfe3e8',
                        whiteSpace: 'nowrap',
                        ...stickyHead,
                      }}
                    >
                      <button
                        onClick={sortVisit.sort}
                        className="h-ef"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          width: '100%',
                          padding: '10px 12px',
                          border: 0,
                          background: 'none',
                          cursor: 'pointer',
                          font: "500 11.5px/1.2 'Noto Sans KR'",
                          color: sortVisit.labelColor,
                        }}
                      >
                        방문예정일
                        <span
                          style={{
                            font: "500 10px/1 'Roboto Mono',monospace",
                            color: sortVisit.color,
                          }}
                        >
                          {sortVisit.arrow}
                        </span>
                      </button>
                    </th>
                    <th style={thStyle}>진행상태</th>
                    <th style={{ ...thStyle, padding: '9px 12px', textAlign: 'right' }}>처리</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((x) => {
                    const r = rowBase(x);
                    const a = rowAction(x);
                    return (
                      <tr
                        key={x.id}
                        onClick={() => router.push(`/supervisor/${x.id}`)}
                        className="h-f8"
                        style={{ cursor: 'pointer' }}
                      >
                        <td
                          onClick={(e) => e.stopPropagation()}
                          style={{ padding: '9px 0 9px 12px', borderBottom: '1px solid #eceff2' }}
                        >
                          {/* 승인 가능한 상태가 아니면 체크박스를 그리지 않는다 (칸은 유지) */}
                          {canBulk(x) ? (
                            <input
                              type="checkbox"
                              checked={!!checked[x.id]}
                              onChange={() => setChecked((c) => ({ ...c, [x.id]: !c[x.id] }))}
                              aria-label={`${x.id} 일괄 검토승인 대상 선택`}
                              style={{ cursor: 'pointer' }}
                            />
                          ) : null}
                        </td>
                        <td style={tdMono}>
                          {/* 행 클릭은 그대로 두고, 키보드로도 상세에 닿을 수 있게 링크로 둔다 */}
                          <Link
                            href={`/supervisor/${x.id}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{ color: 'inherit' }}
                          >
                            {r.id}
                          </Link>
                        </td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid #eceff2' }}>
                          <span
                            style={{
                              padding: '2px 6px',
                              border: '1px solid #dfe3e8',
                              borderRadius: 3,
                              font: "500 10.5px/1.5 'Roboto Mono',monospace",
                              color: '#5b6672',
                            }}
                          >
                            {r.product}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '9px 12px',
                            font: "400 12.5px/1.4 'Noto Sans KR'",
                            color: '#1a1d21',
                            borderBottom: '1px solid #eceff2',
                            maxWidth: 300,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {r.site}
                        </td>
                        <td style={tdText}>{r.owner}</td>
                        <td style={tdText}>{r.pm}</td>
                        <td style={{ ...tdMono, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {r.qty}
                        </td>
                        <td style={tdMono}>{r.reqDate}</td>
                        <td style={{ ...tdMono, color: x.visitDate ? '#1a52b6' : '#98a1ac' }}>
                          {r.visitText}
                        </td>
                        <td
                          style={{
                            padding: '9px 12px',
                            borderBottom: '1px solid #eceff2',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <span
                            /* 신청자 목록과 같은 설명을 붙인다 — 상태 이름만으로는
                               '검토승인' 과 '최종판정대기' 의 차이가 읽히지 않는다 */
                            title={STATUS_NOTE[r.status]}
                            style={{
                              display: 'inline-block',
                              padding: '3px 8px',
                              borderRadius: 3,
                              font: "500 11px/1.35 'Noto Sans KR'",
                              background: r.st.bg,
                              color: r.st.fg,
                              border: `1px solid ${r.st.bd}`,
                            }}
                          >
                            {r.st.label}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '8px 12px',
                            borderBottom: '1px solid #eceff2',
                            textAlign: 'right',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openProcess(x);
                            }}
                            style={{
                              padding: '5px 10px',
                              borderRadius: 4,
                              font: "500 11.5px/1.2 'Noto Sans KR'",
                              cursor: 'pointer',
                              background: a.actBg,
                              color: a.actFg,
                              border: `1px solid ${a.actBd}`,
                            }}
                          >
                            {a.label}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* 남은 건수를 알려 주고 필요한 만큼만 더 펼친다 */}
              {supList.length > shown ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    padding: '12px 14px',
                    borderTop: '1px solid #eceff2',
                    background: '#fbfbfc',
                  }}
                >
                  <span style={{ font: "400 11.5px/1.2 'Noto Sans KR'", color: '#8b95a1' }}>
                    {shown.toLocaleString('ko-KR')} / {supList.length.toLocaleString('ko-KR')}건 표시
                  </span>
                  <motion.button
                    {...pressable}
                    onClick={() => setShown((n) => n + PAGE)}
                    className="h-bd"
                    style={{
                      padding: '6px 13px',
                      background: '#fff',
                      border: '1px solid #d3d8de',
                      borderRadius: 4,
                      font: "500 11.5px/1.2 'Noto Sans KR'",
                      color: '#3c4652',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    +{Math.min(PAGE, supList.length - shown)}건 더보기
                  </motion.button>
                  <motion.button
                    {...pressable}
                    onClick={() => setShown(supList.length)}
                    className="h-bdbluefg"
                    style={{
                      padding: '6px 13px',
                      background: '#fff',
                      border: '1px solid #d3d8de',
                      borderRadius: 4,
                      font: "500 11.5px/1.2 'Noto Sans KR'",
                      color: '#3c4652',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    전체 보기
                  </motion.button>
                </div>
              ) : null}
            </motion.div>
          ) : (
            <motion.div key="cal" variants={fade} initial="hidden" animate="show" exit="exit">
              <CalendarView apps={apps} external={external} base={base} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {kpiDef ? (
          <KpiModal
            key={kpiDef.key}
            def={kpiDef}
            list={kpiList}
            onClose={() => setKpiModal(null)}
            onOpen={openProcess}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {drawerApp ? (
          <ProcessDrawer
            key={drawerApp.id}
            app={drawerApp}
            apps={apps}
            external={external}
            mode={drawerMode}
            onClose={() => setDrawerId(null)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
