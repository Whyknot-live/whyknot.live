# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- User authentication system
- Website directory functionality
- Advanced search and filtering
- User submission system
- API for developers
- Chrome extension
- Mobile applications

---

## [0.1.0] - 2025-10-23

### Initial Release

The first version of WhyKnot.live - a platform for discovering innovative websites and tools!

### Added

#### Frontend
- **Landing Page**: Engaging coming soon page with scroll snap navigation
- **Waitlist System**: Email collection for alpha access
- **Responsive Design**: Mobile-first design that works on all devices
- **SEO Optimization**: Schema.org markup, meta tags, and sitemap
- **Design System**: Centralized CSS architecture with design tokens
- **Pages**: About, Blog, Contact, Privacy Policy, Terms of Service, 404
- **Components**: Reusable Astro components (Navigation, Footer, Logo, etc.)
- **Smooth Animations**: Scroll-based animations and transitions

#### Backend
- **REST API**: Hono-based API server with TypeScript
- **Waitlist Endpoint**: POST /api/waitlist for email submissions
- **MongoDB Integration**: Database for storing waitlist entries
- **Input Validation**: Zod schema validation
- **Rate Limiting**: IP-based rate limiting (10 requests/minute)
- **Security Headers**: HSTS, X-Frame-Options, X-Content-Type-Options
- **CORS Support**: Configurable CORS middleware
- **Email Notifications**: Optional welcome emails via Nodemailer
- **Error Handling**: Comprehensive error responses
- **Health Check**: GET / endpoint for monitoring

#### Security
- **Input Sanitization**: All inputs validated with Zod
- **NoSQL Injection Prevention**: Parameterized MongoDB queries
- **Rate Limiting**: Protection against abuse
- **Environment Validation**: Startup validation of required env vars
- **Secure Headers**: Multiple security headers implemented
- **Error Safety**: No sensitive data in error responses

#### Developer Experience
- **TypeScript**: Full TypeScript support in frontend and backend
- **Hot Reload**: Development servers with automatic reload
- **Code Quality**: Type checking and linting setup
- **Testing**: Unit test infrastructure
- **Documentation**: Comprehensive README and inline documentation

#### DevOps
- **Environment Config**:.env.example files for easy setup
- **Build Scripts**: Production build configurations
- **Node.js Adapter**: SSR support with Astro Node adapter
- **Development Scripts**: Easy-to-use npm scripts

### Architecture

#### Tech Stack
- **Frontend**: Astro 5.13.9, TypeScript, Custom CSS
- **Backend**: Hono 4.8.0, Node.js, TypeScript
- **Database**: MongoDB 5.8.0
- **Validation**: Zod 3.22.2
- **Email**: Nodemailer 6.9.0

#### Project Structure
```
whyknot.live/
├── backend/ # API server
├── frontend/ # Astro application
├── docs/ # Documentation
└──.github/ # GitHub templates
```

### Documentation
- **README.md**: Comprehensive project documentation
- **CONTRIBUTING.md**: Contribution guidelines
- **CODE_OF_CONDUCT.md**: Community guidelines
- **SECURITY.md**: Security policy and reporting
- **CHANGELOG.md**: This file
- **LICENSE**: MIT License

---

## Version History

### [0.1.0] - 2025-10-23
- Initial release with landing page and waitlist functionality

---

## How to Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to contribute to this project.

## Links

- [Repository](https://github.com/jayptl-me/whyknot.live)
- [Website](https://whyknot.live)
- [Issues](https://github.com/jayptl-me/whyknot.live/issues)
- [Discussions](https://github.com/jayptl-me/whyknot.live/discussions)

---

## Legend

- **Major Release**
- **New Feature**
- **Bug Fix**
- **Security**
- **Performance**
- **Documentation**
- **UI/UX**
- **Refactor**
- **Deprecation**
- **Configuration**
- **Testing**

---

<div align="center">
 <p>Made with by <a href="https://github.com/jayptl-me">Jay Patel</a></p>
</div>
