'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { HomeIcon, PencilIcon, PhotoIcon } from '@heroicons/react/24/outline'

export default function EditPlant({ params }: { params: Promise<{ id: string }> }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [plantId, setPlantId] = useState<string>('')
  // const [currentPlant, setCurrentPlant] = useState<{ profileImageUrl?: string } | null>(null)
  
  // Image upload state
  const [profileImage, setProfileImage] = useState<File | null>(null)
  const [profileImagePreview, setProfileImagePreview] = useState<string>('')
  const [imageRemoved, setImageRemoved] = useState(false)
  
  // Form data
  const [plantData, setPlantData] = useState({
    name: '',
    description: '',
    location: '',
    wateringFrequency: 7,
    scientificName: '',
    plantType: '',
    lightRequirement: '',
    humidityLevel: '',
    careInstructions: ''
  })

  useEffect(() => {
    const getParams = async () => {
      const resolvedParams = await params
      setPlantId(resolvedParams.id)
    }
    getParams()
  }, [params])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  const fetchPlantData = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/plants/${plantId}`)
      
      if (response.status === 404) {
        setError('Plant not found')
        return
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch plant data')
      }
      
      const data = await response.json()
      const plant = data.plant
      
      // Store current plant data
      // setCurrentPlant(plant)
      
      // Set current profile image preview
      if (plant.profileImageUrl) {
        setProfileImagePreview(plant.profileImageUrl)
      }
      
      // Reset image state when loading new plant data
      setImageRemoved(false)
      setProfileImage(null)
      
      // Populate form with existing data
      setPlantData({
        name: plant.name || '',
        description: plant.description || '',
        location: plant.location || '',
        wateringFrequency: plant.wateringFrequency || 7,
        scientificName: plant.scientificName || '',
        plantType: plant.plantType || '',
        lightRequirement: plant.lightRequirement || '',
        humidityLevel: plant.humidityLevel || '',
        careInstructions: plant.careInstructions || ''
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plant')
    } finally {
      setLoading(false)
    }
  }, [plantId])

  useEffect(() => {
    if (plantId && status === 'authenticated') {
      fetchPlantData()
    }
  }, [plantId, status, fetchPlantData])

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('Image must be less than 10MB')
        return
      }
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file')
        return
      }
      
      setProfileImage(file)
      setProfileImagePreview(URL.createObjectURL(file))
      setImageRemoved(false) // Reset removal flag when new image is selected
      setError('')
    }
  }

  const handleRemoveImage = () => {
    setProfileImage(null)
    setProfileImagePreview('')
    setImageRemoved(true)
  }

  const uploadImage = async (imageFile: File): Promise<string> => {
    const formData = new FormData()
    formData.append('file', imageFile)
    formData.append('type', 'plant')

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Failed to upload image')
    }

    const data = await response.json()
    return data.imageUrl
  }

  const handleUpdatePlant = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const updatedPlantData: Record<string, string | number | null> = { ...plantData }

      // Upload new image if one was selected
      if (profileImage) {
        const imageUrl = await uploadImage(profileImage)
        updatedPlantData.profileImageUrl = imageUrl
      } else if (imageRemoved) {
        // Image was explicitly removed by user
        updatedPlantData.profileImageUrl = null
      }

      const response = await fetch(`/api/plants/${plantId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedPlantData),
      })

      if (!response.ok) {
        throw new Error('Failed to update plant')
      }

      // Redirect back to plant detail page
      router.push(`/dashboard/plants/${plantId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update plant')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading plant data...</p>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  if (error && !plantData.name) {
    return (
      <div className="min-h-screen bg-gray-50">
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
                  href="/dashboard"
                  className="text-gray-700 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Back to Dashboard
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
        
        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-md">
            <h3 className="text-lg font-medium">Error</h3>
            <p className="mb-4">{error}</p>
            <Link
              href="/dashboard"
              className="inline-flex items-center px-4 py-2 bg-green-700 text-white rounded-md hover:bg-green-800 transition-colors"
            >
              Return to Dashboard
            </Link>
          </div>
        </main>
      </div>
    )
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
                href={`/dashboard/plants/${plantId}`}
                className="text-gray-700 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium"
              >
                Back to Plant
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
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center mb-6">
            <PencilIcon className="h-6 w-6 text-green-600 mr-2" />
            <h1 className="text-2xl font-bold text-gray-900">Edit Plant</h1>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {error}
            </div>
          )}

          <form onSubmit={handleUpdatePlant} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Plant Name *
              </label>
              <input
                type="text"
                id="name"
                required
                value={plantData.name}
                onChange={(e) => setPlantData(prev => ({ ...prev, name: e.target.value }))}
                className="block w-full rounded-md border-gray-300 shadow-sm text-gray-500 focus:border-green-500 focus:ring-green-500"
                placeholder="e.g., My Fiddle Leaf Fig"
              />
            </div>

            {/* Profile Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Profile Picture
              </label>
              
              {profileImagePreview ? (
                <div className="mb-4">
                  <div className="relative w-48 h-48 rounded-lg border-2 border-gray-300 overflow-hidden">
                    <Image
                      src={profileImagePreview}
                      alt="Plant preview"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="mt-2 text-sm text-red-600 hover:text-red-800"
                  >
                    Remove image
                  </button>
                </div>
              ) : (
                <div className="mb-4 w-48 h-48 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <span className="mt-2 block text-sm font-medium text-gray-900">No image</span>
                  </div>
                </div>
              )}
              
              <input
                type="file"
                id="profileImage"
                accept="image/*"
                onChange={handleImageSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
              />
              <p className="text-xs text-gray-500 mt-1">
                Upload a new image to replace the current profile picture (max 10MB)
              </p>
            </div>

            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <input
                type="text"
                id="location"
                value={plantData.location}
                onChange={(e) => setPlantData(prev => ({ ...prev, location: e.target.value }))}
                className="block w-full rounded-md border-gray-300 shadow-sm text-gray-500 focus:border-green-500 focus:ring-green-500"
                placeholder="e.g., Living room window"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="description"
                rows={3}
                value={plantData.description}
                onChange={(e) => setPlantData(prev => ({ ...prev, description: e.target.value }))}
                className="block w-full rounded-md border-gray-300 shadow-sm text-gray-500 focus:border-green-500 focus:ring-green-500"
                placeholder="Add any notes about your plant..."
              />
            </div>

            <div>
              <label htmlFor="wateringFrequency" className="block text-sm font-medium text-gray-700 mb-1">
                Watering Frequency (days) *
              </label>
              <input
                type="number"
                id="wateringFrequency"
                min="1"
                max="365"
                required
                value={plantData.wateringFrequency}
                onChange={(e) => setPlantData(prev => ({ ...prev, wateringFrequency: parseInt(e.target.value) }))}
                className="block w-full rounded-md border-gray-300 shadow-sm text-gray-500 focus:border-green-500 focus:ring-green-500"
              />
            </div>

            <div>
              <label htmlFor="scientificName" className="block text-sm font-medium text-gray-700 mb-1">
                Scientific Name
              </label>
              <input
                type="text"
                id="scientificName"
                value={plantData.scientificName}
                onChange={(e) => setPlantData(prev => ({ ...prev, scientificName: e.target.value }))}
                className="block w-full rounded-md border-gray-300 shadow-sm text-gray-500 focus:border-green-500 focus:ring-green-500"
                placeholder="e.g., Ficus lyrata"
              />
            </div>

            <div>
              <label htmlFor="plantType" className="block text-sm font-medium text-gray-700 mb-1">
                Plant Type
              </label>
              <input
                type="text"
                id="plantType"
                value={plantData.plantType}
                onChange={(e) => setPlantData(prev => ({ ...prev, plantType: e.target.value }))}
                className="block w-full rounded-md border-gray-300 shadow-sm text-gray-500 focus:border-green-500 focus:ring-green-500"
                placeholder="e.g., Houseplant, Succulent, Herb"
              />
            </div>

            <div>
              <label htmlFor="lightRequirement" className="block text-sm font-medium text-gray-700 mb-1">
                Light Requirement
              </label>
              <input
                type="text"
                id="lightRequirement"
                value={plantData.lightRequirement}
                onChange={(e) => setPlantData(prev => ({ ...prev, lightRequirement: e.target.value }))}
                className="block w-full rounded-md border-gray-300 shadow-sm text-gray-500 focus:border-green-500 focus:ring-green-500"
                placeholder="e.g., Bright indirect light"
              />
            </div>

            <div>
              <label htmlFor="humidityLevel" className="block text-sm font-medium text-gray-700 mb-1">
                Humidity Level
              </label>
              <input
                type="text"
                id="humidityLevel"
                value={plantData.humidityLevel}
                onChange={(e) => setPlantData(prev => ({ ...prev, humidityLevel: e.target.value }))}
                className="block w-full rounded-md border-gray-300 shadow-sm text-gray-500 focus:border-green-500 focus:ring-green-500"
                placeholder="e.g., Medium to high humidity"
              />
            </div>

            <div>
              <label htmlFor="careInstructions" className="block text-sm font-medium text-gray-700 mb-1">
                Care Instructions
              </label>
              <textarea
                id="careInstructions"
                rows={4}
                value={plantData.careInstructions}
                onChange={(e) => setPlantData(prev => ({ ...prev, careInstructions: e.target.value }))}
                className="block w-full rounded-md border-gray-300 shadow-sm text-gray-500 focus:border-green-500 focus:ring-green-500"
                placeholder="Special care instructions for your plant..."
              />
            </div>

            <div className="flex space-x-4">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md font-medium disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <Link
                href={`/dashboard/plants/${plantId}`}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-md font-medium text-center transition-colors"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
