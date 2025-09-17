import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { csrfProtection } from '@/lib/csrf'
import { cloudStorage } from '@/lib/cloudStorage'

// Simple auth options for this endpoint
const authOptions = {
  providers: [],
  session: { strategy: 'jwt' as const },
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const plantId = resolvedParams.id

    // Get the plant with watering records and latest analysis
    const plant = await prisma.plant.findFirst({
      where: {
        id: plantId,
        user: {
          email: session.user.email
        }
      },
      include: {
        wateringHistory: {
          orderBy: {
            wateredAt: 'desc'
          },
          take: 10 // Last 10 watering records
        },
        analyses: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1 // Latest analysis only
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any
    })

    if (!plant) {
      return NextResponse.json({ error: 'Plant not found' }, { status: 404 })
    }

    // Parse the latest analysis if it exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plantWithAnalyses = plant as any
    const latestAnalysis = plantWithAnalyses.analyses?.[0] ? {
      healthScore: plantWithAnalyses.analyses[0].healthScore,
      healthStatus: plantWithAnalyses.analyses[0].healthStatus,
      recommendations: (() => {
        try {
          return JSON.parse(plantWithAnalyses.analyses[0].recommendations)
        } catch {
          return ['Analysis data corrupted']
        }
      })(),
      issues: (() => {
        try {
          return JSON.parse(plantWithAnalyses.analyses[0].issues)
        } catch {
          return ['Unable to parse analysis data']
        }
      })(),
      createdAt: plantWithAnalyses.analyses[0].createdAt
    } : null

    return NextResponse.json({
      plant,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      wateringRecords: (plant as any).wateringHistory,
      latestAnalysis
    })
  } catch (error) {
    console.error('Error fetching plant:', error)
    return NextResponse.json(
      { error: 'Failed to fetch plant' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // CSRF Protection - validate request origin
    const csrfError = csrfProtection(request)
    if (csrfError) {
      return csrfError
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const plantId = resolvedParams.id

    const data = await request.json()
    const { 
      name, 
      description, 
      location, 
      wateringFrequency,
      scientificName,
      plantType,
      lightRequirement,
      humidityLevel,
      careInstructions,
      profileImageUrl
    } = data

    if (!name || !wateringFrequency) {
      return NextResponse.json(
        { error: 'Name and watering frequency are required' },
        { status: 400 }
      )
    }

    // Check if plant exists and belongs to user
    const existingPlant = await prisma.plant.findFirst({
      where: {
        id: plantId,
        user: {
          email: session.user.email
        }
      }
    })

    if (!existingPlant) {
      return NextResponse.json({ error: 'Plant not found' }, { status: 404 })
    }

    // Store old profile image URL for cleanup if it changes
    const oldProfileImageUrl = existingPlant.profileImageUrl

    // Calculate new next watering date based on updated frequency
    const nextWateringDue = new Date()
    if (existingPlant.lastWatered) {
      // If plant has been watered before, calculate from last watering
      const lastWatered = new Date(existingPlant.lastWatered)
      nextWateringDue.setTime(lastWatered.getTime() + (parseInt(wateringFrequency) * 24 * 60 * 60 * 1000))
    } else {
      // If never watered, calculate from now
      nextWateringDue.setDate(nextWateringDue.getDate() + parseInt(wateringFrequency))
    }

    // Update the plant
    const updatedPlant = await prisma.plant.update({
      where: { id: plantId },
      data: {
        name,
        description,
        location,
        wateringFrequency: parseInt(wateringFrequency),
        nextWateringDue,
        scientificName,
        plantType,
        lightRequirement,
        humidityLevel,
        careInstructions,
        ...(profileImageUrl !== undefined && { profileImageUrl })
      }
    })

    // Clean up old profile image if it was changed
    if (profileImageUrl !== undefined && 
        oldProfileImageUrl && 
        oldProfileImageUrl !== profileImageUrl) {
      try {
        await cloudStorage.deleteImage(oldProfileImageUrl)
        console.log(`Cleaned up old profile image: ${oldProfileImageUrl}`)
      } catch (error) {
        // Don't fail the update if image cleanup fails, just log it
        console.warn('Failed to delete old profile image:', oldProfileImageUrl, error)
      }
    }

    return NextResponse.json({ plant: updatedPlant })
  } catch (error) {
    console.error('Error updating plant:', error)
    return NextResponse.json(
      { error: 'Failed to update plant' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // CSRF Protection - validate request origin
    const csrfError = csrfProtection(request)
    if (csrfError) {
      return csrfError
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const plantId = resolvedParams.id

    // Verify the plant belongs to the user
    const existingPlant = await prisma.plant.findFirst({
      where: {
        id: plantId,
        user: {
          email: session.user.email
        }
      }
    })

    if (!existingPlant) {
      return NextResponse.json({ error: 'Plant not found' }, { status: 404 })
    }

    // Store profile image URL for cleanup before deletion
    const profileImageToDelete = existingPlant.profileImageUrl

    // Delete the plant (cascade will handle watering records)
    await prisma.plant.delete({
      where: { id: plantId }
    })

    // Clean up profile image after successful deletion
    if (profileImageToDelete) {
      try {
        await cloudStorage.deleteImage(profileImageToDelete)
        console.log(`Cleaned up profile image for deleted plant: ${profileImageToDelete}`)
      } catch (error) {
        // Don't fail the deletion if image cleanup fails, just log it
        console.warn('Failed to delete profile image for deleted plant:', profileImageToDelete, error)
      }
    }

    return NextResponse.json({ message: 'Plant deleted successfully' })
  } catch (error) {
    console.error('Error deleting plant:', error)
    return NextResponse.json(
      { error: 'Failed to delete plant' },
      { status: 500 }
    )
  }
}
