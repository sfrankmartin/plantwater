import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth'

export async function getAuthenticatedSession() {
  const session = await getServerSession(authOptions)
  
  if (!session || !('id' in (session.user || {}))) {
    return null
  }
  
  return session
}
