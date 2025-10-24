# CircleCI Configuration Guide

## Overview

This project uses CircleCI for continuous integration and deployment with a **production-grade branching strategy**. The configuration includes:

- **Automated Testing**: Runs linting, type checking, and unit tests on every push
- **Build Verification**: Ensures both backend and frontend build successfully
- **Multi-Branch Workflows**: Different CI/CD pipelines for `develop`, `staging`, and `main` branches
- **Security Scanning**: Automated security checks before production deployment
- **Manual Production Approval**: Requires manual approval before deploying to production

 **See also**: [BRANCHING_STRATEGY.md](../BRANCHING_STRATEGY.md) for complete branching model details.

## Workflows

### 1. Development Workflow (`development`)

Runs on **feature/fix branches** and **develop branch** for continuous integration.

**Triggered by**: `develop`, `feature/*`, `fix/*` branches

```
┌─────────────────────────────────────────────────────────┐
│ Install Phase │
│ backend-install (parallel) frontend-install │
└─────────────────┬───────────────────────┬───────────────┘
 │ │
┌─────────────────▼───────────────┐ ┌───▼────────────────┐
│ Backend Checks │ │ Frontend Checks │
│ • backend-lint │ │ • frontend-lint │
│ • backend-typecheck │ │ • frontend-check │
│ • backend-test │ │ │
└─────────────────┬───────────────┘ └───┬────────────────┘
 │ │
┌─────────────────▼───────────────┐ ┌───▼────────────────┐
│ backend-build │ │ frontend-build │
└─────────────────────────────────┘ └────────────────────┘
```

**Purpose**: Validate code quality and ensure builds succeed before merging to `develop`.

### 2. Staging Deployment Workflow (`staging-deployment`)

Runs on the **staging branch** for pre-production testing.

**Triggered by**: `staging` branch only

```
┌─────────────────────────────────────────────────────────┐
│ Install Phase │
│ backend-install (parallel) frontend-install │
└─────────────────┬───────────────────────┬───────────────┘
 │ │
┌─────────────────▼───────────────┐ ┌───▼────────────────┐
│ Backend Checks │ │ Frontend Checks │
│ • backend-lint │ │ • frontend-lint │
│ • backend-typecheck │ │ • frontend-check │
│ • backend-test │ │ │
└─────────────────┬───────────────┘ └───┬────────────────┘
 │ │
┌─────────────────▼───────────────┐ ┌───▼────────────────┐
│ backend-build │ │ frontend-build │
└─────────────────┬───────────────┘ └───┬────────────────┘
 │ │
 └──────────┬────────────┘
 │
 ┌──────────▼───────────┐
 │ deploy-staging │
 │ (Auto Deploy) │
 └──────────────────────┘
```

**Purpose**: Automatically deploy to staging environment for QA testing.

### 3. Production Deployment Workflow (`production-deployment`)

Runs on the **main branch** for production releases.

**Triggered by**: `main` branch only

```
┌─────────────────────────────────────────────────────────┐
│ Install Phase │
│ backend-install (parallel) frontend-install │
└─────────────────┬───────────────────────┬───────────────┘
 │ │
┌─────────────────▼───────────────┐ ┌───▼────────────────┐
│ Backend Checks │ │ Frontend Checks │
│ • backend-lint │ │ • frontend-lint │
│ • backend-typecheck │ │ • frontend-check │
│ • backend-test │ │ │
└─────────────────┬───────────────┘ └───┬────────────────┘
 │ │
┌─────────────────▼───────────────┐ ┌───▼────────────────┐
│ backend-build │ │ frontend-build │
└─────────────────┬───────────────┘ └───┬────────────────┘
 │ │
 └──────────┬────────────┘
 │
 ┌──────────▼───────────┐
 │ security-scan │
 │ (Audit deps) │
 └──────────┬───────────┘
 │
 ┌──────────▼───────────┐
 │ hold-production │
 │ (Manual Approval) │
 └──────────┬───────────┘
 │
 ┌──────────▼───────────┐
 │ deploy-production │
 └──────────┬───────────┘
 │
 ┌──────────▼───────────┐
 │ smoke-tests │
 │ (Post-deploy check) │
 └──────────────────────┘
```

**Purpose**: Secure, manual-gated production deployment with post-deployment verification.

### 4. Tagged Release Workflow (`tagged-release`)

Runs when you push a version tag (e.g., `v1.0.0`, `v2.1.3`).

**Triggered by**: Tags matching `v*` pattern

- Runs all checks and builds
- Automatically prepares release (no manual approval)
- Only triggers on tags matching `v*.*.*` pattern

**Example**:
```bash
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

## Jobs Breakdown

### Installation Jobs

#### `backend-install`
- Installs backend dependencies using `npm ci`
- Caches dependencies for faster subsequent runs
- Persists `node_modules` to workspace

#### `frontend-install`
- Installs frontend dependencies using `npm ci`
- Caches dependencies for faster subsequent runs
- Persists `node_modules` to workspace

### Backend Jobs

#### `backend-lint`
- Runs ESLint on backend TypeScript code
- Checks code style and quality
- Command: `npm run lint`

#### `backend-typecheck`
- Performs TypeScript type checking
- Ensures type safety without emitting files
- Command: `npm run typecheck`

#### `backend-test`
- Runs unit tests using Node.js test runner
- Validates business logic and utilities
- Command: `npm test`

#### `backend-build`
- Compiles TypeScript to JavaScript
- Outputs to `dist/` directory
- Persists build artifacts to workspace
- Command: `npm run build`

### Frontend Jobs

#### `frontend-lint`
- Runs ESLint on frontend code (.astro,.ts,.js files)
- Checks Astro component and TypeScript code quality
- Command: `npm run lint`

#### `frontend-typecheck`
- Runs Astro's type checking
- Validates Astro components and TypeScript
- Command: `npm run check`

#### `frontend-build`
- Builds production-ready static site
- Outputs to `dist/` directory
- Includes SSR capabilities with Node.js adapter
- Command: `npm run build`

### Release Jobs

#### `security-scan`
- **Runs on**: `staging` and `main` branches only
- Runs `npm audit` to check for security vulnerabilities
- Scans both backend and frontend dependencies
- Fails build if high-severity vulnerabilities found

#### `hold-production`
- **Type**: Manual Approval
- **Runs on**: `main` branch only
- **Purpose**: Final gate before production deployment
- **Action**: Review all checks, then click "Approve" in CircleCI UI

#### `deploy-staging`
- **Runs on**: `staging` branch only
- Automatically deploys to staging environment
- Uses GitHub Environment: `staging` (no approval required)
- Can be extended with actual deployment commands

#### `deploy-production`
- **Runs on**: `main` branch only (after manual approval)
- Deploys to production environment
- Requires `hold-production` approval first
- Uses GitHub Environment: `production` (with 15-minute wait timer + required reviewer)
- Can be extended with actual deployment commands

#### `smoke-tests`
- **Runs on**: `main` branch only (after production deployment)
- Runs basic health checks on production
- Verifies deployment was successful
- Can be extended with actual test commands

#### `prepare-release` (Tagged Releases)
- Verifies build artifacts exist
- Displays release information (branch, commit, build number)
- Prepares for deployment (can be extended with deploy steps)

## Setting Up CircleCI

### 1. Initial Setup

1. **Connect Repository to CircleCI**:
 - Go to [CircleCI](https://circleci.com/)
 - Sign in with GitHub
 - Click "Set Up Project"
 - Select `whyknot.live` repository
 - CircleCI will automatically detect the config file

2. **Configure GitHub Environments** (Recommended):
 
 GitHub Environments provide better security and control for deployments:
 
 **Create Production Environment**:
 ```
 GitHub: Settings > Environments > New environment
 
 Name: production
 
 Deployment protection rules:
 Required reviewers: @jayptl-me
 Wait timer: 15 minutes
 Allow administrators to bypass: UNCHECKED
 
 Deployment branches:
 • Branch pattern: main
 • Tag pattern: v*
 
 Add secrets:
 - PRODUCTION_API_KEY
 - PRODUCTION_DB_URI
 - PRODUCTION_DEPLOY_TOKEN
 
 Add variables:
 - NODE_ENV = production
 - API_BASE_URL = https://api.whyknot.live
 ```
 
 **Create Staging Environment**:
 ```
 Name: staging
 
 Deployment branches:
 • Branch pattern: staging
 
 Add staging-specific secrets and variables
 ```

3. **Environment Variables** (CircleCI - for CI checks only):
 ```
 Settings > Project Settings > Environment Variables
 ```
 
 Add variables for CI/CD pipeline:
 - `MONGODB_URI` (for integration tests)
 - `SMTP_HOST`, `SMTP_USER`, etc. (for email testing)
 
 **Note**: Deployment secrets should be in GitHub Environments, not CircleCI.

### 2. Branch Protection Rules (Recommended)

On GitHub, set up branch protection following our branching strategy:

**For `main` branch** (production):
```
Settings > Branches > Add rule

Branch name pattern: main

 Require status checks to pass before merging
 backend-lint
 backend-typecheck
 backend-test
 backend-build
 frontend-lint
 frontend-typecheck
 frontend-build
 security-scan

 Require branches to be up to date before merging
 Require pull request reviews before merging
 Require 1 approval
 Dismiss stale pull request approvals when new commits are pushed
 Require review from Code Owners
 Do not allow bypassing the above settings
```

**For `staging` branch** (pre-production):
```
Branch name pattern: staging

 Require status checks to pass before merging
 (same 7 checks as main)
 Require branches to be up to date before merging
 Require pull request reviews before merging
 Require 1 approval
```

**For `develop` branch** (integration):
```
Branch name pattern: develop

 Require status checks to pass before merging
 backend-lint
 backend-typecheck
 backend-test
 backend-build
 frontend-lint
 frontend-typecheck
 frontend-build

 Require branches to be up to date before merging
```

 **Full ruleset configurations**: See [BRANCHING_STRATEGY.md](../BRANCHING_STRATEGY.md#github-branch-protection-rulesets)

### 3. Installing Dependencies Locally

Before pushing, install the new ESLint dependencies:

**Backend**:
```bash
cd backend
npm install
```

**Frontend**:
```bash
cd frontend
npm install
```

## Local Development Commands

### Backend

```bash
cd backend

# Install dependencies
npm install

# Run linting
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Type check
npm run typecheck

# Run tests
npm test

# Build
npm run build

# Development server
npm run dev
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Run linting
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Astro type check
npm run check

# Build
npm run build

# Development server
npm run dev
```

## Development Workflow with CircleCI

### Feature Development

1. **Create feature branch** from `develop`:
 ```bash
 git checkout develop
 git pull origin develop
 git checkout -b feature/new-feature
 ```

2. **Make changes and test locally**:
 ```bash
 # Backend
 cd backend
 npm run lint
 npm run typecheck
 npm test
 npm run build

 # Frontend
 cd frontend
 npm run lint
 npm run check
 npm run build
 ```

3. **Push and open PR** to `develop`:
 ```bash
 git add.
 git commit -m "feat: add new feature"
 git push origin feature/new-feature
 ```

4. **Monitor CircleCI**:
 - `development` workflow will run automatically
 - All 7 status checks must pass
 - Address any failures

5. **Merge to develop** after approval

### Staging Deployment

1. **Merge develop to staging**:
 ```bash
 git checkout staging
 git pull origin staging
 git merge develop
 git push origin staging
 ```

2. **Monitor CircleCI**:
 - `staging-deployment` workflow runs automatically
 - Includes security scan
 - Auto-deploys to staging environment

3. **Test in staging environment**

### Production Deployment

1. **Merge staging to main**:
 ```bash
 git checkout main
 git pull origin main
 git merge staging
 git push origin main
 ```

2. **Monitor CircleCI**:
 - `production-deployment` workflow runs
 - All checks + security scan must pass
 - Workflow pauses at `hold-production`

3. **Manual approval**:
 - Go to [CircleCI Dashboard](https://app.circleci.com/)
 - Review all checks (ensure all green)
 - Click **"Approve"** on `hold-production` job

4. **Production deployment**:
 - `deploy-production` runs after approval
 - `smoke-tests` verify deployment

### Tagged Releases

For version releases:

```bash
# Ensure main is up to date
git checkout main
git pull origin main

# Create and push tag
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

CircleCI `tagged-release` workflow runs automatically (no approval needed).

## Manual Release Process

### For Regular Releases (main/develop branches)

1. **Push your changes**:
 ```bash
 git add.
 git commit -m "feat: add new feature"
 git push origin main
 ```

2. **Monitor CircleCI**:
 - Go to [CircleCI Dashboard](https://app.circleci.com/)
 - Watch the workflow progress
 - All checks will run automatically

3. **Approve Release** (when builds are green):
 - Navigate to the workflow
 - Find the `hold-for-release` job
 - Click **"Approve"**
 - The `prepare-release` job will run

4. **Deploy** (manual for now):
 - After approval, deploy manually using your deployment scripts
 - Future: This can be automated in the `prepare-release` job

### For Tagged Releases

1. **Create and push a version tag**:
 ```bash
 # Ensure main is up to date
 git checkout main
 git pull origin main

 # Create tag
 git tag -a v1.0.0 -m "Release version 1.0.0"

 # Push tag
 git push origin v1.0.0
 ```

2. **Automatic Build**:
 - CircleCI will automatically trigger the `tagged-release` workflow
 - No manual approval required for tagged releases
 - All checks and builds run automatically

## Caching Strategy

CircleCI caches dependencies to speed up builds:

### Backend Cache
- **Key**: `backend-deps-v1-{{ checksum "backend/package-lock.json" }}`
- **Paths**: `backend/node_modules`
- **Invalidation**: Automatically when `package-lock.json` changes

### Frontend Cache
- **Key**: `frontend-deps-v1-{{ checksum "frontend/package-lock.json" }}`
- **Paths**: `frontend/node_modules`
- **Invalidation**: Automatically when `package-lock.json` changes

To clear cache manually:
1. Go to Project Settings in CircleCI
2. Click "Clear Cache"
3. Re-run the workflow

## Workspace Persistence

Build artifacts are persisted between jobs using CircleCI workspaces:

- `backend/node_modules` → Used by all backend jobs
- `backend/dist` → Build output for deployment
- `frontend/node_modules` → Used by all frontend jobs
- `frontend/dist` → Build output for deployment

## Troubleshooting

### Build Fails on Linting

```bash
# Run locally to see errors
npm run lint

# Auto-fix issues
npm run lint:fix

# If auto-fix doesn't work, manually fix reported issues
```

### Build Fails on Type Checking

```bash
# Backend
cd backend
npm run typecheck

# Frontend
cd frontend
npm run check

# Fix TypeScript errors shown in output
```

### Build Fails on Tests

```bash
cd backend
npm test

# Debug specific test
node --import tsx --test src/tests/schema.test.ts
```

### Cache Issues

If you suspect cache problems:

1. Update cache version in `.circleci/config.yml`:
 ```yaml
 # Change v1 to v2
 - backend-deps-v2-{{ checksum "backend/package-lock.json" }}
 ```

2. Or clear cache through CircleCI UI

### "No Linter Configured" Error

If you see this error, ensure:
1. ESLint dependencies are installed
2. `.eslintrc.cjs` files exist in both `backend/` and `frontend/`
3. Run `npm install` in both directories

## Extending the Configuration

### Adding Deployment Steps

Edit `.circleci/config.yml` to add deployment after `prepare-release`:

```yaml
jobs:
 deploy-backend:
 executor: node-executor
 steps:
 - checkout
 - attach_workspace:
 at:.
 - run:
 name: Deploy backend to Railway
 command: 
 # Add deployment commands
 railway up

 deploy-frontend:
 executor: node-executor
 steps:
 - checkout
 - attach_workspace:
 at:.
 - run:
 name: Deploy frontend to Vercel
 command: 
 # Add deployment commands
 vercel --prod

workflows:
 build-test-deploy:
 jobs:
 #... existing jobs...
 - deploy-backend:
 requires:
 - prepare-release
 - deploy-frontend:
 requires:
 - prepare-release
```

### Adding Slack Notifications

1. Install the Slack orb:
 ```yaml
 orbs:
 slack: circleci/slack@4.10.1
 ```

2. Add notification to workflow:
 ```yaml
 - slack/notify:
 event: fail
 template: basic_fail_1
 requires:
 - backend-build
 - frontend-build
 ```

### Adding Docker Builds

```yaml
jobs:
 docker-build:
 docker:
 - image: cimg/base:stable
 steps:
 - checkout
 - setup_remote_docker
 - run:
 name: Build Docker image
 command: 
 docker build -t whyknot/backend:$CIRCLE_SHA1./backend
 docker build -t whyknot/frontend:$CIRCLE_SHA1./frontend
```

## Performance Tips

1. **Use Workspaces**: Already implemented - shares `node_modules` between jobs
2. **Cache Dependencies**: Already implemented - caches based on lock files
3. **Parallel Jobs**: Install and check jobs run in parallel
4. **Resource Classes**: Can upgrade for faster builds:
 ```yaml
 executor:
 node-executor:
 docker:
 - image: cimg/node:20.18.1
 resource_class: medium+ # or large, xlarge
 ```

## CI/CD Best Practices

1. **Run locally first**: Always test `npm run lint`, `typecheck`, `test`, and `build` locally
2. **Small commits**: Easier to identify what broke CI
3. **Keep workflows fast**: Currently ~5-10 minutes total
4. **Use branch protection**: Prevent merging broken code
5. **Review before approval**: Check all builds are green before approving release
6. **Tag releases**: Use semantic versioning (v1.0.0, v1.1.0, etc.)

## Resources

- [CircleCI Documentation](https://circleci.com/docs/)
- [CircleCI Workflows](https://circleci.com/docs/workflows/)
- [CircleCI Configuration Reference](https://circleci.com/docs/configuration-reference/)
- [CircleCI Orbs](https://circleci.com/developer/orbs)

## Support

If you encounter issues with CircleCI:

1. Check the [CircleCI Documentation](https://circleci.com/docs/)
2. Review job logs in the CircleCI UI
3. Test commands locally first
4. Check [CircleCI Status](https://status.circleci.com/) for outages
5. Open an issue in the repository with the job log

---

**Last Updated**: October 23, 2025 
**CircleCI Config Version**: 2.1 
**Node Version**: 20.18.1
