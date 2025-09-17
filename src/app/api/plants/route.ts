import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { csrfProtection } from '@/lib/csrf'

export async function GET() {
  try {
    const session = await getAuthenticatedSession()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const plants = await prisma.plant.findMany({
      where: { userId: session.user.id },
      include: {
        wateringHistory: {
          orderBy: { wateredAt: 'desc' },
          take: 5
        }
      },
      orderBy: { nextWateringDue: 'asc' }
    })

    return NextResponse.json({ plants })
  } catch (error) {
    console.error('Error fetching plants:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // CSRF Protection - validate request origin
    const csrfError = csrfProtection(request)
    if (csrfError) {
      return csrfError
    }

    const session = await getAuthenticatedSession()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { 
      name, 
      description, 
      location, 
      wateringFrequency,
      profileImageUrl,
      scientificName,
      plantType,
      lightRequirement,
      humidityLevel,
      careInstructions
    } = data

    if (!name || !wateringFrequency) {
      return NextResponse.json(
        { error: 'Name and watering frequency are required' },
        { status: 400 }
      )
    }

    const nextWateringDue = new Date()
    nextWateringDue.setDate(nextWateringDue.getDate() + wateringFrequency)

    const plant = await prisma.plant.create({
      data: {
        name,
        description,
        location,
        wateringFrequency: parseInt(wateringFrequency),
        nextWateringDue,
        userId: session.user.id,
        profileImageUrl,
        scientificName,
        plantType,
        lightRequirement,
        humidityLevel,
        careInstructions
      }
    })

    return NextResponse.json({ plant }, { status: 201 })
  } catch (error) {
    console.error('Error creating plant:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
