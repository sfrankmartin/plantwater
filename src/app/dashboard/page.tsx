'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { 
  HomeIcon, 
  FunnelIcon, 
  MapPinIcon, 
  SunIcon
} from '@heroicons/react/24/outline'

interface Plant {
  id: string
  name: string
  scientificName?: string
  profileImageUrl?: string
  description?: string
  location?: string
  wateringFrequency: number
  lastWatered?: string
  nextWateringDue?: string
  careInstructions?: string
  plantType?: string
  lightRequirement?: string
  humidityLevel?: string
  wateringHistory: Array<{
    id: string
    wateredAt: string
    notes?: string
  }>
}

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [plants, setPlants] = useState<Plant[]>([])
  const [loading, setLoading] = useState(true)
  const [showWateringForm, setShowWateringForm] = useState<string | null>(null)
  const [wateringNotes, setWateringNotes] = useState('')
  const [wateringLoading, setWateringLoading] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchPlants()
    }
  }, [status])

  const fetchPlants = async () => {
    try {
      const response = await fetch('/api/plants')
      if (response.ok) {
        const data = await response.json()
        setPlants(data.plants)
      }
    } catch (error) {
      console.error('Error fetching plants:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleWaterPlant = (plantId: string) => {
    setShowWateringForm(plantId)
    setWateringNotes('')
  }

  const submitWatering = async (plantId: string) => {
    setWateringLoading(true)
    try {
      const response = await fetch(`/api/plants/${plantId}/water`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: wateringNotes }),
      })

      if (response.ok) {
        await fetchPlants() // Refresh the plants list
        setShowWateringForm(null)
        setWateringNotes('')
      }
    } catch (error) {
      console.error('Error watering plant:', error)
    } finally {
      setWateringLoading(false)
    }
  }

  const getDaysUntilWatering = (nextWateringDue: string) => {
    const now = new Date()
    const dueDate = new Date(nextWateringDue)
    const diffTime = dueDate.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const getWateringStatus = (nextWateringDue: string) => {
    const days = getDaysUntilWatering(nextWateringDue)
    if (days < 0) return { text: 'Overdue!', color: 'text-red-600', bgColor: 'bg-red-100' }
    if (days === 0) return { text: 'Due today', color: 'text-orange-600', bgColor: 'bg-orange-100' }
    if (days === 1) return { text: 'Due tomorrow', color: 'text-yellow-600', bgColor: 'bg-yellow-100' }
    return { text: `Due in ${days} days`, color: 'text-green-600', bgColor: 'bg-green-100' }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your plants...</p>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-2xl font-bold text-green-600 flex items-center">
                <HomeIcon className="h-6 w-6 mr-2" />
                PlantWater
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Welcome, {session?.user?.name}!</span>
              <Link
                href="/dashboard/add-plant"
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Add Plant
              </Link>
              <button
                onClick={() => signOut()}
                className="text-gray-700 hover:text-red-600 px-3 py-2 rounded-md text-sm font-medium"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Your Plants</h1>
          <p className="mt-2 text-gray-600">
            Keep track of your plant collection and their watering schedules.
          </p>
        </div>

        {plants.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4 flex justify-center">
              <HomeIcon className="h-16 w-16 text-green-600" />
            </div>
            <h3 className="text-xl font-medium text-gray-900 mb-2">No plants yet</h3>
            <p className="text-gray-600 mb-6">
              Start your plant collection by adding your first plant!
            </p>
            <Link
              href="/dashboard/add-plant"
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg text-lg font-medium"
            >
              Add Your First Plant
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {plants.map((plant) => {
              const wateringStatus = plant.nextWateringDue 
                ? getWateringStatus(plant.nextWateringDue)
                : { text: 'No schedule', color: 'text-gray-600', bgColor: 'bg-gray-100' }

              return (
                <div key={plant.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                  {plant.profileImageUrl && (
                    <div className="relative h-48 w-full">
                      <Image
                        src={plant.profileImageUrl}
                        alt={plant.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{plant.name}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${wateringStatus.color} ${wateringStatus.bgColor}`}>
                        {wateringStatus.text}
                      </span>
                    </div>
                    
                    {plant.scientificName && (
                      <p className="text-sm text-gray-600 italic mb-2">{plant.scientificName}</p>
                    )}
                    
                    <p className="text-gray-700 text-sm mb-3 truncate">
                      {plant.description || '\u00A0'}
                    </p>

                    <div className="space-y-2 text-sm text-gray-600 mb-4">
                      {plant.location && (
                        <div className="flex items-center">
                          <MapPinIcon className="h-4 w-4 mr-2 text-gray-500" />
                          <span>{plant.location}</span>
                        </div>
                      )}
                      <div className="flex items-center">
                        <FunnelIcon className="h-4 w-4 mr-2 text-gray-500" />
                        <span>Every {plant.wateringFrequency} days</span>
                      </div>
                      {plant.lightRequirement && (
                        <div className="flex items-center">
                          <SunIcon className="h-4 w-4 mr-2 text-gray-500" />
                          <span>{plant.lightRequirement}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleWaterPlant(plant.id)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center justify-center"
                      >
                        <FunnelIcon className="h-4 w-4 mr-1" />
                        Water Now
                      </button>
                      <Link
                        href={`/dashboard/plants/${plant.id}`}
                        className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium text-center"
                      >
                        View Details
                      </Link>
                    </div>

                    {/* Watering Form - appears below this specific plant card */}
                    {showWateringForm === plant.id && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg border-t border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3">
                          Record Watering
                        </h4>
                        <div className="space-y-3">
                          <div>
                            <label htmlFor={`watering-notes-${plant.id}`} className="block text-xs font-medium text-gray-700 mb-1">
                              Notes (optional)
                            </label>
                            <textarea
                              id={`watering-notes-${plant.id}`}
                              rows={2}
                              className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm text-gray-900 bg-white placeholder-gray-500 px-2 py-1"
                              placeholder="Any observations..."
                              value={wateringNotes}
                              onChange={(e) => setWateringNotes(e.target.value)}
                            />
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => submitWatering(plant.id)}
                              disabled={wateringLoading}
                              className="flex-1 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                            >
                              {wateringLoading ? 'Recording...' : 'Record'}
                            </button>
                            <button
                              onClick={() => {
                                setShowWateringForm(null)
                                setWateringNotes('')
                              }}
                              className="flex-1 px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-500 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
