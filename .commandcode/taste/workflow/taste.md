# Workflow

- For environment/system-level changes, diagnose first and state the root cause before mutating state; cleanup follows the explanation. Confidence: 0.7
- Investigate by reading the installed package's own code and state files (grep the bundled dist, read `~/.commandcode/*.json`, check PATH order, compare versions and timestamps) rather than relying on docs or assumptions. Confidence: 0.65
- Keep a single package manager authoritative: disable the mechanism that recreates duplicate installs (e.g. background auto-update) instead of only deleting the leftover files. Confidence: 0.7
- After changing anything, re-verify with the same commands used to diagnose (`which -a`, `--version`, package-manager global lists) and report the confirmed final state. Confidence: 0.7
- Maintain autonomy rules in `~/.agents/OWNER.md`; consult that file before taking system-level or destructive actions. Confidence: 0.65
- Re-read `~/.agents/OWNER.md` at the start of every session — the rules change mid-project (a new rule landed the same day this session began, and it invalidated the local build plan). Confidence: 0.8
- Prove a fix by showing its negative control: write the failing test first, then remove the guard and confirm the test actually fails, in the same turn. Judge every gate by its real exit line, not by the shape of the output. Confidence: 0.85
- Verify live state by probing it (curl the deployed site/API, check git, read the code) instead of trusting docs or status files; treat code and the running service as the truth. Confidence: 0.8
- Land a long-dirty tree as ONE commit with explicit paths rather than logical slices, after the gates pass — the untracked files are load-bearing, so a partial commit breaks the build. Confidence: 0.75
- Keep the project books current every session: prepend a dated "Resume here" block to STATUS.md and append dated, owner-attributed entries to DECISIONS.md (never rewrite them). Confidence: 0.85
- Do not disturb boxes belonging to other projects (a second box was another project's live CI); use your own machines or wait. Confidence: 0.75
- Money and refunds are the owner's line: never auto-refund or auto-resolve a paid order; mark it as a conflict, surface it in metrics, and let a human decide. Confidence: 0.8
- When a stranded branch holds good content but its code side is a stale baseline that would delete newer work, recover only the good parts (docs) and never merge it whole. Confidence: 0.8
