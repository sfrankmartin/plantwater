/**
 * @jest-environment node
 */
import { 
  getClientIP,
  getRateLimitKey,
  isRateLimited,
  recordFailedLogin,
  isAccountLocked,
  clearFailedLogins,
  rateLimitMiddleware,
  cleanupExpiredEntries,
  RATE_LIMIT_RULES
} from '../src/lib/rateLimit'
import { NextRequest } from 'next/server'

// Mock setTimeout for testing cleanup
jest.useFakeTimers()

describe('Rate Limiting System', () => {
  beforeEach(() => {
    // Clear any existing rate limit data
    jest.clearAllMocks()
  })

  describe('getClientIP', () => {
    it('should extract IP from x-forwarded-for header', () => {
      const request = new NextRequest('http://localhost:3000', {
        headers: {
          'x-forwarded-for': '192.168.1.1, 10.0.0.1',
          'x-real-ip': '172.16.0.1'
        }
      })
      
      expect(getClientIP(request)).toBe('192.168.1.1')
    })

    it('should fallback to x-real-ip if no x-forwarded-for', () => {
      const request = new NextRequest('http://localhost:3000', {
        headers: {
          'x-real-ip': '172.16.0.1'
        }
      })
      
      expect(getClientIP(request)).toBe('172.16.0.1')
    })

    it('should fallback to x-connecting-ip if others missing', () => {
      const request = new NextRequest('http://localhost:3000', {
        headers: {
          'x-connecting-ip': '203.0.113.1'
        }
      })
      
      expect(getClientIP(request)).toBe('203.0.113.1')
    })

    it('should return unknown if no IP headers present', () => {
      const request = new NextRequest('http://localhost:3000')
      
      expect(getClientIP(request)).toBe('unknown')
    })
  })

  describe('getRateLimitKey', () => {
    it('should create correct key format', () => {
      expect(getRateLimitKey('ip', '192.168.1.1', 'LOGIN')).toBe('ip:LOGIN:192.168.1.1')
      expect(getRateLimitKey('user', 'user123', 'AI_ANALYZE')).toBe('user:AI_ANALYZE:user123')
    })
  })

  describe('isRateLimited', () => {
    const testRule = {
      windowMs: 60000, // 1 minute
      maxRequests: 3,
      blockDurationMs: 300000 // 5 minutes
    }

    it('should allow first request', () => {
      const result = isRateLimited('test-key-1', testRule)
      
      expect(result.limited).toBe(false)
      expect(result.remaining).toBe(2)
    })

    it('should track requests within window', () => {
      const key = 'test-key-2'
      
      // First request
      let result = isRateLimited(key, testRule)
      expect(result.limited).toBe(false)
      expect(result.remaining).toBe(2)
      
      // Second request
      result = isRateLimited(key, testRule)
      expect(result.limited).toBe(false)
      expect(result.remaining).toBe(1)
      
      // Third request
      result = isRateLimited(key, testRule)
      expect(result.limited).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('should block after exceeding limit', () => {
      const key = 'test-key-3'
      
      // Use up the limit
      for (let i = 0; i < 3; i++) {
        isRateLimited(key, testRule)
      }
      
      // This should be blocked
      const result = isRateLimited(key, testRule)
      expect(result.limited).toBe(true)
      expect(result.resetTime).toBeDefined()
    })

    it('should reset after window expires', () => {
      const key = 'test-key-4'
      
      // Use up the limit
      for (let i = 0; i < 3; i++) {
        isRateLimited(key, testRule)
      }
      
      // Mock time passage
      jest.advanceTimersByTime(61000) // Advance by 61 seconds
      
      // Should be allowed again
      const result = isRateLimited(key, testRule)
      expect(result.limited).toBe(false)
      expect(result.remaining).toBe(2)
    })
  })

  describe('Account Lockout', () => {
    const testEmail = 'test@example.com'

    beforeEach(() => {
      clearFailedLogins(testEmail)
    })

    it('should track failed login attempts', () => {
      const result = recordFailedLogin(testEmail)
      
      expect(result.locked).toBe(false)
      expect(result.attemptsRemaining).toBe(4) // 5 max - 1 failed
    })

    it('should lock account after max failed attempts', () => {
      // Record 5 failed attempts
      for (let i = 0; i < 4; i++) {
        recordFailedLogin(testEmail)
      }
      
      const result = recordFailedLogin(testEmail)
      expect(result.locked).toBe(true)
      expect(result.lockedUntil).toBeDefined()
    })

    it('should report account as locked', () => {
      // Lock the account
      for (let i = 0; i < 5; i++) {
        recordFailedLogin(testEmail)
      }
      
      const lockStatus = isAccountLocked(testEmail)
      expect(lockStatus.locked).toBe(true)
      expect(lockStatus.lockedUntil).toBeDefined()
    })

    it('should clear failed attempts on successful login', () => {
      // Record some failed attempts
      recordFailedLogin(testEmail)
      recordFailedLogin(testEmail)
      
      // Clear them
      clearFailedLogins(testEmail)
      
      // Should start fresh
      const result = recordFailedLogin(testEmail)
      expect(result.attemptsRemaining).toBe(4)
    })

    it('should reset attempts after failure window expires', () => {
      recordFailedLogin(testEmail)
      
      // Mock time passage beyond failure window
      jest.advanceTimersByTime(16 * 60 * 1000) // 16 minutes
      
      const result = recordFailedLogin(testEmail)
      expect(result.attemptsRemaining).toBe(4) // Should reset
    })

    it('should unlock account after lockout duration', () => {
      // Lock the account
      for (let i = 0; i < 5; i++) {
        recordFailedLogin(testEmail)
      }
      
      // Mock time passage beyond lockout duration
      jest.advanceTimersByTime(31 * 60 * 1000) // 31 minutes
      
      const lockStatus = isAccountLocked(testEmail)
      expect(lockStatus.locked).toBe(false)
    })
  })

  describe('rateLimitMiddleware', () => {
    it('should allow requests within limits', () => {
      const result = rateLimitMiddleware('GENERAL', '192.168.1.1', 'ip')
      
      expect(result.limited).toBe(false)
      expect(result.response).toBeUndefined()
    })

    it('should block requests exceeding limits', () => {
      const ip = '192.168.1.2'
      const rule = RATE_LIMIT_RULES.GENERAL
      
      // Exhaust the limit
      for (let i = 0; i < rule.maxRequests; i++) {
        rateLimitMiddleware('GENERAL', ip, 'ip')
      }
      
      // This should be blocked
      const result = rateLimitMiddleware('GENERAL', ip, 'ip')
      expect(result.limited).toBe(true)
      expect(result.response).toBeDefined()
      expect(result.response!.status).toBe(429)
    })

    it('should return appropriate error message for user vs IP', () => {
      const userId = 'user123'
      const rule = RATE_LIMIT_RULES.AI_ANALYZE
      
      // Exhaust the limit
      for (let i = 0; i < rule.maxRequests; i++) {
        rateLimitMiddleware('AI_ANALYZE', userId, 'user')
      }
      
      const result = rateLimitMiddleware('AI_ANALYZE', userId, 'user')
      expect(result.limited).toBe(true)
      
      // Check the response message
      result.response!.json().then(data => {
        expect(data.error).toContain('account')
      })
    })
  })

  describe('Rate Limit Rules Configuration', () => {
    it('should have appropriate limits for authentication endpoints', () => {
      expect(RATE_LIMIT_RULES.LOGIN.maxRequests).toBe(5)
      expect(RATE_LIMIT_RULES.LOGIN.windowMs).toBe(15 * 60 * 1000)
      
      expect(RATE_LIMIT_RULES.REGISTRATION.maxRequests).toBe(3)
      expect(RATE_LIMIT_RULES.REGISTRATION.windowMs).toBe(60 * 60 * 1000)
    })

    it('should have stricter limits for AI endpoints', () => {
      expect(RATE_LIMIT_RULES.AI_IDENTIFY.maxRequests).toBeLessThan(RATE_LIMIT_RULES.AI_ANALYZE.maxRequests)
      expect(RATE_LIMIT_RULES.AI_ANALYZE.maxRequests).toBe(10)
      expect(RATE_LIMIT_RULES.AI_IDENTIFY.maxRequests).toBe(5)
    })

    it('should have reasonable general API limits', () => {
      expect(RATE_LIMIT_RULES.GENERAL.maxRequests).toBe(60)
      expect(RATE_LIMIT_RULES.GENERAL.windowMs).toBe(60 * 1000)
    })
  })

  describe('cleanupExpiredEntries', () => {
    it('should remove expired rate limit entries', () => {
      // Create some entries
      isRateLimited('cleanup-test-1', { windowMs: 1000, maxRequests: 1 })
      isRateLimited('cleanup-test-2', { windowMs: 1000, maxRequests: 1 })
      
      // Mock time passage
      jest.advanceTimersByTime(25 * 60 * 60 * 1000) // 25 hours
      
      // Run cleanup
      cleanupExpiredEntries()
      
      // Entries should be cleaned up (verify by checking they reset)
      const result = isRateLimited('cleanup-test-1', { windowMs: 1000, maxRequests: 3 })
      expect(result.remaining).toBe(2) // Should be fresh
    })

    it('should remove expired account lockout entries', () => {
      recordFailedLogin('cleanup@example.com')
      
      // Mock time passage
      jest.advanceTimersByTime(25 * 60 * 60 * 1000) // 25 hours
      
      // Run cleanup
      cleanupExpiredEntries()
      
      // Entry should be cleaned up
      const result = recordFailedLogin('cleanup@example.com')
      expect(result.attemptsRemaining).toBe(4) // Should be fresh
    })
  })

  describe('Edge Cases', () => {
    it('should handle concurrent requests correctly', () => {
      const key = 'concurrent-test'
      const rule = { windowMs: 60000, maxRequests: 2 }
      
      // Simulate concurrent requests
      const results = [
        isRateLimited(key, rule),
        isRateLimited(key, rule),
        isRateLimited(key, rule)
      ]
      
      expect(results[0].limited).toBe(false)
      expect(results[1].limited).toBe(false)
      expect(results[2].limited).toBe(true)
    })

    it('should handle malformed IPs gracefully', () => {
      expect(() => {
        rateLimitMiddleware('GENERAL', '', 'ip')
      }).not.toThrow()
      
      expect(() => {
        rateLimitMiddleware('GENERAL', 'null', 'ip')
      }).not.toThrow()
    })
  })
})

// Restore real timers after tests
afterAll(() => {
  jest.useRealTimers()
})
