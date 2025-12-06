import { describe, it, expect } from 'vitest'
import { validateFile, getFileIcon, formatFileSize } from '../fileValidation'
import { MAX_FILE_SIZE } from '../../types/ai'

describe('fileValidation', () => {
  describe('validateFile', () => {
    it('should validate a valid PDF file', () => {
      const file = new File(['content'], 'test.pdf', {
        type: 'application/pdf',
      })
      const result = validateFile(file)
      
      expect(result.isValid).toBe(true)
      expect(result.fileType).toBe('application/pdf')
      expect(result.fileSize).toBe(file.size)
    })

    it('should validate a valid DOCX file', () => {
      const file = new File(['content'], 'test.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
      const result = validateFile(file)
      
      expect(result.isValid).toBe(true)
      expect(result.fileType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    })

    it('should validate a valid PPTX file', () => {
      const file = new File(['content'], 'test.pptx', {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      })
      const result = validateFile(file)
      
      expect(result.isValid).toBe(true)
      expect(result.fileType).toBe('application/vnd.openxmlformats-officedocument.presentationml.presentation')
    })

    it('should reject an unsupported file type', () => {
      const file = new File(['content'], 'test.txt', {
        type: 'text/plain',
      })
      const result = validateFile(file)
      
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Unsupported file type')
    })

    it('should reject a file that exceeds maximum size', () => {
      // Create a file object and manually set size to exceed limit
      const file = new File(['content'], 'large.pdf', {
        type: 'application/pdf',
      })
      Object.defineProperty(file, 'size', { value: MAX_FILE_SIZE + 1, writable: false })
      
      const result = validateFile(file)
      
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('File size too large')
    })
  })

  describe('getFileIcon', () => {
    it('should return PDF icon for PDF files', () => {
      expect(getFileIcon('application/pdf')).toBe('📄')
      expect(getFileIcon('pdf')).toBe('📄')
    })

    it('should return document icon for Word files', () => {
      expect(getFileIcon('application/msword')).toBe('📝')
      expect(getFileIcon('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('📝')
      expect(getFileIcon('word')).toBe('📝')
      expect(getFileIcon('document')).toBe('📝')
    })

    it('should return presentation icon for PowerPoint files', () => {
      expect(getFileIcon('application/vnd.ms-powerpoint')).toBe('📊')
      expect(getFileIcon('application/vnd.openxmlformats-officedocument.presentationml.presentation')).toBe('📊')
      expect(getFileIcon('presentation')).toBe('📊')
      expect(getFileIcon('powerpoint')).toBe('📊')
    })

    it('should return default icon for unknown file types', () => {
      expect(getFileIcon('unknown/type')).toBe('📎')
      expect(getFileIcon('')).toBe('📎')
    })
  })

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 Bytes')
      expect(formatFileSize(500)).toBe('500 Bytes')
    })

    it('should format kilobytes correctly', () => {
      expect(formatFileSize(1024)).toBe('1 KB')
      expect(formatFileSize(2048)).toBe('2 KB')
      expect(formatFileSize(1536)).toBe('1.5 KB')
    })

    it('should format megabytes correctly', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1 MB')
      expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB')
    })

    it('should format gigabytes correctly', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB')
    })
  })
})
