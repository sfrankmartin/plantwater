import OpenAI from 'openai'

/**
 * Mock OpenAI Service
 * 
 * This service provides mock responses for plant identification and health analysis
 * during development. In production, set USE_MOCK_OPENAI=false to use real OpenAI API.
 * 
 * The interface remains the same, so switching to real OpenAI later
 * requires only changing the environment variable, not the calling code.
 */

const USE_MOCK_OPENAI = process.env.NODE_ENV === 'development' || process.env.USE_MOCK_OPENAI === 'true'

// Log the current mode
if (USE_MOCK_OPENAI) {
  console.log('🤖 OpenAI Mock Mode: Using mock responses for plant identification and health analysis')
} else {
  console.log('🌐 OpenAI Production Mode: Using real OpenAI API')
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'mock-key-for-development'
})

export interface PlantIdentificationResult {
  scientificName: string
  commonName: string
  plantType: string
  careInstructions: string
  wateringFrequency: number // days between watering
  lightRequirement: string
  humidityLevel: string
  confidence: number // 0-1
}

// Mock data for development
const MOCK_PLANT_IDENTIFICATIONS: PlantIdentificationResult[] = [
  {
    scientificName: 'Monstera deliciosa',
    commonName: 'Swiss Cheese Plant',
    plantType: 'tropical',
    careInstructions: 'Water when top inch of soil is dry. Loves bright, indirect light and high humidity. Support with a moss pole as it grows.',
    wateringFrequency: 7,
    lightRequirement: 'bright indirect',
    humidityLevel: 'high',
    confidence: 0.92
  },
  {
    scientificName: 'Epipremnum aureum',
    commonName: 'Golden Pothos',
    plantType: 'vine',
    careInstructions: 'Very low maintenance. Water when soil feels dry. Thrives in various light conditions and can trail or climb.',
    wateringFrequency: 10,
    lightRequirement: 'low to bright indirect',
    humidityLevel: 'medium',
    confidence: 0.88
  },
  {
    scientificName: 'Sansevieria trifasciata',
    commonName: 'Snake Plant',
    plantType: 'succulent',
    careInstructions: 'Extremely drought tolerant. Water sparingly and allow soil to dry completely between waterings. Tolerates low light.',
    wateringFrequency: 14,
    lightRequirement: 'low to bright indirect',
    humidityLevel: 'low',
    confidence: 0.95
  },
  {
    scientificName: 'Ficus elastica',
    commonName: 'Rubber Plant',
    plantType: 'tree',
    careInstructions: 'Water when top 2 inches of soil are dry. Prefers bright, indirect light. Wipe leaves regularly to keep them glossy.',
    wateringFrequency: 7,
    lightRequirement: 'bright indirect',
    humidityLevel: 'medium',
    confidence: 0.85
  },
  {
    scientificName: 'Chlorophytum comosum',
    commonName: 'Spider Plant',
    plantType: 'perennial',
    careInstructions: 'Easy care plant that produces baby plants. Water regularly but allow soil to dry between waterings. Great for beginners.',
    wateringFrequency: 5,
    lightRequirement: 'bright indirect',
    humidityLevel: 'medium',
    confidence: 0.90
  },
  {
    scientificName: 'Zamioculcas zamiifolia',
    commonName: 'ZZ Plant',
    plantType: 'succulent',
    careInstructions: 'Very drought tolerant with glossy leaves. Water only when soil is completely dry. Perfect for low light areas.',
    wateringFrequency: 21,
    lightRequirement: 'low to medium',
    humidityLevel: 'low',
    confidence: 0.87
  }
]

const MOCK_HEALTH_ANALYSES = [
  {
    healthScore: 95,
    healthStatus: 'Excellent',
    issues: [],
    recommendations: ['Continue current care routine', 'Monitor for new growth', 'Consider fertilizing monthly during growing season']
  },
  {
    healthScore: 82,
    healthStatus: 'Good',
    issues: ['Slight yellowing on lower leaves'],
    recommendations: ['Check soil moisture - may be slightly overwatered', 'Remove yellow leaves', 'Ensure good drainage']
  },
  {
    healthScore: 65,
    healthStatus: 'Needs Attention',
    issues: ['Brown leaf tips', 'Soil appears dry'],
    recommendations: ['Increase watering frequency slightly', 'Check humidity levels', 'Trim brown tips with clean scissors']
  },
  {
    healthScore: 45,
    healthStatus: 'Critical',
    issues: ['Wilting leaves', 'Possible root rot', 'Pest damage visible'],
    recommendations: ['Check roots for rot and trim if necessary', 'Repot in fresh, well-draining soil', 'Treat for pests with appropriate method']
  },
  {
    healthScore: 78,
    healthStatus: 'Good',
    issues: ['Leggy growth'],
    recommendations: ['Provide more light to encourage compact growth', 'Pinch growing tips to encourage bushiness', 'Rotate plant weekly for even growth']
  }
]

export async function identifyPlant(imageBase64: string): Promise<PlantIdentificationResult> {
  // Use mock data in development
  if (USE_MOCK_OPENAI) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))
    
    // Return a random mock identification
    const randomIndex = Math.floor(Math.random() * MOCK_PLANT_IDENTIFICATIONS.length)
    return MOCK_PLANT_IDENTIFICATIONS[randomIndex]
  }

  // Production OpenAI API call
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Please identify this plant and provide care instructions. Respond with a JSON object containing:
              - scientificName: scientific name of the plant
              - commonName: common name of the plant
              - plantType: type/category (e.g., "succulent", "tropical", "herb", "flowering")
              - careInstructions: detailed care instructions (2-3 sentences)
              - wateringFrequency: number of days between waterings (integer)
              - lightRequirement: light needs (e.g., "bright indirect", "low light", "full sun")
              - humidityLevel: humidity preference (e.g., "low", "medium", "high")
              - confidence: your confidence in the identification (0-1, where 1 is very confident)
              
              If you cannot identify the plant with reasonable confidence, set confidence to 0 and provide general houseplant care advice.`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`
              }
            }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.1
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    // Parse the JSON response with error handling
    let result: PlantIdentificationResult
    try {
      result = JSON.parse(content) as PlantIdentificationResult
    } catch (error) {
      console.error('Failed to parse OpenAI JSON response:', error)
      throw new Error('Invalid JSON response from OpenAI')
    }

    // Validate the response structure
    if (!result.scientificName || !result.commonName || !result.wateringFrequency) {
      throw new Error('Invalid response structure from OpenAI')
    }

    return result
  } catch (error) {
    console.error('Error identifying plant:', error)
    
    // Return fallback response for unknown plants
    return {
      scientificName: 'Unknown species',
      commonName: 'Unknown plant',
      plantType: 'houseplant',
      careInstructions: 'Water when the top inch of soil feels dry. Place in bright, indirect light. Ensure good drainage.',
      wateringFrequency: 7,
      lightRequirement: 'bright indirect',
      humidityLevel: 'medium',
      confidence: 0
    }
  }
}

export async function analyzePlantHealth(imageBase64: string, plantInfo: { scientificName: string, commonName: string }): Promise<{
  healthScore: number
  healthStatus: string
  issues: string[]
  recommendations: string[]
}> {
  // Use mock data in development
  if (USE_MOCK_OPENAI) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1500))
    
    // If no image provided, return basic response
    if (!imageBase64) {
      return {
        healthScore: 75,
        healthStatus: 'Unknown - no image provided',
        issues: ['Cannot assess visual health without plant image'],
        recommendations: [
          'Upload a photo for detailed health analysis',
          'Follow regular care routine',
          'Monitor for any changes in appearance'
        ]
      }
    }
    
    // Return a random mock health analysis
    const randomIndex = Math.floor(Math.random() * MOCK_HEALTH_ANALYSES.length)
    return MOCK_HEALTH_ANALYSES[randomIndex]
  }

  // Production OpenAI API call
  try {
    // If no image provided, return basic text-based analysis
    if (!imageBase64) {
      return {
        healthScore: 75,
        healthStatus: 'Unknown - no image provided',
        issues: ['Cannot assess visual health without plant image'],
        recommendations: [
          'Upload a photo for detailed health analysis',
          'Follow regular care routine',
          'Monitor for any changes in appearance'
        ]
      }
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze the health of this ${plantInfo.commonName} (${plantInfo.scientificName}). 
              Look for signs of disease, pests, nutrient deficiency, overwatering, underwatering, or other issues.
              
              Respond with a JSON object containing:
              - healthScore: number from 0-100 (100 being perfect health)
              - healthStatus: descriptive status (e.g., "Excellent", "Good", "Needs Attention", "Critical")
              - issues: array of specific issues you notice (empty if healthy)
              - recommendations: array of specific care recommendations
              
              Be specific about what you observe and provide actionable advice.`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`
              }
            }
          ]
        }
      ],
      max_tokens: 800,
      temperature: 0.1
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    let result
    try {
      result = JSON.parse(content)
    } catch (error) {
      console.error('Failed to parse OpenAI JSON response:', error)
      throw new Error('Invalid JSON response from OpenAI')
    }
    
    // Ensure required fields exist
    return {
      healthScore: result.healthScore || 75,
      healthStatus: result.healthStatus || 'Good',
      issues: result.issues || [],
      recommendations: result.recommendations || ['Continue with regular care routine.']
    }
  } catch (error) {
    console.error('Error analyzing plant health:', error)
    
    return {
      healthScore: 75,
      healthStatus: 'Good - analysis unavailable',
      issues: [],
      recommendations: ['Continue with regular care routine.', 'Monitor plant condition regularly.']
    }
  }
}

// TODO: Switch to production OpenAI
// To use real OpenAI API in production:
// 1. Set environment variable: USE_MOCK_OPENAI=false
// 2. Or change NODE_ENV to 'production'
// 3. Ensure OPENAI_API_KEY is set with a valid API key
// 
// The mock responses provide realistic plant data for development and testing
// without consuming OpenAI API credits or requiring an internet connection.
