# 프로젝트 구조

이 코드베이스를 처음 여는 사람을 위한 안내입니다.
업무 용어를 먼저 알아야 코드가 읽힙니다 — [`domain-glossary.md`](domain-glossary.md) 를 먼저 보세요.

---

## 1. 출발점

| 궁금한 것 | 볼 파일 |
| --- | --- |
| 화면이 어떤 데이터를 받는가 | `src/lib/data.ts` (Prisma → DTO) |
| 상태가 언제 어떻게 바뀌는가 | `src/lib/actions.ts` (서버 액션 전부) |
| 업무 용어가 코드에서 뭐가 되는가 | `src/lib/domain.ts` (변환표) |
| 배지 색·타임라인·KPI 계산 | `src/lib/view.ts` |
| 저장 구조 | `prisma/schema.prisma` + [`db-schema.md`](db-schema.md) |

**상태를 바꾸는 코드는 전부 `src/lib/actions.ts` 한 파일에 있습니다.**
컴포넌트에서 직접 Prisma 를 부르는 곳은 없습니다.

---

## 2. 전체 흐름

```
  브라우저
     │
     │  ① 페이지 요청
     ▼
  ┌─────────────────────────────────────────────────────────┐
  │  Server Component  (src/app/**/page.tsx)                │
  │    readSession()  →  누구인가 · 권한이 있는가             │
  │    listApplications() 등  →  DTO 로 데이터 조회           │
  └───────────────────────┬─────────────────────────────────┘
                          │  DTO (한글 라벨)
                          ▼
  ┌─────────────────────────────────────────────────────────┐
  │  Client Component  ('use client')                       │
  │    화면 그리기 · 필터 · 정렬 · 모달 · 애니메이션           │
  └───────────────────────┬─────────────────────────────────┘
                          │  ② 사용자가 버튼을 누름
                          ▼
  ┌─────────────────────────────────────────────────────────┐
  │  Server Action  (src/lib/actions.ts)                    │
  │    권한 확인  →  zod 검증  →  상태 검증  →  업무 규칙 검증  │
  │        →  Prisma 갱신  →  로그·통보 기록                  │
  │    반환: { ok, toast, redirect? }                        │
  └───────────────────────┬─────────────────────────────────┘
                          │  ③ router.refresh()
                          ▼
                    ①로 되돌아가 다시 그림
```

**서버 액션이 유일한 쓰기 경로**입니다. 화면에서 막는 것과 별개로
서버가 다시 검증하므로, 화면을 우회한 요청도 통과하지 못합니다.

---

## 3. 디렉터리

```
transfer-inspection-system/
├── index.html               원본 프로토타입 (5.6MB, 참고용 · 빌드에 포함 안 됨)
├── compose.yaml             db → migrate → app 순서로 기동
├── Dockerfile               app · migrate 두 이미지를 멀티스테이지로
├── docs/                    ← 이 문서들
├── docker/
│   └── initdb/01-init.sql   MySQL 최초 기동 시 1회 실행 (스키마 + 샘플 252건)
├── prisma/
│   ├── schema.prisma        MySQL 스키마
│   ├── migrations/          마이그레이션 이력
│   ├── samples.ts           결정적 샘플 데이터 생성기
│   └── seed.ts              시드 실행 (계정 + 샘플)
├── tools/
│   ├── dump-initdb.sh       현재 DB → 01-init.sql 재생성
│   └── write-initdb.mjs     덤프에 주석·헤더를 붙여 저장
└── src/
    ├── app/                 라우팅 (Next.js App Router)
    ├── components/          화면
    └── lib/                 업무 로직
```

### 3.1 `src/app` — 라우팅

```
src/app/
├── layout.tsx                    루트 레이아웃 (폰트 · 토스트 프로바이더)
├── globals.css                   전역 스타일 + 반응형 (ti-* 클래스)
├── page.tsx                      "/" → 역할에 맞는 화면으로 리다이렉트
├── login/page.tsx                로그인 · 회원가입
│
├── (app)/                        인증이 필요한 영역 (상단바 + 사이드바 셸)
│   ├── layout.tsx                세션 확인 · 사이드바 메뉴와 카운트 계산
│   ├── not-found.tsx             404 (역할에 맞는 링크 하나만 보여 줌)
│   ├── applicant/
│   │   ├── page.tsx              내 신청 현황
│   │   ├── new/page.tsx          이관검사 신청 (마법사)
│   │   └── [id]/page.tsx         신청 상세
│   └── supervisor/
│       ├── page.tsx              신청 접수 목록 (?view=cal 이면 캘린더)
│       ├── judge/page.tsx        판정해야 할 건으로 바로 이동
│       └── [id]/page.tsx         판정 상세
│
└── api/
    ├── export/route.ts           접수 목록 CSV (감독관은 전체, 신청자는 본인 건만)
    └── geocode/route.ts          주소 검색 · 역지오코딩 프록시 (로그인 필요)
```

`(app)` 는 **라우트 그룹**입니다 — 괄호라서 URL 에 나타나지 않고,
공통 레이아웃(셸)과 인증 검사만 공유합니다.

모든 페이지에 `export const dynamic = 'force-dynamic'` 이 붙어 있습니다.
세션과 DB 를 매 요청 읽어야 하므로 정적 생성 대상이 아닙니다.

### 3.2 `src/components` — 화면

```
src/components/
├── Shell.tsx                 상단바 + 사이드바. 브랜드가 홈 링크
├── Toast.tsx                 토스트 (Context)
├── Field.tsx                 입력 한 칸 — 날짜/월/숫자/전화/이메일 + 인라인 검증
├── motion.tsx                애니메이션 프리셋 모음 (motion.dev)
│
├── auth/
│   ├── AuthScreen.tsx        로그인 · 회원가입 화면
│   ├── GoogleModal.tsx       데모용 Google 계정 선택
│   └── GoogleG.tsx           Google 로고
│
├── applicant/
│   ├── ListClient.tsx        내 신청 현황 (KPI · 방문 카드 · 목록)
│   ├── NewWizard.tsx         신규 신청 마법사 (제품군 → 4단계 폼)
│   ├── Resubmit.tsx          보완요청 대응 · 재신청
│   ├── MapPicker.tsx         현장 위치 지정 모달
│   ├── mapEngine.ts          네이버 지도 ↔ Leaflet 전환 계층
│   ├── pin.ts                핀 아이콘
│   └── Motion.tsx            서버 컴포넌트에서 쓰는 애니메이션 래퍼
│
└── supervisor/
    ├── ListClient.tsx        접수 목록 (필터 · 검색 · 일괄 승인 · 이번주 일정)
    ├── CalendarView.tsx      월간 방문 캘린더 · 일자별 동선
    ├── KpiModal.tsx          KPI 카드를 눌렀을 때의 목록 모달
    ├── ProcessDrawer.tsx     처리 드로어 (검토 / 판정 / 결과 3모드)
    └── JudgeScreen.tsx       판정 상세 (전 항목 + 판정 입력 패널)
```

**큰 파일 순서** (참고)

| 파일 | 줄 | 왜 큰가 |
| --- | --- | --- |
| `supervisor/ListClient.tsx` | ~1,420 | 목록 · 필터 · KPI · 일괄 승인 · 이번주 일정이 한 화면 |
| `applicant/NewWizard.tsx` | ~1,340 | DDL 41개 / HN 58개 양식 정의가 데이터로 들어 있음 |
| `supervisor/ProcessDrawer.tsx` | ~1,178 | 한 컴포넌트가 3모드를 분기 |
| `supervisor/JudgeScreen.tsx` | ~1,004 | 전 항목 표 + 증권 카드 + 판정 패널 |

> 원본 프로토타입이 인라인 스타일 기반 단일 파일이라, 포팅할 때
> **스타일과 `ti-*` 클래스를 그대로 옮겼습니다.** 그래서 파일이 길지만
> `globals.css` 의 반응형 규칙이 손대지 않고 그대로 동작합니다.

### 3.3 `src/lib` — 업무 로직

| 파일 | 책임 |
| --- | --- |
| `domain.ts` | 한글 라벨 ↔ DB enum 변환표, 상태 설명, 배지 색, DTO 타입 |
| `data.ts` | Prisma 조회 → DTO. 목록용 `includeLite` (로그·통보 제외) 포함 |
| `actions.ts` | **서버 액션 13개.** 상태를 바꾸는 모든 동작 + 업무 규칙 검증 |
| `view.ts` | 화면 파생 로직 — 배지, 타임라인, KPI, 동선, 상세 항목 구성 |
| `form.ts` | 입력 검증·변환. 날짜 포맷, 조사 처리(`josa`/`euro`) |
| `date.ts` | `'YYYY.MM.DD'` ↔ MySQL `DATE` (UTC 자정) |
| `session.ts` | JWT 세션 쿠키 (jose) |
| `db.ts` | Prisma 클라이언트 싱글턴 |

---

## 4. 서버 액션 13개

`src/lib/actions.ts`. 모두 `{ ok, toast, redirect? }` 를 반환합니다.

**인증**

| 액션 | 하는 일 |
| --- | --- |
| `loginAction` | 이메일·비밀번호 로그인 |
| `googleLoginAction` | 데모용 Google 계정 로그인 |
| `signupAction` | 회원가입 |
| `logoutAction` | 세션 삭제 |

**감독관 — 상태 변경**

| 액션 | 허용 상태 | 하는 일 |
| --- | --- | --- |
| `schedulePlanAction` | 승인 전 | 방문예정일 등록 (검토예정) |
| `approveReviewAction` | 승인 전 | 검토승인 + 신청자 통보 |
| `bulkApproveAction` | 승인 전 | 여러 건 일괄 검토승인. **승인 가능한 건만 골라 처리하고 제외 건수를 알림** |
| `saveFirstResultAction` | 방문 이후 | 1차 판정만 저장 |
| `confirmJudgeAction` | 방문 이후 | 최종 판정 확정. **하자이행증권 미확인이면 합격 거부** |
| `requestFixAction` | 제한 없음 | 보완요청 반려 |

**신청자**

| 액션 | 하는 일 |
| --- | --- |
| `createApplicationAction` | 신규 신청 |
| `resubmitAction` | 보완요청 건 재신청 |
| `updateApplicationAction` | 보완 내용 수정 |

### 액션이 하는 검증 순서

```
  ① 권한        requireSupervisor() / 세션의 role 확인
  ② 형식        zod 스키마 (필수값 · 타입 · 날짜 형식)
  ③ 존재        해당 신청 건이 있는가
  ④ 상태        APPROVABLE / JUDGEABLE 에 들어가는 상태인가
  ⑤ 업무 규칙   하자이행증권이 확인되었는가 (합격·조건부합격일 때만)
  ─────────────────────────────────────────────────
  ⑥ 갱신 + 로그 기록 + 통보 기록
```

④와 ⑤가 이 시스템의 안전장치입니다. 화면에서도 같은 기준으로 미리 막지만,
**화면을 우회해도 서버가 다시 막습니다.**

---

## 5. 데이터가 화면까지 가는 길

```
  MySQL
    │  Prisma (ASCII enum: SUBMITTED, PASS, DOCUMENT …)
    ▼
  src/lib/data.ts
    │  toDTO() — enum → 한글 라벨, DATE → 'YYYY.MM.DD', Decimal → number
    ▼
  ApplicationDTO   { status: '신청완료', final: '합격', visitDate: '2026.07.30' … }
    │
    ├─► Server Component 이 그대로 그리거나
    └─► Client Component 에 props 로 넘김
             │
             ▼
        src/lib/view.ts
          배지 색 · 타임라인 단계 · KPI 집계 · 방문 동선 계산
```

**목록 화면은 `includeLite` 를 씁니다** — 로그와 통보 이력을 빼고 조회합니다.
252건에 이력까지 실어 보내면 클라이언트 페이로드가 두 배가 됩니다
(1,134KB → 548KB).

---

## 6. 화면을 하나 추가하려면

1. `src/app/(app)/<역할>/<경로>/page.tsx` 생성
2. 맨 위에 세션·권한 확인
   ```ts
   const s = await readSession();
   if (!s) redirect('/login');
   if (s.role !== 'supervisor') redirect('/applicant');
   ```
3. `export const dynamic = 'force-dynamic'` 추가
4. 데이터는 `src/lib/data.ts` 의 함수로 가져오기 (Prisma 직접 호출 금지)
5. 사이드바에 넣으려면 `src/app/(app)/layout.tsx` 의 `nav` 에 항목 추가
6. 활성 메뉴 판정은 `src/components/Shell.tsx` 의 `activeKey` 에서

## 7. 상태를 바꾸는 동작을 추가하려면

1. `src/lib/actions.ts` 에 액션 추가 — 반드시 §4 의 검증 순서를 지킬 것
2. 상태 전이가 새로 생기면 `APPROVABLE` / `JUDGEABLE` 상수 확인
3. 처리 로그(`log()`)와 통보(`notify()`) 기록을 남길 것 —
   신청자 화면이 이 이력을 그대로 보여 줍니다
4. 되돌릴 수 없는 동작이면 화면에서 **확인 단계**를 거치게 할 것
   (`ProcessDrawer` / `JudgeScreen` 의 `confirmStep` 참고)

---

## 8. 기술 선택 메모

| 선택 | 이유 |
| --- | --- |
| Next.js App Router + 서버 액션 | 별도 API 계층 없이 쓰기 경로를 한 곳에 모을 수 있음 |
| 인라인 스타일 + `ti-*` 클래스 | 원본 프로토타입을 그대로 옮기기 위해. 반응형 CSS 재작성 불필요 |
| API 는 한글 라벨 | 프로토타입 화면 로직이 한글을 그대로 비교하므로 변환 계층 불필요 |
| `output: 'standalone'` | 컨테이너 이미지에 `node_modules` 전체를 넣지 않기 위해 |
| Leaflet 기본 · 네이버 지도 선택 | 키 없이도 동작해야 함. 키가 있으면 자동으로 네이버로 전환 |
| motion.dev | `reducedMotion="user"` 로 접근성 설정을 존중 |

---

## 9. 자주 밟는 함정

- **`npm run dev` 와 `npm run build` 를 동시에 돌리지 말 것** — `.next` 를 공유해
  dev 서버가 `MODULE_NOT_FOUND` 로 깨집니다. 빌드 전에 dev 를 멈추세요.
- **라우트 파일을 지우면 `.next/types` 에 잔재가 남습니다** — `tsc` 가
  없는 모듈을 참조해 실패합니다. `rm -rf .next` 후 다시 하세요.
- **`db:reset` 에 `db push --force-reset` 금지** — [`db-schema.md` §8](db-schema.md#8-초기-데이터--마이그레이션)
- **`_` 로 시작하는 폴더는 Next.js 가 라우트에서 제외합니다** (private folder).
  `src/app/api/_test` 같은 이름은 404 가 됩니다.
- **zsh 에서 `[id]` 경로는 따옴표로 감쌀 것** — glob 으로 해석돼 "no matches" 가 납니다.
