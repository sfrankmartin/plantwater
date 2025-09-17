import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSession } from '@/lib/session'
import { cloudStorage } from '@/lib/cloudStorage'
import { csrfProtection } from '@/lib/csrf'

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

    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Basic file size check before processing (the secure processor will do more validation)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 10MB' }, { status: 400 })
    }

    // Use secure image processing - this will:
    // 1. Validate file type using magic-bytes (not trusting client MIME)
    // 2. Strip EXIF data for privacy
    // 3. Re-encode to WebP format for security and efficiency
    // 4. Generate secure filename
    try {
      const result = await cloudStorage.uploadImageSecurely(file, 'plant')
      
      return NextResponse.json({ 
        imageUrl: result.imageUrl,
        metadata: {
          format: result.processedImage.format,
          width: result.processedImage.width,
          height: result.processedImage.height,
          size: result.processedImage.size
        }
      })
    } catch (processingError) {
      // Image processing failed - likely invalid image or security issue
      const errorMessage = processingError instanceof Error ? processingError.message : 'Image processing failed'
      
      return NextResponse.json({ 
        error: `Image validation failed: ${errorMessage}` 
      }, { status: 400 })
    }

  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
