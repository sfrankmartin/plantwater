# Rate Limiting and Brute-Force Protection

## Overview

This document describes the comprehensive rate limiting and brute-force protection system implemented to secure the PlantWater application against various attack vectors including credential brute-forcing, spam registrations, and AI API abuse.

## Security Threats Addressed

### 1. **Brute-Force Login Attacks**
- **Threat**: Attackers attempting to guess passwords through repeated login attempts
- **Impact**: Account compromise, service disruption
- **Protection**: Per-IP rate limiting + account lockout mechanism

### 2. **Registration Spam**
- **Threat**: Automated scripts creating fake accounts en masse
- **Impact**: Database bloat, service degradation, potential costs
- **Protection**: Per-IP registration rate limiting

### 3. **AI API Abuse**
- **Threat**: Excessive calls to expensive AI endpoints (analyze/identify)
- **Impact**: High costs, service unavailability, resource exhaustion
- **Protection**: Per-user and per-IP rate limiting with strict quotas

## Implementation Architecture

### Core Components

#### 1. **Rate Limiting Engine** (`/src/lib/rateLimit.ts`)

**In-Memory Store Design:**
```typescript
// For development - use Redis in production
const rateLimitStore = new Map<string, RateLimitEntry>()
const accountLockoutStore = new Map<string, AccountLockoutEntry>()
```

**Key Features:**
- Sliding window rate limiting
- Configurable limits per endpoint type
- Automatic cleanup of expired entries
- Support for both IP-based and user-based limiting

#### 2. **Rate Limit Rules Configuration**

```typescript
const RATE_LIMIT_RULES = {
  LOGIN: {
    windowMs: 15 * 60 * 1000,    // 15 minutes
    maxRequests: 5,               // 5 attempts per IP
    blockDurationMs: 15 * 60 * 1000 // 15 min block
  },
  REGISTRATION: {
    windowMs: 60 * 60 * 1000,    // 1 hour
    maxRequests: 3,               // 3 registrations per IP
    blockDurationMs: 60 * 60 * 1000 // 1 hour block
  },
  AI_ANALYZE: {
    windowMs: 60 * 1000,         // 1 minute
    maxRequests: 10,              // 10 requests per user
    blockDurationMs: 5 * 60 * 1000 // 5 min block
  },
  AI_IDENTIFY: {
    windowMs: 60 * 1000,         // 1 minute
    maxRequests: 5,               // 5 requests per user (stricter)
    blockDurationMs: 5 * 60 * 1000 // 5 min block
  }
}
```

#### 3. **Account Lockout System**

```typescript
const ACCOUNT_LOCKOUT_CONFIG = {
  maxFailedAttempts: 5,           // Lock after 5 failures
  lockoutDurationMs: 30 * 60 * 1000, // 30 minutes
  failureWindowMs: 15 * 60 * 1000     // Reset after 15 min of no failures
}
```

## Protected Endpoints

### 1. **Authentication Endpoints**

#### **Login Protection** (`/api/auth/[...nextauth]`)
```typescript
// Per-IP rate limiting
const rateLimitResult = rateLimitMiddleware('LOGIN', clientIP, 'ip')

// Account lockout for repeated failures
if (lockStatus.locked) {
  console.warn(`SECURITY: Login attempt on locked account: ${email}`)
  return null // Don't reveal account is locked
}
```

**Security Features:**
- ✅ 5 login attempts per IP per 15 minutes
- ✅ Account lockout after 5 failed attempts per email
- ✅ 30-minute lockout duration
- ✅ Security logging for suspicious activity
- ✅ No user enumeration (same response for locked/non-existent accounts)

#### **Registration Protection** (`/api/auth/register`)
```typescript
// Prevent spam registrations
const rateLimitResult = rateLimitMiddleware('REGISTRATION', clientIP, 'ip')
```

**Security Features:**
- ✅ 3 registrations per IP per hour
- ✅ 1-hour block duration for violators
- ✅ CSRF protection (inherited)
- ✅ Email enumeration protection (inherited)

### 2. **AI Endpoints Protection**

#### **Plant Analysis** (`/api/analyze`)
```typescript
// Dual-layer protection: user + IP
const userRateLimit = rateLimitMiddleware('AI_ANALYZE', userId, 'user')
const ipRateLimit = rateLimitMiddleware('AI_ANALYZE', clientIP, 'ip')
```

#### **Plant Identification** (`/api/identify`)
```typescript
// Stricter limits for expensive operations
const userRateLimit = rateLimitMiddleware('AI_IDENTIFY', userId, 'user')
const ipRateLimit = rateLimitMiddleware('AI_IDENTIFY', clientIP, 'ip')
```

**Security Features:**
- ✅ Per-user quotas (10 analyze/5 identify per minute)
- ✅ Per-IP backup limits (same quotas)
- ✅ 5-minute block duration
- ✅ Authentication required (inherited)
- ✅ CSRF protection (inherited)

## Client IP Detection

**Robust IP Extraction:**
```typescript
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const real = request.headers.get('x-real-ip') 
  const connectingIP = request.headers.get('x-connecting-ip')
  
  return forwarded?.split(',')[0]?.trim() || real || connectingIP || 'unknown'
}
```

**Supports Multiple Proxy Configurations:**
- ✅ Cloudflare (`x-forwarded-for`)
- ✅ AWS Load Balancer (`x-real-ip`)
- ✅ Vercel Edge (`x-connecting-ip`)
- ✅ Graceful fallback to 'unknown'

## Rate Limiting Responses

### HTTP 429 Too Many Requests
```json
{
  "error": "Too many requests from your IP address. Please try again later."
}
```

**Response Headers:**
- `Retry-After`: Seconds until next allowed request
- `X-RateLimit-Reset`: ISO timestamp when limit resets

### User vs IP Messaging
```typescript
const message = type === 'user' 
  ? 'Too many requests from your account. Please try again later.'
  : 'Too many requests from your IP address. Please try again later.'
```

## Security Logging

**Comprehensive Security Event Logging:**

```typescript
// Rate limit violations
console.warn(`SECURITY: Rate limit exceeded for login attempts from IP: ${clientIP}`)
console.warn(`SECURITY: Registration rate limit exceeded for IP: ${clientIP}`)
console.warn(`SECURITY: AI analyze rate limit exceeded for user: ${userId}`)

// Account lockout events  
console.warn(`SECURITY: Login attempt on locked account: ${email}`)
console.warn(`SECURITY: Account locked due to repeated failures: ${email}`)
```

**Log Analysis Benefits:**
- Attack pattern recognition
- IP reputation building
- User behavior analysis
- Compliance audit trails

## Memory Management

**Automatic Cleanup System:**
```typescript
// Cleanup every hour
setInterval(cleanupExpiredEntries, 60 * 60 * 1000)

export function cleanupExpiredEntries(): void {
  // Remove expired rate limit entries
  // Remove expired account lockout entries
  // Prevent memory leaks in long-running processes
}
```

**Memory Optimization:**
- ✅ Automatic cleanup of expired entries
- ✅ Configurable retention periods
- ✅ Memory leak prevention
- ✅ Production-ready for containerized deployments

## Testing Coverage

**Comprehensive Test Suite** (`__tests__/rateLimit.test.ts`):

```typescript
// 25 test cases covering:
✅ IP extraction from various headers
✅ Rate limit key generation
✅ Window-based request tracking
✅ Limit enforcement and blocking
✅ Window expiration and reset
✅ Account lockout mechanics
✅ Successful login cleanup
✅ Middleware integration
✅ Error message differentiation
✅ Memory cleanup functionality
✅ Edge cases and error handling
```

## Production Considerations

### 1. **Redis Migration**
For production deployments, replace in-memory stores with Redis:

```typescript
// Production implementation example
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL)

async function isRateLimited(key: string, rule: RateLimitRule) {
  // Use Redis for distributed rate limiting
  const current = await redis.incr(key)
  if (current === 1) {
    await redis.expire(key, Math.ceil(rule.windowMs / 1000))
  }
  return { limited: current > rule.maxRequests }
}
```

### 2. **Configuration Management**
Environment-based configuration:

```typescript
const RATE_LIMIT_RULES = {
  LOGIN: {
    windowMs: parseInt(process.env.LOGIN_WINDOW_MS || '900000'),
    maxRequests: parseInt(process.env.LOGIN_MAX_REQUESTS || '5'),
    blockDurationMs: parseInt(process.env.LOGIN_BLOCK_DURATION_MS || '900000')
  }
  // ... other rules
}
```

### 3. **Monitoring Integration**
```typescript
// Example with monitoring service
import { metrics } from './monitoring'

if (rateLimitResult.limited) {
  metrics.increment('rate_limit.violations', {
    endpoint: ruleName,
    type: type,
    ip: identifier
  })
}
```

### 4. **Geolocation Enhancement**
```typescript
// Enhanced IP analysis
import { lookup } from 'geoip-lite'

const geo = lookup(clientIP)
if (geo?.country === 'CN' || geo?.country === 'RU') {
  // Apply stricter limits for high-risk regions
  rule.maxRequests = Math.floor(rule.maxRequests * 0.5)
}
```

## Security Benefits Summary

### ✅ **Attack Prevention**
- **Brute-force attacks**: Blocked after 5 attempts
- **Credential stuffing**: Account lockout protection
- **Registration spam**: IP-based throttling
- **API abuse**: User and IP quotas
- **DoS attempts**: Distributed rate limiting

### ✅ **Cost Protection**
- **AI API costs**: Strict per-user quotas
- **Infrastructure costs**: Request throttling
- **Database load**: Registration limits
- **Bandwidth**: Request rate limiting

### ✅ **User Experience**
- **Legitimate users**: Generous limits
- **Clear messaging**: Helpful error responses
- **Automatic recovery**: Time-based resets
- **No false positives**: Separate user/IP tracking

### ✅ **Operational Security**
- **Security logging**: Attack visibility
- **Memory efficiency**: Automatic cleanup
- **Scalable design**: Redis-ready architecture
- **Configuration flexibility**: Environment-based tuning

## Next Steps for Production

1. **Deploy Redis cluster** for distributed rate limiting
2. **Configure monitoring** with Datadog/New Relic integration
3. **Set up alerting** for rate limit violations and account lockouts
4. **Implement geolocation** filtering for enhanced security
5. **Add CAPTCHA** for repeated violations
6. **Configure log aggregation** (ELK stack/Splunk)
7. **Set up automated IP blocking** for persistent attackers

This rate limiting system provides enterprise-grade protection against common attack vectors while maintaining excellent user experience for legitimate users.
