import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { csrfProtection } from '@/lib/csrf'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { notes } = await request.json()
    const { id: plantId } = await params

    // Verify the plant belongs to the user
    const plant = await prisma.plant.findFirst({
      where: {
        id: plantId,
        userId: session.user.id
      }
    })

    if (!plant) {
      return NextResponse.json({ error: 'Plant not found' }, { status: 404 })
    }

    const now = new Date()
    const nextWateringDue = new Date(now)
    nextWateringDue.setDate(now.getDate() + plant.wateringFrequency)

    // Create watering record
    const wateringRecord = await prisma.wateringRecord.create({
      data: {
        plantId,
        notes: notes || null
      }
    })

    // Update plant's last watered and next due date
    const updatedPlant = await prisma.plant.update({
      where: { id: plantId },
      data: {
        lastWatered: now,
        nextWateringDue
      },
      include: {
        wateringHistory: {
          orderBy: { wateredAt: 'desc' },
          take: 5
        }
      }
    })

    return NextResponse.json({ 
      plant: updatedPlant,
      wateringRecord 
    })
  } catch (error) {
    console.error('Error recording watering:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
