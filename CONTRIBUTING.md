# Contributing to WhyKnot.live

First off, thank you for considering contributing to WhyKnot! It's people like contributors that make WhyKnot such a great tool for discovering innovative websites.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
 - [Reporting Bugs](#reporting-bugs)
 - [Suggesting Enhancements](#suggesting-enhancements)
 - [Your First Code Contribution](#your-first-code-contribution)
 - [Pull Requests](#pull-requests)
- [Style Guides](#style-guides)
 - [Git Commit Messages](#git-commit-messages)
 - [TypeScript Style Guide](#typescript-style-guide)
 - [CSS Style Guide](#css-style-guide)
 - [Documentation Style Guide](#documentation-style-guide)
- [Development Process](#development-process)
- [Community](#community)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the [existing issues](https://github.com/jayptl-me/whyknot.live/issues) to avoid duplicates. When creating a bug report, include as many details as possible:

**Use our bug report template** which will guide through the process.

**Include:**
- A clear and descriptive title
- Exact steps to reproduce the problem
- Expected behavior vs. actual behavior
- Screenshots or GIFs if applicable
- Environment details (OS, browser, Node version)
- Any relevant error messages or logs

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

**Use our feature request template** which will guide through the process.

**Include:**
- A clear and descriptive title
- Detailed description of the proposed functionality
- Explain why this enhancement would be useful
- List any potential drawbacks or alternatives
- Mock-ups or examples if applicable

### Your First Code Contribution

Unsure where to begin? Look for issues labeled:

- `good first issue` - Simple issues perfect for newcomers
- `help wanted` - Issues where we need community help
- `documentation` - Documentation improvements

**Setting up the development environment:**

1. Fork the repository
2. Clone the fork: `git clone https://github.com/YOUR_USERNAME/whyknot.live.git`
3. Add upstream remote: `git remote add upstream https://github.com/jayptl-me/whyknot.live.git`
4. Create a branch from `develop`: `git checkout -b feature/your-feature-name develop`
5. Follow the setup instructions in [README.md](README.md)

### Pull Requests

**Before submitting a pull request:**

1. Ensure the branch is based on the correct branch (`develop` for features/fixes, `main` for hotfixes)
2. Follow the [style guides](#style-guides)
3. Run all linting and type checks locally
4. Add tests if applicable
5. Ensure all tests pass
6. Update documentation as needed
7. Update CHANGELOG.md with changes
8. Fill out the pull request template completely

**Pull Request Process:**

1. **Create your branch** from `develop` (see [Branching Strategy](#branching-strategy))
 ```bash
 git checkout develop
 git pull origin develop
 git checkout -b feature/amazing-feature
 ```

2. **Make your changes** following our style guides

3. **Commit your changes** with clear commit messages
 ```bash
 git commit -m "feat: add amazing feature"
 ```

4. **Push to your fork**
 ```bash
 git push origin feature/amazing-feature
 ```

5. **Open a Pull Request** to `develop` (not `main`!)
 - Use our PR template
 - Link related issues
 - Wait for CI checks to complete

6. **Address review comments** if any

7. **Wait for approval** from maintainers

**Pull Request Guidelines:**

- Keep pull requests focused on a single feature/fix
- Write clear, descriptive PR titles
- Include screenshots for UI changes
- Link related issues using keywords (fixes #123)
- Be responsive to feedback and questions
- Be patient - reviews may take time

## Style Guides

### Git Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

**Format:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that don't affect code meaning (formatting, etc.)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding or updating tests
- `chore`: Changes to build process or auxiliary tools
- `ci`: Changes to CI configuration files and scripts

**Examples:**
```bash
feat(waitlist): add email validation
fix(api): resolve rate limiting issue
docs(readme): update installation instructions
style(frontend): format CSS according to style guide
refactor(backend): simplify database connection logic
perf(api): optimize MongoDB queries
test(waitlist): add unit tests for email validation
chore(deps): update dependencies
```

**Rules:**
- Use present tense ("add feature" not "added feature")
- Use imperative mood ("move cursor to..." not "moves cursor to...")
- Keep the first line under 72 characters
- Reference issues and pull requests in the footer

### TypeScript Style Guide

**General Rules:**

```typescript
// DO: Use explicit types
function processEmail(email: string): Promise<boolean> {
 // implementation
}

// DON'T: Use implicit any
function processEmail(email) {
 // implementation
}

// DO: Use interfaces for object shapes
interface WaitlistEntry {
 email: string;
 createdAt: Date;
}

// DO: Use const for variables that don't change
const MAX_RETRIES = 3;

// DO: Use async/await over promises
async function fetchData() {
 const result = await api.get('/data');
 return result;
}

// DON'T: Use var
var x = 10;
```

**Naming Conventions:**
- `PascalCase` for classes, interfaces, types
- `camelCase` for variables, functions, methods
- `UPPER_SNAKE_CASE` for constants
- `kebab-case` for file names

**File Organization:**
```typescript
// 1. Imports (external first, then internal)
import { Hono } from 'hono';
import { z } from 'zod';

import { connectMongo } from '../utils/mongo';

// 2. Type definitions
interface Config {
 port: number;
}

// 3. Constants
const DEFAULT_PORT = 3001;

// 4. Main code
export const app = new Hono();
```

### CSS Style Guide

**We use a centralized CSS architecture:**

```css
/* DO: Use CSS custom properties (design tokens) */
.button {
 color: var(--color-primary);
 padding: var(--spacing-md);
 border-radius: var(--radius-sm);
}

/* DON'T: Use magic numbers */
.button {
 color: #3498db;
 padding: 16px;
 border-radius: 4px;
}

/* DO: Use semantic class names */
.nav-link--active {
 font-weight: 600;
}

/* DON'T: Use presentational class names */
.blue-text {
 color: blue;
}

/* DO: Use BEM-like naming for components */
.card {}
.card__header {}
.card__body {}
.card--featured {}
```

**Rules:**
- NO inline styles in HTML/Astro files
- NO `<style>` tags in `.astro` components
- All styles go in `src/styles/components/`
- Use design tokens from `tokens.css`
- Mobile-first responsive design
- Prefer CSS Grid and Flexbox over floats

### Documentation Style Guide

**Markdown Formatting:**

```markdown
# Main Heading (H1) - Only one per document

## Section Heading (H2)

### Subsection Heading (H3)

**Bold** for emphasis
*Italic* for terms
`code` for inline code
```

**Code Blocks:**
````markdown
```typescript
// Always specify language for syntax highlighting
const example = "code";
```
````

**Lists:**
```markdown
- Unordered lists use dashes
- Keep items parallel in structure
- End with periods if they're complete sentences

1. Ordered lists use numbers
2. They auto-increment
3. Use them for sequential steps
```

## Development Process

### Branching Strategy

We use a **production-grade branching model** for code quality and deployment safety:

**Branch Hierarchy:**
```
main (production)
 ↑
staging (pre-production)
 ↑
develop (integration)
 ↑
feature/*, fix/*, hotfix/* (working branches)
```

**Branch Purposes:**
- `main` - Production releases only. Protected with strict rules and manual approval required.
- `staging` - Pre-production testing environment. Deploy here before production.
- `develop` - Integration branch for ongoing development. All features merge here first.
- `feature/*` - New features (e.g., `feature/user-authentication`)
- `fix/*` - Bug fixes (e.g., `fix/api-timeout-error`)
- `hotfix/*` - Emergency production fixes (branch from `main`)

### Development Workflow

**For New Features:**

1. **Create your branch** from `develop`
 ```bash
 git checkout develop
 git pull origin develop
 git checkout -b feature/your-feature-name
 ```

2. **Make your changes** following our style guides

3. **Commit your changes** with conventional commits
 ```bash
 git add.
 git commit -m "feat(scope): add amazing feature"
 ```

4. **Push to your fork**
 ```bash
 git push origin feature/your-feature-name
 ```

5. **Open a Pull Request** to `develop` (not `main`!)
 - Use our PR template
 - All CI checks must pass:
 - ESLint (backend & frontend)
 - TypeScript type checking
 - Unit tests
 - Build verification
 - Request review from maintainers

6. **Address review comments** and push updates

7. **Merge to develop** after approval

**For Bug Fixes:**
- Same process as features, but use `fix/` prefix
- Example: `fix/email-validation-regex`

**For Hotfixes (Emergency Production Fixes):**
1. Branch from `main`: `git checkout -b hotfix/critical-security-fix main`
2. Make minimal fix
3. Open PR to `main` with detailed explanation
4. After merge to `main`, also merge to `staging` and `develop`

### Release Process

**Staging Deployment:**
```bash
# Merge develop to staging when ready for pre-production testing
git checkout staging
git merge develop
git push origin staging
```

**Production Deployment:**
```bash
# Merge staging to main for production release
# This requires manual approval from maintainers
git checkout main
git merge staging
git push origin main
```

**Creating a Release:**
```bash
# Tag releases on main branch
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

### Branch Naming Conventions

Follow these patterns:
- `feature/user-auth` - New feature
- `feature/waitlist-export` - New feature
- `fix/api-cors-issue` - Bug fix
- `fix/mobile-navigation` - Bug fix
- `hotfix/security-patch` - Emergency fix

**Rules:**
- Use lowercase
- Use hyphens, not underscores
- Be descriptive but concise
- Include issue number if applicable: `feature/123-user-auth`

 **Full Documentation:** See [BRANCHING_STRATEGY.md](./BRANCHING_STRATEGY.md) for complete details on GitHub rulesets, CI/CD workflows, and team collaboration.

### Branch Workflow

_(See detailed branching strategy above)_

### Testing

**Before submitting:**

```bash
# Run all checks locally before pushing
cd backend
npm run lint
npm run typecheck
npm test
npm run build

cd../frontend
npm run lint
npm run check
npm run build
```

**Write tests for:**
- New features
- Bug fixes
- Edge cases
- Critical paths

### Code Review

All submissions require review. We review for:

- **Functionality**: Does it work as intended?
- **Code quality**: Is it readable and maintainable?
- **Tests**: Are there adequate tests?
- **Documentation**: Is documentation updated?
- **Style**: Does it follow our style guides?

**As a reviewer:**
- Be respectful and constructive
- Explain reasoning
- Approve when satisfied
- Request changes if needed

**As an author:**
- Be receptive to feedback
- Ask questions if unclear
- Make requested changes
- Thank reviewers

## Community

### Getting Help

- [GitHub Discussions](https://github.com/jayptl-me/whyknot.live/discussions) - Ask questions and share ideas
- [GitHub Issues](https://github.com/jayptl-me/whyknot.live/issues) - Report bugs and request features
- [Contact Form](https://whyknot.live/contact) - Direct communication

### Recognition

Contributors are recognized in:
- README.md acknowledgments
- CHANGELOG.md for their contributions
- GitHub's contributor graph

### License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

## Questions?

Don't hesitate to ask! We're here to help:

- Open a [Discussion](https://github.com/jayptl-me/whyknot.live/discussions)
- Comment on an existing issue
- Reach out via our [contact form](https://whyknot.live/contact)

Thank you for contributing to WhyKnot! 

---

<div align="center">
 <p>Made with by the WhyKnot community</p>
</div>
