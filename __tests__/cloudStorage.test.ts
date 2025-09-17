import { cloudStorage } from '../src/lib/cloudStorage'
import { promises as fs } from 'fs'

// Mock uuid module
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-123'),
}))

// Mock the image processing module
jest.mock('@/lib/imageProcessing', () => ({
  processImageSecurely: jest.fn().mockResolvedValue({
    buffer: Buffer.from('processed-webp-data'),
    filename: 'plant_123456_abc123.webp',
    format: 'webp',
    width: 800,
    height: 600,
    size: 1024
  })
}))

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    unlink: jest.fn(),
  },
}))

const mockFs = fs as jest.Mocked<typeof fs>

describe('CloudStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('uploadImage', () => {
    it('should upload a Buffer and return a URL', async () => {
      const mockBuffer = Buffer.from('test content')
      mockFs.access.mockResolvedValueOnce(undefined) // Directory exists
      mockFs.writeFile.mockResolvedValueOnce(undefined)

      // Mock console.warn to suppress expected security warning during testing
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await cloudStorage.uploadImage(mockBuffer, 'test.png')

      expect(result).toBe('/api/images/mock-uuid-123.png')
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.png'),
        mockBuffer
      )
      
      // Verify the security warning was issued
      expect(consoleWarnSpy).toHaveBeenCalledWith('SECURITY: Using legacy buffer upload method. Consider migrating to File-based uploads.')
      
      // Restore console.warn
      consoleWarnSpy.mockRestore()
    })

    it('should create upload directory when needed', async () => {
    const mockAccess = jest.fn().mockRejectedValue(new Error('Directory does not exist'))
    const mockMkdir = jest.fn().mockResolvedValue(undefined)
    
    ;(fs.access as jest.Mock) = mockAccess
    ;(fs.mkdir as jest.Mock) = mockMkdir

    // Create a mock file
    const mockFile = {
      name: 'test.jpg',
      type: 'image/jpeg',
      size: 1024,
      arrayBuffer: jest.fn().mockResolvedValue(Buffer.from('fake image data'))
    } as unknown as File

    // This should trigger directory creation
    await cloudStorage.uploadImageSecurely(mockFile)
    
    expect(mockAccess).toHaveBeenCalled()
    expect(mockMkdir).toHaveBeenCalledWith(
      expect.stringContaining('public/uploads/plants'),
      { recursive: true }
    )
  })
  })

  describe('uploadImageSecurely', () => {
    it('should securely process and upload a File', async () => {
      const mockFile = {
        name: 'test.jpg',
        type: 'image/jpeg',
        size: 1024,
        arrayBuffer: jest.fn().mockResolvedValue(Buffer.from('test content').buffer)
      } as unknown as File
      
      mockFs.access.mockResolvedValueOnce(undefined)
      mockFs.writeFile.mockResolvedValueOnce(undefined)

      const result = await cloudStorage.uploadImageSecurely(mockFile, 'plant')

      expect(result.imageUrl).toBe('/api/images/plant_123456_abc123.webp')
      expect(result.processedImage.format).toBe('webp')
      expect(result.processedImage.width).toBe(800)
      expect(result.processedImage.height).toBe(600)
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('plant_123456_abc123.webp'),
        expect.any(Buffer)
      )
    })
  })

  describe('deleteImage', () => {
    it('should delete an image and return true', async () => {
      mockFs.unlink.mockResolvedValueOnce(undefined)

      const result = await cloudStorage.deleteImage('/api/images/test.jpg')

      expect(result).toBe(true)
      expect(mockFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('test.jpg')
      )
    })

    it('should return false when deletion fails', async () => {
      // Mock console.error to prevent the error message during test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      
      mockFs.unlink.mockRejectedValueOnce(new Error('File not found'))

      const result = await cloudStorage.deleteImage('/api/images/test.jpg')

      expect(result).toBe(false)
      
      // Restore console.error
      consoleSpy.mockRestore()
    })
  })
})
