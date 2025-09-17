import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}))

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props) => {
    // Convert fill prop to string if it's boolean to avoid React warnings
    const { fill, ...otherProps } = props
    const imgProps = {
      ...otherProps,
      alt: props.alt || '',
      ...(fill && { 'data-fill': 'true' })
    }
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={imgProps.alt} {...imgProps} />
  },
}))

// Mock NextAuth
jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: null,
    status: 'unauthenticated',
  }),
  signIn: jest.fn(),
  signOut: jest.fn(),
  getSession: jest.fn(),
}))

// Import jest-dom matchers
import '@testing-library/jest-dom'
