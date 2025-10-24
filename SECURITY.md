# Security Policy

## Security

Security is a top priority for WhyKnot.live. We take all security vulnerabilities seriously and appreciate your efforts to responsibly disclose your findings.

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities through public GitHub issues.**

If a security vulnerability is discovered, please follow these steps:

### 1. **Private Disclosure**

Send a detailed report to our security team via:

- **Email**: Use our [contact form](https://whyknot.live/contact) with "SECURITY" in the subject line
- **GitHub Security Advisory**: [Create a private security advisory](https://github.com/jayptl-me/whyknot.live/security/advisories/new)

### 2. **Include These Details**

To help us understand and resolve the issue quickly, please include:

- **Description**: Detailed description of the vulnerability
- **Impact**: Potential impact and attack scenario
- **Steps to Reproduce**: Step-by-step instructions to reproduce
- **Proof of Concept**: If applicable, include PoC code or screenshots
- **Affected Versions**: Which versions are affected
- **Environment**: OS, browser, Node.js version, etc.
- **Suggested Fix**: If you have ideas for a solution

### 3. **What to Expect**

We aim to respond to security reports according to this timeline:

- **24 hours**: Initial response acknowledging receipt
- **72 hours**: Preliminary assessment of the report
- **7 days**: Detailed response with our evaluation and timeline
- **30 days**: Resolution and public disclosure (if applicable)

## Vulnerability Categories

We are particularly interested in reports about:

### Critical
- SQL/NoSQL injection vulnerabilities
- Remote code execution (RCE)
- Authentication bypass
- Privilege escalation
- Sensitive data exposure

### High
- Cross-site scripting (XSS)
- Cross-site request forgery (CSRF)
- Insecure direct object references (IDOR)
- Server-side request forgery (SSRF)
- Broken access control

### Medium
- Information disclosure
- Denial of service (DoS)
- Rate limiting bypass
- Insecure dependencies with known vulnerabilities

### Low
- Missing security headers
- Cookie security issues
- Open redirects (if exploitable)
- Low-impact information leakage

## Current Security Measures

WhyKnot.live implements several security best practices:

### Backend Security
- **Input Validation**: Zod schema validation on all inputs
- **Rate Limiting**: IP-based rate limiting on API endpoints
- **CORS**: Configurable Cross-Origin Resource Sharing
- **Security Headers**: HSTS, X-Frame-Options, X-Content-Type-Options
- **Database Security**: MongoDB parameterized queries prevent injection
- **Environment Variables**: Sensitive data in environment variables
- **Error Handling**: No sensitive information in error messages

### Frontend Security
- **Content Security Policy**: Strict CSP headers (planned)
- **HTTPS Only**: All production traffic over HTTPS
- **Sanitization**: User inputs sanitized before display
- **Secure Cookies**: HttpOnly and Secure flags on cookies (when implemented)

### Infrastructure Security
- **Regular Updates**: Dependencies updated regularly
- **Dependency Scanning**: Automated vulnerability scanning
- **Least Privilege**: Services run with minimal permissions
- **Monitoring**: Error tracking and security event logging

## Security Best Practices for Contributors

When contributing to WhyKnot, contributors should follow these guidelines:

### Code Security

```typescript
// DO: Validate all inputs
const schema = z.object({
 email: z.string().email()
});
const result = schema.safeParse(input);

// DO: Use parameterized queries
await db.collection('users').findOne({ email: userEmail });

// DON'T: Use string interpolation for queries
await db.collection('users').findOne(`{"email": "${userEmail}"}`);

// DO: Handle errors without exposing details
catch (error) {
 console.error(error); // Log internally
 return { error: 'server_error' }; // Generic message to user
}

// DON'T: Expose internal errors
catch (error) {
 return { error: error.message };
}
```

### Environment Variables

```typescript
// DO: Validate environment variables at startup
import { z } from 'zod';

const envSchema = z.object({
 MONGODB_URI: z.string().url(),
 MONGODB_DB: z.string().min(1)
});

export const validateEnv = () => {
 return envSchema.parse(process.env);
};

// DO: Use PUBLIC_ prefix for client-side variables
// frontend/.env
PUBLIC_API_BASE_URL=https://api.example.com

// DON'T: Expose sensitive data on client
SECRET_KEY=abc123 // Will be exposed in browser!
```

### Dependencies

```bash
# DO: Check for vulnerabilities regularly
npm audit

# DO: Update dependencies
npm update

# DO: Review dependency changes
npm outdated
```

## Out of Scope

The following are **not** considered vulnerabilities:

- Reports from automated tools without validation
- Denial of Service (DoS) attacks
- Social engineering attacks
- Physical attacks against WhyKnot infrastructure
- Issues requiring unlikely user interaction
- Issues in third-party applications or websites
- Theoretical vulnerabilities without proof of exploitability
- Issues that require physical access to a user's device
- Missing best practices without security impact
- Rate limiting on non-critical endpoints
- Reports about software version disclosure

## Recognition

We appreciate security researchers and contributors:

- **Hall of Fame**: Security researchers will be acknowledged in our [SECURITY.md](SECURITY.md)
- **Credit**: With your permission, we'll credit you in release notes
- **Swag**: Receive WhyKnot swag for valid high/critical findings (when available)

### Security Researcher Hall of Fame

*No vulnerabilities reported yet. Be the first!*

<!-- 
Template for future entries:
- **[Researcher Name](link)** - [Vulnerability Description] - [Date]
-->

## Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [MongoDB Security Checklist](https://docs.mongodb.com/manual/administration/security-checklist/)

## Security Updates

Security updates are released as soon as possible:

- **Critical**: Within 24-48 hours
- **High**: Within 1 week
- **Medium**: Next scheduled release
- **Low**: Future release

Subscribe to our [GitHub releases](https://github.com/jayptl-me/whyknot.live/releases) to stay informed.

## Contact

For security-related questions:

- **Security Reports**: Use GitHub Security Advisory or our contact form
- **General Questions**: Open a [discussion](https://github.com/jayptl-me/whyknot.live/discussions)
- **Other Inquiries**: [Contact us](https://whyknot.live/contact)

## Version Support

We actively support the following versions:

 Version Supported Notes 
 ------- ------------------ ------------------------- 
 main Yes Current development 
 0.1.x Yes Current stable release 
 < 0.1.0 No Pre-release versions 

---

<div align="center">
 <p> Security is everyone's responsibility</p>
 <p><strong>Thank you for helping keep WhyKnot and our users safe!</strong></p>
</div>
