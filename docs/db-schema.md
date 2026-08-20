# DB 스키마 설계

MySQL 8.4 · Prisma 6.3 기준. 원본 정의는 [`prisma/schema.prisma`](../prisma/schema.prisma) 이고,
이 문서는 **왜 이렇게 생겼는지**를 설명합니다.

---

## 1. 한눈에 보기

```
                          ┌───────────────────────┐
                          │        users          │
                          │  id (PK)              │
                          │  email (UQ)           │
                          │  role  APPLICANT      │
                          │        SUPERVISOR     │
                          └───────────────────────┘
                             ▲                 ▲
              applicantId    │                 │   inspectorId
              (필수)          │                 │   (NULL 허용)
                             │                 │
                          ┌──┴─────────────────┴──┐
                          │     applications      │
                          │  id (PK, VARCHAR 16)  │◄──── 업무 식별번호. 예: 20260701
                          │  status               │
                          │  visitDate            │
                          │  firstResult          │
                          │  finalResult          │
                          │  bondNo / issuer      │
                          │  extra (JSON)         │
                          └───────────────────────┘
                             │                 │
              applicationId  │                 │  applicationId
              ON DELETE      │                 │  ON DELETE
              CASCADE        ▼                 ▼  CASCADE
              ┌──────────────────────┐  ┌──────────────────────┐
              │  application_logs    │  │    notifications     │
              │  누가 · 언제 · 무엇을 │  │  MAIL / SMS 발송 이력 │
              └──────────────────────┘  └──────────────────────┘


              ┌──────────────────────┐
              │   external_visits    │   다른 신청 건의 방문 일정.
              │  (관계 없음)          │   감독관 동선 계산에만 쓰는 참고 데이터라
              └──────────────────────┘   applications 와 FK 로 묶지 않는다.
```

핵심 테이블은 `applications` 하나이고, 나머지는 그 주변입니다.
`users` 는 로그인과 소유권, `application_logs`·`notifications` 는 이력,
`external_visits` 는 일정 화면에 겹쳐 보여 줄 참고 데이터입니다.

---

## 2. 왜 `applications.id` 가 문자열인가

```
id  VARCHAR(16)  PK        예: "20260701", "20241003"
```

자동증가 정수를 쓰지 않았습니다. 이 번호는 **내부 식별자가 아니라 업무 문서 번호**라서,
감독관과 설치점이 전화로 부르고 엑셀에 적고 URL 로 공유합니다
(`/supervisor/20260701`). 화면에 보이는 값과 DB 키가 다르면 그 매핑을
어딘가에서 계속 유지해야 하므로, 보이는 값을 그대로 키로 씁니다.

대신 이런 제약이 따라옵니다.

- 번호 채번 규칙(연도 + 일련번호)을 애플리케이션이 책임집니다 (`createApplicationAction`)
- 자식 테이블 FK 도 `VARCHAR(16)` 이라 정수 FK 보다 인덱스가 큽니다.
  전체 규모가 수천~수만 건이라 실측상 문제되지 않습니다.

---

## 3. 상태(status) — 이 시스템의 중심

`applications.status` 하나가 화면 분기·권한·집계를 모두 좌우합니다.

```
                 신청자가 작성
                      │
                      ▼
                  ┌────────┐
                  │ DRAFT  │  작성중 (현재 화면에서는 만들지 않음)
                  └───┬────┘
                      │ 제출
                      ▼
              ┌───────────────┐
      ┌──────►│   SUBMITTED   │  신청완료
      │       └───────┬───────┘
      │               │ 감독관: 방문예정일 등록
      │               ▼
      │       ┌────────────────┐
      │       │ REVIEW_PLANNED │  검토예정
      │       └───────┬────────┘
      │               │ 감독관: 검토승인
      │               ▼
      │       ┌────────────────┐
      │       │ REVIEW_APPROVED│  검토승인   ← 방문 대기
      │       └───┬────────┬───┘
      │           │        │ 1차 판정만 저장
      │           │        ▼
      │           │  ┌───────────────┐
      │           │  │ FINAL_PENDING │  최종판정대기
      │           │  └───────┬───────┘
      │           │          │
      │           ▼          ▼
      │       ┌──────────────────────────────────────┐
      │       │  최종 판정 확정 (confirmJudgeAction)   │
      │       └──┬──────┬──────┬───────┬──────┬──────┘
      │          ▼      ▼      ▼       ▼      ▼
      │      PASSED  COND.  FAILED   HOLD  CARRIED_OVER
      │      최종합격 조건부  불합격   보류    이월
      │
      │       ┌───────────────┐
      └───────┤ FIX_REQUESTED │  보완요청
   재신청      └───────────────┘
   (resubmit)        ▲
                     │ 감독관: 보완요청 반려 (어느 단계에서든)
```

**되돌아갈 수 있는 경로는 보완요청 하나뿐**입니다. 판정이 끝난 다섯 상태
(`PASSED`/`CONDITIONAL`/`FAILED`/`HOLD`/`CARRIED_OVER`)는 종착역이고,
서버가 이 상태의 건에 대한 승인·판정 요청을 거부합니다.

### 상태를 바꿀 수 있는 조건 (서버 강제)

| 서버 액션 | 허용 상태 | 근거 |
| --- | --- | --- |
| `schedulePlanAction` | SUBMITTED, FIX_REQUESTED, REVIEW_PLANNED | 아직 승인 전 |
| `approveReviewAction` | SUBMITTED, FIX_REQUESTED, REVIEW_PLANNED | 〃 |
| `bulkApproveAction` | 〃 (선택 목록에서 해당 건만 골라 처리) | 완료 건 되돌림 방지 |
| `saveFirstResultAction` | REVIEW_APPROVED, FINAL_PENDING | 방문 이후 |
| `confirmJudgeAction` | REVIEW_APPROVED, FINAL_PENDING | 〃 |
| `requestFixAction` | 제한 없음 | 언제든 반려 가능 |

`src/lib/actions.ts` 상단의 `APPROVABLE` / `JUDGEABLE` 상수가 이 표의 실체입니다.

---

## 4. 한글 업무 용어 ↔ ASCII enum

DB 는 ASCII enum 으로 저장하고, **API 경계에서 한글 라벨로 바꿔 내보냅니다.**

```
  DB (MySQL enum)              API · 화면 (한글 라벨)
  ─────────────────            ──────────────────────
  SUBMITTED          ◄────►    신청완료
  REVIEW_PLANNED     ◄────►    검토예정
  REVIEW_APPROVED    ◄────►    검토승인
  FIX_REQUESTED      ◄────►    보완요청
  FINAL_PENDING      ◄────►    최종판정대기
  PASSED             ◄────►    최종합격
  CONDITIONAL        ◄────►    조건부합격
  FAILED             ◄────►    불합격
  HOLD               ◄────►    보류
  CARRIED_OVER       ◄────►    이월

  PASS/CONDITIONAL/FAIL/HOLD/CARRY_OVER  ◄────►  합격/조건부합격/불합격/보류/이월
  DOCUMENT / SAMPLING                    ◄────►  서류검사 / 샘플링검사
  DIRECT / DISTRIBUTION                  ◄────►  직판 / 유통
  MAIL / SMS                             ◄────►  이메일 / 문자
```

변환표는 [`src/lib/domain.ts`](../src/lib/domain.ts) 한 곳에만 있습니다
(`STATUS_ENUM` / `STATUS_LABEL` 등의 쌍).

> **왜 DB 에 한글을 넣지 않았나** — 정렬·인덱스·마이그레이션·외부 연동에서
> ASCII 가 안전합니다. 반대로 **왜 API 는 한글인가** — 원본 프로토타입
> (`index.html`)의 화면 로직이 한글 라벨을 그대로 비교하기 때문에,
> 라벨로 내보내면 UI 포팅에 변환 계층이 필요 없습니다.

주의: `Status.CONDITIONAL`(신청 건의 상태)과 `Result.CONDITIONAL`(판정 결과)은
이름이 같지만 **다른 enum** 입니다.

---

## 5. 테이블별 상세

### 5.1 `users`

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | INT AI PK | |
| `email` | VARCHAR(190) UNIQUE | 로그인 ID. 190 은 utf8mb4 에서 인덱스 길이 한계(3072B) 안에 들어가는 값 |
| `password` | VARCHAR(120) | bcrypt 해시 |
| `name` | VARCHAR(60) | 화면 표시 이름 |
| `phone` | VARCHAR(40) | |
| `org` | VARCHAR(120) | 소속. 예: `세움테크 · 이관검사 신청자` |
| `role` | ENUM | `APPLICANT` / `SUPERVISOR` |

인덱스: `role`

한 계정은 역할 하나만 가집니다. 역할이 다른 화면으로 들어가면 자기 화면으로 되돌려보냅니다.

### 5.2 `applications`

컬럼이 많아 묶어서 봅니다.

**① 식별·기본**

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | VARCHAR(16) PK | 식별번호 |
| `product` | ENUM | `DDL`(도어록) / `HN`(홈네트워크·HA) |
| `year` | INT | 사업연도. 신청일 연도와 다를 수 있어 따로 보관 |
| `site` | VARCHAR(200) | 현장명 |
| `owner` | VARCHAR(120) | 원청 |
| `pm` | VARCHAR(60) | 현장PM |
| `channel` | ENUM | `DIRECT`(직판) / `DISTRIBUTION`(유통) |
| `code` | VARCHAR(60) | 프로젝트 코드 |
| `moveIn` | VARCHAR(7) | 입주개시일 `'YYYY.MM'` — 일자가 없는 월 단위 값이라 DATE 로 두지 않음 |

**② 위치**

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `region` / `zip` / `addr` | VARCHAR | 지역 · 우편번호 · 주소 |
| `lat` / `lng` | DECIMAL(10,7) NULL | 지도 핀. DOUBLE 이 아니라 DECIMAL 인 이유는 아래 §7 |

**③ 설치점 · 입회자**

`installer`, `managerName`, `managerPhone`, `qty`(수량·세대),
`installer2`, `witness`, `witnessPhone`, `worker1`, `worker2`

**④ 신청자가 적어 내는 희망 검사 조건**

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `desiredDate` | DATE NULL | 희망 검사일 |
| `desiredInspectType` | ENUM NULL | 희망 검사 종류 |
| `occupancy` | VARCHAR(120) | 입주율·시공률. 예: `입주율 92% · 시공 100%` |

감독관이 방문예정일을 잡을 때 가장 먼저 봐야 하는 값들이라 `extra` 에 묻지 않고 컬럼으로 뺐습니다.

**⑤ 제품 양식 항목**

DDL 41개 / HN·HA 58개 항목 중 **화면에서 자주 쓰는 것만 컬럼**입니다.

```
DDL     link, linked, board, strike, other, lock1
HN/HA   topology, main, dev1, camera, lobby, dongs
나머지   extra  (JSON)
```

`extra` 는 JSON 입니다. 두 제품군의 항목 집합이 다르고 양식이 개정될 수 있어,
모두 컬럼으로 펼치면 한쪽 제품에서 항상 NULL 인 컬럼이 수십 개 생깁니다.
**검색·필터·집계에 쓰이는 값만 컬럼**, 상세 화면에서 나열만 하는 값은 `extra` 로 나눴습니다.

> 판단 기준: `WHERE`·`ORDER BY`·`GROUP BY` 에 등장할 수 있으면 컬럼, 아니면 `extra`.

**⑥ 처리 상태**

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `status` | ENUM | §3 참조 |
| `reqDate` | DATE | 신청일 |
| `visitDate` | DATE NULL | 방문예정일 |
| `inspectType` | ENUM NULL | 확정된 검사 종류 |
| `firstResult` | ENUM NULL | 1차 판정 |
| `finalResult` | ENUM NULL | 최종 판정 |
| `memo` / `revComment` / `firstComment` / `finalComment` | VARCHAR(1000) | 비고 · 검토 코멘트 · 1차 코멘트 · 최종 코멘트 |

> **왜 TEXT 가 아니라 VARCHAR(1000) 인가** — MySQL 은 BLOB/TEXT 컬럼에
> `DEFAULT` 를 허용하지 않습니다(에러 1101). 이 컬럼들은 `DEFAULT ''` 여야
> 애플리케이션에서 NULL 분기를 하지 않아도 되므로 VARCHAR 로 두었습니다.

**⑦ 하자이행증권**

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `bondNo` | VARCHAR(80) | 증권번호. 미발행이면 `''` 또는 `입력 요망` |
| `issuer` | VARCHAR(60) | 발행기관. 미발행이면 `미발행` |
| `months` | INT (기본 36) | 하자보증기간 개월 |
| `bondFrom` / `bondTo` | DATE NULL | 하자보증기간 시작·종료 |

**서버가 이 값을 보고 합격 처리를 막습니다.** 자세한 내용은
[`docs/domain-glossary.md`](domain-glossary.md#하자이행증권) 참조.

**⑧ 소유·담당**

| 컬럼 | 설명 |
| --- | --- |
| `applicantId` → `users.id` | 신청자. **필수.** 신청자 화면의 조회 범위를 정하는 값 |
| `inspectorId` → `users.id` | 담당 감독관. NULL 허용 (배정 전) |

**인덱스**

```
status              상태별 KPI · 필터
visitDate           캘린더 · 이번주 일정
reqDate             목록 기본 정렬
applicantId         신청자 화면 조회
(year, product)     연도/제품 필터 (복합)
```

### 5.3 `application_logs`

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | INT AI PK | |
| `applicationId` | VARCHAR(16) FK | `ON DELETE CASCADE` |
| `at` | DATE | 처리일 |
| `who` | VARCHAR(80) | 예: `박지훈 (감독관)` |
| `txt` | VARCHAR(500) | 예: `검토승인 · 방문예정일 2026.07.30 (샘플링검사)` |

인덱스 `(applicationId, id)` — 한 건의 이력을 시간순으로 읽는 것이 유일한 조회 패턴입니다.

`who` 를 `users` FK 가 아니라 문자열로 박은 이유: **이력은 그 시점의 사실**이라
사람 이름이 바뀌거나 계정이 지워져도 그대로 남아야 합니다.

### 5.4 `notifications`

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `applicationId` | VARCHAR(16) FK | `ON DELETE CASCADE` |
| `channel` | ENUM | `MAIL` / `SMS` |
| `txt` | VARCHAR(500) | 발송 내용 |
| `at` | DATE | 발송일 |

실제로 메일·문자를 보내지는 않습니다. **발송했다는 기록만 남깁니다.**
실서비스로 갈 때 이 테이블에 쓰는 자리(`src/lib/actions.ts` 의 `notify()`)에
발송 연동을 붙이면 됩니다.

### 5.5 `external_visits`

감독관 동선 화면에 겹쳐 그리는 **다른 신청 건의 방문 일정**입니다.
이 시스템이 관리하지 않는 외부 일정이므로 `applications` 와 FK 로 묶지 않습니다.

| 컬럼 | 설명 |
| --- | --- |
| `date` / `time` | 방문일 · 시각(`'HH:MM'`) |
| `site` / `region` / `product` / `installer` / `manager` | 표시용 |

인덱스: `date`

---

## 6. 날짜를 다루는 방식

화면과 프로토타입은 `'YYYY.MM.DD'` **문자열**을 씁니다. DB 는 `DATE` 입니다.

```
   화면 · DTO            변환 계층                DB
  ─────────────      ───────────────         ─────────
  "2026.07.30"  ◄──  src/lib/date.ts    ──►  DATE 2026-07-30
                     parseDot / fmtDot        (UTC 자정)
```

- `parseDot('2026.07.30')` → `Date`(UTC 자정)
- 저장·조회 모두 UTC 자정으로 맞춥니다. 로컬 타임존으로 만들면
  KST(+9) 에서 하루 밀립니다.
- `moveIn` 만 예외로 `'YYYY.MM'` 문자열 그대로 둡니다 (일자가 없는 값).

**타임존 규칙: DB·서버 모두 UTC. 표시만 한국식 포맷.**

---

## 7. `lat`/`lng` 가 DECIMAL 인 이유

`DECIMAL(10,7)` 은 소수점 7자리 — 약 1cm 해상도로, 현장 핀에 충분합니다.

`DOUBLE` 을 쓰면 Prisma 가 JS `number` 로 주고받으면서 마지막 자리가
미세하게 흔들려, 저장 → 재조회 시 값이 달라져 보이는 일이 생깁니다.
지도 핀은 사용자가 "내가 찍은 그 자리"로 인식해야 하므로 `DECIMAL` 로 고정했습니다.

대신 Prisma 가 `Decimal` 객체로 주므로 DTO 경계에서 `Number()` 변환이 필요합니다
(`src/lib/data.ts`).

---

## 8. 초기 데이터 · 마이그레이션

세 갈래가 있고, **서로 충돌하지 않게 맞물려 있습니다.**

```
  ① docker/initdb/01-init.sql     MySQL 컨테이너 최초 기동 시 1회 실행
     (스키마 + _prisma_migrations 행 + 샘플 252건)
                  │
                  ▼
  ② prisma migrate deploy         migrate 컨테이너가 실행
     → ①이 _prisma_migrations 를 이미 채워 뒀으므로
       "No pending migrations to apply." 로 통과
                  │
                  ▼
  ③ prisma/seed.ts                이어서 실행
     → SEED_ONLY_IF_EMPTY=1 이고 이미 데이터가 있으면 건너뜀
```

이 구조 덕분에 **컨테이너를 처음 올리면 즉시 252건이 있는 상태**로 뜨고,
재기동해도 데이터가 덮어써지지 않습니다.

| 명령 | 하는 일 |
| --- | --- |
| `npm run db:migrate` | `prisma migrate deploy` |
| `npm run db:seed` | 샘플 데이터 적재 |
| `npm run db:reset` | `prisma migrate reset --force --skip-seed` + 시드 |
| `npm run db:dump` | 현재 DB → `docker/initdb/01-init.sql` 재생성 |

> `db:reset` 에 `db push --force-reset` 을 쓰면 안 됩니다.
> `_prisma_migrations` 가 사라져 컨테이너의 `migrate deploy` 가 P3005 로 실패합니다.

샘플 데이터는 [`prisma/samples.ts`](../prisma/samples.ts) 가 **결정적 난수**(mulberry32)로
생성하므로, 같은 시드값이면 항상 같은 데이터가 나옵니다. 그래서 커밋된
`01-init.sql` 과 재생성한 결과가 일치합니다.

---

## 9. 스키마를 바꿀 때

1. `prisma/schema.prisma` 수정
2. `npx prisma migrate dev --name <설명>`
   - MySQL 은 shadow DB 생성 권한이 필요합니다. 권한 오류(P3014)가 나면
     `DATABASE_URL` 을 root 계정으로 바꿔 한 번 실행하세요.
3. 컬럼이 화면에 나와야 하면 `src/lib/data.ts` 의 DTO 변환에 추가
4. 한글 라벨이 필요하면 `src/lib/domain.ts` 에 변환표 추가
5. `npm run db:reset && npm run db:dump` 로 `01-init.sql` 재생성
6. `npx tsc --noEmit && npm run build`

**주의**

- `VARCHAR` 컬럼에 `DEFAULT` 를 주려면 TEXT 가 아니어야 합니다 (§5.2 ⑥)
- enum 값을 바꾸면 `src/lib/domain.ts` 의 변환표도 함께 바꿔야 합니다.
  타입이 `satisfies Record<StatusLabel, string>` 로 묶여 있어 빠뜨리면
  `tsc` 가 잡아 줍니다.
