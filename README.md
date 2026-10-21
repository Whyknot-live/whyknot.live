<div align="center">
 <h1> WhyKnot.live</h1>
 <p><strong>Discover the web's most innovative websites and tools</strong></p>
 
 <p>
 <a href="https://whyknot.live"><img src="https://img.shields.io/badge/Website-whyknot.live-blue?style=for-the-badge" alt="Website"></a>
 <a href="#license"><img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License"></a>
 <a href="https://github.com/jayptl-me/whyknot.live/stargazers"><img src="https://img.shields.io/github/stars/jayptl-me/whyknot.live?style=for-the-badge" alt="Stars"></a>
 </p>

 <p>
 <strong> Alpha Launch:</strong> September 19, 2026 <strong> Full Launch:</strong> live since October 21, 2026
 </p>
</div>

---

## Table of Contents

- [About](#about)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
 - [Prerequisites](#prerequisites)
 - [Installation](#installation)
 - [Environment Variables](#environment-variables)
 - [Running Locally](#running-locally)
- [Project Structure](#project-structure)
- [Development](#development)
 - [Backend Development](#backend-development)
 - [Frontend Development](#frontend-development)
 - [Branching Strategy](#branching-strategy)
- [Deployment](#deployment)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)
- [Security](#security)
- [Roadmap](#roadmap)
- [License](#license)
- [Contact](#contact)
- [Acknowledgments](#acknowledgments)

---

## About

**WhyKnot** is a curated platform for discovering innovative websites, creative tools, and inspiring web experiences. Whether you're a designer seeking inspiration, a developer looking for new tools, or just someone who loves exploring the internet's hidden gems, WhyKnot is your gateway to the best the web has to offer.

### Why WhyKnot?

- ** Curated Discovery**: Hand-picked selection of the web's most innovative sites
- ** Design-First**: Beautiful, intuitive interface with smooth scroll experiences
- ** Performance**: Built with modern tech for lightning-fast load times
- ** Responsive**: Perfect experience across all devices
- ** Community-Driven**: Join our alpha community and help shape the platform

---

## Features

### Current Features
- **Coming Soon Landing Page**: Engaging scroll-based experience
- **Waitlist System**: Join the alpha community
- **🔐 Admin Dashboard**: Secure panel to manage waitlist users (NEW)
- **Email Notifications**: Get notified when we launch
- **Responsive Design**: Mobile-first approach
- **SEO Optimized**: Built-in schema.org markup
- **Security Hardened**: Rate limiting, CORS, security headers, JWT authentication

### Planned Features (Roadmap)
- **Website Directory**: Browse curated collections
- **User Submissions**: Suggest your favorite sites
- **Categories & Tags**: Filter by design, development, tools, etc.
- **User Accounts**: Save favorites and create collections
- **API Access**: Programmatic access to the directory
- **Chrome Extension**: Quick access to discoveries

---

## Tech Stack

### Frontend
![Astro](https://img.shields.io/badge/Astro-BC52EE?style=for-the-badge&logo=astro&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)

- **[Astro](https://astro.build/)** - Modern static site generator with SSR support
- **TypeScript** - Type-safe JavaScript
- **Custom CSS** - Centralized design system with tokens
- **Node.js Adapter** - Server-side rendering capabilities

### Backend
![Hono](https://img.shields.io/badge/Hono-E36002?style=for-the-badge&logo=hono&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)

- **[Hono](https://hono.dev/)** - Ultra-fast web framework
- **Node.js** - Runtime environment
- **MongoDB** - NoSQL database
- **[Zod](https://zod.dev/)** - TypeScript-first schema validation
- **Nodemailer** - Email notifications

### DevOps & Tools
- **Git** - Version control
- **npm** - Package management
- **ts-node-dev** - Development server with hot reload
- **ESLint** - Code linting (planned)
- **Docker** - Containerization (planned)

---

## Getting Started

### Prerequisites

Before getting started, ensure the following are installed:

- **Node.js** (v18.0.0 or higher) - [Download](https://nodejs.org/)
- **npm** (v9.0.0 or higher) - Comes with Node.js
- **MongoDB** (v5.0 or higher) - [Download](https://www.mongodb.com/try/download/community) or use [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- **Git** - [Download](https://git-scm.com/)

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/jayptl-me/whyknot.live.git
cd whyknot.live
```

2. **Install Backend Dependencies**

```bash
cd backend
npm install
```

3. **Install Frontend Dependencies**

```bash
cd../frontend
npm install
```

### Environment Variables

#### Backend Configuration

Create a `.env` file in the `backend/` directory:

```bash
cd backend
cp.env.example.env
```

Edit `.env` with the appropriate configuration:

```env
# Database
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=whyknot

# Server
PORT=3001
CORS_ORIGIN=http://localhost:4321

# Email (Optional)
ENABLE_EMAIL=0
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=postmaster@example.com
SMTP_PASS=your_smtp_password
```

#### Frontend Configuration

Create a `.env` file in the `frontend/` directory:

```bash
cd frontend
cp.env.example.env
```

Edit `.env` with the appropriate configuration:

```env
PUBLIC_API_BASE_URL=http://localhost:3001
PUBLIC_SITE_NAME=WhyKnot Live
```

### Running Locally

#### Option 1: Run Both Services Separately

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```
Backend will run on `http://localhost:3001`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
Frontend will run on `http://localhost:4321`

#### Option 2: Using Docker Compose (Coming Soon)

```bash
docker-compose up --build
```

### Admin Dashboard Setup

To access the admin panel for managing waitlist users:

1. **Configure Backend** - Generate a bcrypt hash for your password:
```bash
cd backend
bun run src/scripts/hash-password.ts "YourSecureP@ssw0rd123!"
```

2. **Add to `backend/.env`**:
```env
ADMIN_PASSWORD_HASH=$2b$12$...your-generated-hash...
ADMIN_JWT_SECRET=generate-with-openssl-rand-hex-32
```

3. **Setup Admin Frontend**:
```bash
cd admin
bun install
cp .env.example .env
```

4. **Run Admin** (in separate terminal):
```bash
cd admin
bun run dev
```
Admin panel runs on `http://localhost:4322`

5. **Access Dashboard**: Open browser and login with your password

📖 **Full documentation**: See [ADMIN.md](./ADMIN.md) and [admin/README.md](./admin/README.md)

---

## Project Structure

```
whyknot.live/
├── admin/ # 🔐 Admin Dashboard (NEW)
│ ├── src/
│ │ ├── layouts/
│ │ │ └── AdminLayout.astro # Admin base layout
│ │ ├── pages/
│ │ │ ├── index.astro # Login page
│ │ │ └── dashboard.astro # Waitlist dashboard
│ │ └── styles/
│ │ ├── admin.css # Admin-specific styles
│ │ └── tokens.css # Shared design tokens
│ ├── astro.config.mjs
│ ├── package.json
│ └── README.md # Full admin documentation
├── backend/ # Backend API server
│ ├── src/
│ │ ├── index.ts # Entry point
│ │ ├── middleware/
│ │ │ └── security.ts # Security headers & middleware
│ │ ├── routes/
│ │ │ ├── admin.ts # 🔐 Admin API routes (NEW)
│ │ │ └── waitlist.ts # Waitlist API routes
│ │ ├── tests/
│ │ │ └── schema.test.ts # Unit tests
│ │ └── utils/
│ │ ├── email.ts # Email service
│ │ ├── env.ts # Environment validation
│ │ └── mongo.ts # MongoDB connection
│ ├── package.json
│ ├── tsconfig.json
│ └──.env.example
├── frontend/ # Frontend Astro application
│ ├── public/ # Static assets
│ │ ├── images/
│ │ ├── data/
│ │ ├── manifest.json
│ │ └── robots.txt
│ ├── src/
│ │ ├── components/ # Reusable components
│ │ │ ├── ComingSoon.astro
│ │ │ ├── Footer.astro
│ │ │ ├── Head.astro
│ │ │ ├── Logo.astro
│ │ │ ├── Navigation.astro
│ │ │ └── Waitlist.astro
│ │ ├── layouts/
│ │ │ └── Layout.astro # Base layout
│ │ ├── pages/ # Route pages
│ │ │ ├── index.astro
│ │ │ ├── about.astro
│ │ │ ├── blog.astro
│ │ │ ├── contact.astro
│ │ │ └── blog/
│ │ │ └── [slug].astro
│ │ ├── styles/ # Centralized CSS
│ │ │ ├── global.css # Main stylesheet
│ │ │ ├── tokens.css # Design tokens
│ │ │ └── components/ # Component styles
│ │ └── utils/
│ ├── astro.config.mjs
│ ├── package.json
│ ├── tsconfig.json
│ └──.env.example
├── docs/ # Additional documentation
├──.github/ # GitHub specific files
│ ├── ISSUE_TEMPLATE/
│ └── PULL_REQUEST_TEMPLATE.md
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
├── CHANGELOG.md
├── LICENSE
└── README.md # You are here!
```

---

## Development

### Backend Development

The backend is built with [Hono](https://hono.dev/), a lightweight and ultra-fast web framework.

**Development Server:**
```bash
cd backend
npm run dev
```

**Build for Production:**
```bash
npm run build
```

**Run Production Build:**
```bash
npm start
```

**Run Tests:**
```bash
npm test
```

**Type Checking:**
```bash
npm run typecheck
```

#### Key Files
- `src/index.ts` - Server setup and middleware configuration
- `src/routes/waitlist.ts` - Waitlist API endpoint
- `src/middleware/security.ts` - Security headers and CORS
- `src/utils/mongo.ts` - MongoDB connection management

### Frontend Development

The frontend uses [Astro](https://astro.build/) for optimal performance with SSR capabilities.

**Development Server:**
```bash
cd frontend
npm run dev
```

**Build for Production:**
```bash
npm run build
```

**Preview Production Build:**
```bash
npm run preview
```

**Type Checking:**
```bash
npm run typecheck
```

**Linting:**
```bash
npm run lint
```

#### Styling Guidelines

All styles are **centralized** in `src/styles/`:

1. **DO NOT** use inline `style=""` attributes
2. **DO NOT** add `<style>` tags in `.astro` files
3. **DO** add CSS to appropriate files in `src/styles/components/`
4. **DO** use design tokens from `tokens.css`

**Adding New Styles:**
```css
/* src/styles/components/your-component.css */
.your-class {
 color: var(--color-primary);
 padding: var(--spacing-md);
}
```

Then import in `src/styles/components/index.css`:
```css
@import './your-component.css';
```

### Branching Strategy

This project follows a production-grade branching model with automated CI/CD workflows:

**Branch Hierarchy:**
- `main` - Production releases only (protected)
- `staging` - Pre-production testing (protected)
- `develop` - Integration branch (protected)
- `feature/*` - New features (e.g., `feature/user-auth`)
- `fix/*` - Bug fixes (e.g., `fix/api-timeout`)
- `hotfix/*` - Emergency production fixes

**Workflow:**
1. Create feature/fix branch from `develop`
2. Open PR to merge into `develop` (requires all CI checks)
3. `develop` → `staging` for pre-production testing
4. `staging` → `main` requires manual approval for production release

**CI/CD Checks:**
- Linting (ESLint)
- Type checking (TypeScript)
- Unit tests
- Build verification
- Security scanning (staging/main only)

 **Full Documentation:** See [BRANCHING_STRATEGY.md](./BRANCHING_STRATEGY.md) for complete details on workflows, GitHub rulesets, and team collaboration guidelines.

---

## Deployment

### [success] Production-Ready

This project is production-ready with:
- **Security**: Rate limiting, CORS, security headers, input validation
- **Performance**: Connection pooling, Redis caching, request timeouts
- 🏥 **Reliability**: Health checks, graceful shutdown, automatic reconnection
- **Monitoring**: Structured logging, health endpoints, error tracking
- **Scalability**: Stateless design, horizontal scaling support

### Quick Deploy to Render (Recommended)

1. **Check your setup**:
```bash
npm run check-deploy
```

2. **Follow the deployment guide**:
See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for the three Render services, the environment
variables each one needs, and the two build traps that have already broken a deploy.

3. **Deploy**:
```bash
# Push to GitHub
git push origin main
```
The three services already exist in Render, so there is no blueprint to create. The public site
and the API deploy once their checks pass; if no CI check reports, trigger them from the Render
dashboard (Manual deploy) or through the Render API. The admin deploys on every push.

### Required Services

- **MongoDB**: [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (Free M0 tier available)
- **Redis**: [Upstash](https://upstash.com/) or Render Redis (Recommended for rate limiting)

### Environment Variables

**Backend (Set in Render Dashboard):**
```bash
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://...
MONGODB_DB=whyknot
REDIS_URL=redis://...
USE_REDIS_RATE_LIMIT=1
CORS_ORIGIN=https://whyknot.live,https://www.whyknot.live,https://admin.whyknot.live
ADMIN_PASSWORD_HASH=$2b$12$...
ADMIN_JWT_SECRET=... # at least 32 characters
```

**Frontend (Set in Render Dashboard, baked into the bundle at build time):**
```bash
PUBLIC_API_BASE_URL=https://api.whyknot.live
```

**Admin (Set in Render Dashboard):**
```bash
PUBLIC_API_URL=https://api.whyknot.live/api
```

### Health Checks

- Backend: `https://api.whyknot.live/health`
- Frontend: `https://www.whyknot.live/`

### Documentation

- 📘 [Deployment Guide](./docs/DEPLOYMENT.md) — the three Render services, env vars, deploy flow
- 📗 [API Reference](./docs/API.md)
- 📙 [Architecture](./docs/ARCHITECTURE.md) · [Development](./docs/DEVELOPMENT.md) · [CI](./docs/CIRCLECI.md) · [FAQ](./docs/FAQ.md)

---

## API Documentation

### Base URL
```
Production: https://api.whyknot.live
Development: http://localhost:3001
```

### Endpoints

#### Health Check
```http
GET /
```

**Response:**
```json
{
 "ok": true,
 "service": "whyknot-backend"
}
```

#### Join Waitlist
```http
POST /api/waitlist
Content-Type: application/json
```

**Request Body:**
```json
{
 "email": "user@example.com"
}
```

**Success Response (200):**
```json
{
 "ok": true,
 "id": "507f1f77bcf86cd799439011"
}
```

**Error Responses:**

 Status Code Error Description 
---------------------------------
 400 `invalid_email` Email format is invalid 
 409 `already_exists` Email already in waitlist 
 429 `rate_limited` Too many requests from IP 
 500 `server_error` Internal server error 

**Example with cURL:**
```bash
curl -X POST http://localhost:3001/api/waitlist \
 -H "Content-Type: application/json" \
 -d '{"email":"test@example.com"}'
```

**Example with JavaScript:**
```javascript
const response = await fetch('http://localhost:3001/api/waitlist', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ email: 'test@example.com' })
});

const data = await response.json();
console.log(data);
```

### Rate Limiting

- **Window:** 60 seconds
- **Max Requests:** 10 per IP
- **Note:** In-memory implementation; use Redis for production

---

## Contributing

We love contributions! Whether it's bug fixes, feature additions, or documentation improvements, all contributions are welcome.

Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting a pull request.

### Quick Start for Contributors

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

See our [Code of Conduct](CODE_OF_CONDUCT.md) for community guidelines.

---

## Security

Security is a top priority for WhyKnot. If you discover a security vulnerability, please follow our [Security Policy](SECURITY.md).

**DO NOT** open a public issue for security vulnerabilities.

### Security Features

- Rate limiting on API endpoints
- CORS protection
- Security headers (HSTS, X-Frame-Options, etc.)
- Input validation with Zod
- MongoDB injection prevention
- Environment variable validation

---

## Roadmap

### Phase 1: Foundation (Current)
- [x] Landing page with waitlist
- [x] Backend API with MongoDB
- [x] Email notifications
- [x] Security hardening
- [ ] Beta testing with alpha users

### Phase 2: Alpha Launch (September 2026)
- [ ] User authentication system
- [ ] Basic website directory
- [ ] Search functionality
- [ ] Category filtering
- [ ] User profiles

### Phase 3: Full Launch (October 2026)
- [ ] Advanced filtering and sorting
- [ ] User submissions
- [ ] Collections and favorites
- [ ] API for developers
- [ ] Chrome extension
- [ ] Mobile app (iOS/Android)

### Future Enhancements
- [ ] AI-powered recommendations
- [ ] Community voting system
- [ ] Premium tier with advanced features
- [ ] Analytics dashboard
- [ ] Internationalization (i18n)

See the [open issues](https://github.com/jayptl-me/whyknot.live/issues) for a complete list of proposed features and known issues.

---

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2025 Jay Patel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...
```

---

## Contact

**Jay Patel** - Project Creator

- Website: [whyknot.live](https://whyknot.live)
- GitHub: [@jayptl-me](https://github.com/jayptl-me)
- Email: [Contact Form](https://whyknot.live/contact)

**Project Links:**
- [Homepage](https://whyknot.live)
- [Documentation](https://github.com/jayptl-me/whyknot.live/tree/main/docs)
- [Issue Tracker](https://github.com/jayptl-me/whyknot.live/issues)
- [Discussions](https://github.com/jayptl-me/whyknot.live/discussions)

---

## Acknowledgments

Special thanks to:

- [Astro](https://astro.build/) - For the amazing static site generator
- [Hono](https://hono.dev/) - For the ultra-fast web framework
- [Vercel](https://vercel.com/) - For hosting and deployment
- [MongoDB](https://www.mongodb.com/) - For the database
- [Shields.io](https://shields.io/) - For the awesome badges
- All our alpha testers and early supporters

### Inspiration & Resources

- [Awesome README](https://github.com/matiassingers/awesome-readme)
- [Best README Template](https://github.com/othneildrew/Best-README-Template)
- [Choose an Open Source License](https://choosealicense.com/)
- [Contributor Covenant](https://www.contributor-covenant.org/)
- [Semantic Versioning](https://semver.org/)

---

<div align="center">
 <p>Made with by <a href="https://github.com/jayptl-me">Jay Patel</a></p>
 <p>
 <a href="#-table-of-contents">Back to Top </a>
 </p>
</div>
