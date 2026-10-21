# Workflow

- For environment/system-level changes, diagnose first and state the root cause before mutating state; cleanup follows the explanation. Confidence: 0.7
- Investigate by reading the installed package's own code and state files (grep the bundled dist, read `~/.commandcode/*.json`, check PATH order, compare versions and timestamps) rather than relying on docs or assumptions. Confidence: 0.65
- Keep a single package manager authoritative: disable the mechanism that recreates duplicate installs (e.g. background auto-update) instead of only deleting the leftover files. Confidence: 0.7
- After changing anything, re-verify with the same commands used to diagnose (`which -a`, `--version`, package-manager global lists) and report the confirmed final state. Confidence: 0.7
- Maintain autonomy rules in `~/.agents/OWNER.md`; consult that file before taking system-level or destructive actions. Confidence: 0.65
