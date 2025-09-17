/**
 * CSRF Protection Utility
 * 
 * Provides CSRF protection for API routes by validating Origin and Referer headers.
 * This prevents malicious websites from making unauthorized requests using a user's session.
 */

import { NextRequest, NextResponse } from 'next/server'

// Get the allowed origins from environment or default to localhost for development
const getAllowedOrigins = (): string[] => {
  const envOrigins = process.env.ALLOWED_ORIGINS
  if (envOrigins) {
    return envOrigins.split(',').map(origin => origin.trim())
  }
  
  // Default development origins
  return [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://localhost:3000',
  ]
}

/**
 * Validates CSRF protection by checking Origin and Referer headers
 * @param request - The incoming NextRequest
 * @returns true if request is valid, false otherwise
 */
export function validateCSRF(request: NextRequest): boolean {
  const allowedOrigins = getAllowedOrigins()
  
  // Get Origin header (preferred for CORS requests)
  const origin = request.headers.get('origin')
  
  // Get Referer header (fallback for same-origin requests)
  const referer = request.headers.get('referer')
  
  // For same-origin requests, Origin might be null but Referer should be present
  if (origin) {
    return allowedOrigins.includes(origin)
  } else if (referer) {
    try {
      const refererUrl = new URL(referer)
      const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`
      return allowedOrigins.includes(refererOrigin)
    } catch {
      return false
    }
  }
  
  // If neither Origin nor Referer is present, reject the request
  return false
}

/**
 * CSRF protection middleware for API routes
 * Call this at the beginning of any state-changing API route (POST, PUT, DELETE, PATCH)
 * 
 * Enforces strict Origin/Referer validation for ALL requests - no alternative paths.
 * This prevents cross-site requests even with JSON Content-Type headers.
 * 
 * @param request - The incoming NextRequest
 * @returns NextResponse with 403 error if CSRF validation fails, null if valid
 */
export function csrfProtection(request: NextRequest): NextResponse | null {
  // Only apply CSRF protection to state-changing methods
  const method = request.method.toUpperCase()
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    return null
  }
  
  // SECURITY: Strict Origin/Referer validation - no shortcuts or alternatives
  if (!validateCSRF(request)) {
    console.warn('CSRF validation failed:', {
      method,
      origin: request.headers.get('origin'),
      referer: request.headers.get('referer'),
      userAgent: request.headers.get('user-agent'),
      timestamp: new Date().toISOString()
    })
    
    return NextResponse.json(
      { 
        error: 'CSRF validation failed. Request rejected for security reasons.',
        code: 'CSRF_VALIDATION_FAILED'
      },
      { status: 403 }
    )
  }
  
  return null
}

// Note: All API routes should use the standard csrfProtection() function above.
// There are no alternative CSRF protection paths - Origin/Referer validation is required.
