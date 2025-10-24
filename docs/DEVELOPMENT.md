# Development Guide

Welcome to the WhyKnot.live development guide! This document will help developers get started with local development, understand the development workflow, and follow best practices.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Environment](#development-environment)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Debugging](#debugging)
- [Performance](#performance)
- [Common Tasks](#common-tasks)
- [Troubleshooting](#troubleshooting)

---

## Getting Started

### Quick Start

```bash
# Clone the repository
git clone https://github.com/jayptl-me/whyknot.live.git
cd whyknot.live

# Setup backend
```bash
cd backend
npm install
cp.env.example.env
# Edit.env with the appropriate configuration
npm run dev
```

# In a new terminal, setup frontend
```bash
cd frontend
npm install
cp.env.example.env
# Edit.env with the appropriate configuration
npm run dev
```
```

Now visit:
- Frontend: http://localhost:4321
- Backend: http://localhost:3001

### Prerequisites

Ensure these are installed:

```bash
# Check Node.js version (18+ required)
node --version

# Check npm version
npm --version

# Check MongoDB (if running locally)
mongod --version
```

---

## Development Environment

### Recommended Tools

**Code Editor:**
- [VS Code](https://code.visualstudio.com/) with extensions:
 - ESLint
 - Prettier
 - Astro
 - TypeScript
 - MongoDB for VS Code
 - GitLens

**API Testing:**
- [Postman](https://www.postman.com/)
- [Insomnia](https://insomnia.rest/)
- [HTTPie](https://httpie.io/)

**Database GUI:**
- [MongoDB Compass](https://www.mongodb.com/products/compass)
- [Studio 3T](https://studio3t.com/)

**Terminal:**
- [iTerm2](https://iterm2.com/) (macOS)
- [Windows Terminal](https://aka.ms/terminal) (Windows)
- [Hyper](https://hyper.is/) (Cross-platform)

### VS Code Configuration

`.vscode/settings.json`:
```json
{
 "editor.formatOnSave": true,
 "editor.defaultFormatter": "esbenp.prettier-vscode",
 "editor.codeActionsOnSave": {
 "source.fixAll.eslint": true
 },
 "typescript.tsdk": "node_modules/typescript/lib",
 "files.associations": {
 "*.css": "css"
 },
 "[astro]": {
 "editor.defaultFormatter": "astro-build.astro-vscode"
 }
}
```

`.vscode/extensions.json`:
```json
{
 "recommendations": [
 "astro-build.astro-vscode",
 "dbaeumer.vscode-eslint",
 "esbenp.prettier-vscode",
 "mongodb.mongodb-vscode",
 "eamodio.gitlens"
 ]
}
```

---

## Project Structure

### Backend Structure

```
backend/
├── src/
│ ├── index.ts # Entry point
│ ├── middleware/
│ │ └── security.ts # Security middleware
│ ├── routes/
│ │ └── waitlist.ts # Waitlist routes
│ ├── tests/
│ │ └── schema.test.ts # Tests
│ └── utils/
│ ├── email.ts # Email utilities
│ ├── env.ts # Environment validation
│ └── mongo.ts # Database connection
├── package.json
├── tsconfig.json
└──.env.example
```

### Frontend Structure

```
frontend/
├── public/ # Static files
├── src/
│ ├── components/ # Reusable components
│ ├── layouts/ # Page layouts
│ ├── pages/ # Route pages
│ ├── styles/ # Centralized CSS
│ │ ├── global.css
│ │ ├── tokens.css
│ │ └── components/
│ └── utils/ # Helper functions
├── astro.config.mjs
├── package.json
└── tsconfig.json
```

---

## Development Workflow

### 1. Create a New Feature

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes
#...

# Run tests
npm test

# Type check
npm run typecheck

# Commit changes
git add.
git commit -m "feat: add my feature"

# Push to remote
git push origin feature/my-feature

# Create pull request on GitHub
```

### 2. Working with Multiple Services

Use terminal multiplexer or separate terminals:

**Option A: tmux**
```bash
# Start tmux session
tmux new -s whyknot

# Split panes
Ctrl+b % # Split vertically
Ctrl+b " # Split horizontally

# Run services in each pane
cd backend && npm run dev
cd frontend && npm run dev
```

**Option B: VS Code Tasks**

`.vscode/tasks.json`:
```json
{
 "version": "2.0.0",
 "tasks": [
 {
 "label": "Start Backend",
 "type": "shell",
 "command": "cd backend && npm run dev",
 "isBackground": true
 },
 {
 "label": "Start Frontend",
 "type": "shell",
 "command": "cd frontend && npm run dev",
 "isBackground": true
 },
 {
 "label": "Start All",
 "dependsOn": ["Start Backend", "Start Frontend"],
 "problemMatcher": []
 }
 ]
}
```

### 3. Making API Changes

When modifying the API:

1. Update route handler in `backend/src/routes/`
2. Update validation schema if needed
3. Add/update tests
4. Update API documentation in `docs/API.md`
5. Test manually with Postman/curl
6. Update frontend integration if needed

### 4. Making UI Changes

When modifying the frontend:

1. Edit component in `frontend/src/components/`
2. Update styles in `frontend/src/styles/components/`
3. Test on multiple screen sizes
4. Check accessibility
5. Test with different browsers

---

## Coding Standards

### TypeScript Style

```typescript
// DO: Use explicit types
function calculateTotal(items: Item[]): number {
 return items.reduce((sum, item) => sum + item.price, 0);
}

// DO: Use interfaces for object shapes
interface User {
 id: string;
 email: string;
 createdAt: Date;
}

// DO: Use const for immutable values
const MAX_RETRIES = 3;

// DON'T: Use any
function process(data: any) { }

// DO: Use unknown and type guard
function process(data: unknown) {
 if (typeof data === 'string') {
 // Type narrowed to string
 }
}
```

### Async/Await

```typescript
// DO: Use async/await
async function fetchUser(id: string): Promise<User> {
 const response = await fetch(`/api/users/${id}`);
 return response.json();
}

// DON'T: Chain promises unnecessarily
function fetchUser(id: string): Promise<User> {
 return fetch(`/api/users/${id}`)
.then(response => response.json());
}
```

### Error Handling

```typescript
// DO: Handle errors appropriately
try {
 const result = await riskyOperation();
 return result;
} catch (error) {
 console.error('Operation failed:', error);
 return { error: 'server_error' };
}

// DO: Use custom error types
class ValidationError extends Error {
 constructor(public field: string, message: string) {
 super(message);
 this.name = 'ValidationError';
 }
}

throw new ValidationError('email', 'Invalid email format');
```

### CSS Style

```css
/* DO: Use design tokens */
.button {
 color: var(--color-primary);
 padding: var(--spacing-md);
 border-radius: var(--radius-sm);
}

/* DO: Use BEM-like naming */
.card {}
.card__header {}
.card__body {}
.card--featured {}

/* DO: Mobile-first responsive */
.container {
 width: 100%;
}

@media (min-width: 768px) {
.container {
 max-width: 720px;
 }
}

/* DON'T: Use magic numbers */
.element {
 margin: 16px;
 padding: 24px;
}
```

---

## Testing

### Running Tests

```bash
# Backend tests
cd backend
npm test

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage

# Type checking
npm run typecheck
```

### Writing Tests

```typescript
import { describe, it, assert } from 'node:test';
import { z } from 'zod';

describe('Email Validation', () => {
 const schema = z.string().email();

 it('should accept valid email', () => {
 const result = schema.safeParse('test@example.com');
 assert.strictEqual(result.success, true);
 });

 it('should reject invalid email', () => {
 const result = schema.safeParse('invalid');
 assert.strictEqual(result.success, false);
 });
});
```

### Manual Testing

**Test Waitlist Endpoint:**

```bash
# Valid email
curl -X POST http://localhost:3001/api/waitlist \
 -H "Content-Type: application/json" \
 -d '{"email":"test@example.com"}'

# Invalid email
curl -X POST http://localhost:3001/api/waitlist \
 -H "Content-Type: application/json" \
 -d '{"email":"invalid"}'

# Duplicate email
curl -X POST http://localhost:3001/api/waitlist \
 -H "Content-Type: application/json" \
 -d '{"email":"test@example.com"}'
```

---

## Debugging

### Backend Debugging

**Console Logging:**
```typescript
console.log('Debug:', { email, timestamp: new Date() });
```

**VS Code Debugger:**

`.vscode/launch.json`:
```json
{
 "version": "0.2.0",
 "configurations": [
 {
 "type": "node",
 "request": "launch",
 "name": "Debug Backend",
 "runtimeArgs": ["-r", "ts-node/register"],
 "args": ["${workspaceFolder}/backend/src/index.ts"],
 "cwd": "${workspaceFolder}/backend",
 "env": {
 "NODE_ENV": "development"
 }
 }
 ]
}
```

**Node Inspector:**
```bash
node --inspect-brk dist/index.js
# Then open chrome://inspect in Chrome
```

### Frontend Debugging

**Browser DevTools:**
- Press F12 to open
- Use Console for logs
- Use Network tab for API calls
- Use Elements tab for CSS debugging

**Astro Dev Overlay:**
- Available at bottom-right in dev mode
- Shows component tree
- Shows routing info
- Shows performance metrics

---

## Performance

### Backend Performance

**Database Queries:**
```typescript
// DO: Use indexes
db.collection('waitlist').createIndex({ email: 1 }, { unique: true });

// DO: Project only needed fields
db.collection('waitlist').find({}, { projection: { email: 1 } });

// DO: Use connection pooling
const client = new MongoClient(uri, {
 maxPoolSize: 10,
 minPoolSize: 5
});
```

**Response Time:**
```typescript
// Add timing middleware
app.use('*', async (c, next) => {
 const start = Date.now();
 await next();
 const ms = Date.now() - start;
 console.log(`${c.req.method} ${c.req.url} - ${ms}ms`);
});
```

### Frontend Performance

**Optimize Images:**
```bash
# Use optimized formats
# AVIF > WebP > JPEG/PNG
```

**Lazy Loading:**
```astro
<img src="image.jpg" loading="lazy" alt="Description" />
```

**Minimize JavaScript:**
- Use Astro's default behavior (no JS by default)
- Only add interactive islands when needed
- Code split large dependencies

---

## Common Tasks

### Add a New API Endpoint

1. Create route file:
```typescript
// backend/src/routes/myroute.ts
import { Hono } from 'hono';

const router = new Hono();

router.get('/my-endpoint', async (c) => {
 return c.json({ message: 'Hello!' });
});

export default router;
```

2. Register route:
```typescript
// backend/src/index.ts
import myRoute from './routes/myroute';
app.route('/api', myRoute);
```

3. Test it:
```bash
curl http://localhost:3001/api/my-endpoint
```

### Add a New Page

1. Create page file:
```astro
---
// frontend/src/pages/mypage.astro
import Layout from '../layouts/Layout.astro';
---

<Layout title="My Page">
 <h1>My Page</h1>
</Layout>
```

2. Visit: http://localhost:4321/mypage

### Add a New Component

1. Create component:
```astro
---
// frontend/src/components/MyComponent.astro
interface Props {
 title: string;
}

const { title } = Astro.props;
---

<div class="my-component">
 <h2>{title}</h2>
</div>
```

2. Use it:
```astro
---
import MyComponent from '../components/MyComponent.astro';
---

<MyComponent title="Hello" />
```

### Update Database Schema

1. Add migration logic:
```typescript
// backend/src/utils/migrations.ts
export async function migrateWaitlist() {
 const db = getDb();
 // Add new field with default value
 await db.collection('waitlist').updateMany(
 { newField: { $exists: false } },
 { $set: { newField: 'default' } }
 );
}
```

2. Run migration:
```bash
npm run migrate
```

---

## Troubleshooting

### Port Already in Use

```bash
# Find process using port
lsof -i :3001
lsof -i :4321

# Kill process
kill -9 <PID>
```

### MongoDB Connection Issues

```bash
# Check if MongoDB is running
brew services list # macOS
sudo systemctl status mongod # Linux

# Start MongoDB
brew services start mongodb-community # macOS
sudo systemctl start mongod # Linux
```

### TypeScript Errors

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

### Hot Reload Not Working

```bash
# Restart dev server
# Kill process (Ctrl+C) and restart
npm run dev
```

---

## Resources

- [Astro Documentation](https://docs.astro.build/)
- [Hono Documentation](https://hono.dev/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Zod Documentation](https://zod.dev/)

---

## Getting Help

- [GitHub Discussions](https://github.com/jayptl-me/whyknot.live/discussions)
- [Report Issues](https://github.com/jayptl-me/whyknot.live/issues)
- [Read the Docs](https://github.com/jayptl-me/whyknot.live/tree/main/docs)

---

Happy coding! 

---

Last Updated: October 23, 2025
