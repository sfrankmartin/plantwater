/**
 * Utility functions for plant watering calculations
 */

export const getDaysUntilWatering = (nextWateringDue: string | Date | null): number | null => {
  if (!nextWateringDue) return null
  
  const now = new Date()
  const dueDate = new Date(nextWateringDue)
  const diffTime = dueDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  return diffDays
}

export const getWateringStatus = (nextWateringDue: string | Date | null) => {
  const days = getDaysUntilWatering(nextWateringDue)
  
  if (days === null) {
    return { text: 'No schedule', color: 'text-gray-600', bgColor: 'bg-gray-100' }
  }
  
  if (days < 0) {
    return { text: 'Overdue!', color: 'text-red-600', bgColor: 'bg-red-100' }
  }
  
  if (days === 0) {
    return { text: 'Due today', color: 'text-orange-600', bgColor: 'bg-orange-100' }
  }
  
  if (days === 1) {
    return { text: 'Due tomorrow', color: 'text-yellow-600', bgColor: 'bg-yellow-100' }
  }
  
  return { text: `Due in ${days} days`, color: 'text-green-600', bgColor: 'bg-green-100' }
}

export const formatDate = (date: Date | string | null): string => {
  if (!date) return 'Never'
  
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}
