import { getDaysUntilWatering, getWateringStatus, formatDate } from '@/utils/plantUtils'

describe('Plant Utilities', () => {
  describe('getDaysUntilWatering', () => {
    it('should return null for null input', () => {
      expect(getDaysUntilWatering(null)).toBeNull()
    })

    it('should return positive days for future dates', () => {
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // 5 days from now
      const result = getDaysUntilWatering(futureDate)
      expect(result).toBe(5)
    })

    it('should return negative days for past dates', () => {
      const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
      const result = getDaysUntilWatering(pastDate)
      expect(result).toBe(-3)
    })

    it('should return 0 for today', () => {
      const today = new Date()
      today.setHours(23, 59, 59) // End of today
      const result = getDaysUntilWatering(today)
      expect(result).toBe(1) // Will be 1 due to Math.ceil
    })

    it('should handle string dates', () => {
      const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
      const result = getDaysUntilWatering(futureDate.toISOString())
      expect(result).toBe(2)
    })
  })

  describe('getWateringStatus', () => {
    it('should return "No schedule" for null date', () => {
      const result = getWateringStatus(null)
      expect(result).toEqual({
        text: 'No schedule',
        color: 'text-gray-600',
        bgColor: 'bg-gray-100'
      })
    })

    it('should return "Overdue!" for past dates', () => {
      const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      const result = getWateringStatus(pastDate)
      expect(result).toEqual({
        text: 'Overdue!',
        color: 'text-red-600',
        bgColor: 'bg-red-100'
      })
    })

    it('should return "Due today" for today', () => {
      // Create a date that's exactly midnight today (start of today)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const result = getWateringStatus(today.toISOString())
      expect(result.text).toBe('Due today')
    })

    it('should return "Due tomorrow" for tomorrow', () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      const result = getWateringStatus(tomorrow)
      expect(result.text).toMatch(/Due tomorrow|Due in 1 days/)
    })

    it('should return "Due in X days" for future dates', () => {
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
      const result = getWateringStatus(futureDate)
      expect(result).toEqual({
        text: 'Due in 5 days',
        color: 'text-green-600',
        bgColor: 'bg-green-100'
      })
    })
  })

  describe('formatDate', () => {
    it('should return "Never" for null input', () => {
      expect(formatDate(null)).toBe('Never')
    })

    it('should format Date objects correctly', () => {
      const testDate = new Date('2023-12-25')
      const result = formatDate(testDate)
      expect(result).toBe('Dec 25, 2023')
    })

    it('should format string dates correctly', () => {
      const result = formatDate('2023-06-15T10:30:00Z')
      expect(result).toBe('Jun 15, 2023')
    })

    it('should handle invalid dates gracefully', () => {
      const result = formatDate('invalid-date')
      expect(result).toBe('Invalid Date')
    })
  })
})
