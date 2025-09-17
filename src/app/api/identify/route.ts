import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSession } from '@/lib/session'
import { identifyPlant } from '@/lib/openai'
import { csrfProtection } from '@/lib/csrf'
import { rateLimitMiddleware, getClientIP } from '@/lib/rateLimit'

export async function POST(request: NextRequest) {
  try {
    // CSRF Protection - validate request origin
    const csrfError = csrfProtection(request)
    if (csrfError) {
      return csrfError
    }

    const session = await getAuthenticatedSession()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting for AI identify endpoint - per user and per IP
    const userId = session.user.id
    const clientIP = getClientIP(request)
    
    // Check user-based rate limit first (stricter for identify)
    const userRateLimit = rateLimitMiddleware('AI_IDENTIFY', userId, 'user')
    if (userRateLimit.limited) {
      console.warn(`SECURITY: AI identify rate limit exceeded for user: ${userId}`)
      return userRateLimit.response!
    }
    
    // Also check IP-based rate limit as backup
    const ipRateLimit = rateLimitMiddleware('AI_IDENTIFY', clientIP, 'ip')
    if (ipRateLimit.limited) {
      console.warn(`SECURITY: AI identify rate limit exceeded for IP: ${clientIP}`)
      return ipRateLimit.response!
    }

    const { imageBase64 } = await request.json()
    
    if (!imageBase64) {
      return NextResponse.json({ error: 'No image data provided' }, { status: 400 })
    }

    const identification = await identifyPlant(imageBase64)

    return NextResponse.json({ identification })
  } catch (error) {
    console.error('Error identifying plant:', error)
    return NextResponse.json(
      { error: 'Failed to identify plant' },
      { status: 500 }
    )
  }
}
