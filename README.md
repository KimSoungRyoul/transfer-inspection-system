# 준공 이관검사 시스템 (Transfer Inspection System)

공동주택 도어록(DDL)·홈네트워크(HN/HA) 준공 이관검사의
**신청 → 검토승인 → 1차 판정 → 최종 판정 → 결과 통보** 전 과정을 처리하는 웹 애플리케이션입니다.

* `index.html` 단일 페이지 프로토타입

---

## 빠른 실행 (Docker 또는 Podman)

```bash
cp .env.example .env          # 필요하면 비밀번호·포트 수정

docker compose up -d --build  # 또는
podman compose up -d --build
```

`db` → `migrate` → `app` 순으로 기동합니다. 완료되면 <http://localhost:3000> 으로 접속합니다.

DB 는 처음 올라올 때 `docker/initdb/01-init.sql` 이 스키마와 샘플 데이터를 한 번에 넣습니다
(계정 17 · 신청 252건 · 처리이력 899 · 통보 691 · 외부 방문일정 50).
뒤이어 도는 `migrate` 는 적용할 마이그레이션이 없으면 시드도 건너뜁니다.

### 데모 계정

| 역할 | 이메일 | 비밀번호 |
| --- | --- | --- |
| 이관검사 신청자 | `user1@gmail.com` | `1234` |
| 감독관 | `user2@gmail.com` | `1234` |

로그인 화면의 **Google 계정으로 계속하기** 를 누르면 두 계정을 목록에서 골라 바로 들어갈 수 있습니다.
시드는 이 둘 외에 설치점 담당자별 신청자 계정 8개를 더 만듭니다(비밀번호 동일).
비밀번호는 `SEED_PASSWORD` 환경변수로 바꿀 수 있습니다.

### 종료 · 초기화

```bash
docker compose down          # 컨테이너만 정리
docker compose down -v       # DB 볼륨까지 삭제 (다음 기동 때 시드 재실행)
```

---

## 로컬 개발

```bash
npm install
docker compose up -d db       # MySQL 만 띄운다
npm run db:migrate            # 스키마 반영
npm run db:seed               # 더미 데이터 적재
npm run dev                   # http://localhost:3000
```

| 스크립트 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` | `prisma generate` + `next build` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | `prisma migrate deploy` |
| `npm run db:seed` | 더미 데이터 적재(멱등) |
| `npm run db:reset` | 스키마 초기화 후 재시드 |
| `npm run db:dump` | 현재 DB 를 `docker/initdb/01-init.sql` 로 다시 덤프 |

> 마이그레이션을 **새로 만들 때**(`prisma migrate dev`)는 shadow DB 생성 권한이 필요하므로
> `DATABASE_URL="mysql://root:root@127.0.0.1:3306/inspection"` 처럼 root 로 실행합니다.

### 샘플 데이터

`prisma/data/*.json` 의 12건은 프로토타입에서 그대로 옮겨 온 시연용 기준 데이터이고,
그 위에 `prisma/samples.ts` 가 만드는 샘플이 얹힙니다. 생성기는 고정 시드 PRNG 를 써서
**같은 입력이면 항상 같은 데이터**가 나오므로 커밋된 init SQL 과 어긋나지 않습니다.

| 환경변수 | 기본값 | 설명 |
| --- | --- | --- |
| `SEED_SAMPLES` | `240` | 추가로 만들 신청 건 수 (`0` 이면 기준 12건만) |
| `SEED_VISITS` | `60` | 추가로 만들 외부 방문일정 수 (주말은 제외되어 실제로는 더 적음) |
| `SEED_PASSWORD` | `1234` | 전 계정 공통 비밀번호 |

건수를 바꿨으면 init SQL 도 다시 만들어야 합니다.

```bash
SEED_SAMPLES=80 npm run db:reset   # 원하는 규모로 다시 적재
npm run db:dump                    # docker/initdb/01-init.sql 갱신
```

> 감독관 접수 목록은 프로토타입과 같이 페이지네이션 없이 전 건을 한 표에 그립니다.
> 252건 기준 목록 화면 HTML 이 약 1.1MB 이므로, 더 늘릴 때는 이 점을 감안하세요.

---

## 기능

### 공통
- 이메일·비밀번호 로그인 / 회원가입, 역할(신청자·감독관) 선택
- 데모용 Google 계정 선택 로그인
- 세션은 서명된 JWT 를 httpOnly 쿠키에 담아 유지 (`로그인 상태 유지` 체크 시 14일)
- 계정 권한과 다른 역할 화면에는 접근할 수 없습니다

### 이관검사 신청자
- **내 신청 현황** — KPI 4종, 방문 일정 카드(D-day·도착 예정 시각), 신청 목록
- **신청 상세** — 진행 단계 타임라인, 감독관 방문 동선, 신청서 전 항목, 하자이행증권,
  처리 로그, 통보(이메일/문자) 이력
- **이관검사 신청** — 제품군 선택 후 4단계 폼
  (현장 기본정보 · 설치점/담당자 · 제품 정보 · 보증/검사요청).
  DDL 41개 / HN·HA 58개 항목을 모두 저장합니다.
- **보완요청 대응** — 반려된 건의 하자이행증권·비고를 수정해 재신청

### 감독관
- **신청 접수 목록** — KPI 카드 → 목록 모달, 이번주(일~토) 방문 일정,
  연도/제품/상태 필터 · 검색 · 정렬, 다중 선택 후 일괄 검토승인, CSV 내보내기
- **방문 캘린더** — 월간 방문예정일 격자, 일자별 방문 동선
- **처리 드로어** — 목록·KPI 모달·이번주 일정 어디서 열어도 그 건의 현재 단계에 맞는 화면
  (검토예정 등록 / 검토승인 / 보완요청 반려 / 판정 입력 / 결과 조회)
- **판정 상세** — 1차·최종 합격·불합격 판정, 검사종류, 하자이행증권 확인,
  이메일·문자 발송 선택 후 결과 통보

처리할 때마다 **처리 로그**와 **통보 이력**이 DB 에 쌓이고 신청자 화면에 그대로 보입니다.

### 잘못된 처리를 막는 장치

화면에서 막는 것과 별개로, **서버가 다시 한 번 검사**합니다. 화면을 우회해 요청을
보내도 아래는 통과하지 못합니다.

| 규칙 | 막는 것 |
| --- | --- |
| 상태 검증 | 이미 검토승인·판정이 끝난 건을 다시 승인하거나 되돌리는 요청 |
| 일괄 승인 | 선택 목록에서 승인 가능한 상태만 처리하고, 제외된 건수를 알려 줍니다 |
| 하자이행증권 확인 | 하자이행증권이 미발행이면 **합격·조건부합격으로 확정할 수 없습니다** (불합격·보류·이월은 가능) |
| 1차 판정 | 하지 않은 1차 판정을 최종 판정으로 채워 넣지 않습니다 — 이력에 `1차 판정 없이 확정` 으로 남습니다 |

되돌릴 수 없고 신청자·현장PM·설치점 3곳에 통보가 나가는 조작(최종 판정 확정,
보완요청 반려)은 버튼 줄이 **확인 단계로 바뀐 뒤** 실행됩니다.

### 현장 위치 · 지도

지도 제공자는 환경변수로 갈립니다. **키가 없으면 그대로 OpenStreetMap 으로 동작**하므로
별도 설정 없이도 바로 쓸 수 있습니다.

| 조건 | 지도 | 주소 검색 · 역지오코딩 |
| --- | --- | --- |
| 키 없음 (기본) | Leaflet + OpenStreetMap 타일 | Nominatim |
| 네이버 키 설정 | 네이버 지도 JS API v3 | 네이버 Geocoding / Reverse Geocoding |

주소 검색·역지오코딩은 브라우저가 아니라 서버의 `/api/geocode` 가 대신 호출합니다.
시크릿 키를 노출하지 않고, CORS·User-Agent 정책도 서버에서 맞추기 위해서입니다.
네이버 호출이 실패하면(키 만료·쿼터 초과) 조용히 OpenStreetMap 으로 한 번 더 시도하므로
지도가 비어 보이는 일은 없습니다.

#### 네이버 지도를 쓰려면

1. [NAVER Cloud Platform 콘솔](https://console.ncloud.com) →
   **Services > Application Services > Maps** 에서 애플리케이션을 등록합니다.
2. **Web 서비스 URL** 에 접속 주소를 등록합니다 (로컬은 `http://localhost:3000`).
   등록하지 않으면 SDK 가 인증 오류로 로드되지 않습니다.
3. 발급받은 값을 `.env` 에 채웁니다.

```bash
# 브라우저에서 지도를 그릴 때 쓰는 공개 키
NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=발급받은_클라이언트_ID
# SDK 쿼리 파라미터 이름 — 신규 계정은 ncpKeyId, 구 계정은 ncpClientId
NEXT_PUBLIC_NAVER_MAP_KEY_PARAM=ncpKeyId
# 서버에서 주소 검색·역지오코딩에 쓰는 키 (노출 금지)
NAVER_MAP_CLIENT_ID=발급받은_클라이언트_ID
NAVER_MAP_CLIENT_SECRET=발급받은_시크릿
```

> `NEXT_PUBLIC_*` 값은 빌드 시점에 번들로 박히므로, 컨테이너로 돌릴 때는
> `.env` 를 채운 뒤 **이미지를 다시 빌드**해야 반영됩니다 (`docker compose up -d --build`).
> compose 가 build args 로 넘기도록 이미 연결해 두었습니다.

---

## 화면 주소

로그인하면 계정 역할에 맞는 화면으로 보냅니다. 역할이 다른 주소로 들어가면 자기 화면으로 되돌아갑니다.

| 주소 | 화면 |
| --- | --- |
| `/login` | 로그인 · 회원가입 |
| `/applicant` | 신청자 — 내 신청 현황 |
| `/applicant/new` | 신청자 — 이관검사 신청 |
| `/applicant/{식별번호}` | 신청자 — 신청 상세 |
| `/supervisor` | 감독관 — 신청 접수 목록 (`?view=cal` 이면 방문 캘린더) |
| `/supervisor/judge` | 감독관 — 판정해야 할 건으로 바로 이동 |
| `/supervisor/{식별번호}` | 감독관 — 판정 상세 |

---

## 구조

```
src/
  app/
    layout.tsx              루트 레이아웃 (폰트 · 토스트)
    login/                  로그인 · 회원가입
    (app)/                  인증이 필요한 영역 (상단바 + 사이드바 셸)
      applicant/            신청자: 목록 · 상세 · 신규 신청
      supervisor/           감독관: 접수 목록/캘린더 · 판정 상세
    api/
      geocode/              Nominatim 프록시
      export/               접수 목록 CSV
  components/               화면 컴포넌트
  lib/
    domain.ts               한글 업무 용어 ↔ DB enum 변환표, DTO
    date.ts                 'YYYY.MM.DD' ↔ MySQL DATE
    view.ts                 화면 파생 로직 (배지 색 · 동선 · 타임라인 · KPI)
    data.ts                 Prisma 조회 → DTO
    actions.ts              서버 액션 (모든 상태 변화)
    session.ts              JWT 세션 쿠키
docker/
  initdb/                   MySQL 최초 기동 시 실행되는 스키마 + 샘플 데이터 SQL
prisma/
  schema.prisma             MySQL 스키마
  samples.ts                결정적 샘플 데이터 생성기
  migrations/               마이그레이션
  seed.ts                   더미 데이터 적재
  data/                     프로토타입에서 추출한 시드 원본
tools/
  extract-seed.mjs          index.html → 시드 JSON 추출
index.html                  원본 프로토타입 (참고용 보존)
```

### 데이터 모델

| 테이블 | 내용 |
| --- | --- |
| `users` | 신청자·감독관 계정 |
| `applications` | 신청 건. DDL/HN 양식 항목, 상태, 방문예정일, 판정, 하자이행증권 |
| `application_logs` | 처리 이력 (상세 화면 타임라인) |
| `notifications` | 발송된 이메일·문자 통보 이력 |
| `external_visits` | 감독관 동선 참고용 외부 일정 |

업무 용어는 화면에서 한글 라벨(`신청완료`·`검토승인`…)을 쓰고 DB 에는 ASCII enum 으로 저장합니다.
변환표는 `src/lib/domain.ts` 한 곳에 있습니다.

---

## 데이터에 대한 안내

화면에 보이는 **현장명, 회사명, 담당자명, 연락처, 이메일, 프로젝트 코드, 제품 모델명, 하자이행증권 번호는 모두 가상의 더미 데이터**입니다.
실제 사업장·기업·개인 정보와는 무관하며, 우연히 일치하더라도 의도된 것이 아닙니다.

## 기술

- Next.js 15 (App Router, 서버 액션, standalone 출력)
- React 19 / TypeScript 5.7
- Prisma 6 + MySQL 8.4
- jose (JWT 세션) · bcryptjs (비밀번호 해시) · zod (입력 검증)
- Leaflet 1.9.4 + OpenStreetMap
- Noto Sans KR / Roboto Mono
