import { NextRequest, NextResponse } from 'next/server'

/**
 * Rate Limiting Utility
 * 
 * Provides rate limiting capabilities for different types of operations:
 * - Per-IP rate limiting for anonymous requests
 * - Per-user rate limiting for authenticated requests  
 * - Account lockout for repeated authentication failures
 * - Configurable time windows and limits
 * 
 * In production, replace this in-memory store with Redis for scalability
 */

interface RateLimitRule {
  windowMs: number     // Time window in milliseconds
  maxRequests: number  // Maximum requests per window
  blockDurationMs?: number // How long to block after limit exceeded
}

interface RateLimitEntry {
  count: number
  windowStart: number
  blockedUntil?: number
}

interface AccountLockoutEntry {
  failedAttempts: number
  lastFailure: number
  lockedUntil?: number
}

// In-memory stores (use Redis in production)
const rateLimitStore = new Map<string, RateLimitEntry>()
const accountLockoutStore = new Map<string, AccountLockoutEntry>()

// Rate limit configurations
const RATE_LIMIT_RULES = {
  // Authentication endpoints
  LOGIN: {
    windowMs: 15 * 60 * 1000,    // 15 minutes
    maxRequests: 5,               // 5 login attempts per IP per 15 min
    blockDurationMs: 15 * 60 * 1000 // Block for 15 minutes
  },
  REGISTRATION: {
    windowMs: 60 * 60 * 1000,    // 1 hour  
    maxRequests: 3,               // 3 registrations per IP per hour
    blockDurationMs: 60 * 60 * 1000 // Block for 1 hour
  },
  
  // AI/expensive endpoints
  AI_ANALYZE: {
    windowMs: 60 * 1000,         // 1 minute
    maxRequests: 10,              // 10 requests per minute per user
    blockDurationMs: 5 * 60 * 1000 // Block for 5 minutes
  },
  AI_IDENTIFY: {
    windowMs: 60 * 1000,         // 1 minute  
    maxRequests: 5,               // 5 requests per minute per user
    blockDurationMs: 5 * 60 * 1000 // Block for 5 minutes
  },
  
  // General API endpoints
  GENERAL: {
    windowMs: 60 * 1000,         // 1 minute
    maxRequests: 60,              // 60 requests per minute per IP
    blockDurationMs: 60 * 1000   // Block for 1 minute
  }
} as const

// Account lockout configuration
const ACCOUNT_LOCKOUT_CONFIG = {
  maxFailedAttempts: 5,
  lockoutDurationMs: 30 * 60 * 1000,  // 30 minutes
  failureWindowMs: 15 * 60 * 1000     // Reset counter after 15 minutes of no failures
}

export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const real = request.headers.get('x-real-ip')
  const connectingIP = request.headers.get('x-connecting-ip')
  
  // Try various header sources for IP
  const ip = forwarded?.split(',')[0]?.trim() || 
            real || 
            connectingIP || 
            'unknown'
  
  return ip
}

export function getRateLimitKey(type: 'ip' | 'user', identifier: string, rule: string): string {
  return `${type}:${rule}:${identifier}`
}

export function isRateLimited(key: string, rule: RateLimitRule): { 
  limited: boolean
  resetTime?: number
  remaining?: number
} {
  const now = Date.now()
  const entry = rateLimitStore.get(key)
  
  // No previous entry - allow request
  if (!entry) {
    rateLimitStore.set(key, {
      count: 1,
      windowStart: now
    })
    return { limited: false, remaining: rule.maxRequests - 1 }
  }
  
  // Check if currently blocked
  if (entry.blockedUntil && now < entry.blockedUntil) {
    return { 
      limited: true, 
      resetTime: entry.blockedUntil 
    }
  }
  
  // Check if window has expired
  if (now - entry.windowStart > rule.windowMs) {
    // Reset window
    rateLimitStore.set(key, {
      count: 1,
      windowStart: now
    })
    return { limited: false, remaining: rule.maxRequests - 1 }
  }
  
  // Increment counter
  entry.count++
  
  // Check if limit exceeded
  if (entry.count > rule.maxRequests) {
    if (rule.blockDurationMs) {
      entry.blockedUntil = now + rule.blockDurationMs
    }
    return { 
      limited: true, 
      resetTime: entry.blockedUntil || (entry.windowStart + rule.windowMs)
    }
  }
  
  return { 
    limited: false, 
    remaining: rule.maxRequests - entry.count 
  }
}

export function recordFailedLogin(email: string): { 
  locked: boolean
  lockedUntil?: number
  attemptsRemaining?: number
} {
  const now = Date.now()
  const entry = accountLockoutStore.get(email) || {
    failedAttempts: 0,
    lastFailure: 0
  }
  
  // Reset counter if enough time has passed
  if (now - entry.lastFailure > ACCOUNT_LOCKOUT_CONFIG.failureWindowMs) {
    entry.failedAttempts = 0
  }
  
  entry.failedAttempts++
  entry.lastFailure = now
  
  // Check if account should be locked
  if (entry.failedAttempts >= ACCOUNT_LOCKOUT_CONFIG.maxFailedAttempts) {
    entry.lockedUntil = now + ACCOUNT_LOCKOUT_CONFIG.lockoutDurationMs
    accountLockoutStore.set(email, entry)
    return { 
      locked: true, 
      lockedUntil: entry.lockedUntil 
    }
  }
  
  accountLockoutStore.set(email, entry)
  return { 
    locked: false, 
    attemptsRemaining: ACCOUNT_LOCKOUT_CONFIG.maxFailedAttempts - entry.failedAttempts 
  }
}

export function isAccountLocked(email: string): { 
  locked: boolean
  lockedUntil?: number
} {
  const entry = accountLockoutStore.get(email)
  if (!entry || !entry.lockedUntil) {
    return { locked: false }
  }
  
  const now = Date.now()
  if (now >= entry.lockedUntil) {
    // Lockout expired - clean up
    entry.lockedUntil = undefined
    entry.failedAttempts = 0
    accountLockoutStore.set(email, entry)
    return { locked: false }
  }
  
  return { 
    locked: true, 
    lockedUntil: entry.lockedUntil 
  }
}

export function clearFailedLogins(email: string): void {
  const entry = accountLockoutStore.get(email)
  if (entry) {
    entry.failedAttempts = 0
    entry.lockedUntil = undefined
    accountLockoutStore.set(email, entry)
  }
}

export function createRateLimitResponse(
  resetTime?: number,
  message: string = 'Too many requests'
): NextResponse {
  const headers: Record<string, string> = {
    'Retry-After': resetTime ? Math.ceil((resetTime - Date.now()) / 1000).toString() : '60'
  }
  
  if (resetTime) {
    headers['X-RateLimit-Reset'] = new Date(resetTime).toISOString()
  }
  
  return NextResponse.json(
    { error: message },
    { status: 429, headers }
  )
}

// Middleware function for easy integration
export function rateLimitMiddleware(
  ruleName: keyof typeof RATE_LIMIT_RULES,
  identifier: string,
  type: 'ip' | 'user' = 'ip'
): { limited: boolean, response?: NextResponse } {
  const rule = RATE_LIMIT_RULES[ruleName]
  const key = getRateLimitKey(type, identifier, ruleName)
  const result = isRateLimited(key, rule)
  
  if (result.limited) {
    const message = type === 'user' 
      ? 'Too many requests from your account. Please try again later.'
      : 'Too many requests from your IP address. Please try again later.'
    
    return {
      limited: true,
      response: createRateLimitResponse(result.resetTime, message)
    }
  }
  
  return { limited: false }
}

// Cleanup function to prevent memory leaks
export function cleanupExpiredEntries(): void {
  const now = Date.now()
  
  // Clean up rate limit store
  for (const [key, entry] of rateLimitStore.entries()) {
    const isExpired = entry.blockedUntil 
      ? now > entry.blockedUntil
      : now - entry.windowStart > 24 * 60 * 60 * 1000 // 24 hours
    
    if (isExpired) {
      rateLimitStore.delete(key)
    }
  }
  
  // Clean up account lockout store
  for (const [email, entry] of accountLockoutStore.entries()) {
    const isExpired = entry.lockedUntil 
      ? now > entry.lockedUntil
      : now - entry.lastFailure > 24 * 60 * 60 * 1000 // 24 hours
    
    if (isExpired) {
      accountLockoutStore.delete(email)
    }
  }
}

// Auto-cleanup every hour (only in production)
if (process.env.NODE_ENV === 'production') {
  setInterval(cleanupExpiredEntries, 60 * 60 * 1000)
}

export { RATE_LIMIT_RULES }
