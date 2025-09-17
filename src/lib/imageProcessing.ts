/**
 * Secure Image Processing Utility
 * 
 * Provides secure image upload handling with:
 * - Magic-byte validation (not trusting client MIME types)
 * - EXIF data stripping for privacy
 * - Re-encoding to safe formats (WebP)
 * - Size and dimension limits
 * - Secure filename generation
 */

import sharp from 'sharp'

// Configuration
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_DIMENSIONS = 4096 // 4K max width/height
const ALLOWED_FORMATS = ['jpeg', 'jpg', 'png', 'webp', 'gif', 'tiff', 'bmp', 'avif'] as const
const OUTPUT_FORMAT = 'webp' // Always convert to WebP for security and efficiency
const OUTPUT_QUALITY = 85 // WebP quality (1-100)

export interface ImageValidationResult {
  isValid: boolean
  error?: string
  format?: string
  width?: number
  height?: number
  size?: number
}

export interface ProcessedImage {
  buffer: Buffer
  filename: string
  format: string
  width: number
  height: number
  size: number
}

/**
 * Validates image file using magic-byte detection
 * Does NOT trust client-provided MIME types
 */
export async function validateImageFile(file: File): Promise<ImageValidationResult> {
  try {
    // Convert File to Buffer for processing
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Check file size
    if (buffer.length > MAX_FILE_SIZE) {
      return {
        isValid: false,
        error: `File size too large. Maximum allowed: ${MAX_FILE_SIZE / (1024 * 1024)}MB`
      }
    }
    
    // Magic-byte validation - detect actual file type
    const { fileTypeFromBuffer } = await import('file-type')
    const fileType = await fileTypeFromBuffer(buffer)
    
    if (!fileType) {
      return {
        isValid: false,
        error: 'Unable to determine file type. File may be corrupted or not a valid image.'
      }
    }
    
    // Check if it's actually an image format we support
    if (!ALLOWED_FORMATS.includes(fileType.ext as typeof ALLOWED_FORMATS[number])) {
      return {
        isValid: false,
        error: `Unsupported image format: ${fileType.ext}. Allowed formats: ${ALLOWED_FORMATS.join(', ')}`
      }
    }
    
    // Verify the file can be processed as an image using Sharp
    try {
      const metadata = await sharp(buffer).metadata()
      
      if (!metadata.width || !metadata.height) {
        return {
          isValid: false,
          error: 'Invalid image: unable to read dimensions'
        }
      }
      
      // Check image dimensions
      if (metadata.width > MAX_DIMENSIONS || metadata.height > MAX_DIMENSIONS) {
        return {
          isValid: false,
          error: `Image dimensions too large. Maximum: ${MAX_DIMENSIONS}x${MAX_DIMENSIONS}px`
        }
      }
      
      return {
        isValid: true,
        format: fileType.ext,
        width: metadata.width,
        height: metadata.height,
        size: buffer.length
      }
    } catch {
      return {
        isValid: false,
        error: 'File appears to be corrupted or not a valid image'
      }
    }
    
  } catch (error) {
    console.error('Image validation error:', error)
    return {
      isValid: false,
      error: 'Failed to validate image file'
    }
  }
}

/**
 * Securely processes an image file:
 * 1. Validates using magic-bytes
 * 2. Strips EXIF data
 * 3. Re-encodes to WebP format
 * 4. Generates secure filename
 */
export async function processImageSecurely(file: File, baseFilename?: string): Promise<ProcessedImage> {
  // First validate the image
  const validation = await validateImageFile(file)
  if (!validation.isValid) {
    throw new Error(validation.error || 'Image validation failed')
  }
  
  try {
    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const inputBuffer = Buffer.from(arrayBuffer)
    
    // Process with Sharp:
    // - Strip all metadata (including EXIF)
    // - Convert to WebP for security and efficiency
    // - Maintain reasonable quality
    const processedBuffer = await sharp(inputBuffer)
      .webp({ 
        quality: OUTPUT_QUALITY,
        effort: 6, // Good compression vs speed balance
        smartSubsample: true // Better quality for photos
      })
      .toBuffer()
    
    // Get final metadata after processing
    const finalMetadata = await sharp(processedBuffer).metadata()
    
    // Generate secure filename
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const filename = `${baseFilename || 'image'}_${timestamp}_${random}.webp`
    
    return {
      buffer: processedBuffer,
      filename,
      format: OUTPUT_FORMAT,
      width: finalMetadata.width || 0,
      height: finalMetadata.height || 0,
      size: processedBuffer.length
    }
    
  } catch (error) {
    console.error('Image processing error:', error)
    throw new Error('Failed to process image securely')
  }
}

/**
 * Validates image buffer (for server-side processing)
 */
export async function validateImageBuffer(buffer: Buffer): Promise<ImageValidationResult> {
  try {
    // Check file size
    if (buffer.length > MAX_FILE_SIZE) {
      return {
        isValid: false,
        error: `File size too large. Maximum allowed: ${MAX_FILE_SIZE / (1024 * 1024)}MB`
      }
    }
    
    // Magic-byte validation
    const { fileTypeFromBuffer } = await import('file-type')
    const fileType = await fileTypeFromBuffer(buffer)
    
    if (!fileType || !ALLOWED_FORMATS.includes(fileType.ext as typeof ALLOWED_FORMATS[number])) {
      return {
        isValid: false,
        error: 'Invalid or unsupported image format'
      }
    }
    
    // Verify with Sharp
    const metadata = await sharp(buffer).metadata()
    
    if (!metadata.width || !metadata.height) {
      return {
        isValid: false,
        error: 'Invalid image: unable to read dimensions'
      }
    }
    
    if (metadata.width > MAX_DIMENSIONS || metadata.height > MAX_DIMENSIONS) {
      return {
        isValid: false,
        error: `Image dimensions too large. Maximum: ${MAX_DIMENSIONS}x${MAX_DIMENSIONS}px`
      }
    }
    
    return {
      isValid: true,
      format: fileType.ext,
      width: metadata.width,
      height: metadata.height,
      size: buffer.length
    }
    
  } catch {
    return {
      isValid: false,
      error: 'Failed to validate image'
    }
  }
}

/**
 * Security-focused image constraints
 */
export const ImageSecurity = {
  MAX_FILE_SIZE,
  MAX_DIMENSIONS,
  ALLOWED_FORMATS,
  OUTPUT_FORMAT,
  OUTPUT_QUALITY
} as const
