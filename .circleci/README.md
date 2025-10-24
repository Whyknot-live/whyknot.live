# CircleCI Quick Reference

This project uses CircleCI for continuous integration and deployment.

## Quick Commands

### Run Checks Locally (Before Pushing)

**Backend**:
```bash
cd backend
npm run lint        # Check code style
npm run lint:fix    # Auto-fix issues
npm run typecheck   # Type checking
npm test            # Run tests
npm run build       # Build project
```

**Frontend**:
```bash
cd frontend
npm run lint        # Check code style
npm run lint:fix    # Auto-fix issues
npm run check       # Astro type check
npm run build       # Build project
```

## Workflows

### 1. Regular Development (Feature Branches)
- Push code → All checks run automatically
- Fix any failures before merging

### 2. Release to Main/Develop
- Push to `main` or `develop`
- All checks run automatically
- **Manual approval required** (click "Approve" in CircleCI UI)
- `prepare-release` job runs after approval

### 3. Tagged Release
- Create tag: `git tag v1.0.0`
- Push tag: `git push origin v1.0.0`
- Automatic build (no approval needed)

## Jobs Overview

 Job  Purpose  Command 
-----------------------
 `backend-lint`  Code style check  `npm run lint` 
 `backend-typecheck`  TypeScript validation  `npm run typecheck` 
 `backend-test`  Unit tests  `npm test` 
 `backend-build`  Compile TypeScript  `npm run build` 
 `frontend-lint`  Code style check  `npm run lint` 
 `frontend-typecheck`  Astro validation  `npm run check` 
 `frontend-build`  Build static site  `npm run build` 
 `hold-for-release`  Manual approval gate  _(UI action)_ 
 `prepare-release`  Release preparation  _(automated)_ 

## First Time Setup

1. **Install dependencies**:
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. **Connect to CircleCI**:
   - Go to [circleci.com](https://circleci.com)
   - Login with GitHub
   - Add the `whyknot.live` project

3. **Done!** CircleCI will automatically detect `.circleci/config.yml`

## Common Issues

### "No linter configured"
→ Run `npm install` in both `backend/` and `frontend/`

### Build fails on lint
→ Run `npm run lint:fix` to auto-fix issues

### Build fails on typecheck
→ Fix TypeScript errors shown in output

### Cache issues
→ Clear cache in CircleCI Project Settings

## Full Documentation

See [docs/CIRCLECI.md](./CIRCLECI.md) for comprehensive guide including:
- Detailed workflow diagrams
- Environment variable setup
- Deployment configuration
- Troubleshooting guide
- Performance optimization
- Extending the configuration

---

**Need Help?** Check the [full CircleCI documentation](./CIRCLECI.md) or CircleCI job logs.
