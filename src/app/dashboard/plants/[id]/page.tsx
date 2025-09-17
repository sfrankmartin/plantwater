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
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  PencilIcon
} from '@heroicons/react/24/outline'

interface Plant {
  id: string
  name: string
  description: string | null
  location: string | null
  profileImageUrl: string | null
  scientificName: string | null
  plantType: string | null
  lightRequirement: string | null
  humidityLevel: string | null
  careInstructions: string | null
  wateringFrequency: number
  lastWatered: Date | null
  nextWateringDue: Date | null
  createdAt: Date
  updatedAt: Date
}

interface WateringRecord {
  id: string
  wateredAt: Date
  notes: string | null
}

interface PlantAnalysis {
  healthScore: number
  healthStatus: string
  recommendations: string[]
  issues: string[]
  createdAt?: Date | string
}

export default function PlantDetail({ params }: { params: Promise<{ id: string }> }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [plant, setPlant] = useState<Plant | null>(null)
  const [wateringRecords, setWateringRecords] = useState<WateringRecord[]>([])
  const [analysis, setAnalysis] = useState<PlantAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [wateringLoading, setWateringLoading] = useState(false)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [error, setError] = useState('')
  const [wateringNotes, setWateringNotes] = useState('')
  const [showWateringForm, setShowWateringForm] = useState(false)
  const [showAnalysisPhotoForm, setShowAnalysisPhotoForm] = useState(false)
  const [analysisPhoto, setAnalysisPhoto] = useState<File | null>(null)
  const [analysisPhotoPreview, setAnalysisPhotoPreview] = useState('')
  const [plantId, setPlantId] = useState<string>('')

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

  useEffect(() => {
    if (plantId && status === 'authenticated') {
      const fetchPlantData = async () => {
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
          setPlant(data.plant)
          setWateringRecords(data.wateringRecords || [])
          setAnalysis(data.latestAnalysis || null)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load plant')
        } finally {
          setLoading(false)
        }
      }
      
      fetchPlantData()
    }
  }, [plantId, status])

  const refetchPlantData = async () => {
    if (!plantId) return
    
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
      setPlant(data.plant)
      setWateringRecords(data.wateringRecords || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plant')
    } finally {
      setLoading(false)
    }
  }

  const handleWaterPlant = async () => {
    if (!plantId) return
    
    setWateringLoading(true)
    try {
      const response = await fetch(`/api/plants/${plantId}/water`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: wateringNotes }),
      })

      if (!response.ok) {
        throw new Error('Failed to record watering')
      }

      // Refresh plant data
      await refetchPlantData()
      setWateringNotes('')
      setShowWateringForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record watering')
    } finally {
      setWateringLoading(false)
    }
  }

  const analyzeHealth = () => {
    setShowAnalysisPhotoForm(true)
    setError('')
  }

  const handleAnalysisPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB')
        return
      }
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file')
        return
      }
      
      setAnalysisPhoto(file)
      setAnalysisPhotoPreview(URL.createObjectURL(file))
      setError('')
    }
  }

  const performAnalysisWithPhoto = async () => {
    if (!plantId || !analysisPhoto) return
    
    setAnalysisLoading(true)
    try {
      // Convert file to base64
      const reader = new FileReader()
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const result = reader.result as string
          const base64 = result.split(',')[1] // Remove data:image/jpeg;base64, prefix
          resolve(base64)
        }
      })
      reader.readAsDataURL(analysisPhoto)
      const imageBase64 = await base64Promise

      const response = await fetch(`/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          plantId,
          imageBase64,
          plantInfo: {
            scientificName: plant?.scientificName || 'Unknown species',
            commonName: plant?.name || 'Unknown plant'
          }
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to analyze plant health')
      }

      const data = await response.json()
      setAnalysis(data.analysis)
      
      // Close the photo form and clean up
      setShowAnalysisPhotoForm(false)
      setAnalysisPhoto(null)
      setAnalysisPhotoPreview('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze plant health')
    } finally {
      setAnalysisLoading(false)
    }
  }

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'Never'
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getDaysUntilWatering = () => {
    if (!plant?.nextWateringDue) return null
    const today = new Date()
    const nextWatering = new Date(plant.nextWateringDue)
    const diffTime = nextWatering.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const isOverdue = () => {
    const days = getDaysUntilWatering()
    return days !== null && days < 0
  }

  const getAnalysisAge = () => {
    if (!analysis?.createdAt) {
      // If no createdAt, assume it's a fresh analysis
      return 'Just now'
    }
    const now = new Date()
    const analysisDate = new Date(analysis.createdAt)
    const diffMs = now.getTime() - analysisDate.getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    } else if (diffMinutes > 0) {
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`
    } else {
      return 'Just now'
    }
  }

  const isAnalysisOld = () => {
    if (!analysis?.createdAt) return false
    const now = new Date()
    const analysisDate = new Date(analysis.createdAt)
    const diffMs = now.getTime() - analysisDate.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    return diffHours >= 24 // Consider old if 24+ hours
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading plant details...</p>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  if (error && !plant) {
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

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border-2 border-red-300 text-red-800 px-6 py-4 rounded-lg text-center">
            <h1 className="text-xl font-semibold mb-2">Plant Not Found</h1>
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

  if (!plant) return null

  const daysUntilWatering = getDaysUntilWatering()
  const overdue = isOverdue()

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

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border-2 border-red-300 text-red-800 px-4 py-3 rounded-lg" role="alert">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Error:</span>
              <span className="ml-1">{error}</span>
            </div>
          </div>
        )}

        {/* Plant Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              {plant.profileImageUrl && (
                <div className="relative w-full h-64 rounded-lg overflow-hidden">
                  <Image
                    src={plant.profileImageUrl}
                    alt={`Photo of ${plant.name}`}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
            </div>
            
            <div className="space-y-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{plant.name}</h1>
                {plant.scientificName && (
                  <p className="text-lg text-gray-700 italic">{plant.scientificName}</p>
                )}
                {plant.location && (
                  <p className="text-gray-600 flex items-center">
                    <MapPinIcon className="h-4 w-4 mr-1" />
                    {plant.location}
                  </p>
                )}
              </div>

              {/* Watering Status */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Watering Status</h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-gray-700">Last watered:</span>
                    <span className="ml-2 text-gray-700 font-medium">{formatDate(plant.lastWatered)}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-700">Next watering:</span>
                    <span className={`ml-2 font-medium ${overdue ? 'text-red-600' : daysUntilWatering === 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      {daysUntilWatering === null 
                        ? 'Not scheduled' 
                        : daysUntilWatering === 0 
                        ? 'Today!' 
                        : daysUntilWatering < 0 
                        ? `${Math.abs(daysUntilWatering)} days overdue` 
                        : `In ${daysUntilWatering} days`}
                    </span>
                  </div>
                </div>
                
                <div className="mt-4 flex space-x-3">
                  <button
                    onClick={() => setShowWateringForm(!showWateringForm)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center"
                  >
                    <FunnelIcon className="h-4 w-4 mr-2" />
                    Water Plant
                  </button>
                  <button
                    onClick={analyzeHealth}
                    disabled={analysisLoading}
                    className="px-4 py-2 bg-green-700 text-white rounded-md hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 transition-colors flex items-center"
                  >
                    <MagnifyingGlassIcon className="h-4 w-4 mr-2" />
                    {analysisLoading ? 'Analyzing...' : 'Analyze Health'}
                  </button>
                  <Link
                    href={`/dashboard/plants/${plantId}/edit`}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors flex items-center"
                  >
                    <PencilIcon className="h-4 w-4 mr-2" />
                    Edit Plant
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Watering Form */}
        {showWateringForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Record Watering</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="watering-notes" className="block text-sm font-semibold text-gray-900 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  id="watering-notes"
                  rows={3}
                  className="block w-full rounded-md border-2 border-gray-400 shadow-sm focus:border-blue-600 focus:ring-blue-600 focus:ring-2 transition-colors text-gray-900 bg-white placeholder-gray-500 px-3 py-2"
                  placeholder="Any observations about your plant..."
                  value={wateringNotes}
                  onChange={(e) => setWateringNotes(e.target.value)}
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={handleWaterPlant}
                  disabled={wateringLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
                >
                  {wateringLoading ? 'Recording...' : 'Record Watering'}
                </button>
                <button
                  onClick={() => {
                    setShowWateringForm(false)
                    setWateringNotes('')
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Analysis Photo Form */}
        {showAnalysisPhotoForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Take Fresh Photo for Health Analysis</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="analysis-photo" className="block text-sm font-medium text-gray-700 mb-2">
                  Upload a current photo of your plant for AI analysis
                </label>
                <input
                  type="file"
                  id="analysis-photo"
                  accept="image/*"
                  capture="environment"
                  onChange={handleAnalysisPhotoSelect}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This photo is only used for analysis and will not be saved to your plant profile.
                </p>
              </div>
              
              {analysisPhotoPreview && (
                <div className="mt-4">
                  <div className="relative w-full max-w-md h-64 rounded-lg border overflow-hidden">
                    <Image
                      src={analysisPhotoPreview}
                      alt="Analysis preview"
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>
              )}
              
              <div className="flex space-x-3">
                <button
                  onClick={performAnalysisWithPhoto}
                  disabled={!analysisPhoto || analysisLoading}
                  className="px-4 py-2 bg-green-700 text-white rounded-md hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 transition-colors flex items-center"
                >
                  <MagnifyingGlassIcon className="h-4 w-4 mr-2" />
                  {analysisLoading ? 'Analyzing...' : 'Analyze with Photo'}
                </button>
                <button
                  onClick={() => {
                    setShowAnalysisPhotoForm(false)
                    setAnalysisPhoto(null)
                    setAnalysisPhotoPreview('')
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Health Analysis */}
        {analysis && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-gray-900">AI Health Analysis</h3>
              <div className="text-right">
                <div className="text-sm text-gray-600">
                  {getAnalysisAge()}
                </div>
                {isAnalysisOld() && (
                  <div className="text-xs text-orange-600 font-medium flex items-center">
                    <ExclamationTriangleIcon className="h-3 w-3 mr-1" />
                    Analysis may be outdated
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center">
                <span className="text-sm text-gray-700">Health Score:</span>
                <div className="ml-3 flex-1 bg-gray-200 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full ${
                      analysis.healthScore >= 80 ? 'bg-green-500' : 
                      analysis.healthScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${analysis.healthScore}%` }}
                  ></div>
                </div>
                <span className="ml-3 font-semibold text-gray-500">{analysis.healthScore}/100</span>
              </div>
              
              <div>
                <span className="text-sm font-semibold text-gray-900">Status:</span>
                <span className={`ml-2 px-2 py-1 rounded text-sm font-medium ${
                  analysis.healthScore >= 80 ? 'bg-green-100 text-green-800' : 
                  analysis.healthScore >= 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                }`}>
                  {analysis.healthStatus}
                </span>
              </div>

              {analysis.recommendations.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Recommendations:</h4>
                  <ul className="list-disc list-inside space-y-1 text-gray-800">
                    {analysis.recommendations.map((rec, index) => (
                      <li key={index} className="text-sm">{rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.issues.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Issues Detected:</h4>
                  <ul className="list-disc list-inside space-y-1 text-red-700">
                    {analysis.issues.map((issue, index) => (
                      <li key={index} className="text-sm">{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Plant Details */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Care Information */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Care Information</h3>
            <div className="space-y-3">
              {plant.plantType && (
                <div>
                  <span className="text-sm font-semibold text-gray-900">Type:</span>
                  <span className="ml-2 text-gray-800">{plant.plantType}</span>
                </div>
              )}
              {plant.lightRequirement && (
                <div>
                  <span className="text-sm font-semibold text-gray-900">Light:</span>
                  <span className="ml-2 text-gray-800">{plant.lightRequirement}</span>
                </div>
              )}
              {plant.humidityLevel && (
                <div>
                  <span className="text-sm font-semibold text-gray-900">Humidity:</span>
                  <span className="ml-2 text-gray-800">{plant.humidityLevel}</span>
                </div>
              )}
              <div>
                <span className="text-sm font-semibold text-gray-900">Watering Frequency:</span>
                <span className="ml-2 text-gray-800">Every {plant.wateringFrequency} days</span>
              </div>
              {plant.careInstructions && (
                <div>
                  <span className="text-sm font-semibold text-gray-900">Care Instructions:</span>
                  <p className="mt-1 text-sm text-gray-800 leading-relaxed">{plant.careInstructions}</p>
                </div>
              )}
              {plant.description && (
                <div>
                  <span className="text-sm font-semibold text-gray-900">Description:</span>
                  <p className="mt-1 text-sm text-gray-800 leading-relaxed">{plant.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Watering History */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Watering History</h3>
            {wateringRecords.length === 0 ? (
              <p className="text-gray-600 text-sm">No watering records yet.</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {wateringRecords.map((record) => (
                  <div key={record.id} className="border-l-4 border-blue-400 pl-4 py-2">
                    <div className="text-sm font-medium text-gray-900">
                      {formatDate(record.wateredAt)}
                    </div>
                    {record.notes && (
                      <div className="text-sm text-gray-600 mt-1">{record.notes}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
