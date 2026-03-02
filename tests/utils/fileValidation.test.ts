import { describe, it, expect } from 'vitest'
import { validateFile, getFileIcon, formatFileSize } from '../../src/utils/fileValidation'
import { MAX_FILE_SIZE } from '../../src/types/ai'

describe('fileValidation', () => {
  describe('validateFile', () => {
    it('should validate a valid PDF file', () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const result = validateFile(file)
      
      expect(result.isValid).toBe(true)
      expect(result.fileType).toBe('application/pdf')
      expect(result.fileSize).toBe(file.size)
    })

    it('should validate a valid DOCX file', () => {
      const file = new File(['content'], 'test.docx', { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      })
      const result = validateFile(file)
      
      expect(result.isValid).toBe(true)
      expect(result.fileType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    })

    it('should validate a valid PPTX file', () => {
      const file = new File(['content'], 'test.pptx', { 
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' 
      })
      const result = validateFile(file)
      
      expect(result.isValid).toBe(true)
    })

    it('should reject unsupported file types', () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' })
      const result = validateFile(file)
      
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Unsupported file type')
    })

    it('should reject files that are too large', () => {
      const largeContent = 'x'.repeat(MAX_FILE_SIZE + 1)
      const file = new File([largeContent], 'large.pdf', { type: 'application/pdf' })
      const result = validateFile(file)
      
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('File size too large')
    })

    it('should accept files at the maximum size limit', () => {
      const maxContent = 'x'.repeat(MAX_FILE_SIZE)
      const file = new File([maxContent], 'max.pdf', { type: 'application/pdf' })
      const result = validateFile(file)
      
      expect(result.isValid).toBe(true)
    })

    it('should accept empty files within size limit', () => {
      const file = new File([], 'empty.pdf', { type: 'application/pdf' })
      const result = validateFile(file)
      
      expect(result.isValid).toBe(true)
    })
  })

  describe('getFileIcon', () => {
    it('should return PDF icon for PDF files', () => {
      expect(getFileIcon('application/pdf')).toBe('📄')
    })

    it('should return presentation icon for PowerPoint files', () => {
      expect(getFileIcon('application/vnd.openxmlformats-officedocument.presentationml.presentation')).toBe('📊')
      expect(getFileIcon('application/vnd.ms-powerpoint')).toBe('📊')
    })

    it('should return document icon for Word files', () => {
      expect(getFileIcon('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('📝')
      expect(getFileIcon('application/msword')).toBe('📝')
    })

    it('should return default icon for unknown file types', () => {
      expect(getFileIcon('application/unknown')).toBe('📎')
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

    it('should handle large file sizes', () => {
      expect(formatFileSize(5 * 1024 * 1024 * 1024)).toBe('5 GB')
    })
  })
})
