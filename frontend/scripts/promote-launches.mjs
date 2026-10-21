// Promotes approved submissions from the backend review queue into
// frontend/src/content/launches.json — the Option A promote step: approve a
// submission in the admin UI, run this script, then build/commit when told.
// No manual code edits to launches.json at any point.
//
//   bun frontend/scripts/promote-launches.mjs                 fetch + validate + append new launches, write once
//   bun frontend/scripts/promote-launches.mjs --dry-run       same pipeline, report only; never writes
//   bun frontend/scripts/promote-launches.mjs --api <origin>  API origin (default $PROMOTE_API_BASE or http://localhost:10000)
//   bun frontend/scripts/promote-launches.mjs --env-file <p>  where ADMIN_JWT_SECRET lives (default backend/.env)
//   bun frontend/scripts/promote-launches.mjs --file <path>   target launches.json (default frontend/src/content/launches.json)
//   bun frontend/scripts/promote-launches.mjs --help
//
// Auth: signs the same HS256 admin JWT the login route issues
// (backend/src/routes/admin.ts, POST /admin/login) with ADMIN_JWT_SECRET from
// backend/.env, then calls GET /api/admin/submissions?status=approved. Signing
// locally was chosen over reading Mongo directly: no driver dependency (zero
// package installs), and the admin endpoint is the exact data path the review
// UI already uses — one source of truth for "what is approved".
//
// Guarantees (negative controls exercised with this review; reproducible
// commands in the "Controls" block below):
//   1. API unreachable / bad token / malformed response / invalid submission
//      data / missing or malformed pagination / slug collision with a
//      different product / unreadable or invalid launches.json -> exit 1 with
//      launches.json byte-identical: everything is fetched and validated
//      before a single byte is written, and the write is a same-directory
//      tmp-file + re-parse + rename (atomic; a crash never truncates the
//      target).
//   2. Idempotent: a slug already present as the same product (name and
//      makerHandle both match) is skipped with a per-slug log line and never
//      overwritten, so hand edits survive; a second run reports zero changes
//      and does not touch the file at all. A slug present as a DIFFERENT
//      product is a collision: logged and exit 1, no overwrite (a maker was
//      promised that URL).
//   3. Pagination contract: every response must carry a well-formed
//      { pagination: { pages: n } }; missing/malformed -> exit 1 (never a
//      silent partial run). Rows are deduped by slug across pages (equal
//      createdAt rows repeat at page boundaries), an empty page ends the
//      fetch, and the loop hard-caps at 1000 pages.
//
// Controls (run from the repo root; always promote into a scratch copy —
// frontend/src/content/launches.json is never a --file target here):
//   T=$(mktemp -d) && cp frontend/src/content/launches.json "$T/launches.json"
//   # dead port: exit 1, target byte-identical
//   H=$(shasum -a 256 "$T/launches.json"); bun frontend/scripts/promote-launches.mjs --api http://127.0.0.1:18999 --file "$T/launches.json"; echo "exit=$?"; [ "$H" = "$(shasum -a 256 "$T/launches.json")" ] && echo "byte-identical"
//   # invalid payload / URL variants / missing+malformed pagination / slug collisions: exit 1, byte-identical
//   for F in invalid-submissions url-variants no-pagination bad-pagination slug-collision slug-collision-handle maker-handle-invalid; do
//     bun frontend/scripts/fixtures/serve-fixture.mjs $F.json 18111 & S=$!; sleep 0.3
//     H=$(shasum -a 256 "$T/launches.json"); bun frontend/scripts/promote-launches.mjs --api http://127.0.0.1:18111 --file "$T/launches.json"; echo "$F exit=$?"; [ "$H" = "$(shasum -a 256 "$T/launches.json")" ] && echo "$F byte-identical"
//     kill $S; sleep 0.2
//   done
//   # double-run: run 1 promotes nova-pad + zeta-clock (context-canvas skipped as
//   # the same product), run 2 = 0 changes; plus long-story, 2-page+dedupe, empty-page,
//   # makerHandle '@' strip, and the 1000-page cap (see each fixture file's mode).
//
// Mapping (decided 2026-10-08, not re-openable here):
//   - maker: maker display name if submissions ever ship one (makerName/maker),
//     else makerHandle — submissions carry no maker display name today.
//   - rank: append after the current max, new launches processed in slotDate order.
//   - votes/comments 0, badge 'New', publishedAt = slotDate.
//   - future slotDate -> status 'scheduled' + scheduledAt, else status 'live'.
//   - makerStory: submission story truncated at a word boundary to the
//     schema's 1200-char cap; omitted when under the 20-char schema minimum.
//   - url: the submission's outbound URL, only when present and http/https.
// launchSchema is the authority for every field (frontend/src/content.config.ts).
import { readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DEFAULT_API = process.env.PROMOTE_API_BASE ?? 'http://localhost:10000';
const DEFAULT_ENV_FILE = fileURLToPath(new URL('../../backend/.env', import.meta.url));
const DEFAULT_TARGET = fileURLToPath(new URL('../../frontend/src/content/launches.json', import.meta.url));
const PAGE_SIZE = 200; // GET /api/admin/submissions caps limit at 200
const MAX_PAGES = 1000; // hard cap: runaway pagination must never loop forever
const STORY_CAP = 1200; // launchSchema makerStory max
const STORY_MIN = 20; // launchSchema makerStory min
const MAKER_HANDLE = /^[A-Za-z0-9_-]+$/; // handle pattern after one leading '@' is stripped

function fail(message) {
    console.error(`promote-launches: ERROR ${message}`);
    process.exit(1);
}

function usage() {
    console.info('promote-launches.mjs — approved submissions -> frontend/src/content/launches.json');
    console.info('usage: bun frontend/scripts/promote-launches.mjs [--dry-run] [--api <origin>] [--env-file <path>] [--file <path>]');
}

function parseArgs(argv) {
    const opts = { dryRun: false, api: DEFAULT_API, envFile: DEFAULT_ENV_FILE, target: DEFAULT_TARGET };
    const valueOf = (flag, inline, next) => {
        if (inline !== undefined) return inline;
        if (next === undefined || next.startsWith('--')) fail(`missing value for ${flag}`);
        return next;
    };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--dry-run') opts.dryRun = true;
        else if (arg === '-h' || arg === '--help') { usage(); process.exit(0); }
        else if (arg === '--api') opts.api = valueOf(arg, undefined, argv[++i]);
        else if (arg.startsWith('--api=')) opts.api = valueOf('--api', arg.slice('--api='.length));
        else if (arg === '--env-file') opts.envFile = valueOf(arg, undefined, argv[++i]);
        else if (arg.startsWith('--env-file=')) opts.envFile = valueOf('--env-file', arg.slice('--env-file='.length));
        else if (arg === '--file') opts.target = valueOf(arg, undefined, argv[++i]);
        else if (arg.startsWith('--file=')) opts.target = valueOf('--file', arg.slice('--file='.length));
        else fail(`unknown argument: ${arg} (try --help)`);
    }
    opts.api = opts.api.replace(/\/+$/, '');
    return opts;
}

// Minimal .env reader: KEY=value, optional export prefix, quoted values,
// '#' comments on their own line. Inline comments are not stripped so a
// secret containing '#' is never truncated.
function readEnvFile(path) {
    let text;
    try {
        text = readFileSync(path, 'utf8');
    } catch (err) {
        fail(`cannot read env file ${path}: ${err.message}`);
    }
    const out = {};
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(trimmed);
        if (!match) continue;
        let value = match[2].trim();
        if ((value.startsWith('"') && value.endsWith('"') && value.length >= 2)
            || (value.startsWith("'") && value.endsWith("'") && value.length >= 2)) {
            value = value.slice(1, -1);
        }
        out[match[1]] = value;
    }
    return out;
}

// Same claims as the login route: { sub: 'admin', exp }, HS256. Web Crypto is
// built into Bun/Node — no dependencies.
async function signAdminJwt(secret) {
    const base64url = (input) => Buffer.from(input).toString('base64url');
    const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = base64url(JSON.stringify({ sub: 'admin', exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 }));
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${payload}`))).toString('base64url');
    return `${header}.${payload}.${signature}`;
}

// Transport errors often bury the errno in cause.cause / AggregateError.
function errorCode(err) {
    const codes = [];
    const seen = new Set();
    const walk = (value, depth) => {
        if (!value || typeof value !== 'object' || depth > 4 || seen.has(value)) return;
        seen.add(value);
        if (typeof value.code === 'string') codes.push(value.code);
        if (Array.isArray(value.errors)) value.errors.forEach((child) => walk(child, depth + 1));
        if (value.cause) walk(value.cause, depth + 1);
    };
    walk(err, 0);
    return codes.length > 0 ? ` [${codes.join(', ')}]` : '';
}

// GET /api/admin/submissions?status=approved, all pages. Any transport,
// contract or pagination failure fails the run; the caller exits 1 before
// touching the target file. Rows are deduped by slug (equal-createdAt rows can
// repeat across page boundaries), an empty page ends the fetch, and the loop
// hard-caps at MAX_PAGES so a runaway response can never loop forever.
async function fetchApproved(origin, token) {
    const all = [];
    const seen = new Set();
    let duplicates = 0;
    for (let page = 1; ; page++) {
        if (page > MAX_PAGES) {
            fail(`pagination still reports more pages at the ${MAX_PAGES}-page cap — refusing to promote a partial fetch`);
        }
        const url = `${origin}/api/admin/submissions?status=approved&page=${page}&limit=${PAGE_SIZE}`;
        let response;
        try {
            response = await fetch(url, {
                headers: { cookie: `adminToken=${token}`, accept: 'application/json' },
                signal: AbortSignal.timeout(15_000),
            });
        } catch (err) {
            fail(`fetch failed for ${url}: ${err?.message ?? 'unknown error'}${errorCode(err)}`);
        }
        if (!response.ok) {
            const hint = response.status === 401 ? ' (admin token rejected — check ADMIN_JWT_SECRET)' : '';
            fail(`GET ${url} returned HTTP ${response.status}${hint}`);
        }
        let body;
        try {
            body = await response.json();
        } catch {
            fail(`GET ${url} returned a body that is not JSON`);
        }
        if (!body || body.ok !== true || !Array.isArray(body.data)) {
            fail(`GET ${url} returned an unexpected shape (expected { ok: true, data: [...] })`);
        }
        const pagination = body.pagination;
        if (pagination === null || typeof pagination !== 'object' || Array.isArray(pagination)
            || !Number.isInteger(pagination.pages) || pagination.pages < 1) {
            fail(`GET ${url} returned missing or malformed pagination (expected { pagination: { pages: >= 1 } }) — refusing to promote a partial fetch`);
        }
        if (body.data.length === 0) {
            if (page < pagination.pages) {
                console.info(`promote-launches: page ${page} is empty; stopping the fetch (pagination reports ${pagination.pages} page(s))`);
            }
            break;
        }
        for (const doc of body.data) {
            const slug = doc !== null && typeof doc === 'object' && typeof doc.slug === 'string' ? doc.slug : null;
            if (slug !== null) {
                if (seen.has(slug)) {
                    duplicates += 1;
                    continue;
                }
                seen.add(slug);
            }
            all.push(doc);
        }
        if (page >= pagination.pages) break;
    }
    if (duplicates > 0) {
        console.info(`promote-launches: dropped ${duplicates} duplicate row(s) repeated across pages (same slug)`);
    }
    return all;
}

const nonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

// Every field the mapping relies on must be present and sane, or the whole run
// fails (fail-safe): bad data never produces a partial promote.
// Normalization happens here too, in place on the freshly fetched docs, so the
// value built into launches.json is the validated one:
//   - makerHandle: the submit form sends the input verbatim (SubmitForm.astro
//     only trims), so '@jane' is possible; strip ONE leading '@', then require
//     ^[A-Za-z0-9_-]+$ — otherwise it could never match makers.json.
//   - url: mirror launchSchema (content.config.ts): must start with the scheme,
//     must parse, must be http/https, and must carry no raw whitespace or
//     quotes (the schema regex is anchored and a quoted URL would break the
//     static build).
function validateSubmissions(docs) {
    const errors = [];
    docs.forEach((doc, index) => {
        const at = `submissions[${index}]${doc && typeof doc === 'object' && nonEmptyString(doc.slug) ? ` (slug "${doc.slug}")` : ''}`;
        if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
            errors.push(`${at}: not an object`);
            return;
        }
        if (typeof doc.makerHandle === 'string') {
            doc.makerHandle = doc.makerHandle.trim().replace(/^@/, '');
        }
        for (const field of ['slug', 'name', 'tagline', 'makerHandle']) {
            if (!nonEmptyString(doc[field])) errors.push(`${at}: missing or empty "${field}"`);
        }
        if (nonEmptyString(doc.makerHandle) && !MAKER_HANDLE.test(doc.makerHandle)) {
            errors.push(`${at}: "makerHandle" must match ^[A-Za-z0-9_-]+$ after stripping one leading "@", got "${doc.makerHandle}"`);
        }
        const slotOk = typeof doc.slotDate === 'string'
            && /^\d{4}-\d{2}-\d{2}$/.test(doc.slotDate)
            && !Number.isNaN(Date.parse(doc.slotDate));
        if (!slotOk) errors.push(`${at}: "slotDate" must be a valid YYYY-MM-DD date`);
        if (doc.url !== undefined && doc.url !== null) {
            if (typeof doc.url !== 'string') {
                errors.push(`${at}: "url" must be a string`);
            } else if (/[\s"]/.test(doc.url)) {
                errors.push(`${at}: "url" must not contain whitespace or quotes`);
            } else if (!/^https?:\/\//i.test(doc.url)) {
                errors.push(`${at}: "url" must be http or https (start with http:// or https://)`);
            } else {
                let protocol = '';
                try {
                    protocol = new URL(doc.url).protocol;
                } catch {
                    errors.push(`${at}: "url" is not a valid URL`);
                }
                if (protocol && protocol !== 'http:' && protocol !== 'https:') {
                    errors.push(`${at}: "url" must be http or https, got ${protocol}`);
                }
            }
        }
        if (doc.story !== undefined && doc.story !== null && typeof doc.story !== 'string') {
            errors.push(`${at}: "story" must be a string`);
        }
    });
    return errors;
}

// Cut at a word boundary, never inside a surrogate pair: Intl.Segmenter keeps
// whole-word (grapheme-safe) boundaries when available; the fallback backs a
// trailing high surrogate off before slicing at the last space. The cap counts
// UTF-16 code units, matching launchSchema's .max(1200).
const wordSegmenter = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'word' })
    : null;

function truncateAtWord(text, max) {
    const trimmed = text.trim();
    if (trimmed.length <= max) return trimmed;
    if (wordSegmenter) {
        let out = '';
        for (const { segment } of wordSegmenter.segment(trimmed)) {
            if (out.length + segment.length > max) break;
            out += segment;
        }
        if (out.length > 0) return out.trimEnd();
    }
    const cut = trimmed.slice(0, max);
    const lastCodeUnit = cut.charCodeAt(cut.length - 1);
    const endsMidPair = lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff;
    const safe = endsMidPair ? cut.slice(0, -1) : cut;
    const space = safe.lastIndexOf(' ');
    return (space > 0 ? safe.slice(0, space) : safe).trimEnd();
}

// Submissions have no maker display name (only makerHandle); check the display
// fields first so this keeps working if submit ever collects a name.
function makerDisplay(doc) {
    for (const field of ['makerName', 'maker']) {
        if (nonEmptyString(doc[field])) return doc[field].trim();
    }
    return doc.makerHandle.trim();
}

function buildEntry(doc, rank, today) {
    const entry = {
        name: doc.name.trim(),
        tagline: doc.tagline.trim(),
        maker: makerDisplay(doc),
        makerHandle: doc.makerHandle.trim(),
        votes: 0,
        comments: 0,
        rank,
        badge: 'New',
        publishedAt: doc.slotDate,
    };
    if (doc.url !== undefined && doc.url !== null) entry.url = doc.url;
    if (doc.slotDate > today) {
        entry.status = 'scheduled';
        entry.scheduledAt = doc.slotDate;
    } else {
        entry.status = 'live';
    }
    if (nonEmptyString(doc.story)) {
        const story = truncateAtWord(doc.story, STORY_CAP);
        if (story.length >= STORY_MIN) entry.makerStory = story;
    }
    return entry;
}

// Appends new entries as whole lines before the final '}'. Existing bytes stay
// a byte-identical prefix of the output — hand edits are never reformatted,
// reordered, or overwritten.
function appendEntries(raw, entries) {
    const trimmed = raw.trimEnd();
    if (!trimmed.endsWith('}')) fail('launches.json does not end with "}" — refusing to write');
    const open = trimmed.indexOf('{');
    if (open === -1) fail('launches.json has no top-level object — refusing to write');
    const head = trimmed.slice(0, trimmed.length - 1);
    const inner = head.slice(open + 1);
    const lines = entries.map(([slug, entry]) => `  ${JSON.stringify(slug)}: ${JSON.stringify(entry)}`);
    const out = head + (inner.trim() ? ',\n' : '\n') + lines.join(',\n') + '\n}\n';
    let parsed;
    try {
        parsed = JSON.parse(out);
    } catch (err) {
        fail(`resulting launches.json would not parse (${err.message}) — refusing to write`);
    }
    for (const [slug] of entries) {
        if (!(slug in parsed)) fail(`resulting launches.json is missing "${slug}" — refusing to write`);
    }
    return out;
}

async function main() {
    const opts = parseArgs(process.argv.slice(2));

    // 1. Read everything before touching anything.
    let raw;
    let launches;
    try {
        raw = readFileSync(opts.target, 'utf8');
    } catch (err) {
        fail(`cannot read ${opts.target}: ${err.message}`);
    }
    try {
        launches = JSON.parse(raw);
    } catch (err) {
        fail(`${opts.target} is not valid JSON (${err.message}) — refusing to write`);
    }
    if (launches === null || typeof launches !== 'object' || Array.isArray(launches)) {
        fail(`${opts.target} must be a JSON object keyed by slug — refusing to write`);
    }

    // Environment wins; backend/.env is only read when the variable is absent
    // (a deployment with ADMIN_JWT_SECRET exported never touches the file).
    const secret = process.env.ADMIN_JWT_SECRET || readEnvFile(opts.envFile).ADMIN_JWT_SECRET;
    if (!secret) fail(`ADMIN_JWT_SECRET not found in the environment or ${opts.envFile}`);

    // 2. Fetch + validate.
    console.info(`promote-launches: GET ${opts.api}/api/admin/submissions?status=approved`);
    const token = await signAdminJwt(secret);
    const docs = await fetchApproved(opts.api, token);
    const errors = validateSubmissions(docs);
    if (errors.length > 0) {
        for (const error of errors) console.error(`  - ${error}`);
        fail(`${errors.length} invalid submission(s); ${opts.target} not touched`);
    }

    // 3. Compute the delta. An existing slug is skipped only when it is the
    //    SAME product (name and makerHandle both match). Same slug, different
    //    product = collision: a maker was promised that URL, so we log every
    //    outcome and exit 1 without overwriting anything (fail-safe).
    const existing = new Set(Object.keys(launches));
    const pending = [];
    const skipped = [];
    const collisions = [];
    for (const doc of docs) {
        if (!existing.has(doc.slug)) {
            pending.push(doc);
            continue;
        }
        const current = launches[doc.slug];
        const sameName = current !== null && typeof current === 'object'
            && String(current.name ?? '').trim() === doc.name.trim();
        const sameHandle = current !== null && typeof current === 'object'
            && String(current.makerHandle ?? '').trim() === doc.makerHandle.trim();
        if (sameName && sameHandle) {
            skipped.push(doc.slug);
            console.info(`  - skip ${doc.slug}: already in launches.json as the same product (name + makerHandle match); never overwritten`);
        } else {
            collisions.push(doc);
        }
    }
    if (collisions.length > 0) {
        for (const doc of collisions) {
            const current = launches[doc.slug];
            console.error(`  - COLLISION ${doc.slug}: launches.json has "${String(current?.name ?? '(unknown)').trim()}" (makerHandle "${String(current?.makerHandle ?? '(none)').trim()}"), submission has "${doc.name.trim()}" (makerHandle "${doc.makerHandle.trim()}")`);
        }
        fail(`${collisions.length} approved submission(s) collide with a different product already at that slug — a maker was promised that URL; resolve by hand (rename the submission or the existing entry), ${opts.target} not touched`);
    }
    console.info(`promote-launches: ${docs.length} approved submission(s); ${pending.length} to promote, ${skipped.length} already in launches.json as the same product (skipped)`);

    if (pending.length === 0) {
        console.info(`promote-launches: OK, 0 changes; ${opts.target} untouched`);
        return;
    }

    const ranks = Object.values(launches)
        .map((entry) => (entry && typeof entry === 'object' && Number.isInteger(entry.rank) ? entry.rank : 0));
    let nextRank = ranks.length > 0 ? Math.max(...ranks) + 1 : 1;
    // UTC day (toISOString), matching how the boards read publishedAt — a local
    // date could disagree with launchDayBounds around midnight.
    const today = new Date().toISOString().slice(0, 10);
    pending.sort((a, b) => (a.slotDate === b.slotDate ? a.slug.localeCompare(b.slug) : a.slotDate.localeCompare(b.slotDate)));

    const added = pending.map((doc) => {
        const entry = buildEntry(doc, nextRank++, today);
        console.info(`  + ${doc.slug} -> rank ${entry.rank}, ${entry.status ?? 'live'}, slot ${doc.slotDate}`);
        return [doc.slug, entry];
    });

    // 4. Single write at the very end, or report-only.
    if (opts.dryRun) {
        console.info(`promote-launches: dry run, would append ${added.length} entr${added.length === 1 ? 'y' : 'ies'} to ${opts.target}; not written`);
        return;
    }
    const out = appendEntries(raw, added);
    // Atomic: write a same-directory tmp file, re-parse IT (not the string)
    // end to end, then rename over the target. A crash at any point leaves the
    // original launches.json untouched — a truncate-in-place write could not
    // promise that.
    const tmp = `${opts.target}.tmp`;
    try {
        writeFileSync(tmp, out, 'utf8');
        let roundTrip;
        try {
            roundTrip = JSON.parse(readFileSync(tmp, 'utf8'));
        } catch (err) {
            throw new Error(`written copy does not re-parse (${err.message})`, { cause: err });
        }
        if (roundTrip === null || typeof roundTrip !== 'object' || Array.isArray(roundTrip)) {
            throw new Error('written copy is not a JSON object');
        }
        for (const [slug] of added) {
            if (!(slug in roundTrip)) throw new Error(`written copy is missing "${slug}"`);
        }
        renameSync(tmp, opts.target);
    } catch (err) {
        try {
            unlinkSync(tmp);
        } catch {
            // tmp may not exist; the original error is the one to report.
        }
        fail(`cannot write ${opts.target}: ${err.message} — target left untouched`);
    }
    console.info(`promote-launches: wrote ${opts.target} (+${added.length} added, existing entries byte-identical)`);
}

await main();
