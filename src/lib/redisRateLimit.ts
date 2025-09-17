/**
 * Production-ready Redis rate limiting implementation
 * 
 * Features:
 * - Distributed rate limiting across multiple servers
 * - Atomic operations for accuracy
 * - Sliding window counters
 * - Configurable TTL and cleanup
 * - Fallback to in-memory for development
 */

import Redis from 'ioredis'

interface RateLimitRule {
  windowMs: number
  maxRequests: number
}

interface RateLimitResult {
  success: boolean
  totalCount: number
  remainingRequests: number
  resetTime: number
}

interface LockResult {
  locked: boolean
  remainingTime?: number
}

class RedisRateLimiter {
  private redis: Redis | null = null
  private fallbackStore = new Map<string, { count: number; resetTime: number }>()
  private lockStore = new Map<string, { lockTime: number; failures: number }>()

  constructor() {
    // Initialize Redis only if URL is provided
    if (process.env.REDIS_URL) {
      try {
        this.redis = new Redis(process.env.REDIS_URL)

        this.redis.on('error', (err: Error) => {
          console.error('Redis connection error:', err)
          // Continue with in-memory fallback
        })

        this.redis.on('connect', () => {
          console.log('Redis rate limiter connected')
        })
      } catch (error) {
        console.error('Failed to initialize Redis:', error)
        console.log('Falling back to in-memory rate limiting')
      }
    }
  }

  /**
   * Check rate limit using Redis sliding window counter
   */
  async checkRateLimit(
    identifier: string,
    rule: RateLimitRule,
    prefix = 'rl'
  ): Promise<RateLimitResult> {
    const key = `${prefix}:${identifier}`
    const now = Date.now()
    const windowStart = now - rule.windowMs
    
    if (this.redis) {
      try {
        // Use Redis sorted set for sliding window
        const pipe = this.redis.pipeline()
        
        // Remove expired entries
        pipe.zremrangebyscore(key, 0, windowStart)
        
        // Add current request
        pipe.zadd(key, now, `${now}-${Math.random()}`)
        
        // Count current requests in window
        pipe.zcard(key)
        
        // Set expiration
        pipe.expire(key, Math.ceil(rule.windowMs / 1000))
        
        const results = await pipe.exec()
        
        if (!results) {
          throw new Error('Redis pipeline failed')
        }
        
        const totalCount = results[2]?.[1] as number || 0
        const success = totalCount <= rule.maxRequests
        
        return {
          success,
          totalCount,
          remainingRequests: Math.max(0, rule.maxRequests - totalCount),
          resetTime: now + rule.windowMs
        }
      } catch (error) {
        console.error('Redis rate limit check failed:', error)
        // Fall through to in-memory implementation
      }
    }

    // Fallback to in-memory rate limiting
    return this.checkRateLimitMemory(identifier, rule, prefix)
  }

  /**
   * In-memory fallback rate limiting
   */
  private checkRateLimitMemory(
    identifier: string,
    rule: RateLimitRule,
    prefix: string
  ): RateLimitResult {
    const key = `${prefix}:${identifier}`
    const now = Date.now()
    const record = this.fallbackStore.get(key)

    if (!record || now > record.resetTime) {
      // New window
      this.fallbackStore.set(key, { count: 1, resetTime: now + rule.windowMs })
      return {
        success: true,
        totalCount: 1,
        remainingRequests: rule.maxRequests - 1,
        resetTime: now + rule.windowMs
      }
    }

    record.count++
    const success = record.count <= rule.maxRequests

    return {
      success,
      totalCount: record.count,
      remainingRequests: Math.max(0, rule.maxRequests - record.count),
      resetTime: record.resetTime
    }
  }

  /**
   * Check if an account is locked due to failed login attempts
   */
  async isAccountLocked(email: string): Promise<LockResult> {
    const key = `lock:${email}`
    
    if (this.redis) {
      try {
        const lockData = await this.redis.hgetall(key)
        
        if (lockData.lockTime) {
          const lockTime = parseInt(lockData.lockTime)
          const lockDuration = 15 * 60 * 1000 // 15 minutes
          
          if (Date.now() < lockTime + lockDuration) {
            return {
              locked: true,
              remainingTime: (lockTime + lockDuration) - Date.now()
            }
          }
          
          // Lock expired, clean up
          await this.redis.del(key)
        }
        
        return { locked: false }
      } catch (error) {
        console.error('Redis lock check failed:', error)
        // Fall through to memory implementation
      }
    }

    // Fallback to in-memory
    const lockData = this.lockStore.get(email)
    if (lockData) {
      const lockDuration = 15 * 60 * 1000 // 15 minutes
      
      if (Date.now() < lockData.lockTime + lockDuration) {
        return {
          locked: true,
          remainingTime: (lockData.lockTime + lockDuration) - Date.now()
        }
      }
      
      // Lock expired
      this.lockStore.delete(email)
    }

    return { locked: false }
  }

  /**
   * Record a failed login attempt
   */
  async recordFailedLogin(email: string): Promise<LockResult> {
    const key = `lock:${email}`
    const maxAttempts = 5
    const lockDuration = 15 * 60 * 1000 // 15 minutes
    
    if (this.redis) {
      try {
        const pipe = this.redis.pipeline()
        pipe.hincrby(key, 'failures', 1)
        pipe.hget(key, 'failures')
        pipe.expire(key, Math.ceil(lockDuration / 1000))
        
        const results = await pipe.exec()
        const failures = parseInt(results?.[1]?.[1] as string || '0')
        
        if (failures >= maxAttempts) {
          await this.redis.hset(key, 'lockTime', Date.now())
          return {
            locked: true,
            remainingTime: lockDuration
          }
        }
        
        return { locked: false }
      } catch (error) {
        console.error('Redis failed login recording failed:', error)
        // Fall through to memory implementation
      }
    }

    // Fallback to in-memory
    const lockData = this.lockStore.get(email) || { lockTime: 0, failures: 0 }
    lockData.failures++
    
    if (lockData.failures >= maxAttempts) {
      lockData.lockTime = Date.now()
      this.lockStore.set(email, lockData)
      return {
        locked: true,
        remainingTime: lockDuration
      }
    }
    
    this.lockStore.set(email, lockData)
    return { locked: false }
  }

  /**
   * Clear failed login attempts for successful login
   */
  async clearFailedLogins(email: string): Promise<void> {
    const key = `lock:${email}`
    
    if (this.redis) {
      try {
        await this.redis.del(key)
        return
      } catch (error) {
        console.error('Redis clear failed logins failed:', error)
        // Fall through to memory implementation
      }
    }

    // Fallback to in-memory
    this.lockStore.delete(email)
  }

  /**
   * Clean up expired entries (for in-memory fallback)
   */
  cleanup(): void {
    const now = Date.now()
    
    // Clean up rate limit entries
    for (const [key, record] of this.fallbackStore.entries()) {
      if (now > record.resetTime) {
        this.fallbackStore.delete(key)
      }
    }
    
    // Clean up lock entries
    const lockDuration = 15 * 60 * 1000
    for (const [email, lockData] of this.lockStore.entries()) {
      if (now > lockData.lockTime + lockDuration) {
        this.lockStore.delete(email)
      }
    }
  }

  /**
   * Get Redis connection status
   */
  isRedisConnected(): boolean {
    return this.redis?.status === 'ready'
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit()
    }
  }
}

// Singleton instance
export const redisRateLimiter = new RedisRateLimiter()

// Rate limiting rules
export const RATE_LIMIT_RULES = {
  // General API requests per IP
  general: { windowMs: 15 * 60 * 1000, maxRequests: 100 }, // 100 requests per 15 minutes
  
  // Authentication endpoints
  auth: { windowMs: 15 * 60 * 1000, maxRequests: 5 }, // 5 attempts per 15 minutes
  
  // Image upload endpoints
  upload: { windowMs: 60 * 60 * 1000, maxRequests: 20 }, // 20 uploads per hour
  
  // AI analysis endpoints (more restrictive)
  ai: { windowMs: 60 * 60 * 1000, maxRequests: 10 } // 10 AI requests per hour
}

// Export convenience functions for backward compatibility
export async function checkRateLimit(
  identifier: string, 
  rule: RateLimitRule, 
  prefix?: string
): Promise<RateLimitResult> {
  return redisRateLimiter.checkRateLimit(identifier, rule, prefix)
}

export async function isAccountLocked(email: string): Promise<LockResult> {
  return redisRateLimiter.isAccountLocked(email)
}

export async function recordFailedLogin(email: string): Promise<LockResult> {
  return redisRateLimiter.recordFailedLogin(email)
}

export async function clearFailedLogins(email: string): Promise<void> {
  return redisRateLimiter.clearFailedLogins(email)
}

// Start cleanup interval for in-memory fallback
if (typeof window === 'undefined') {
  setInterval(() => {
    redisRateLimiter.cleanup()
  }, 5 * 60 * 1000) // Clean up every 5 minutes
}
