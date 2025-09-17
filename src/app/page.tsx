'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import { 
  HomeIcon, 
  CameraIcon, 
  FunnelIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'

export default function Home() {
  const { status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/dashboard')
    }
  }, [status, router])

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="text-2xl font-bold text-green-600 flex items-center justify-center">
                <HomeIcon className="h-6 w-6 mr-2" />
                PlantWater
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/auth/signin"
                className="text-gray-700 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium"
              >
                Sign In
              </Link>
              <Link
                href="/auth/signup"
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
            <span className="block">Smart Plant Care</span>
            <span className="block text-green-600">Made Simple</span>
          </h1>
          <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
            Upload photos of your plants and get AI-powered identification, care suggestions, and personalized watering reminders. Never let your plants go thirsty again!
          </p>
          <div className="mt-5 max-w-md mx-auto sm:flex sm:justify-center md:mt-8">
            <div className="rounded-md shadow">
              <Link
                href="/auth/signup"
                className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 md:py-4 md:text-lg md:px-10"
              >
                Start Growing
              </Link>
            </div>
            <div className="mt-3 rounded-md shadow sm:mt-0 sm:ml-3">
              <Link
                href="/auth/signin"
                className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-green-600 bg-white hover:bg-gray-50 md:py-4 md:text-lg md:px-10"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mt-16">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 text-4xl flex items-center justify-center">
                <CameraIcon className="h-12 w-12 text-green-600" />
              </div>
              <h3 className="mt-4 text-lg font-medium text-gray-900">Upload & Identify</h3>
              <p className="mt-2 text-base text-gray-500">
                Take a photo of your plant and our AI will identify the species and provide detailed care information.
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto h-12 w-12 text-4xl flex items-center justify-center">
                <FunnelIcon className="h-12 w-12 text-blue-600" />
              </div>
              <h3 className="mt-4 text-lg font-medium text-gray-900">Smart Reminders</h3>
              <p className="mt-2 text-base text-gray-500">
                Get personalized watering schedules based on your plant&apos;s specific needs and care requirements.
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto h-12 w-12 text-4xl flex items-center justify-center">
                <CheckCircleIcon className="h-12 w-12 text-green-600" />
              </div>
              <h3 className="mt-4 text-lg font-medium text-gray-900">Health Monitoring</h3>
              <p className="mt-2 text-base text-gray-500">
                Track your plants&apos; health over time and get expert advice when issues arise.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white mt-16">
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="text-center text-gray-500">
            <p>&copy; 2025 PlantWater. Made with <HomeIcon className="h-4 w-4 inline text-green-600" /> for plant lovers.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
