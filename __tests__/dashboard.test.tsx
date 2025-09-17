import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import Dashboard from '@/app/dashboard/page'

// Mock fetch globally
global.fetch = jest.fn()

const mockPush = jest.fn()

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

// Mock next-auth
jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        name: 'John Doe',
        email: 'john@example.com',
      },
    },
    status: 'authenticated',
  }),
  signOut: jest.fn(),
}))

// Sample plant data
const mockPlants = [
  {
    id: '1',
    name: 'Fiddle Leaf Fig',
    description: 'A beautiful houseplant',
    location: 'Living room',
    profileImageUrl: '/uploads/plants/test.jpg',
    scientificName: 'Ficus lyrata',
    wateringFrequency: 7,
    nextWateringDue: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
    lightRequirement: 'Bright indirect',
  },
  {
    id: '2',
    name: 'Snake Plant',
    description: null,
    location: 'Bedroom',
    profileImageUrl: null,
    scientificName: 'Sansevieria trifasciata',
    wateringFrequency: 14,
    nextWateringDue: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday (overdue)
    lightRequirement: 'Low light',
  },
]

describe('Dashboard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock successful API response
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        plants: mockPlants,
      }),
    })
  })

  it('renders dashboard header with user welcome message', async () => {
    render(<Dashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('Welcome, John Doe!')).toBeInTheDocument()
    })
  })

  it('displays plant cards with correct information', async () => {
    render(<Dashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('Fiddle Leaf Fig')).toBeInTheDocument()
      expect(screen.getByText('Snake Plant')).toBeInTheDocument()
    })

    // Check scientific names
    expect(screen.getByText('Ficus lyrata')).toBeInTheDocument()
    expect(screen.getByText('Sansevieria trifasciata')).toBeInTheDocument()

    // Check descriptions (one plant has description, other doesn't)
    expect(screen.getByText('A beautiful houseplant')).toBeInTheDocument()
    
    // Check watering status
    expect(screen.getByText('Due tomorrow')).toBeInTheDocument()
    expect(screen.getByText('Overdue!')).toBeInTheDocument()
  })

  it('shows "Add Your First Plant" when no plants exist', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        plants: [],
      }),
    })

    render(<Dashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('No plants yet')).toBeInTheDocument()
      expect(screen.getByText('Add Your First Plant')).toBeInTheDocument()
    })
  })

  it('handles water plant functionality', async () => {
    const user = userEvent.setup()
    
    // Mock the watering API call
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ plants: mockPlants }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ plants: mockPlants }),
      })

    render(<Dashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('Fiddle Leaf Fig')).toBeInTheDocument()
    })

    // Click water button
    const waterButtons = screen.getAllByText('Water Now')
    await user.click(waterButtons[0])

    // Should show watering form
    expect(screen.getByPlaceholderText('Any observations...')).toBeInTheDocument()
    
    // Add notes and submit
    const notesTextarea = screen.getByPlaceholderText('Any observations...')
    await user.type(notesTextarea, 'Plant looks healthy!')
    
    const recordButton = screen.getByText('Record')
    await user.click(recordButton)

    // Should make API call to water endpoint
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/plants/1/water',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: 'Plant looks healthy!' }),
      })
    )
  })

  it('handles loading and error states', async () => {
    // Mock loading state
    ;(global.fetch as jest.Mock).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    )

    render(<Dashboard />)
    
    // Should show loading state
    expect(screen.getByText('Loading your plants...')).toBeInTheDocument()
  })

  it('handles API error state', async () => {
    // Suppress expected console error during this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('API Error'))

    render(<Dashboard />)
    
    await waitFor(() => {
      // Component should handle error gracefully and show empty state
      expect(screen.queryByText('Loading your plants...')).not.toBeInTheDocument()
    })
    
    // Restore console.error
    consoleSpy.mockRestore()
  })

  it('navigates to plant detail when clicking view button', async () => {
    render(<Dashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('Fiddle Leaf Fig')).toBeInTheDocument()
    })

    // Get all view buttons and click the first one since the test data has multiple plants
    const viewButtons = screen.getAllByRole('link', { name: /view details/i })
    const firstViewButton = viewButtons[0]

    expect(firstViewButton.getAttribute('href')).toBe('/dashboard/plants/1')
  })
})
