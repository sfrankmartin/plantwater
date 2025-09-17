// import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from './prisma'
import * as bcryptjs from 'bcryptjs'
import { 
  isAccountLocked, 
  recordFailedLogin, 
  clearFailedLogins 
} from './rateLimit'

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // Check if account is locked due to failed login attempts
        const lockStatus = isAccountLocked(credentials.email)
        if (lockStatus.locked) {
          console.warn(`SECURITY: Login attempt on locked account: ${credentials.email}`)
          // Don't reveal that account is locked to prevent user enumeration
          return null
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email
          }
        })

        if (!user || !user.password) {
          // Record failed login attempt for non-existent users too
          // This prevents user enumeration via timing attacks
          recordFailedLogin(credentials.email)
          return null
        }

        const isPasswordValid = await bcryptjs.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          // Record failed login attempt
          const lockResult = recordFailedLogin(credentials.email)
          if (lockResult.locked) {
            console.warn(`SECURITY: Account locked due to repeated failures: ${credentials.email}`)
          }
          return null
        }

        // Successful login - clear any failed attempts
        clearFailedLogins(credentials.email)

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        }
      }
    })
  ],
  session: {
    strategy: 'jwt' as const,
    // JWT maximum age (1 day for security)
    maxAge: 24 * 60 * 60, // 24 hours
    // Update session every hour to ensure freshness
    updateAge: 60 * 60, // 1 hour
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        maxAge: 24 * 60 * 60, // 24 hours
      },
    },
    callbackUrl: {
      name: `next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60,
      },
    },
    csrfToken: {
      name: `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60,
      },
    },
  },
  pages: {
    signIn: '/auth/signin'
  },
  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async session({ session, token }: any) {
      if (token && session.user) {
        session.user.id = token.id as string
      }
      return session
    }
  }
}
