# WhyKnot Backend

This repository contains a secure, production-ready backend for the WhyKnot waitlist. Built with TypeScript, Hono, MongoDB, and Zod for comprehensive validation.

## Features

- **POST /api/waitlist** endpoint that accepts JSON `{ email }`
- Strong validation using Zod
- Unique index on email to prevent duplicates
- Basic IP rate limiting (in-memory, replaceable with Redis for production)
- Security headers (HSTS, X-Frame-Options, etc.) and CORS middleware
- Optional transactional emails via SMTP/Nodemailer
- TypeScript first with full type safety
- Ready for containerized deployment with Docker

## Quick Start (Local Development)

### Prerequisites

- Node.js 18+ (or use Docker)
- MongoDB running locally or remotely

### Steps

1. **Clone and install dependencies:**

```bash
cd backend
npm install
```

2. **Copy environment template:**

```bash
cp.env.example.env
```

Then edit `.env` and set `MONGODB_URI` and `MONGODB_DB` appropriately.

3. **Run development server:**

```bash
npm run dev
```

The server starts on `http://localhost:10000`. Health check: `GET /` returns `{ ok: true, service: "whyknot-backend" }`.

## API Reference

### POST /api/waitlist

Accepts JSON payload:

```json
{
 "email": "user@example.com"
}
```

**Responses:**

- `200 OK`: `{ ok: true, id: "<mongo_id>" }`
- `400 Bad Request`: `{ error: "invalid_email" }`
- `409 Conflict`: `{ error: "already_exists" }`
- `429 Too Many Requests`: `{ error: "rate_limited" }`
- `500 Internal Server Error`: `{ error: "server_error" }`

**Example (curl):**

```bash
curl -X POST http://localhost:10000/api/waitlist \
 -H 'Content-Type: application/json' \
 -d '{"email":"test@example.com"}'
```

### Admin Endpoints (Protected with JWT)

These routes require a valid admin token obtained from `POST /api/admin/login`. Set `ADMIN_PASSWORD` and `ADMIN_JWT_SECRET` in the backend `.env` file.

- `POST /api/admin/login` – exchange the env-based password for a 24-hour JWT token
- `GET /api/admin/verify` – validate an existing token
- `GET /api/admin/stats` – aggregate waitlist totals, recency metrics, and interest distribution
- `GET /api/admin/waitlist` – paginated waitlist data with optional `search`, `interest`, `page`, `limit`, `sort`, and `order` query parameters
- `GET /api/admin/waitlist?format=csv` – download the filtered waitlist as a CSV export (max 5,000 rows per request)

## Docker

To run the entire stack (MongoDB + backend) locally with Docker Compose:

```bash
docker-compose up --build
```

Backend will be on `http://localhost:3001` and MongoDB on port `27017`.

## Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for production hardening and deployment best practices.

## Security

See [SECURITY.md](./SECURITY.md) for security recommendations.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT (or your choice)
