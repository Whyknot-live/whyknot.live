// Minimal stand-in for GET /api/admin/submissions used by the negative
// controls of promote-launches.mjs: serves a fixture file for any request, so
// the script's fetch + validation path can be exercised without a live
// backend. Never used by the build; run manually and kill afterwards.
//
//   bun frontend/scripts/fixtures/serve-fixture.mjs [fixture.json] [port]
//
// Defaults: invalid-submissions.json on 127.0.0.1:18111.
//
// Three fixture modes:
//   1. verbatim (default)   — the file is served as-is for every request, so
//      every page the script asks for returns the same body (that is how a
//      missing/paginated contract shows up). Used by invalid-submissions,
//      approved-mixed, url-variants, no-pagination, bad-pagination, ...
//   2. page map             — a top-level "pages" object keyed by page number
//      {"pages": {"1": {...}, "2": {...}}} serves the requested page (from the
//      ?page= query) and 404s for pages the map does not contain. Used by
//      pagination-2page and empty-page.
//   3. repeat               — a top-level "repeat" body served for every page
//      with pagination.page rewritten to the requested page. Used by
//      infinite-pagination to prove the 1000-page cap without 1000 files.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const fixtureName = process.argv[2] ?? 'invalid-submissions.json';
const port = Number.parseInt(process.argv[3] ?? '18111', 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`serve-fixture: ERROR invalid port "${process.argv[3]}"`);
    process.exit(1);
}

let fixture;
try {
    fixture = JSON.parse(readFileSync(fileURLToPath(new URL(fixtureName, import.meta.url)), 'utf8'));
} catch (err) {
    console.error(`serve-fixture: ERROR cannot read fixture ${fixtureName} as JSON: ${err.message}`);
    process.exit(1);
}

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const mode = isPlainObject(fixture.repeat) ? 'repeat' : isPlainObject(fixture.pages) ? 'page-map' : 'verbatim';

function bodyFor(page) {
    if (mode === 'repeat') {
        const body = structuredClone(fixture.repeat);
        if (isPlainObject(body.pagination)) body.pagination.page = page;
        return { status: 200, body };
    }
    if (mode === 'page-map') {
        const entry = fixture.pages[String(page)];
        if (!entry) return { status: 404, body: { ok: false, error: 'no_such_page' } };
        return { status: 200, body: entry };
    }
    return { status: 200, body: fixture };
}

const server = createServer((req, res) => {
    const requested = Number.parseInt(new URL(req.url ?? '/', 'http://127.0.0.1').searchParams.get('page') ?? '1', 10);
    const page = Number.isInteger(requested) && requested >= 1 ? requested : 1;
    const { status, body } = bodyFor(page);
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
});
server.listen(port, '127.0.0.1', () => {
    console.info(`serve-fixture: serving ${fixtureName} (${mode}) at http://127.0.0.1:${port}`);
});
