// 프로토타입(index.html) 안의 더미 데이터를 시드용 JSON 으로 뽑아낸다.
// 입력: tools/.extracted/app_decoded.jsx  (index.html 안의 x-dc 스크립트를 풀어 놓은 것)
// 출력: tools/.extracted/apps.json, tools/.extracted/external.json
//       → prisma/data/ 로 복사해 두면 시드가 그대로 쓴다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, '.extracted/app_decoded.jsx'), 'utf8');

/** `key` 로 시작하는 배열 리터럴을 대괄호 균형을 맞춰 잘라낸다. */
function sliceArray(text, key) {
  const at = text.indexOf(key);
  if (at < 0) throw new Error(`not found: ${key}`);
  const open = at + key.length - 1;
  let depth = 0;
  for (let p = open; p < text.length; p++) {
    if (text[p] === '[') depth++;
    else if (text[p] === ']') {
      depth--;
      if (depth === 0) return text.slice(open, p + 1);
    }
  }
  throw new Error(`unbalanced: ${key}`);
}

const apps = eval(sliceArray(src, 'apps: ['));
const external = eval(sliceArray(src, 'OTHER = ['));

fs.writeFileSync(path.join(here, '.extracted/apps.json'), JSON.stringify(apps, null, 2));
fs.writeFileSync(path.join(here, '.extracted/external.json'), JSON.stringify(external, null, 2));

const keys = new Set();
for (const a of apps) for (const k of Object.keys(a)) keys.add(k);
console.log('apps:', apps.length, '/ external:', external.length);
console.log('keys:', [...keys].join(', '));
console.log('managers:');
for (const m of new Set(apps.map((a) => `${a.manager} | ${a.phone} | ${a.installer}`))) console.log(' ', m);
