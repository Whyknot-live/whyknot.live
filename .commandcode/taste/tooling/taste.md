# Tooling

- Prefers Bun over npm for installing and running tooling; global installs/updates go through `bun add -g <pkg>@latest`. Confidence: 0.85
- Wants exactly one copy of a CLI installed — a stray duplicate (e.g. an npm copy sitting next to the bun copy) is treated as something to remove, not tolerate. Confidence: 0.8
- Avoids built-in self-updaters that assume a different package manager (e.g. `cmd update` hardcodes `npm i -g`); prefer package-manager-native update commands. Confidence: 0.75
- Environment: macOS, zsh, homebrew-era paths, npm global prefix is `~/.local` while bun globals live under `~/.bun/install/global`. Confidence: 0.6
- Never computes on the Mac: builds and test gates run on remote boxes (compute-mini, mini-arm) reached over ssh, with the working tree synced there by a script (mini-sync.sh --apply) first. Confidence: 0.85
- Hosting is Render (static sites + API web service); the installed Render CLI needs interactive login, so drive the REST API with a key read from the gitignored env instead. Confidence: 0.7
- Secrets live in gitignored env files (backend/.env, .env.render) and are never committed or pasted into chat. Confidence: 0.7
