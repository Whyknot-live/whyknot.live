# Architecture Documentation

## Overview

WhyKnot.live is a modern web application built with a decoupled architecture, separating the frontend and backend for scalability, maintainability, and deployment flexibility.

## System Architecture

```
┌─────────────────┐
│ │
│ Web Browser │
│ │
└────────┬────────┘
 │
 │ HTTPS
 ▼
┌─────────────────────────────────────────────────┐
│ │
│ Frontend (Astro SSR) │
│ │
│ ┌──────────────┐ ┌────────────────────────┐ │
│ │ Pages │ │ Components │ │
│ │ │ │ │ │
│ │ - Home │ │ - Navigation │ │
│ │ - About │ │ - Footer │ │
│ │ - Blog │ │ - Waitlist Form │ │
│ │ - Contact │ │ - Coming Soon │ │
│ └──────────────┘ └────────────────────────┘ │
│ │
│ ┌──────────────────────────────────────────┐ │
│ │ Centralized CSS │ │
│ │ - Design Tokens │ │
│ │ - Component Styles │ │
│ └──────────────────────────────────────────┘ │
│ │
└────────────────────┬────────────────────────────┘
 │
 │ REST API
 ▼
┌─────────────────────────────────────────────────┐
│ │
│ Backend (Hono/Node.js) │
│ │
│ ┌──────────────┐ ┌────────────────────────┐ │
│ │ Routes │ │ Middleware │ │
│ │ │ │ │ │
│ │ - Waitlist │ │ - Security Headers │ │
│ │ - Health │ │ - CORS │ │
│ │ │ │ - Rate Limiting │ │
│ └──────────────┘ └────────────────────────┘ │
│ │
│ ┌──────────────┐ ┌────────────────────────┐ │
│ │ Utils │ │ Services │ │
│ │ │ │ │ │
│ │ - MongoDB │ │ - Email (Nodemailer) │ │
│ │ - Env │ │ - Validation (Zod) │ │
│ └──────────────┘ └────────────────────────┘ │
│ │
└────────────────────┬────────────────────────────┘
 │
 │ MongoDB Protocol
 ▼
┌─────────────────────────────────────────────────┐
│ │
│ MongoDB Database │
│ │
│ ┌──────────────────────────────────────────┐ │
│ │ Collections │ │
│ │ │ │
│ │ - waitlist │ │
│ │ • email (unique index) │ │
│ │ • createdAt │ │
│ │ • _id │ │
│ └──────────────────────────────────────────┘ │
│ │
└─────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend Layer

#### Astro (Static Site Generator with SSR)
- **Version**: 5.13.9
- **Purpose**: Build optimized static pages with server-side rendering
- **Key Features**:
 - Zero JavaScript by default
 - Component islands architecture
 - Built-in optimization
 - Node.js adapter for SSR

#### TypeScript
- **Purpose**: Type-safe development
- **Benefits**:
 - Compile-time error detection
 - Better IDE support
 - Self-documenting code
 - Refactoring safety

#### CSS Architecture
- **Approach**: Centralized CSS with design tokens
- **Structure**:
 ```
 src/styles/
 ├── global.css # Main entry point
 ├── tokens.css # Design tokens (colors, spacing, etc.)
 └── components/ # Component-specific styles
 ├── index.css # Imports all component styles
 ├── layout.css
 ├── navigation.css
 ├── footer.css
 ├── forms.css
 ├── blog.css
 ├── pages.css
 └── design-system.css
 ```
- **Principles**:
 - No inline styles
 - No scoped `<style>` tags
 - Design token-driven
 - Mobile-first responsive design

### Backend Layer

#### Hono (Web Framework)
- **Version**: 4.8.0
- **Purpose**: Ultra-fast, lightweight web framework
- **Why Hono?**:
 - Performance-focused
 - TypeScript-first
 - Minimal overhead
 - Express-like API
 - Edge runtime compatible

#### Node.js
- **Version**: 18+
- **Purpose**: Runtime environment
- **Features Used**:
 - Async/await
 - ES modules
 - Native test runner

#### MongoDB
- **Version**: 5.8.0
- **Purpose**: NoSQL database
- **Data Model**:
 ```typescript
 interface WaitlistEntry {
 _id: ObjectId;
 email: string; // Unique index
 createdAt: Date;
 }
 ```

### Supporting Libraries

#### Zod
- **Version**: 3.22.2
- **Purpose**: Runtime type validation
- **Usage**: Validate API inputs, environment variables

#### Nodemailer
- **Version**: 6.9.0
- **Purpose**: Email notifications
- **Usage**: Welcome emails for waitlist signups (optional)

## Data Flow

### Waitlist Signup Flow

```
1. User submits email on frontend
 ↓
2. Frontend sends POST /api/waitlist
 ↓
3. Backend validates with Zod
 ↓
4. Backend checks rate limit
 ↓
5. Backend inserts to MongoDB
 ↓
6. Backend sends welcome email (if enabled)
 ↓
7. Backend returns success/error
 ↓
8. Frontend shows feedback to user
```

### Error Handling Flow

```
Request → Validation → Rate Check → Database → Response
 ↓ ↓ ↓ ↓ ↓
 400 400 429 409/500 200
(invalid) (schema) (limited) (duplicate/error) (success)
```

## Security Architecture

### Defense in Depth

1. **Input Layer**
 - Zod schema validation
 - Type checking with TypeScript
 - Email format validation

2. **Application Layer**
 - Rate limiting (10 req/min per IP)
 - CORS restrictions
 - Security headers

3. **Data Layer**
 - Parameterized queries (no injection)
 - Unique constraints
 - Connection string validation

4. **Transport Layer**
 - HTTPS only in production
 - Secure cookies (when implemented)
 - HSTS headers

### Security Headers

```typescript
{
 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
 'X-Frame-Options': 'DENY',
 'X-Content-Type-Options': 'nosniff',
 'X-XSS-Protection': '1; mode=block',
 'Referrer-Policy': 'strict-origin-when-cross-origin'
}
```

## Performance Optimizations

### Frontend
- Static site generation where possible
- Minimal JavaScript
- CSS minification
- Asset optimization
- Prefetch strategy: hover
- Compressed HTML

### Backend
- Lightweight framework (Hono)
- Connection pooling (MongoDB)
- In-memory rate limiting (consider Redis for scale)
- Async operations
- Minimal dependencies

### Database
- Indexed email field
- Connection reuse
- Efficient queries

## Scalability Considerations

### Current Implementation
- Monolithic deployment
- In-memory rate limiting
- Single database connection

### Future Scalability
- Horizontal scaling with load balancer
- Redis for distributed rate limiting
- MongoDB replica set
- CDN for static assets
- Caching layer (Redis/Memcached)
- Message queue for emails (Bull/RabbitMQ)

## Deployment Architecture

### Development
```
Local Machine
├── Frontend: localhost:4321
├── Backend: localhost:3001
└── MongoDB: localhost:27017
```

### Production (Recommended)
```
┌─────────────────────────────────────────┐
│ CDN (Cloudflare/CloudFront) │
└────────────────┬────────────────────────┘
 │
┌────────────────▼────────────────────────┐
│ Frontend (Vercel/Netlify) │
└────────────────┬────────────────────────┘
 │
┌────────────────▼────────────────────────┐
│ Backend (Railway/Heroku/Fly.io) │
└────────────────┬────────────────────────┘
 │
┌────────────────▼────────────────────────┐
│ Database (MongoDB Atlas) │
└─────────────────────────────────────────┘
```

## Directory Structure Philosophy

```
whyknot.live/
│
├── frontend/ # Completely independent frontend
│ ├── src/
│ │ ├── components/ # Reusable UI components
│ │ ├── layouts/ # Page templates
│ │ ├── pages/ # File-based routing
│ │ ├── styles/ # Centralized CSS
│ │ └── utils/ # Frontend helpers
│ └── public/ # Static assets
│
├── backend/ # Completely independent backend
│ └── src/
│ ├── routes/ # API endpoints
│ ├── middleware/ # Express-like middleware
│ ├── utils/ # Backend helpers
│ └── tests/ # Unit tests
│
├── docs/ # Documentation
├──.github/ # GitHub templates
└── [root files] # Project metadata
```

## Design Patterns

### Backend Patterns

1. **Middleware Pattern**: Composable request processing
2. **Service Layer Pattern**: Business logic separation
3. **Repository Pattern**: Database access abstraction (future)
4. **Singleton Pattern**: Database connection
5. **Factory Pattern**: Response builders

### Frontend Patterns

1. **Component Composition**: Reusable Astro components
2. **Layout Pattern**: Shared page structure
3. **Props Pattern**: Component configuration
4. **Slot Pattern**: Content projection

## API Design

### RESTful Principles
- Resource-based URLs
- HTTP methods for actions
- Status codes for outcomes
- JSON responses

### Response Format
```typescript
// Success
{
 ok: true,
 data: {... }
}

// Error
{
 error: "error_code"
}
```

## Testing Strategy

### Backend Testing
- Unit tests for business logic
- Integration tests for API endpoints
- Schema validation tests
- Error handling tests

### Frontend Testing (Planned)
- Component tests
- E2E tests with Playwright
- Visual regression tests
- Accessibility tests

## Monitoring & Observability (Planned)

- Error tracking (Sentry)
- Performance monitoring (Vercel Analytics)
- Logging (structured JSON logs)
- Health checks
- Uptime monitoring

## Future Architecture Improvements

1. **Microservices**: Split by domain (auth, content, notifications)
2. **GraphQL API**: More flexible data fetching
3. **WebSockets**: Real-time features
4. **Service Workers**: Offline support
5. **Edge Functions**: Global performance
6. **CI/CD Pipeline**: Automated testing and deployment

---

Last Updated: October 23, 2025
