# CSRF Protection Implementation

## Overview

This application implements comprehensive Cross-Site Request Forgery (CSRF) protection for all state-changing API endpoints. CSRF attacks occur when malicious websites trick a user's browser into making unauthorized requests using their existing session cookies.

## Protection Strategy

Our CSRF protection uses **Origin and Referer header validation**, which is effective because:

1. **Origin Header**: Automatically set by browsers for cross-origin requests and cannot be modified by malicious JavaScript
2. **Referer Header**: Fallback for same-origin requests where Origin might be null
3. **Content-Type Validation**: Additional protection for JSON requests

## Implementation Details

### Protected Endpoints

All state-changing endpoints are protected:

- `POST /api/plants` - Create new plant
- `PUT /api/plants/[id]` - Update plant
- `DELETE /api/plants/[id]` - Delete plant
- `POST /api/plants/[id]/water` - Record watering
- `POST /api/upload` - Upload images
- `POST /api/analyze` - Analyze plant health
- `POST /api/identify` - Identify plant species
- `POST /api/auth/register` - User registration

### CSRF Utility Functions

Located in `/src/lib/csrf.ts`:

- `validateCSRF()` - Core validation logic
- `csrfProtection()` - Middleware for API routes
- `enhancedCSRFProtection()` - Additional Content-Type validation

### Configuration

Set allowed origins in your environment variables:

```bash
# Development
ALLOWED_ORIGINS="http://localhost:3000,https://localhost:3000,http://127.0.0.1:3000"

# Production
ALLOWED_ORIGINS="https://yourdomain.com,https://www.yourdomain.com"
```

## Security Benefits

1. **Prevents unauthorized state changes** from malicious websites
2. **Protects user data** from modification attacks
3. **Maintains session integrity** across the application
4. **Complements other security measures** like authentication

## Browser Compatibility

This implementation works across all modern browsers as it relies on standard HTTP headers that browsers automatically include in requests.

## Monitoring

CSRF validation failures are logged with details including:
- HTTP method
- Origin header
- Referer header
- User agent
- Timestamp

Monitor these logs to detect potential attack attempts.

## Additional Security Considerations

This CSRF protection should be used alongside:

- **Secure session cookies** (HttpOnly, Secure, SameSite)
- **Strong authentication**
- **Input validation**
- **Rate limiting**
- **HTTPS in production**

## Testing

The implementation allows legitimate requests from configured origins while blocking potentially malicious cross-origin requests. Test with:

1. Normal application usage (should work)
2. Requests from different origins (should be blocked)
3. Missing Origin/Referer headers (should be blocked)
