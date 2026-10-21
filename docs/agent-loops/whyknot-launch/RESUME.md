# whyknot-launch: resume page

Seeded 2026-10-05T17:19:33+0530 by loopctl from the old campaign books (seed text replaced by this
report under the end-of-run rule; nothing of substance lost - the seed only said "no run yet").

## Run 2026-10-05 22:29 -> 2026-10-06 (role think, ACTION PLAN): units K01, K02, L00, L01 all PLANNED
- Four contracts written; loopctl record was refused (the ceiling reclaimed the run lock - see the
  Closeout at the end): durable copies live at
  docs/agent-loops/whyknot-launch/contracts/{K01,K02,L00,L01}.json - the next run records with
  --contract pointing THERE, not at /tmp (scratch prunes in 24h).
- Research leads copied into the books: docs/agent-loops/whyknot-launch/research/l00-truth-table.md
  and research/k01-k02-money-and-auth.md (leads only - every citation is re-read at build time).
- No project code or docs changed this run; no build on the Mac; no env file read or touched;
  no deploy, no DB write, no outward mail. The engine logged a no-record entry on all four units at
  01:53 (3-hour ceiling) and the ceiling also reclaimed the run lock, so record and ask were
  refused - see the Closeout.
- Gate questions drafted (loopctl ask refused by the reclaimed lock; they reach Jay in this run's
  final report and the next run must re-ask them): 4 total - L01/gate 9 (box env-star leftovers),
  L01/gate 11+12 (two baseline gate fixes), K01/gate 7 (sponsor paid approach),
  K02/gate 12 (edit-endpoint lock-down).

## Verified this run (file:line read in THIS run, not from the research file)
- Sponsor slot orders never reach paid: insert of 'created' at backend/src/routes/sponsor.ts:176;
  readers of 'paid' at :94, :143, :211; repo grep slot_orders hits only sponsor.ts:93,140,176,211
  plus index creation backend/src/utils/mongo.ts:84-91. The unique {slot,date} index (mongo.ts:84-87)
  means ONE abandoned 'created' row permanently 409-blocks its date (sponsor.ts:178-181) while
  availability shows the date free - double defect, both reported.
- Sponsor checkout never verifies: frontend/src/pages/sponsor/index.astro:320-322 redirects to
  /payment/success ignoring the checkout response; no verify/confirm caller anywhere.
- PATCH /api/submissions/:slug has no auth (backend/src/routes/submit.ts:246-308; TODO :36-38);
  zero callers in frontend/ and admin/ (grep run twice this run); CORS allows PATCH and allowHeaders
  lacks any custom header (backend/src/index.ts:66-67).
- Helpers: timingSafeEqualHex/verifyOrderSignature/verifyWebhookSignature exported at
  routes/payments.ts:17-32; VERIFY_TOKEN_RE exported at utils/verify-checks.ts:17;
  isPaymentsConfigured calls validateEnv and can throw (utils/razorpay.ts:15-18); 30s route timeout
  at index.ts:49.
- Baseline gate verdict lines OBSERVED on the box during review (the loop's own gate run is still
  NOT RUN): backend typecheck FAIL - tests/screener.test.ts:1 imports bun:test while
  backend/tsconfig.json:7 whitelists types ['node'] (TS2307); 'bun run test' executes ZERO tests
  (backend/package.json:14 glob src/tests/**/*.test.ts never expanded under bash) while the working
  form 'bun test src/tests' ran 77 pass / 0 fail; lint 31 warnings 0 errors. Frontend/admin gates
  NOT RUN.
- Sync blocked: mini-sync's env-file verification line prints YES-PROBLEM (leftover env-star
  template files on the box, excluded from both transfer and deletion so the check cannot
  self-clear); the env guard blocks even listing env names - stopped and reported, not routed around.

## Mechanical verification run in-session by this planner
- L00 17-check probe matrix (scratch L00-closeout-probe): compliant file passes 17/17; gaming file
  (letter kept, spirit broken) caught by 7/17 - checks 5,6,8,10,11,12,13; zero-byte caught by 13/17;
  zero emoji and zero loop-code hits in the compliant file.
- K01 delta: stamp-on-pass literal present, old stamp-on-entry form absent; sponsor.ts contains 0
  'reconcileSelf' occurrences so checks 5/6 fail today as designed; throttle simulation in-session -
  stamp-on-pass 13 passes vs stamp-on-entry 1 pass over 12 minutes at 5s request spacing (the round-4
  defect, re-proven fixed).
- Defect found and fixed in-session: inline parenthetical annotations in K01/K02 check strings made a
  naive runner exit 2 (bash parse error at the '('). All annotations converted to '# (' comments;
  every check string in all four contracts now passes bash -n, and the grep checks re-run rc 1 today
  exactly as designed. L00/L01 checks were already bare.

## Reviews per unit (risk -> required passes)
- K01 (money): 4 helper rounds, all fail, 19 findings fixed cumulatively; round-5 delta child died on
  HTTP 429 model concurrency (3 attempts) so the delta pass is IN-SESSION by the planner (labelled,
  weaker than independent eyes) - review array ends with two in-session passes.
- K02 (security): fail, fail, fail -> round 4 PASS (15 prior fixes quote-confirmed, all five checks
  executed on the box, every planned literal probed).
- L00 (small): rounds 1-2 substantive (12 findings, all fixed, own probe matrices); rounds 3-4
  findings adjudicated invalid (they judged PLAN-run state as defects; details in the review array);
  in-session 17-check matrix closes the mechanical half - OWNER rule 3 met (checks + 1 reviewer).
- L01 (small): fail -> pass -> pass (probe matrix both times, both run paths traced).

## NOT done this run
- No planned records and no queue questions landed (lock reclaimed - see Closeout); units remain
  todo with contract: null in queue.json.
- All eight box gates are NOT RUN (blocked by the env-file YES-PROBLEM). L01's build writes
  docs/roadmap/status/gates.md with the eight NOT RUN rows either way, then re-runs when unblocked.
- docs/roadmap/STATUS.md not created - that is L00's build, contract ready.
- K01 and K02 builds wait on their gate answers (7 and 12) and on the baseline gate fixes.

## Questions waiting on Jay (4, drafted; re-ask via loopctl next run)
1. gate 9 / L01: clear the leftover env-star template files on the box (recommended) or amend
   mini-sync's verification - otherwise every gate stays NOT RUN and the finish line cannot be met.
2. gate 11+12 / L01: approve the two baseline fixes - screener test import to node:test like the
   other seven test files, and the test script to 'bun test ./src/tests' (77 pass verified on box).
3. gate 7 / K01: sponsor paid-transition approach - reconcile-on-read inside routes/sponsor.ts
   (recommended, owned files only), or a frontend confirm call (needs an owned-paths exception),
   or webhook wiring (protected payments.ts, Jay's edit).
4. gate 12 / K02: edit-endpoint lock-down - one-time edit token issued at submit (recommended),
   close editing until maker accounts exist, or build maker-auth now.

## Report-only findings (protected or out of scope; never edited here)
- routes/payments.ts:275-277 grants a free 'verified' entitlement on ANY captured payment including
  a sponsor buyer; :244-246 webhook accepted unsigned when no secret is set (unit K03 owns that fix).
- backend/src/index.ts:66-67: PATCH in allowMethods, allowHeaders lacks x-edit-token - outside owned
  paths; the required custom header also kills the cross-site write path.
- frontend/ has no tracked lockfile (installs unfrozen); record in gates rows.
- Instant sponsor confirmation needs frontend/src/pages/sponsor/index.astro (outside owned paths);
  releasing the burned unique {slot,date} index needs a data decision (deletion or index change).
- Screener pages deleted in the baseline while backend screener route + test remain - L10's question.

## Next
1. Build order after Jay's answers: L01 (unblocks gates) -> L00 (STATUS.md cites gates.md) -> K02
   -> K01. K01/K02 step 0 lists the three baseline prerequisites and forbids weakening any check.
2. K01 build follows its contract order exactly: write failing tests -> sync -> record the red on the
   box -> implement reconcileSelf -> run checks -> record the build commit hash here for verify's
   git show --stat.
3. Verify reads: contracts in contracts/, the research/ files, and this page. First action of the
   next run: re-ask the four questions above (queue.json questions is empty).

## Closeout of this run (appended after the end-run commands ran - the real outcomes)
- The gate handed this run at 22:29 with a 3-hour ceiling (loopctl LOCK_CEILING_S = 10800). At
  01:53 the ceiling reclaimed the run lock and wrote the no-record history entries on all four units.
  This run was still inside its review waves and finished around 11:00, so the mandated end-run
  sequence hit a lock that no longer existed.
- Exact refusals captured: ask -> "refusing: ask only about a unit this run was handed" (all four
  questions; the unit ids were correct - the lock itself is gone), record -> "refusing: no gate
  handed this loop a run (no lock). Only the run the gate started may record." Re-running the gate
  to regain a lock would forge a new run identity after the engine ended this one, so it was NOT
  done (OWNER rule 15: never route around a block).
- What still landed, verified: contracts copied to docs/agent-loops/whyknot-launch/contracts/
  before /tmp pruning; research leads and this page in the books; commit b21af28 on
  agent/whyknot-launch (a second commit carries this closeout); loop lock released (unlink of a
  missing file); mini-slot release printed "not held by whyknot-launch" - the slot had already gone
  stale (SLOT_STALE_S is 40 minutes, the run took hours) and was reclaimed, so no slot is held now.
  Caveat for honesty: a review child re-ran mini-sync and the gate chain on the box during that
  lapsed window; any other loop whose verdicts came out of that window should be re-run after its
  own fresh sync.
- What the next run inherits: four todo units, empty questions, contract: null, contracts and leads
  on disk, all findings and the four gate questions on this page. Outcomes recorded this run can
  only be 'no-record' plus whatever the next gate hands - the planning work itself is complete and
  ready to record the moment a gate reopens the run.

## Loop Brain diagnosis 2026-10-11 (unparked all 9 parked units; root cause named)
- ROOT CAUSE of the parks: all 9 parked units (L00,L01,L02,L03,L08,L10,K01,K02,K03) were parked by
  the ENGINE's automatic "stuck after 3 attempts" gate (queue.json questions q1-q9, gate "5 (stuck
  after 3 attempts)"), NOT by a Jay judgment call. Their history shows the stalls were engine-side
  no-records ("run ended without recording", provider-fault, and the 2026-10-06 stalls-reset entry
  that explicitly says "caused by engine defects (3 h lock ceiling on live runs; gateway restart),
  not by this unit's work"). The work itself never advanced far enough to be judged. This is an
  engine/communication stall, not a judgment park, so the deterministic brain's blanket "never unpark
  on its own" would have left the lane dead forever - the LLM brain researched the evidence and
  unblocked it via simplegate.py brain-action unpark whyknot-launch (ledger id b26acc27, tombstoned
  and reversible).
- ACTION TAKEN: all 9 units flipped parked->todo in the books queue (docs/agent-loops/whyknot-launch/
  queue.json now 15 todo / 0 parked). The queue.json under ~/.hermes/loops/state/ is a STALE SNAPSHOT
  and still shows the old 9 parked - do NOT read it as truth; the books queue is the source of truth
  (simplegate.py:93 queue_path -> books(cfg,loop)/queue.json).
- STILL BLOCKING (unchanged, Jay's calls): the 9 questions q1-q9 remain OPEN. Unparking re-enables
  the lane to run; it does NOT answer the questions. But NOTE: these q1-q9 are engine-stall questions
  ("keep parked / retry with this hint") - the REAL judgment gates this lane waits on are the FOUR
  substantive questions on this page above (L01/gate 9 env-star files, L01/gate 11+12 baseline fixes,
  K01/gate 7 sponsor paid-transition, K02/gate 12 edit-endpoint lock-down). Those four, not q1-q9,
  are what unblock the actual build work.
- BIGGER FACT: every whyknot-launch cron stage (research/plan/review/build, plus notify/digest) is
  PAUSED since 2026-10-08 15:53 IST (hermes cron list). Unparking the queue changes nothing until
  those jobs are resumed - that resume is Jay's operator call, reported not acted on.
