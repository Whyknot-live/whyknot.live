# WhyKnot Admin Dashboard

Secure admin panel for managing the WhyKnot waitlist.

## Features

- 🔐 **Secure Authentication**: Token-based JWT authentication with env-based password
- 📊 **Real-time Statistics**: View total signups, recent activity, and interest distribution
- 📋 **User Management**: Browse and search all waitlist users
- 🔍 **Search & Filters**: Filter the waitlist by email keyword or interest tag
- 📁 **CSV Export**: Download filtered waitlist data for deeper analysis
- 🎨 **Themed Design**: Uses the same design system as the main WhyKnot site
- 📱 **Responsive**: Works seamlessly on desktop, tablet, and mobile devices
- ♻️ **Auto-refresh**: Dashboard updates automatically every 30 seconds

## Setup

### 1. Install Dependencies

```bash
cd admin
bun install
```

### 2. Configure Environment

Create a `.env` file in the `admin` directory:

```env
PUBLIC_API_URL=http://localhost:10000/api
```

For production, update to your backend URL:
```env
PUBLIC_API_URL=https://your-backend.onrender.com/api
```

### 3. Configure Backend

Add these environment variables to your backend `.env`:

```env
# Admin credentials
ADMIN_PASSWORD=your-secure-password-min-8-chars
ADMIN_JWT_SECRET=your-secret-key-min-32-chars-random-string
```

**Important Security Notes:**
- Use a strong password (minimum 8 characters)
- Use a random, secure JWT secret (minimum 32 characters)
- Never commit these values to version control
- Use different values for development and production

Generate a secure JWT secret:
```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or using OpenSSL
openssl rand -hex 32
```

### 4. Start Development Server

```bash
bun run dev
```

The admin dashboard will be available at `http://localhost:4322`

## Usage

### Login

1. Navigate to `http://localhost:4322`
2. Enter your admin password (set in `ADMIN_PASSWORD` env variable)
3. Click "Sign In"

### Dashboard

The dashboard displays:

- **Statistics Cards**: Total signups, last 24 hours, and last 7 days
- **Waitlist Table**: All registered users with:
  - Position number
  - Email address
  - Selected interests
  - Join date/time
- **Filter Controls**:
  - Live search by email address
  - Interest dropdown populated from real data
  - Result counter and pagination helpers
- **Interest Breakdown**: Visual ranking of the most popular interests
- **CSV Export**: Download the current filtered dataset with one click
- **Pagination**: Browse through users (50 per page)
- **Auto-refresh**: Data updates every 30 seconds

### Logout

Click the "Logout" button in the top-right corner to end your session.

## Architecture

### Frontend (Astro)
- **Port**: 4322 (development)
- **Framework**: Astro static site generator
- **Styling**: CSS with design tokens from main site
- **Authentication**: JWT tokens stored in localStorage

### Backend API Endpoints

#### POST `/api/admin/login`
Authenticate with admin password and receive JWT token.

**Request:**
```json
{
  "password": "your-admin-password"
}
```

**Response:**
```json
{
  "ok": true,
  "token": "jwt-token-here",
  "expiresIn": 86400
}
```

#### GET `/api/admin/verify`
Verify if current token is still valid.

**Headers:**
```
Authorization: Bearer <token>
```

#### GET `/api/admin/stats`
Get waitlist statistics.

**Response:**
```json
{
  "ok": true,
  "stats": {
    "total": 1234,
    "last24h": 45,
    "last7days": 289,
    "interests": [
      { "name": "Design", "count": 456 },
      { "name": "Development", "count": 342 }
    ]
  }
}
```

#### GET `/api/admin/waitlist?page=1&limit=50`
Get paginated waitlist users.

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "_id": "...",
      "email": "user@example.com",
      "interests": ["Design", "Development"],
      "createdAt": "2025-10-29T12:34:56.789Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1234,
    "pages": 25
  }
}
```

## Security

### Authentication Flow

1. User enters password on login page
2. Frontend sends password to `/api/admin/login`
3. Backend verifies password against `ADMIN_PASSWORD` env variable
4. Backend generates JWT token with 24-hour expiration
5. Frontend stores token in localStorage
6. All subsequent requests include token in Authorization header
7. Backend validates token on each protected route

### Token Validation

- Tokens expire after 24 hours
- Invalid tokens redirect to login page
- Tokens are signed with `ADMIN_JWT_SECRET`
- `noindex, nofollow` meta tags prevent search engine indexing

### Best Practices

- Change default password immediately
- Use strong, unique passwords
- Rotate JWT secret periodically
- Enable HTTPS in production
- Monitor admin access logs
- Consider adding IP whitelist for production

## Deployment

### Production Build

```bash
cd admin
bun run build
```

### Deploy Options

1. **Static Hosting** (Netlify, Vercel, Cloudflare Pages):
   - Upload `dist/` folder
   - Set environment variable: `PUBLIC_API_URL=your-backend-url`

2. **Self-hosted**:
   - Serve `dist/` folder with any static file server
   - Configure your backend URL

### Environment Variables

Production `.env`:
```env
PUBLIC_API_URL=https://api.whyknot.live/api
```

## Customization

### Styling

Admin uses the same design tokens as the main site. To customize:

1. Edit `/admin/src/styles/tokens.css` for colors and spacing
2. Edit `/admin/src/styles/admin.css` for component styles

### Features to Add

The admin panel is designed to be extensible. Consider adding:

- [ ] User search and filtering
- [ ] Export to CSV
- [ ] Email individual users
- [ ] Bulk actions
- [ ] Activity logs
- [ ] User analytics charts
- [ ] Multi-admin support with roles
- [ ] Two-factor authentication
- [ ] Session management

## Troubleshooting

### Login fails with "invalid_credentials"
- Check `ADMIN_PASSWORD` in backend `.env`
- Ensure backend is running
- Verify `PUBLIC_API_URL` is correct

### "Unauthorized" error
- Token may have expired (24 hours)
- Clear localStorage and login again
- Check `ADMIN_JWT_SECRET` matches between requests

### Dashboard not loading
- Verify backend `/api/admin/waitlist` endpoint is accessible
- Check browser console for errors
- Ensure token is valid with `/api/admin/verify`

### CORS errors
- Add admin URL to backend `CORS_ORIGIN` env variable
- Ensure credentials are enabled in CORS config

## Support

For issues or questions:
- Check backend logs for errors
- Review browser console for frontend errors
- Ensure all environment variables are set correctly
- Verify MongoDB connection is healthy

## License

Private - Part of WhyKnot platform
