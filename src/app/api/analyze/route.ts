import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSession } from '@/lib/session'
import { analyzePlantHealth } from '@/lib/openai'
import { prisma } from '@/lib/prisma'
import { csrfProtection } from '@/lib/csrf'
import { rateLimitMiddleware, getClientIP } from '@/lib/rateLimit'
import fs from 'fs'
import path from 'path'

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

    // Rate limiting for AI analyze endpoint - per user and per IP
    const userId = session.user.id
    const clientIP = getClientIP(request)
    
    // Check user-based rate limit first
    const userRateLimit = rateLimitMiddleware('AI_ANALYZE', userId, 'user')
    if (userRateLimit.limited) {
      console.warn(`SECURITY: AI analyze rate limit exceeded for user: ${userId}`)
      return userRateLimit.response!
    }
    
    // Also check IP-based rate limit as backup
    const ipRateLimit = rateLimitMiddleware('AI_ANALYZE', clientIP, 'ip')
    if (ipRateLimit.limited) {
      console.warn(`SECURITY: AI analyze rate limit exceeded for IP: ${clientIP}`)
      return ipRateLimit.response!
    }

    const body = await request.json()
    const { imageBase64, plantInfo, plantId } = body
    
    // Handle plant ID analysis (from plant detail page) - prioritize this
    if (plantId) {
      // Get plant from database
      const plant = await prisma.plant.findFirst({
        where: {
          id: plantId,
          user: {
            email: session.email
          }
        },
        include: {
          wateringHistory: {
            orderBy: {
              wateredAt: 'desc'
            },
            take: 5 // Recent watering history for context
          }
        }
      })

      if (!plant) {
        return NextResponse.json({ error: 'Plant not found' }, { status: 404 })
      }

      // Get image data - prioritize new uploaded image, fallback to profile image
      let imageBase64Data = imageBase64 // Use the newly uploaded image for analysis
      if (!imageBase64Data && plant.profileImageUrl) {
        try {
          // If no new image but plant has a profile image, use that as fallback
          if (plant.profileImageUrl.startsWith('/uploads/')) {
            const imagePath = path.join(process.cwd(), 'public', plant.profileImageUrl)
            if (fs.existsSync(imagePath)) {
              const imageBuffer = fs.readFileSync(imagePath)
              imageBase64Data = imageBuffer.toString('base64')
            }
          }
        } catch (err) {
          console.warn('Could not read plant image for analysis:', err)
          // Continue without image - we can still analyze based on text data
        }
      }

      // Create plant info object for analysis
      const plantInfoForAnalysis = {
        scientificName: plant.scientificName || 'Unknown species',
        commonName: plant.name
      }

      // Always generate new analysis (for potential monetization)
      let newAnalysis
      // If we have an image, use it for analysis, otherwise provide text-based analysis
      if (imageBase64Data) {
        newAnalysis = await analyzePlantHealth(imageBase64Data, plantInfoForAnalysis)
      } else {
        // Provide text-based analysis when no image is available
        newAnalysis = {
          healthScore: 75, // Default healthy score
          healthStatus: 'Good - based on care data',
          recommendations: [
            `Water every ${plant.wateringFrequency} days as scheduled`,
            plant.lightRequirement ? `Ensure ${plant.lightRequirement} lighting conditions` : 'Provide appropriate lighting',
            plant.humidityLevel ? `Maintain ${plant.humidityLevel} humidity levels` : 'Monitor humidity levels',
            'Check for pests and diseases regularly'
          ].filter(Boolean),
          issues: [] as string[]
        }

        // Add watering-related recommendations based on schedule
        if (plant.nextWateringDue) {
          const today = new Date()
          const nextWatering = new Date(plant.nextWateringDue)
          const daysUntilWatering = Math.ceil((nextWatering.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          
          if (daysUntilWatering < 0) {
            newAnalysis.issues.push(`Watering is ${Math.abs(daysUntilWatering)} days overdue`)
            newAnalysis.recommendations.unshift('Water immediately - plant is overdue for watering')
            newAnalysis.healthScore = 50
            newAnalysis.healthStatus = 'Needs Attention - overdue watering'
          } else if (daysUntilWatering === 0) {
            newAnalysis.recommendations.unshift('Water today as scheduled')
          }
        }
      }

      // Store the new analysis in the database
      const savedAnalysis = await prisma.plantAnalysis.create({
        data: {
          plantId: plant.id,
          healthScore: newAnalysis.healthScore,
          healthStatus: newAnalysis.healthStatus,
          recommendations: JSON.stringify(newAnalysis.recommendations),
          issues: JSON.stringify(newAnalysis.issues)
        }
      })

      return NextResponse.json({
        analysis: {
          ...newAnalysis,
          createdAt: savedAnalysis.createdAt
        }
      })
    }
    
    // Handle direct image analysis (from plant identification) - when no plantId
    if (imageBase64 && plantInfo && !plantId) {
      const analysis = await analyzePlantHealth(imageBase64, plantInfo)
      return NextResponse.json({ analysis })
    }
    
    return NextResponse.json({ 
      error: 'Either imageBase64 with plantInfo, or plantId is required' 
    }, { status: 400 })

  } catch (error) {
    console.error('Error analyzing plant health:', error)
    return NextResponse.json(
      { error: 'Failed to analyze plant health' },
      { status: 500 }
    )
  }
}
