import { NextRequest, NextResponse } from 'next/server'
import bcryptjs from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { csrfProtection } from '@/lib/csrf'
import { validatePassword } from '@/lib/passwordPolicy'
import { rateLimitMiddleware, getClientIP } from '@/lib/rateLimit'

export async function POST(request: NextRequest) {
  try {
    // Rate limiting - prevent spam registrations
    const clientIP = getClientIP(request)
    const rateLimitResult = rateLimitMiddleware('REGISTRATION', clientIP, 'ip')
    
    if (rateLimitResult.limited) {
      console.warn(`SECURITY: Registration rate limit exceeded for IP: ${clientIP}`)
      return rateLimitResult.response!
    }

    // CSRF Protection - validate request origin
    const csrfError = csrfProtection(request)
    if (csrfError) {
      return csrfError
    }

    const { name, email, password } = await request.json()

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate password strength
    const passwordValidation = validatePassword(password)
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { 
          error: 'Password does not meet security requirements',
          details: passwordValidation.errors 
        },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      // SECURITY: Prevent email enumeration - return generic success message
      // Don't reveal whether the email is already registered
      return NextResponse.json(
        { message: 'Registration successful. If this is a new account, you can now sign in.' },
        { status: 200 }
      )
    }

    // Hash password
    const hashedPassword = await bcryptjs.hash(password, 12)

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword
      }
    })

    // Remove password from response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: userPassword, ...userWithoutPassword } = user

    return NextResponse.json(
      { message: 'Registration successful. You can now sign in.', user: userWithoutPassword },
      { status: 201 }
    )
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
