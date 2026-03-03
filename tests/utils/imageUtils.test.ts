import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createThumbnail } from '../../src/utils/imageUtils'

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockObjectUrl = 'blob:http://localhost/mock-object-url'
const mockCreateObjectURL = vi.fn(() => mockObjectUrl)
const mockRevokeObjectURL = vi.fn()

// Mock canvas and context
const mockToDataURL = vi.fn(() => 'data:image/jpeg;base64,mockbase64data')
const mockDrawImage = vi.fn()
const mockGetContext = vi.fn(() => ({
  drawImage: mockDrawImage,
}))

// Store original Image
const OriginalImage = globalThis.Image

describe('imageUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock URL methods
    global.URL.createObjectURL = mockCreateObjectURL
    global.URL.revokeObjectURL = mockRevokeObjectURL

    // Mock document.createElement to return mock canvas
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: mockGetContext,
          toDataURL: mockToDataURL,
        } as unknown as HTMLCanvasElement
      }
      return document.createElement(tag)
    })
  })

  afterEach(() => {
    // Restore original Image
    globalThis.Image = OriginalImage
  })

  function mockImageConstructor(opts: { triggerError?: boolean; width?: number; height?: number } = {}) {
    const { triggerError = false, width = 400, height = 300 } = opts

    globalThis.Image = class MockImage {
      width = width
      height = height
      src = ''
      onload: (() => void) | null = null
      onerror: (() => void) | null = null

      constructor() {
        // Use a getter/setter on src to trigger onload/onerror when set
        let _src = ''
        Object.defineProperty(this, 'src', {
          get: () => _src,
          set: (value: string) => {
            _src = value
            if (triggerError) {
              setTimeout(() => this.onerror?.(), 0)
            } else {
              setTimeout(() => this.onload?.(), 0)
            }
          },
        })
      }
    } as unknown as typeof Image
  }

  describe('createThumbnail', () => {
    it('should create a thumbnail and return a data URL', async () => {
      mockImageConstructor()
      const file = new File(['fake-image-data'], 'photo.jpg', { type: 'image/jpeg' })

      const result = await createThumbnail(file)

      expect(result).toBe('data:image/jpeg;base64,mockbase64data')
      expect(mockCreateObjectURL).toHaveBeenCalledWith(file)
      expect(mockRevokeObjectURL).toHaveBeenCalledWith(mockObjectUrl)
      expect(mockGetContext).toHaveBeenCalledWith('2d')
      expect(mockDrawImage).toHaveBeenCalled()
      expect(mockToDataURL).toHaveBeenCalledWith('image/jpeg', 0.7)
    })

    it('should scale down images wider than maxWidth', async () => {
      mockImageConstructor({ width: 400, height: 300 })
      const file = new File(['fake-image-data'], 'wide.png', { type: 'image/png' })

      const result = await createThumbnail(file, 200)

      expect(result).toBe('data:image/jpeg;base64,mockbase64data')
      // With maxWidth 200: new width = 200, new height = round(300 * 200 / 400) = 150
      expect(mockDrawImage).toHaveBeenCalled()
    })

    it('should not scale images smaller than maxWidth', async () => {
      mockImageConstructor({ width: 100, height: 80 })
      const file = new File(['fake-image-data'], 'small.jpg', { type: 'image/jpeg' })

      const result = await createThumbnail(file, 200)

      expect(result).toBe('data:image/jpeg;base64,mockbase64data')
      expect(mockDrawImage).toHaveBeenCalled()
    })

    it('should use custom quality parameter', async () => {
      mockImageConstructor()
      const file = new File(['fake-image-data'], 'photo.jpg', { type: 'image/jpeg' })

      await createThumbnail(file, 200, 0.5)

      expect(mockToDataURL).toHaveBeenCalledWith('image/jpeg', 0.5)
    })

    it('should reject when image fails to load', async () => {
      mockImageConstructor({ triggerError: true })
      const file = new File(['bad-data'], 'broken.jpg', { type: 'image/jpeg' })

      await expect(createThumbnail(file)).rejects.toThrow('Failed to load image for thumbnail generation')
      expect(mockRevokeObjectURL).toHaveBeenCalledWith(mockObjectUrl)
    })

    it('should reject when canvas context is null', async () => {
      mockImageConstructor()
      mockGetContext.mockReturnValueOnce(null)
      const file = new File(['fake-image-data'], 'photo.jpg', { type: 'image/jpeg' })

      await expect(createThumbnail(file)).rejects.toThrow('Failed to get canvas context')
    })

    it('should revoke object URL after successful thumbnail creation', async () => {
      mockImageConstructor()
      const file = new File(['fake-image-data'], 'photo.jpg', { type: 'image/jpeg' })

      await createThumbnail(file)

      expect(mockRevokeObjectURL).toHaveBeenCalledTimes(1)
      expect(mockRevokeObjectURL).toHaveBeenCalledWith(mockObjectUrl)
    })

    it('should use default maxWidth and quality', async () => {
      mockImageConstructor({ width: 400, height: 200 })
      const file = new File(['fake-image-data'], 'photo.jpg', { type: 'image/jpeg' })

      await createThumbnail(file)

      // Default maxWidth is 200, default quality is 0.7
      expect(mockToDataURL).toHaveBeenCalledWith('image/jpeg', 0.7)
    })
  })
})
