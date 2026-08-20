'use client';

/**
 * 방문 캘린더 — 기준월의 방문예정 건을 월 그리드로 보여 준다.
 * 셀의 방문 항목을 누르면 판정 상세로 이동하고,
 * 날짜 숫자나 '+N건 더보기' 를 누르면 그날의 방문 동선 패널이 아래에 열린다.
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { ApplicationDTO, ExternalVisitDTO } from '@/lib/domain';
import { fmtDot, parseDot } from '@/lib/date';
import { DOW, calendarCells, dayItinerary, dowOf, monthLabel, monthVisitCount } from '@/lib/view';
import {
  AnimatePresence,
  fade,
  fadeUp,
  motion,
  pressable,
  stagger,
  staggerItem,
} from '@/components/motion';

/** 35~42칸이라 간격을 아주 짧게 준다 — 전체가 0.4s 안에 끝난다 */
const cellStagger = stagger(0.008);
const itemStagger = stagger(0.04);

const navBtnStyle: React.CSSProperties = {
  padding: '5px 10px',
  background: '#fff',
  border: '1px solid #d3d8de',
  borderRadius: 4,
  font: "500 11.5px/1.2 'Noto Sans KR'",
  color: '#3c4652',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

/** 기준일이 속한 달에서 n 달 이동한 달의 1일 */
function shiftMonth(base: string, n: number): string {
  const d = parseDot(base);
  if (!d) return base;
  return fmtDot(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)));
}

/** 같은 달인지 */
function sameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

export function CalendarView({
  apps,
  external,
  base,
}: {
  apps: ApplicationDTO[];
  external: ExternalVisitDTO[];
  /** 오늘 — 처음 그리는 달이자 '이번 달' 버튼이 돌아가는 곳 */
  base: string;
}) {
  const router = useRouter();
  /* 당월 고정이면 다음 달 일정을 잡을 수 없다 — 기준 달을 화면 상태로 둔다 */
  const [month, setMonth] = useState(base);
  /* 하루치 방문 동선 패널 — 열려 있는 날짜 */
  const [day, setDay] = useState<string | null>(null);

  const cells = calendarCells(apps, month, external);
  const b = parseDot(month);
  const prefix = b ? `${b.getUTCFullYear()}.${String(b.getUTCMonth() + 1).padStart(2, '0')}.` : '';

  const goMonth = (n: number) => {
    setMonth((m) => shiftMonth(m, n));
    setDay(null);
  };

  const dayItems = day ? dayItinerary(apps, external, day) : [];
  const dayApps = day ? apps.filter((x) => x.visitDate === day).length : 0;

  return (
    <div style={{ padding: '16px 14px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <span style={{ font: "700 14px/1 'Noto Sans KR'" }}>{monthLabel(month)}</span>
        <span style={{ font: "400 11.5px/1 'Noto Sans KR'", color: '#8b95a1' }}>
          방문예정 {monthVisitCount(apps, month)}건
        </span>
        <div style={{ flex: 1 }} />
        <motion.button onClick={() => goMonth(-1)} className="h-bd" {...pressable} style={navBtnStyle}>
          ‹ 이전 달
        </motion.button>
        {!sameMonth(month, base) ? (
          <motion.button
            onClick={() => {
              setMonth(base);
              setDay(null);
            }}
            className="h-bdbluefg"
            {...pressable}
            style={navBtnStyle}
          >
            이번 달
          </motion.button>
        ) : null}
        <motion.button onClick={() => goMonth(1)} className="h-bd" {...pressable} style={navBtnStyle}>
          다음 달 ›
        </motion.button>
      </div>

      <div className="ti-calscroll">
        <motion.div
          className="ti-cal"
          variants={cellStagger}
          initial="hidden"
          animate="show"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7,minmax(0,1fr))',
            gap: 1,
            background: '#e4e8ec',
            border: '1px solid #e4e8ec',
            borderRadius: 5,
            overflow: 'hidden',
            tableLayout: 'fixed',
          }}
        >
          {DOW.map((d) => (
            <motion.div
              key={d}
              variants={staggerItem}
              style={{
                background: '#f7f8fa',
                padding: '8px 10px',
                font: "500 11px/1.2 'Noto Sans KR'",
                color: '#6b7480',
                minWidth: 0,
              }}
            >
              {d}
            </motion.div>
          ))}

          {cells.map((c, i) => {
            const date = c.d ? prefix + c.d.padStart(2, '0') : '';
            const open = !!date && date === day;
            return (
              <motion.div
                key={i}
                variants={staggerItem}
                style={{
                  background: open ? '#eaf1fd' : c.bg,
                  height: 96,
                  minWidth: 0,
                  padding: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 5,
                  overflow: 'hidden',
                }}
              >
                {/* 날짜 숫자를 누르면 그날 동선이 열린다 */}
                {date ? (
                  <button
                    onClick={() => setDay((v) => (v === date ? null : date))}
                    title={`${date} 방문 동선 보기`}
                    className="h-ef"
                    style={{
                      alignSelf: 'flex-start',
                      padding: 0,
                      border: 0,
                      background: 'none',
                      font: "500 11px/1.2 'Roboto Mono',monospace",
                      color: c.numColor,
                      cursor: 'pointer',
                      flex: 'none',
                    }}
                  >
                    {c.d}
                  </button>
                ) : (
                  <span
                    style={{
                      font: "500 11px/1.2 'Roboto Mono',monospace",
                      color: c.numColor,
                      flex: 'none',
                    }}
                  >
                    {c.d}
                  </span>
                )}

                {c.visits.map((v) => (
                  <motion.button
                    key={v.id}
                    onClick={() => router.push(`/supervisor/${v.id}`)}
                    title={v.label}
                    {...pressable}
                    style={{
                      display: 'block',
                      width: '100%',
                      maxWidth: '100%',
                      flex: 'none',
                      textAlign: 'left',
                      padding: '4px 6px',
                      border: '1px solid #cfe0fa',
                      background: '#eaf1fd',
                      borderRadius: 3,
                      font: "500 10px/1.35 'Noto Sans KR'",
                      color: '#1a52b6',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {v.label}
                  </motion.button>
                ))}

                {/* 타 신청 건 — 누를 수 없고, 그날이 이미 찼다는 것만 알린다 */}
                {c.ext ? (
                  <span
                    title="타 신청 건 방문 일정"
                    style={{
                      display: 'block',
                      maxWidth: '100%',
                      flex: 'none',
                      padding: '3px 6px',
                      border: '1px solid #e4e8ec',
                      background: '#f2f4f7',
                      borderRadius: 3,
                      font: "400 10px/1.35 'Noto Sans KR'",
                      color: '#77808c',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    타 신청 {c.ext}건
                  </span>
                ) : null}

                {c.more ? (
                  <button
                    onClick={() => setDay((v) => (v === date ? null : date))}
                    className="h-ef"
                    style={{
                      alignSelf: 'flex-start',
                      padding: 0,
                      border: 0,
                      background: 'none',
                      font: "500 10px/1.35 'Noto Sans KR'",
                      color: '#8b95a1',
                      cursor: 'pointer',
                      flex: 'none',
                    }}
                  >
                    {c.more}
                  </button>
                ) : null}
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* 하루치 방문 동선 — 상세 화면의 동선 카드와 같은 모양 */}
      <AnimatePresence initial={false}>
        {day ? (
          <motion.div
            key={day}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            exit="hidden"
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
              <span style={{ font: "500 12.5px/1 'Noto Sans KR'" }}>
                {day} ({dowOf(day)}) 방문 동선
              </span>
              <span
                style={{
                  padding: '2px 7px',
                  border: '1px solid #dfe3e8',
                  borderRadius: 3,
                  font: "400 10.5px/1.6 'Roboto Mono',monospace",
                  color: '#5b6672',
                  whiteSpace: 'nowrap',
                }}
              >
                {dayItems.length}개 현장 · 접수 건 {dayApps}건
              </span>
              <div style={{ flex: 1 }} />
              <motion.button
                onClick={() => setDay(null)}
                className="h-bd"
                {...pressable}
                style={{
                  padding: '4px 10px',
                  border: '1px solid #dfe3e8',
                  background: '#fff',
                  borderRadius: 4,
                  font: "400 12px/1.2 'Noto Sans KR'",
                  color: '#6b7480',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                닫기
              </motion.button>
            </div>

            {dayItems.length ? (
              <motion.div
                variants={itemStagger}
                initial="hidden"
                animate="show"
                style={{ padding: '15px 16px 16px', display: 'flex', flexDirection: 'column' }}
              >
                {dayItems.map((i, idx) => {
                  /* 감독관 화면에서는 '내 현장' 이 아니라 접수 건 / 외부 일정으로 나눈다 */
                  const isApp = !!i.appId;
                  return (
                    <motion.div key={`${i.t}-${idx}`} variants={staggerItem}>
                      {i.showTravel ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '72px 15px 1fr', gap: 12 }}>
                          <span />
                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <span
                              style={{ width: 0, borderLeft: '1px dashed #cdd3da', minHeight: 24 }}
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <span style={{ font: "400 11px/1.2 'Noto Sans KR'", color: '#a2abb5' }}>
                              ↓ {i.travel}
                            </span>
                          </div>
                        </div>
                      ) : null}

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '72px 15px 1fr',
                          gap: 12,
                          alignItems: 'start',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                            paddingTop: 10,
                            textAlign: 'right',
                          }}
                        >
                          <span
                            style={{
                              font: "500 12.5px/1.2 'Roboto Mono',monospace",
                              color: isApp ? '#1a52b6' : '#6b7480',
                            }}
                          >
                            {i.t}
                          </span>
                          <span
                            style={{
                              font: "400 10.5px/1.2 'Roboto Mono',monospace",
                              color: '#a2abb5',
                            }}
                          >
                            ~{i.tEnd}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 13 }}>
                          <span
                            style={{
                              width: 11,
                              height: 11,
                              borderRadius: '50%',
                              background: isApp ? '#1f5fd0' : '#fff',
                              border: `2px solid ${isApp ? '#1f5fd0' : '#c9cfd6'}`,
                              flex: 'none',
                            }}
                          />
                        </div>

                        <motion.button
                          onClick={() => (isApp ? router.push(`/supervisor/${i.appId}`) : undefined)}
                          className={isApp ? 'h-bdblue' : undefined}
                          {...(isApp ? pressable : {})}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 5,
                            width: '100%',
                            textAlign: 'left',
                            padding: '10px 13px',
                            borderRadius: 6,
                            background: isApp ? '#f7faff' : '#fff',
                            border: `1px solid ${isApp ? '#cfe0fa' : '#e4e8ec'}`,
                            cursor: isApp ? 'pointer' : 'default',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'baseline',
                              gap: 8,
                              width: '100%',
                            }}
                          >
                            <span
                              style={{
                                font: "500 12.5px/1.45 'Noto Sans KR'",
                                color: isApp ? '#1a52b6' : '#1a1d21',
                                textWrap: 'pretty',
                              }}
                            >
                              {i.site}
                            </span>
                            <div style={{ flex: 1 }} />
                            <span
                              style={{
                                padding: '1px 6px',
                                borderRadius: 3,
                                font: "500 10px/1.65 'Noto Sans KR'",
                                background: isApp ? '#eaf1fd' : '#eef0f3',
                                color: isApp ? '#1a52b6' : '#6b7480',
                                whiteSpace: 'nowrap',
                                flex: 'none',
                              }}
                            >
                              {isApp ? '접수 건' : '외부 일정'}
                            </span>
                          </div>
                          <div
                            className="ti-metarow"
                            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                          >
                            <span style={{ font: "400 11px/1.45 'Noto Sans KR'", color: '#8b95a1' }}>
                              {i.meta}
                            </span>
                            <span style={{ width: 1, height: 9, background: '#dfe3e8' }} />
                            <span style={{ font: "400 11px/1.45 'Noto Sans KR'", color: '#8b95a1' }}>
                              {i.durText}
                            </span>
                          </div>
                        </motion.button>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            ) : (
              <motion.div
                variants={fade}
                initial="hidden"
                animate="show"
                style={{
                  padding: '26px 16px',
                  textAlign: 'center',
                  font: "400 12px/1.6 'Noto Sans KR'",
                  color: '#98a1ac',
                }}
              >
                이 날짜에 예정된 방문이 없습니다
              </motion.div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
