/**
 * mysqldump 결과에 헤더를 붙여 docker/initdb/01-init.sql 로 저장한다.
 * `npm run db:dump` 가 부른다 — 직접 실행할 일은 없다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const raw = path.join(root, 'docker/initdb/_dump.sql');
const out = path.join(root, 'docker/initdb/01-init.sql');

const body = fs.readFileSync(raw, 'utf8');
if (!body.includes('CREATE TABLE `applications`')) {
  console.error('덤프에 applications 테이블이 없습니다. DB 가 떠 있고 시드가 끝났는지 확인하세요.');
  process.exit(1);
}

// 행 수는 SQL 을 파싱하지 말고 DB 에서 직접 세어 온다.
// (로그·통보 본문에 괄호가 들어 있어 INSERT 문 파싱은 과다 집계된다)
const [users, apps, logs, notifs, visits] = (process.env.SEED_COUNTS ?? '')
  .trim()
  .split(/\s+/)
  .map((n) => Number(n) || 0);
const tables = (body.match(/CREATE TABLE/g) || []).length;

const header = `-- ============================================================================
--  준공 이관검사 시스템 — 초기 스키마 + 샘플 더미데이터
--
--  MySQL 데이터 디렉터리가 비어 있을 때(최초 기동) 1회 실행된다.
--  compose 의 db 서비스가 /docker-entrypoint-initdb.d 로 마운트한다.
--
--  담고 있는 것
--    - 전체 테이블 스키마 (users / applications / application_logs /
--      notifications / external_visits)
--    - _prisma_migrations — 마이그레이션이 적용된 것으로 기록해 두므로
--      뒤이어 도는 \`prisma migrate deploy\` 는 "No pending migrations" 로 끝난다
--    - 샘플 데이터: 계정 ${users} · 신청 ${apps}건 · 처리이력 ${logs} ·
--      통보 ${notifs} · 외부 방문일정 ${visits}
--
--  로그인: 신청자 user1@gmail.com · 감독관 user2@gmail.com · 비밀번호 1234
--
--  이 파일은 손으로 고치지 말 것. prisma/seed.ts 를 고친 뒤 아래로 다시 만든다.
--      npm run db:reset && npm run db:dump
--
--  이미 만들어진 볼륨에는 적용되지 않는다. 다시 적용하려면:
--      docker compose down -v && docker compose up -d
-- ============================================================================

`;

fs.writeFileSync(out, header + body);
fs.rmSync(raw, { force: true });
console.log(
  `docker/initdb/01-init.sql 갱신 — 테이블 ${tables}개 · 계정 ${users} · 신청 ${apps}건 · ` +
    `처리이력 ${logs} · 통보 ${notifs} · 외부일정 ${visits} · ${(fs.statSync(out).size / 1024).toFixed(0)}KB`,
);
