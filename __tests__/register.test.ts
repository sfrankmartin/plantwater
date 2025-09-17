/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

// Setup mocks
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    }
  }
}))

jest.mock('bcryptjs', () => ({
  hash: jest.fn()
}))

jest.mock('@/lib/csrf', () => ({
  csrfProtection: jest.fn(() => null) // No CSRF error for tests
}))

// Mock rate limiting
jest.mock('@/lib/rateLimit', () => ({
  rateLimitMiddleware: jest.fn(() => ({ limited: false })),
  getClientIP: jest.fn(() => '192.168.1.1')
}))

// Import after mocks are set up
import { POST } from '@/app/api/auth/register/route'
import { prisma } from '@/lib/prisma'
import bcryptjs from 'bcryptjs'

// Type the mocked modules
const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockBcrypt = bcryptjs as jest.Mocked<typeof bcryptjs>

describe('/api/auth/register - Email Enumeration Protection', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const createMockRequest = (body: Record<string, string>) => {
    return new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000'
      },
      body: JSON.stringify(body)
    })
  }

  it('should prevent email enumeration by returning generic message for existing users', async () => {
    const userData = {
      name: 'John Doe',
      email: 'existing@example.com',
      password: 'SecurePass123!' // Updated to meet new password policy
    }

    // Mock user already exists
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: '1',
      name: 'Existing User',
      email: 'existing@example.com',
      password: 'hashedpassword',
      createdAt: new Date(),
      updatedAt: new Date()
    })

    const request = createMockRequest(userData)
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.message).toBe('Registration successful. If this is a new account, you can now sign in.')
    expect(data.user).toBeUndefined() // Should not return user data for existing users
    expect(mockPrisma.user.create).not.toHaveBeenCalled() // Should not create user
  })

  it('should create new user and return user data for non-existing emails', async () => {
    const userData = {
      name: 'Jane Doe',
      email: 'new@example.com',
      password: 'SecurePass123!' // Updated to meet new password policy
    }

    const newUser = {
      id: '2',
      name: 'Jane Doe',
      email: 'new@example.com',
      password: 'hashedpassword',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Mock user doesn't exist
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.user.create as jest.Mock).mockResolvedValue(newUser)
    ;(mockBcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword')

    const request = createMockRequest(userData)
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.message).toBe('Registration successful. You can now sign in.')
    expect(data.user).toBeDefined()
    expect(data.user.email).toBe('new@example.com')
    expect(data.user.password).toBeUndefined() // Password should be stripped
    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: {
        name: 'Jane Doe',
        email: 'new@example.com',
        password: 'hashedpassword'
      }
    })
  })

  it('should return 400 for missing required fields', async () => {
    const incompleteData = {
      name: 'John Doe',
      email: 'test@example.com'
      // missing password
    }

    const request = createMockRequest(incompleteData)
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Missing required fields')
  })

  it('should handle database errors gracefully', async () => {
    const userData = {
      name: 'John Doe',
      email: 'test@example.com',
      password: 'SecurePass123!' // Updated to meet new password policy
    }

    // Mock console.error to suppress expected error logs during testing
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    // Mock database error
    ;(mockPrisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'))

    const request = createMockRequest(userData)
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Internal server error')
    
    // Verify that error was logged (even though we mocked it)
    expect(consoleErrorSpy).toHaveBeenCalledWith('Registration error:', expect.any(Error))
    
    // Restore console.error
    consoleErrorSpy.mockRestore()
  })
})
