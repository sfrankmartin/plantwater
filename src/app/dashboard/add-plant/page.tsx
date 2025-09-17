'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { HomeIcon } from '@heroicons/react/24/outline'

interface PlantIdentification {
  scientificName: string
  commonName: string
  plantType: string
  careInstructions: string
  wateringFrequency: number
  lightRequirement: string
  humidityLevel: string
  confidence: number
}

export default function AddPlant() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [step, setStep] = useState(1) // 1: Upload, 2: Identify, 3: Details, 4: Save
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Form data
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [identification, setIdentification] = useState<PlantIdentification | null>(null)
  const [plantData, setPlantData] = useState({
    name: '',
    description: '',
    location: '',
    wateringFrequency: 7,
    profileImageUrl: '',
    scientificName: '',
    plantType: '',
    lightRequirement: '',
    humidityLevel: '',
    careInstructions: ''
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      
      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      setError('')
    }
  }

  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    })
    
    if (!response.ok) {
      throw new Error('Failed to upload image')
    }
    
    const data = await response.json()
    return data.imageUrl
  }

  const identifyPlant = async (file: File): Promise<PlantIdentification> => {
    // Convert file to base64
    const reader = new FileReader()
    const base64Promise = new Promise<string>((resolve) => {
      reader.onload = () => {
        const result = reader.result as string
        const base64 = result.split(',')[1] // Remove data:image/jpeg;base64, prefix
        resolve(base64)
      }
    })
    reader.readAsDataURL(file)
    const imageBase64 = await base64Promise

    const response = await fetch('/api/identify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageBase64 }),
    })

    if (!response.ok) {
      throw new Error('Failed to identify plant')
    }

    const data = await response.json()
    return data.identification
  }

  const handleIdentify = async () => {
    if (!selectedFile) return

    setLoading(true)
    setError('')

    try {
      // Upload image first
      const imageUrl = await uploadImage(selectedFile)
      
      // Then identify the plant
      const identificationResult = await identifyPlant(selectedFile)
      
      setIdentification(identificationResult)
      setPlantData(prev => ({
        ...prev,
        name: identificationResult.commonName,
        profileImageUrl: imageUrl,
        scientificName: identificationResult.scientificName,
        plantType: identificationResult.plantType,
        lightRequirement: identificationResult.lightRequirement,
        humidityLevel: identificationResult.humidityLevel,
        careInstructions: identificationResult.careInstructions,
        wateringFrequency: identificationResult.wateringFrequency
      }))
      
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleSavePlant = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/plants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(plantData),
      })

      if (!response.ok) {
        throw new Error('Failed to save plant')
      }

      const data = await response.json()
      const plantId = data.plant.id
      
      // Redirect to the individual plant page instead of dashboard
      router.push(`/dashboard/plants/${plantId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save plant')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
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
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Add New Plant</h1>
          <p className="mt-2 text-gray-600">
            Upload a photo of your plant and let AI help identify it and set up care reminders.
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8" role="navigation" aria-label="Progress steps">
          <div className="flex items-center justify-center space-x-8">
            <div className={`flex items-center ${step >= 1 ? 'text-green-700' : 'text-gray-600'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${step >= 1 ? 'bg-green-700 text-white' : 'bg-gray-400 text-white'}`} aria-current={step === 1 ? 'step' : undefined}>
                1
              </div>
              <span className="ml-2 font-medium">Upload Photo</span>
            </div>
            <div className={`flex items-center ${step >= 2 ? 'text-green-700' : 'text-gray-600'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${step >= 2 ? 'bg-green-700 text-white' : 'bg-gray-400 text-white'}`} aria-current={step === 2 ? 'step' : undefined}>
                2
              </div>
              <span className="ml-2 font-medium">AI Identification</span>
            </div>
            <div className={`flex items-center ${step >= 3 ? 'text-green-700' : 'text-gray-600'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${step >= 3 ? 'bg-green-700 text-white' : 'bg-gray-400 text-white'}`} aria-current={step === 3 ? 'step' : undefined}>
                3
              </div>
              <span className="ml-2 font-medium">Plant Details</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border-2 border-red-300 text-red-800 px-4 py-3 rounded-lg" role="alert" aria-live="polite">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Error:</span>
              <span className="ml-1">{error}</span>
            </div>
          </div>
        )}

        {/* Step 1: Upload Photo */}
        {step === 1 && (
          <div className="bg-white rounded-lg shadow-md p-6" role="main" aria-labelledby="upload-heading">
            <h2 id="upload-heading" className="text-xl font-semibold mb-4 text-gray-900">Upload Plant Photo</h2>
            
            <div className="border-2 border-dashed border-gray-400 rounded-lg p-8 text-center hover:border-green-600 transition-colors focus-within:border-green-600 focus-within:ring-2 focus-within:ring-green-500 focus-within:ring-opacity-50">
              {previewUrl ? (
                <div className="space-y-4">
                  <div className="relative w-64 h-64 mx-auto">
                    <Image
                      src={previewUrl}
                      alt="Preview of uploaded plant photo"
                      fill
                      className="object-cover rounded-lg"
                    />
                  </div>
                  <div className="flex space-x-4 justify-center">
                    <button
                      onClick={() => {
                        setSelectedFile(null)
                        setPreviewUrl('')
                      }}
                      className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                    >
                      Choose Different Photo
                    </button>
                    <button
                      onClick={handleIdentify}
                      disabled={loading}
                      className="px-6 py-2 bg-green-700 text-white rounded-md hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      aria-describedby={loading ? "identify-status" : undefined}
                    >
                      {loading ? 'Identifying...' : 'Identify Plant'}
                    </button>
                    {loading && <span id="identify-status" className="sr-only">Plant identification in progress</span>}
                  </div>
                </div>
              ) : (
                <div>
                  <svg className="mx-auto h-12 w-12 text-gray-500" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div className="mt-4">
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <span className="mt-2 block text-sm font-medium text-gray-900 hover:text-green-700 transition-colors">
                        Click to upload a photo of your plant
                      </span>
                      <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        className="sr-only"
                        accept="image/*"
                        onChange={handleFileSelect}
                        aria-describedby="file-upload-help"
                      />
                    </label>
                    <p id="file-upload-help" className="mt-1 text-xs text-gray-600">PNG, JPG, GIF up to 10MB</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: AI Identification Results */}
        {step === 2 && identification && (
          <div className="bg-white rounded-lg shadow-md p-6" role="main" aria-labelledby="identification-heading">
            <h2 id="identification-heading" className="text-xl font-semibold mb-4 text-gray-900">Plant Identified!</h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                {previewUrl && (
                  <div className="relative w-full h-64">
                    <Image
                      src={previewUrl}
                      alt={`Photo of identified plant: ${identification.commonName}`}
                      fill
                      className="object-cover rounded-lg"
                    />
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg text-green-700">{identification.commonName}</h3>
                  <p className="text-gray-700 italic font-medium">{identification.scientificName}</p>
                  <p className="text-sm text-gray-700">Confidence: {Math.round(identification.confidence * 100)}%</p>
                </div>
                
                <div className="space-y-2 text-gray-800">
                  <div><span className="font-semibold text-gray-900">Type:</span> {identification.plantType}</div>
                  <div><span className="font-semibold text-gray-900">Light:</span> {identification.lightRequirement}</div>
                  <div><span className="font-semibold text-gray-900">Humidity:</span> {identification.humidityLevel}</div>
                  <div><span className="font-semibold text-gray-900">Watering:</span> Every {identification.wateringFrequency} days</div>
                </div>
                
                <div>
                  <span className="font-semibold text-gray-900">Care Instructions:</span>
                  <p className="text-sm text-gray-800 mt-1 leading-relaxed">{identification.careInstructions}</p>
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex space-x-4">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
              >
                Try Different Photo
              </button>
              <button
                onClick={() => setStep(3)}
                className="px-6 py-2 bg-green-700 text-white rounded-md hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
              >
                Continue with These Details
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Plant Details Form */}
        {step === 3 && (
          <div className="bg-white rounded-lg shadow-md p-6" role="main" aria-labelledby="details-heading">
            <h2 id="details-heading" className="text-xl font-semibold mb-4 text-gray-900">Customize Plant Details</h2>
            
            <form onSubmit={(e) => { e.preventDefault(); handleSavePlant(); }} className="space-y-6" noValidate>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="plant-name" className="block text-sm font-semibold text-gray-900 mb-1">
                    Plant Name <span className="text-red-600" aria-label="required">*</span>
                  </label>
                  <input
                    id="plant-name"
                    type="text"
                    required
                    className="mt-1 block w-full rounded-md border-2 border-gray-400 shadow-sm focus:border-green-600 focus:ring-green-600 focus:ring-2 transition-colors text-gray-900 bg-white placeholder-gray-500 px-3 py-2"
                    value={plantData.name}
                    onChange={(e) => setPlantData(prev => ({ ...prev, name: e.target.value }))}
                    aria-describedby="plant-name-error"
                  />
                </div>
                
                <div>
                  <label htmlFor="plant-location" className="block text-sm font-semibold text-gray-900 mb-1">Location</label>
                  <input
                    id="plant-location"
                    type="text"
                    placeholder="e.g., Living room window"
                    className="mt-1 block w-full rounded-md border-2 border-gray-400 shadow-sm focus:border-green-600 focus:ring-green-600 focus:ring-2 transition-colors text-gray-900 bg-white placeholder-gray-500 px-3 py-2"
                    value={plantData.location}
                    onChange={(e) => setPlantData(prev => ({ ...prev, location: e.target.value }))}
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="plant-description" className="block text-sm font-semibold text-gray-900 mb-1">Description</label>
                <textarea
                  id="plant-description"
                  rows={3}
                  className="mt-1 block w-full rounded-md border-2 border-gray-400 shadow-sm focus:border-green-600 focus:ring-green-600 focus:ring-2 transition-colors text-gray-900 bg-white placeholder-gray-500 px-3 py-2"
                  placeholder="Any notes about your plant..."
                  value={plantData.description}
                  onChange={(e) => setPlantData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              
              <div>
                <label htmlFor="watering-frequency" className="block text-sm font-semibold text-gray-900 mb-1">
                  Watering Frequency (days) <span className="text-red-600" aria-label="required">*</span>
                </label>
                <input
                  id="watering-frequency"
                  type="number"
                  min="1"
                  max="30"
                  required
                  className="mt-1 block w-32 rounded-md border-2 border-gray-400 shadow-sm focus:border-green-600 focus:ring-green-600 focus:ring-2 transition-colors text-gray-900 bg-white placeholder-gray-500 px-3 py-2"
                  value={plantData.wateringFrequency}
                  onChange={(e) => setPlantData(prev => ({ ...prev, wateringFrequency: parseInt(e.target.value) }))}
                  aria-describedby="watering-frequency-help"
                />
                <p id="watering-frequency-help" className="mt-1 text-sm text-gray-700">How often should this plant be watered?</p>
              </div>
              
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-green-700 text-white rounded-md hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-describedby={loading ? "save-status" : undefined}
                >
                  {loading ? 'Saving...' : 'Save Plant'}
                </button>
                {loading && <span id="save-status" className="sr-only">Saving plant details in progress</span>}
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}
