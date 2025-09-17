/**
 * DoS Protection Middleware
 * 
 * Protects against:
 * - Request flooding (rate limiting)
 * - Large payload attacks (size limits)
 * - Slow loris attacks (timeout protection)
 * - Resource exhaustion (concurrent request limits)
 * - Malformed request detection
 */

import { NextRequest, NextResponse } from 'next/server'
import { redisRateLimiter, RATE_LIMIT_RULES } from './redisRateLimit'

interface DoSProtectionConfig {
  enabled: boolean
  maxRequestSize: number // bytes
  maxConcurrentRequests: number
  requestTimeout: number // ms
  suspiciousPatternDetection: boolean
}

interface RequestMetrics {
  startTime: number
  size: number
  ip: string
  userAgent?: string
  path: string
}

class DoSProtectionService {
  private config: DoSProtectionConfig
  private activeRequests = new Map<string, RequestMetrics>()
  private suspiciousIPs = new Set<string>()
  private requestCounts = new Map<string, number>()

  constructor() {
    this.config = {
      enabled: process.env.NODE_ENV === 'production',
      maxRequestSize: 10 * 1024 * 1024, // 10MB
      maxConcurrentRequests: 50,
      requestTimeout: 30000, // 30 seconds
      suspiciousPatternDetection: true
    }

    // Clean up stale requests every minute
    setInterval(() => this.cleanupStaleRequests(), 60000)
  }

  /**
   * Main DoS protection middleware
   */
  async protect(request: NextRequest): Promise<NextResponse | null> {
    if (!this.config.enabled) {
      return null
    }

    const ip = this.getClientIP(request)
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const path = request.nextUrl.pathname
    const requestId = `${ip}-${Date.now()}-${Math.random()}`

    try {
      // 1. Check if IP is temporarily blocked
      if (this.suspiciousIPs.has(ip)) {
        console.warn(`SECURITY: Blocked request from suspicious IP: ${ip}`)
        return new NextResponse('Request blocked', { status: 429 })
      }

      // 2. Request size protection
      const sizeCheck = await this.checkRequestSize(request)
      if (!sizeCheck.allowed) {
        console.warn(`SECURITY: Oversized request from ${ip}: ${sizeCheck.size} bytes`)
        return new NextResponse('Request too large', { status: 413 })
      }

      // 3. Concurrent request limit
      const concurrentCheck = this.checkConcurrentRequests(ip)
      if (!concurrentCheck) {
        console.warn(`SECURITY: Too many concurrent requests from ${ip}`)
        return new NextResponse('Too many concurrent requests', { status: 429 })
      }

      // 4. Rate limiting based on endpoint type
      const rateLimitCheck = await this.checkRateLimit(request, ip)
      if (!rateLimitCheck.allowed) {
        console.warn(`SECURITY: Rate limit exceeded for ${ip} on ${path}`)
        return new NextResponse('Rate limit exceeded', {
          status: 429,
          headers: {
            'Retry-After': Math.ceil(rateLimitCheck.retryAfter / 1000).toString(),
            'X-RateLimit-Remaining': rateLimitCheck.remaining.toString()
          }
        })
      }

      // 5. Suspicious pattern detection
      if (this.config.suspiciousPatternDetection) {
        const suspiciousCheck = this.detectSuspiciousPatterns(request, ip, userAgent)
        if (suspiciousCheck.suspicious) {
          console.warn(`SECURITY: Suspicious pattern detected from ${ip}: ${suspiciousCheck.reason}`)
          this.markIPSuspicious(ip)
          return new NextResponse('Request blocked', { status: 429 })
        }
      }

      // Track active request
      this.activeRequests.set(requestId, {
        startTime: Date.now(),
        size: sizeCheck.size,
        ip,
        userAgent,
        path
      })

      // Set up request cleanup
      setTimeout(() => {
        this.activeRequests.delete(requestId)
      }, this.config.requestTimeout)

      return null // Allow request to proceed

    } catch (error) {
      console.error('DoS protection error:', error)
      // Fail open - allow request but log the error
      return null
    }
  }

  /**
   * Get client IP address with proxy support
   */
  private getClientIP(request: NextRequest): string {
    // Check various headers for real IP (handle proxies/CDNs)
    const xForwardedFor = request.headers.get('x-forwarded-for')
    const xRealIP = request.headers.get('x-real-ip')
    const cfConnectingIP = request.headers.get('cf-connecting-ip')
    
    if (cfConnectingIP) return cfConnectingIP
    if (xRealIP) return xRealIP
    if (xForwardedFor) {
      // X-Forwarded-For can contain multiple IPs, take the first
      return xForwardedFor.split(',')[0].trim()
    }
    
    // Fallback to a synthetic identifier if no IP headers are available
    return request.headers.get('host') || 'unknown'
  }

  /**
   * Check request size to prevent large payload attacks
   */
  private async checkRequestSize(request: NextRequest): Promise<{ allowed: boolean; size: number }> {
    try {
      const contentLength = request.headers.get('content-length')
      
      if (contentLength) {
        const size = parseInt(contentLength, 10)
        return {
          allowed: size <= this.config.maxRequestSize,
          size
        }
      }

      // For requests without content-length, we need to be more careful
      // This is a simple approximation - in production you might want more sophisticated handling
      return { allowed: true, size: 0 }
      
    } catch (error) {
      console.error('Error checking request size:', error)
      return { allowed: true, size: 0 }
    }
  }

  /**
   * Check concurrent request limits per IP
   */
  private checkConcurrentRequests(ip: string): boolean {
    const activeForIP = Array.from(this.activeRequests.values())
      .filter(req => req.ip === ip).length
    
    return activeForIP < this.config.maxConcurrentRequests
  }

  /**
   * Apply rate limiting based on endpoint type
   */
  private async checkRateLimit(request: NextRequest, ip: string): Promise<{ allowed: boolean; retryAfter: number; remaining: number }> {
    const path = request.nextUrl.pathname
    let rule = RATE_LIMIT_RULES.general

    // Select appropriate rate limit rule based on endpoint
    if (path.includes('/auth/')) {
      rule = RATE_LIMIT_RULES.auth
    } else if (path.includes('/upload')) {
      rule = RATE_LIMIT_RULES.upload
    } else if (path.includes('/analyze') || path.includes('/identify')) {
      rule = RATE_LIMIT_RULES.ai
    }

    const result = await redisRateLimiter.checkRateLimit(ip, rule, 'dos')
    
    return {
      allowed: result.success,
      retryAfter: result.resetTime - Date.now(),
      remaining: result.remainingRequests
    }
  }

  /**
   * Detect suspicious request patterns
   */
  private detectSuspiciousPatterns(
    request: NextRequest, 
    ip: string, 
    userAgent: string
  ): { suspicious: boolean; reason?: string } {
    
    // 1. Check for bot-like user agents
    const suspiciousAgents = [
      'python', 'curl', 'wget', 'libwww', 'lwp', 'scanner', 'bot', 'crawler'
    ]
    
    const lowerAgent = userAgent.toLowerCase()
    if (suspiciousAgents.some(agent => lowerAgent.includes(agent))) {
      return { suspicious: true, reason: 'Suspicious user agent' }
    }

    // 2. Check for rapid sequential requests (potential script)
    const currentCount = this.requestCounts.get(ip) || 0
    this.requestCounts.set(ip, currentCount + 1)
    
    // Reset counter after 1 minute
    setTimeout(() => {
      const count = this.requestCounts.get(ip) || 0
      if (count > 0) {
        this.requestCounts.set(ip, count - 1)
      }
    }, 60000)

    if (currentCount > 20) { // More than 20 requests per minute
      return { suspicious: true, reason: 'High request frequency' }
    }

    // 3. Check for malformed or suspicious headers
    const contentType = request.headers.get('content-type')
    if (contentType && contentType.includes('../../')) {
      return { suspicious: true, reason: 'Malformed content-type header' }
    }

    // 4. Check for path traversal attempts in URL
    const path = request.nextUrl.pathname
    if (path.includes('../') || path.includes('..\\')) {
      return { suspicious: true, reason: 'Path traversal attempt' }
    }

    return { suspicious: false }
  }

  /**
   * Mark IP as suspicious for temporary blocking
   */
  private markIPSuspicious(ip: string): void {
    this.suspiciousIPs.add(ip)
    
    // Remove from suspicious list after 30 minutes
    setTimeout(() => {
      this.suspiciousIPs.delete(ip)
    }, 30 * 60 * 1000)
  }

  /**
   * Clean up stale request tracking
   */
  private cleanupStaleRequests(): void {
    const now = Date.now()
    const staleThreshold = this.config.requestTimeout
    
    for (const [id, request] of this.activeRequests.entries()) {
      if (now - request.startTime > staleThreshold) {
        this.activeRequests.delete(id)
      }
    }
  }

  /**
   * Get current protection statistics
   */
  getStats(): {
    activeRequests: number
    suspiciousIPs: number
    isRedisConnected: boolean
  } {
    return {
      activeRequests: this.activeRequests.size,
      suspiciousIPs: this.suspiciousIPs.size,
      isRedisConnected: redisRateLimiter.isRedisConnected()
    }
  }
}

// Singleton instance
export const dosProtection = new DoSProtectionService()

/**
 * Middleware function to be used in API routes
 */
export async function withDoSProtection(
  request: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse> | NextResponse
): Promise<NextResponse> {
  // Apply DoS protection
  const protectionResult = await dosProtection.protect(request)
  
  if (protectionResult) {
    // Request was blocked
    return protectionResult
  }
  
  // Request is allowed, proceed with handler
  try {
    return await handler(request)
  } catch (error) {
    console.error('Request handler error:', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}

/**
 * Rate limiting function for specific use cases
 */
export async function applyRateLimit(
  identifier: string,
  rule: { windowMs: number; maxRequests: number },
  errorMessage = 'Rate limit exceeded'
): Promise<NextResponse | null> {
  const result = await redisRateLimiter.checkRateLimit(identifier, rule)
  
  if (!result.success) {
    return new NextResponse(errorMessage, {
      status: 429,
      headers: {
        'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
        'X-RateLimit-Remaining': result.remainingRequests.toString()
      }
    })
  }
  
  return null
}
