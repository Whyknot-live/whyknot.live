# API Documentation

Complete API reference for WhyKnot.live backend services.

## Base URLs

 Environment URL 
-------------------------------------------
 Production `https://api.whyknot.live` 
 Staging `https://staging-api.whyknot.live` 
 Local `http://localhost:3001` 

## Authentication

Currently, the API does not require authentication for waitlist submissions. Authentication will be added in future versions for user-specific features.

## Rate Limiting

All API endpoints are rate-limited to prevent abuse:

- **Window**: 60 seconds
- **Max Requests**: 10 per IP address
- **Reset**: Automatic after window expires

**Rate Limit Headers:**
```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1698765432
```

When rate limit is exceeded:
```json
{
 "error": "rate_limited"
}
```
**Status Code**: `429 Too Many Requests`

## Common Response Formats

### Success Response
```json
{
 "ok": true,
 "data": {... }
}
```

### Error Response
```json
{
 "error": "error_code"
}
```

## Error Codes

 Code Status Description 
---------------------------
 `invalid_email` 400 Email format is invalid 
 `already_exists` 409 Email already in waitlist 
 `rate_limited` 429 Too many requests 
 `server_error` 500 Internal server error 

---

## Endpoints

### 1. Health Check

Check if the API is running and healthy.

```http
GET /
```

#### Response

**Status**: `200 OK`

```json
{
 "ok": true,
 "service": "whyknot-backend"
}
```

#### Example

```bash
curl https://api.whyknot.live/
```

```javascript
const response = await fetch('https://api.whyknot.live/');
const data = await response.json();
console.log(data);
```

---

### 2. Join Waitlist

Submit an email to join the WhyKnot waitlist.

```http
POST /api/waitlist
Content-Type: application/json
```

#### Request Body

 Field Type Required Description 
------------------------------------
 `email` string Yes Valid email address 

```json
{
 "email": "user@example.com"
}
```

#### Validation Rules

- Email must be valid format
- Email must be unique (not already in waitlist)
- Request must pass rate limiting

#### Response

**Success - Status**: `200 OK`

```json
{
 "ok": true,
 "id": "507f1f77bcf86cd799439011"
}
```

**Error - Status**: `400 Bad Request`

```json
{
 "error": "invalid_email"
}
```

**Error - Status**: `409 Conflict`

```json
{
 "error": "already_exists"
}
```

**Error - Status**: `429 Too Many Requests`

```json
{
 "error": "rate_limited"
}
```

**Error - Status**: `500 Internal Server Error`

```json
{
 "error": "server_error"
}
```

#### Examples

**cURL:**
```bash
curl -X POST https://api.whyknot.live/api/waitlist \
 -H "Content-Type: application/json" \
 -d '{"email":"test@example.com"}'
```

**JavaScript (Fetch API):**
```javascript
const joinWaitlist = async (email) => {
 const response = await fetch('https://api.whyknot.live/api/waitlist', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({ email }),
 });

 const data = await response.json();

 if (!response.ok) {
 throw new Error(data.error);
 }

 return data;
};

// Usage
try {
 const result = await joinWaitlist('user@example.com');
 console.log('Successfully joined!', result.id);
} catch (error) {
 console.error('Failed to join:', error.message);
}
```

**JavaScript (Axios):**
```javascript
import axios from 'axios';

const joinWaitlist = async (email) => {
 try {
 const response = await axios.post('https://api.whyknot.live/api/waitlist', {
 email,
 });
 return response.data;
 } catch (error) {
 if (error.response) {
 throw new Error(error.response.data.error);
 }
 throw error;
 }
};
```

**Python (requests):**
```python
import requests

def join_waitlist(email):
 url = 'https://api.whyknot.live/api/waitlist'
 payload = {'email': email}
 
 response = requests.post(url, json=payload)
 
 if response.status_code == 200:
 return response.json()
 else:
 raise Exception(response.json().get('error'))

# Usage
try:
 result = join_waitlist('user@example.com')
 print(f"Successfully joined! ID: {result['id']}")
except Exception as e:
 print(f"Failed to join: {e}")
```

**TypeScript (with type safety):**
```typescript
interface WaitlistResponse {
 ok: true;
 id: string;
}

interface ErrorResponse {
 error: string;
}

async function joinWaitlist(email: string): Promise<WaitlistResponse> {
 const response = await fetch('https://api.whyknot.live/api/waitlist', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({ email }),
 });

 const data = await response.json();

 if (!response.ok) {
 const error = data as ErrorResponse;
 throw new Error(error.error);
 }

 return data as WaitlistResponse;
}
```

---

## Data Models

### Waitlist Entry

```typescript
interface WaitlistEntry {
 _id: ObjectId; // MongoDB ObjectId
 email: string; // Unique email address
 createdAt: Date; // Timestamp of signup
}
```

**Database Indexes:**
- `email`: Unique index for duplicate prevention
- `createdAt`: Index for sorting by signup date

---

## Security

### HTTPS Only

All API requests must use HTTPS in production. HTTP requests will be redirected to HTTPS.

### CORS

Cross-Origin Resource Sharing (CORS) is configured to allow requests from:

- Production: `https://whyknot.live`
- Development: `http://localhost:4321`

**CORS Headers:**
```
Access-Control-Allow-Origin: https://whyknot.live
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

### Security Headers

All responses include security headers:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

### Input Validation

All inputs are validated using Zod schemas before processing:

```typescript
const waitlistSchema = z.object({
 email: z.string().email(),
});
```

### Rate Limiting

See [Rate Limiting](#rate-limiting) section above.

---

## Best Practices

### Error Handling

Always handle errors gracefully:

```javascript
try {
 const result = await joinWaitlist(email);
 // Handle success
} catch (error) {
 if (error.message === 'already_exists') {
 // Show "already signed up" message
 } else if (error.message === 'rate_limited') {
 // Show "please try again later" message
 } else if (error.message === 'invalid_email') {
 // Show "invalid email" message
 } else {
 // Show generic error message
 }
}
```

### User Feedback

Provide clear feedback for each error state:

 Error User Message 
---------------------
 `invalid_email` "Please enter a valid email address" 
 `already_exists` "This email is already on our waitlist!" 
 `rate_limited` "Too many attempts. Please try again in a minute." 
 `server_error` "Something went wrong. Please try again later." 

### Retry Logic

Implement exponential backoff for retries:

```javascript
async function joinWaitlistWithRetry(email, maxRetries = 3) {
 for (let i = 0; i < maxRetries; i++) {
 try {
 return await joinWaitlist(email);
 } catch (error) {
 if (error.message === 'server_error' && i < maxRetries - 1) {
 await new Promise(resolve => 
 setTimeout(resolve, Math.pow(2, i) * 1000)
 );
 continue;
 }
 throw error;
 }
 }
}
```

### Loading States

Show loading indicators during API calls:

```javascript
const [loading, setLoading] = useState(false);

const handleSubmit = async (e) => {
 e.preventDefault();
 setLoading(true);
 
 try {
 await joinWaitlist(email);
 // Show success message
 } catch (error) {
 // Show error message
 } finally {
 setLoading(false);
 }
};
```

---

## Webhooks (Coming Soon)

Future versions will support webhooks for:

- New waitlist signups
- User account events
- Content updates

---

## Versioning

The API uses URL versioning:

- Current: `/api/` (v1, no version prefix)
- Future: `/api/v2/` (when breaking changes are introduced)

**Version Support Policy:**
- Current version: Full support
- Previous version: 6 months deprecation notice
- Older versions: No support

---

## SDK (Coming Soon)

Official SDKs will be available for:

- JavaScript/TypeScript
- Python
- Go
- PHP

---

## Status & Monitoring

Monitor API status at: [status.whyknot.live](https://status.whyknot.live) (coming soon)

---

## Support

Need help with the API?

- [Documentation](https://github.com/jayptl-me/whyknot.live/tree/main/docs)
- [GitHub Discussions](https://github.com/jayptl-me/whyknot.live/discussions)
- [Report Issues](https://github.com/jayptl-me/whyknot.live/issues)
- [Contact Form](https://whyknot.live/contact)

---

## Changelog

See [CHANGELOG.md](../CHANGELOG.md) for API version history and changes.

---

Last Updated: October 23, 2025
