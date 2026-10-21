// Guards the single-source token architecture (see AGENTS.md conventions).
// Fails if any stylesheet other than tokens.css redefines core brand tokens
// at :root scope (font stack, accent, canvas, page width). Component files
// may consume tokens and define component-scoped custom properties, but must
// never re-declare the brand foundation — that silently re-themes the product.
//
// WARN mode (prints, never fails; DESIGN.md section 11), added 2026-09-29:
//   1. raw hex colors in stylesheets outside tokens.css
//   2. backdrop-filter outside the overlay files (navigation, cookie banner, dialog)
//   3. font-family values outside Bebas Neue / Outfit / Caveat / the system mono stack
// Scope: every .css under src/ plus <style> blocks inside .astro files. Flip a check to failing by
// raising WARN_ONLY to false once its warning count reaches zero.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const STYLES_DIR = fileURLToPath(new URL('../src/styles/', import.meta.url));
const OWNER = 'tokens.css';
// Core brand foundation: redefining any of these outside tokens.css is a bug.
const GUARDED = new Set([
    '--font-sans',
    '--font-mono',
    '--color-accent',
    '--color-bg',
    '--color-text',
    '--page-max-width',
]);

function collectCss(dir) {
    const out = [];
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        const st = statSync(full);
        if (st.isDirectory()) out.push(...collectCss(full));
        else if (name.endsWith('.css')) out.push(full);
    }
    return out;
}

function rootBlocks(css) {
    // Yield each :root { ... } body (no nesting inside :root in this codebase).
    const blocks = [];
    const re = /:root(?:\[[^\]]*\])?\s*\{([^}]*)\}/g;
    let match;
    while ((match = re.exec(css)) !== null) blocks.push(match[1]);
    return blocks;
}

let failures = 0;
for (const file of collectCss(STYLES_DIR)) {
    if (file.endsWith(`/${OWNER}`)) continue;
    const raw = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const body of rootBlocks(raw)) {
        for (const token of GUARDED) {
            const hit = new RegExp(`${token.replace(/-/g, '\\-')}\\s*:`).test(body);
            if (hit) {
                console.error(`token-guard: ${relative(process.cwd(), file)} redefines ${token} (owned by ${OWNER})`);
                failures += 1;
            }
        }
    }
}

// ---------------------------------------------------------------------------
// WARN-mode checks
// ---------------------------------------------------------------------------
const WARN_ONLY = true;
const SRC_DIR = fileURLToPath(new URL('../src/', import.meta.url));
// Only these stylesheets may carry a backdrop-filter (overlays where blur aids legibility).
const BLUR_ALLOWED = new Set(['navigation.css', 'cookie-consent.css', 'dialog.css']);
// Every family name (or generic/system keyword) that is allowed inside a font-family value.
const FONT_ALLOWED = new Set([
    'bebas neue', 'outfit', 'caveat',
    // system stack used by --font-sans / --font-hand / --font-mono
    'system-ui', '-apple-system', 'segoe ui', 'roboto', 'helvetica neue', 'arial', 'noto sans', 'sans-serif',
    'segoe print', 'bradley hand', 'cursive',
    'ui-monospace', 'sfmono-regular', 'menlo', 'monaco', 'consolas', 'liberation mono', 'monospace',
    'inherit', 'initial', 'unset',
]);

function collectAll(dir, exts) {
    const out = [];
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        const st = statSync(full);
        if (st.isDirectory()) out.push(...collectAll(full, exts));
        else if (exts.some((e) => name.endsWith(e))) out.push(full);
    }
    return out;
}

// Returns [{ file, text }] chunks of CSS: whole .css files, and <style> bodies from .astro files.
function cssChunks() {
    const chunks = [];
    for (const file of collectAll(SRC_DIR, ['.css', '.astro'])) {
        const raw = readFileSync(file, 'utf8');
        if (file.endsWith('.css')) {
            chunks.push({ file, text: raw });
        } else {
            const re = /<style[^>]*>([\s\S]*?)<\/style>/g;
            let m;
            while ((m = re.exec(raw)) !== null) chunks.push({ file, text: m[1] });
        }
    }
    return chunks;
}

function warnSummary(title, hits) {
    if (hits.length === 0) {
        console.info(`token-warn: ${title}: none`);
        return;
    }
    const byFile = new Map();
    for (const h of hits) byFile.set(h.file, (byFile.get(h.file) ?? 0) + 1);
    console.warn(`token-warn: ${title}: ${hits.length} in ${byFile.size} file(s)`);
    const top = [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    for (const [file, n] of top) console.warn(`  ${String(n).padStart(4)}  ${relative(process.cwd(), file)}`);
    if (byFile.size > top.length) console.warn(`        ... and ${byFile.size - top.length} more file(s)`);
}

const hexHits = [];
const blurHits = [];
const fontHits = [];
for (const { file, text } of cssChunks()) {
    const css = text.replace(/\/\*[\s\S]*?\*\//g, '');
    const base = file.split('/').pop();
    if (base !== OWNER) {
        for (const m of css.matchAll(/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g)) hexHits.push({ file, value: m[0] });
    }
    if (!BLUR_ALLOWED.has(base)) {
        for (const m of css.matchAll(/(?<![\w-])backdrop-filter\s*:/g)) blurHits.push({ file, value: m[0] });
    }
    for (const m of css.matchAll(/(?<![\w-])font-family\s*:\s*([^;}]+)/g)) {
        // Strip var(--x, fallback) wrappers down to their fallback text so fallbacks are judged too.
        const value = m[1].replace(/var\(\s*--[\w-]+\s*,?/g, '').replace(/\)/g, '');
        const names = value.split(',').map((n) => n.trim().replace(/^["']|["']$/g, '').toLowerCase()).filter(Boolean);
        const bad = names.filter((n) => !FONT_ALLOWED.has(n) && !n.startsWith('--'));
        if (bad.length > 0) fontHits.push({ file, value: bad.join(', ') });
    }
}
warnSummary('raw hex colors outside tokens.css', hexHits);
warnSummary(`backdrop-filter outside ${[...BLUR_ALLOWED].join(', ')}`, blurHits);
warnSummary('font-family outside Bebas Neue / Outfit / Caveat / system mono', fontHits);
if (!WARN_ONLY && hexHits.length + blurHits.length + fontHits.length > 0) failures += 1;

if (failures > 0) {
    console.error(`\ntoken-guard: ${failures} forbidden token redefinition(s). Move brand values into ${OWNER}.`);
    process.exit(1);
}
console.info('token-guard: OK — brand tokens owned solely by tokens.css');
