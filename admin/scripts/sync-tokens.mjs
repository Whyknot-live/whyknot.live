// Keeps admin/src/styles/tokens.css in step with the single token source,
// frontend/src/styles/tokens.css (see AGENTS.md and DESIGN.md).
//
//   bun scripts/sync-tokens.mjs           check (default): report drift, always exit 0 (WARN mode)
//   bun scripts/sync-tokens.mjs --check   same as above
//   bun scripts/sync-tokens.mjs --strict  check, but exit 1 on drift (use once admin is in sync)
//   bun scripts/sync-tokens.mjs --write   overwrite the admin copy from the frontend source
//
// Before running --write: on 2026-09-29 the admin copy differed from the frontend file (for example
// --font-sans, --radius-md/lg, the gradient-title tokens, --color-link-hover). Those may be
// intentional. --write replaces the whole file, so review the check output first.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SOURCE = fileURLToPath(new URL('../../frontend/src/styles/tokens.css', import.meta.url));
const TARGET = fileURLToPath(new URL('../src/styles/tokens.css', import.meta.url));
const HEADER = '/* GENERATED from frontend/src/styles/tokens.css by admin/scripts/sync-tokens.mjs. Edit the frontend file, then run: bun scripts/sync-tokens.mjs --write */\n';

const args = new Set(process.argv.slice(2));
const write = args.has('--write');
const strict = args.has('--strict');

if (!existsSync(SOURCE)) {
    console.warn('tokens-sync: frontend/src/styles/tokens.css not found (admin built on its own?); skipping.');
    process.exit(0);
}

const source = readFileSync(SOURCE, 'utf8').replace(/\r\n/g, '\n');
const expected = HEADER + source;

if (write) {
    writeFileSync(TARGET, expected);
    console.info('tokens-sync: wrote admin/src/styles/tokens.css from the frontend source.');
    process.exit(0);
}

const actual = existsSync(TARGET) ? readFileSync(TARGET, 'utf8').replace(/\r\n/g, '\n') : '';
if (actual === expected) {
    console.info('tokens-sync: OK, admin tokens match the frontend source.');
    process.exit(0);
}

// Custom-property declarations as name -> list of values (a token can be declared once per theme selector).
function declarations(css) {
    const map = new Map();
    const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of clean.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)) {
        const list = map.get(m[1]) ?? [];
        list.push(m[2].replace(/\s+/g, ' ').trim());
        map.set(m[1], list);
    }
    return map;
}

const front = declarations(source);
const admin = declarations(actual);
const onlyFront = [...front.keys()].filter((k) => !admin.has(k));
const onlyAdmin = [...admin.keys()].filter((k) => !front.has(k));
const changed = [...front.keys()].filter((k) => admin.has(k) && JSON.stringify(front.get(k)) !== JSON.stringify(admin.get(k)));

const sample = (list) => list.slice(0, 12).join(', ') + (list.length > 12 ? `, ... (+${list.length - 12})` : '');
console.warn('tokens-sync: WARN admin/src/styles/tokens.css differs from frontend/src/styles/tokens.css');
console.warn(`  tokens only in frontend: ${onlyFront.length}${onlyFront.length ? `  ${sample(onlyFront)}` : ''}`);
console.warn(`  tokens only in admin:    ${onlyAdmin.length}${onlyAdmin.length ? `  ${sample(onlyAdmin)}` : ''}`);
console.warn(`  tokens with other values: ${changed.length}${changed.length ? `  ${sample(changed)}` : ''}`);
console.warn('  Review, then run: bun scripts/sync-tokens.mjs --write   (replaces the whole admin file)');
process.exit(strict ? 1 : 0);
