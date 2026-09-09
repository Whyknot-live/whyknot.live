// Guards the single-source token architecture (see agent.md conventions).
// Fails if any stylesheet other than tokens.css redefines core brand tokens
// at :root scope (font stack, accent, canvas, page width). Component files
// may consume tokens and define component-scoped custom properties, but must
// never re-declare the brand foundation — that silently re-themes the product.
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

if (failures > 0) {
    console.error(`\ntoken-guard: ${failures} forbidden token redefinition(s). Move brand values into ${OWNER}.`);
    process.exit(1);
}
console.info('token-guard: OK — brand tokens owned solely by tokens.css');
