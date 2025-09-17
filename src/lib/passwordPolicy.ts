/**
 * Password validation utility for enforcing strong password policies
 * 
 * Security Requirements:
 * - Minimum 8 characters length
 * - At least one uppercase letter
 * - At least one lowercase letter  
 * - At least one number
 * - At least one special character
 * - No common weak passwords
 */

interface PasswordValidationResult {
  isValid: boolean
  errors: string[]
  strength: 'weak' | 'medium' | 'strong'
}

// Common weak passwords to reject
const WEAK_PASSWORDS = new Set([
  'password', 'password123', '123456', '123456789', 'qwerty',
  'abc123', 'password1', 'admin', 'letmein', 'welcome',
  'monkey', 'dragon', 'master', 'shadow', 'passw0rd'
])

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = []
  let strength: 'weak' | 'medium' | 'strong' = 'weak'

  // Basic length check
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long')
  }

  // Character type requirements
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number')
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*)')
  }

  // Check against common weak passwords
  if (WEAK_PASSWORDS.has(password.toLowerCase())) {
    errors.push('This password is too common and not allowed')
  }

  // Additional security checks
  if (password.length > 100) {
    errors.push('Password must be less than 100 characters')
  }

  // Determine strength
  if (errors.length === 0) {
    const hasVariousChars = /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password) && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    
    if (password.length >= 12 && hasVariousChars) {
      strength = 'strong'
    } else if (password.length >= 8 && hasVariousChars) {
      strength = 'medium'
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength
  }
}

export function getPasswordStrengthMessage(strength: 'weak' | 'medium' | 'strong'): string {
  switch (strength) {
    case 'weak':
      return 'Password strength: Weak'
    case 'medium':
      return 'Password strength: Medium'
    case 'strong':
      return 'Password strength: Strong'
  }
}
