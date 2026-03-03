import { describe, it, expect, beforeEach, vi } from 'vitest'
import { documentProcessor } from '../../src/services/documentProcessor'
import * as pdfjsLib from 'pdfjs-dist'
import * as mammoth from 'mammoth'
import { PPTXParser } from 'pptx-parser'

// Mock pdfjs-dist
vi.mock('pdfjs-dist', () => {
  const mockPage = {
    getTextContent: vi.fn(),
  }
  
  const mockPdf = {
    numPages: 3,
    getPage: vi.fn().mockResolvedValue(mockPage),
  }
  
  const mockLoadingTask = {
    promise: Promise.resolve(mockPdf),
  }
  
  return {
    GlobalWorkerOptions: {
      workerSrc: '',
    },
    getDocument: vi.fn().mockReturnValue(mockLoadingTask),
  }
})

// Mock mammoth
vi.mock('mammoth', () => ({
  extractRawText: vi.fn(),
}))

// Mock pptx-parser
vi.mock('pptx-parser', () => ({
  PPTXParser: vi.fn().mockImplementation(() => ({
    parse: vi.fn().mockResolvedValue(undefined),
    slides: [],
  })),
}))

// Mock firebaseAILogicService for image OCR
vi.mock('../../src/services/firebaseAILogicService', () => ({
  firebaseAILogicService: {
    extractTextFromImage: vi.fn().mockResolvedValue('OCR extracted text from image'),
    generateResponse: vi.fn(),
    getCurrentProvider: vi.fn().mockReturnValue('mock'),
    getAvailableProviders: vi.fn().mockReturnValue(['mock']),
    testConnection: vi.fn().mockResolvedValue(true),
  },
}))

describe('documentProcessor', () => {
  // Helper to create mock File with arrayBuffer method
  const createMockFile = (name: string, type: string, content: string = 'test content'): File => {
    const buffer = new TextEncoder().encode(content).buffer
    const file = new File([content], name, { type })
    // Mock arrayBuffer method
    if (!file.arrayBuffer) {
      (file as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = async () => {
        return buffer
      }
    }
    return file
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('PDF Extraction', () => {
    it('should handle PDF extraction with empty pages gracefully', async () => {
      const emptyContent = {
        items: [],
      }

      const mockPage = {
        getTextContent: vi.fn().mockResolvedValue(emptyContent),
      }

      const mockPdf = {
        numPages: 1,
        getPage: vi.fn().mockResolvedValue(mockPage),
      }

      const mockLoadingTask = {
        promise: Promise.resolve(mockPdf),
      }

      vi.mocked(pdfjsLib.getDocument).mockReturnValue(mockLoadingTask as ReturnType<typeof pdfjsLib.getDocument>)

      const file = createMockFile('empty.pdf', 'application/pdf', '')
      const result = await documentProcessor.processDocument(file)

      // Should use fallback content when extraction fails
      expect(result.extractedContent).toBeTruthy()
      expect(result.fileName).toBe('empty.pdf')
    })

    it('should handle PDF extraction errors gracefully', async () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      vi.mocked(pdfjsLib.getDocument).mockReturnValue({
        promise: Promise.reject(new Error('PDF parsing failed')),
      } as ReturnType<typeof pdfjsLib.getDocument>)

      const file = createMockFile('corrupted.pdf', 'application/pdf', 'corrupted')
      const result = await documentProcessor.processDocument(file)

      // Should create fallback document
      expect(result.processed).toBe(true)
      expect(result.extractedContent).toBeTruthy()
      expect(result.fileName).toBe('corrupted.pdf')
      
      consoleSpy.mockRestore()
    })
  })

  describe('Word Document Extraction', () => {
    it('should handle DOCX extraction errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      vi.mocked(mammoth.extractRawText).mockRejectedValue(new Error('DOCX parsing failed'))

      const file = createMockFile('corrupted.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'corrupted')
      const result = await documentProcessor.processDocument(file)

      expect(result.processed).toBe(true)
      expect(result.extractedContent).toBeTruthy()

      consoleSpy.mockRestore()
    })

    it('should handle empty DOCX file', async () => {
      vi.mocked(mammoth.extractRawText).mockResolvedValue({
        value: '',
        messages: [],
      })

      const file = createMockFile('empty.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '')
      const result = await documentProcessor.processDocument(file)

      // Should use fallback
      expect(result.extractedContent).toBeTruthy()
      expect(result.fileName).toBe('empty.docx')
    })
  })

  describe('PowerPoint Extraction', () => {
    it('should handle PPTX extraction errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const mockParser = {
        parse: vi.fn().mockRejectedValue(new Error('PPTX parsing failed')),
        slides: [],
      }

      vi.mocked(PPTXParser).mockImplementation(() => mockParser as unknown as PPTXParser)

      const file = createMockFile('corrupted.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'corrupted')
      const result = await documentProcessor.processDocument(file)

      expect(result.processed).toBe(true)
      expect(result.extractedContent).toBeTruthy()

      consoleSpy.mockRestore()
    })
  })

  describe('Text Processing', () => {
    it('should generate summary for homework documents', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const file = createMockFile('homework.pdf', 'application/pdf', 'homework content')
      const result = await documentProcessor.processDocument(file)

      expect(result.summary).toContain('homework assignment')
      expect(result.keyTopics).toContain('Homework')

      consoleSpy.mockRestore()
    })

    it('should generate summary for syllabus documents', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const file = createMockFile('syllabus.pdf', 'application/pdf', 'syllabus content')
      const result = await documentProcessor.processDocument(file)

      expect(result.summary).toContain('syllabus')
      expect(result.keyTopics).toContain('Syllabus')

      consoleSpy.mockRestore()
    })

    it('should extract key topics from document', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const file = createMockFile('statistics_homework.pdf', 'application/pdf', 'statistics content')
      const result = await documentProcessor.processDocument(file)

      expect(result.keyTopics).toContain('Statistics')
      expect(result.keyTopics).toContain('Homework')

      consoleSpy.mockRestore()
    })

    it('should chunk text appropriately', async () => {
      const longText = 'word '.repeat(2000) // 2000 words
      const mockTextContent = {
        items: [{ str: longText }],
      }

      const mockPage = {
        getTextContent: vi.fn().mockResolvedValue(mockTextContent),
      }

      const mockPdf = {
        numPages: 1,
        getPage: vi.fn().mockResolvedValue(mockPage),
      }

      const mockLoadingTask = {
        promise: Promise.resolve(mockPdf),
      }

      vi.mocked(pdfjsLib.getDocument).mockReturnValue(mockLoadingTask as ReturnType<typeof pdfjsLib.getDocument>)

      const file = createMockFile('long.pdf', 'application/pdf', longText)
      const result = await documentProcessor.processDocument(file)

      // Should have multiple chunks
      expect(result.chunks.length).toBeGreaterThan(1)
    })

    it('should clean text properly', async () => {
      const messyContent = {
        items: [{ str: 'Text   with    multiple    spaces\n\n\nand\n\nline breaks' }],
      }

      const mockPage = {
        getTextContent: vi.fn().mockResolvedValue(messyContent),
      }

      const mockPdf = {
        numPages: 1,
        getPage: vi.fn().mockResolvedValue(mockPage),
      }

      const mockLoadingTask = {
        promise: Promise.resolve(mockPdf),
      }

      vi.mocked(pdfjsLib.getDocument).mockReturnValue(mockLoadingTask as ReturnType<typeof pdfjsLib.getDocument>)

      const file = createMockFile('messy.pdf', 'application/pdf', 'messy content')
      const result = await documentProcessor.processDocument(file)

      // Should have normalized whitespace
      expect(result.extractedContent).not.toContain('   ')
    })
  })

  describe('Image File Detection and Processing', () => {
    it('should detect JPEG as an image file', async () => {
      const file = createMockFile('photo.jpg', 'image/jpeg', 'fake-image-data')
      const result = await documentProcessor.processDocument(file)

      expect(result.processed).toBe(true)
      expect(result.fileName).toBe('photo.jpg')
      expect(result.fileType).toBe('image/jpeg')
    })

    it('should detect PNG as an image file', async () => {
      const file = createMockFile('screenshot.png', 'image/png', 'fake-image-data')
      const result = await documentProcessor.processDocument(file)

      expect(result.processed).toBe(true)
      expect(result.fileName).toBe('screenshot.png')
    })

    it('should detect HEIC as an image file', async () => {
      const file = createMockFile('iphone-photo.heic', 'image/heic', 'fake-image-data')
      const result = await documentProcessor.processDocument(file)

      expect(result.processed).toBe(true)
      expect(result.fileName).toBe('iphone-photo.heic')
      expect(result.fileType).toBe('image/heic')
    })

    it('should detect GIF as an image file', async () => {
      const file = createMockFile('animation.gif', 'image/gif', 'fake-image-data')
      const result = await documentProcessor.processDocument(file)

      expect(result.processed).toBe(true)
      expect(result.fileName).toBe('animation.gif')
    })

    it('should detect WebP as an image file', async () => {
      const file = createMockFile('image.webp', 'image/webp', 'fake-image-data')
      const result = await documentProcessor.processDocument(file)

      expect(result.processed).toBe(true)
      expect(result.fileName).toBe('image.webp')
    })

    it('should handle image OCR extraction failure gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { firebaseAILogicService } = await import('../../src/services/firebaseAILogicService')
      vi.mocked(firebaseAILogicService.extractTextFromImage).mockRejectedValueOnce(new Error('OCR failed'))

      const file = createMockFile('broken.jpg', 'image/jpeg', 'fake-image-data')
      const result = await documentProcessor.processDocument(file)

      // Should fall back gracefully
      expect(result.processed).toBe(true)
      expect(result.extractedContent).toBeTruthy()

      consoleSpy.mockRestore()
    })
  })

  describe('Markdown / Text File Extraction', () => {
    it('should process markdown files as text', async () => {
      const mdContent = '# Chapter 1\n\nThis is a markdown document with **bold** text.'
      const file = createMockFile('notes.md', 'text/markdown', mdContent)
      const result = await documentProcessor.processDocument(file)

      expect(result.processed).toBe(true)
      expect(result.fileName).toBe('notes.md')
      // Markdown files go through extractAsText → readFileAsText → cleanText
      expect(result.extractedContent).toBeTruthy()
    })

    it('should process unknown text-based file types as text', async () => {
      const textContent = 'This is plain text content for testing.'
      const file = createMockFile('readme.txt', 'text/plain', textContent)
      const result = await documentProcessor.processDocument(file)

      expect(result.processed).toBe(true)
      expect(result.extractedContent).toBeTruthy()
    })
  })

  describe('Fallback Document Generation', () => {
    it('should generate fallback for exam documents', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const file = createMockFile('midterm_exam.pdf', 'application/pdf', '')
      const result = await documentProcessor.processDocument(file)

      expect(result.summary).toContain('assessment')
      expect(result.keyTopics).toContain('Exam')

      consoleSpy.mockRestore()
    })

    it('should generate fallback for lecture notes', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const file = createMockFile('lecture_notes_week3.pdf', 'application/pdf', '')
      const result = await documentProcessor.processDocument(file)

      expect(result.summary).toContain('lecture notes')
      expect(result.keyTopics).toContain('Lecture Notes')

      consoleSpy.mockRestore()
    })

    it('should assess difficulty as advanced for graduate-level content', async () => {
      const advancedContent = {
        items: [{ str: 'This is an advanced graduate level course on quantum mechanics' }],
      }

      const mockPage = { getTextContent: vi.fn().mockResolvedValue(advancedContent) }
      const mockPdf = { numPages: 1, getPage: vi.fn().mockResolvedValue(mockPage) }
      const mockLoadingTask = { promise: Promise.resolve(mockPdf) }

      vi.mocked(pdfjsLib.getDocument).mockReturnValue(mockLoadingTask as ReturnType<typeof pdfjsLib.getDocument>)

      const file = createMockFile('advanced_course.pdf', 'application/pdf', 'advanced graduate')
      const result = await documentProcessor.processDocument(file)

      expect(result.difficulty).toBe('advanced')
    })

    it('should assess difficulty as beginner for introductory content', async () => {
      const beginnerContent = {
        items: [{ str: 'This is a basic introduction to computer science fundamentals' }],
      }

      const mockPage = { getTextContent: vi.fn().mockResolvedValue(beginnerContent) }
      const mockPdf = { numPages: 1, getPage: vi.fn().mockResolvedValue(mockPage) }
      const mockLoadingTask = { promise: Promise.resolve(mockPdf) }

      vi.mocked(pdfjsLib.getDocument).mockReturnValue(mockLoadingTask as ReturnType<typeof pdfjsLib.getDocument>)

      const file = createMockFile('intro_cs.pdf', 'application/pdf', 'basic introduction')
      const result = await documentProcessor.processDocument(file)

      expect(result.difficulty).toBe('beginner')
    })
  })

  describe('Document Context Methods', () => {
    it('should get document content for AI context', () => {
      const documents = [
        {
          id: 'doc1',
          fileName: 'test1.pdf',
          extractedContent: 'This is document 1 content',
          extractedText: 'This is document 1 content',
          summary: 'Test doc 1',
          keyTopics: ['Test'],
          fileType: 'application/pdf',
          fileSize: 1000,
          uploadDate: new Date(),
          processed: true,
          difficulty: 'beginner' as const,
          chunks: [],
          contentLength: 25,
          contentPreview: 'This is document 1...',
        },
        {
          id: 'doc2',
          fileName: 'test2.pdf',
          extractedContent: 'This is document 2 content',
          extractedText: 'This is document 2 content',
          summary: 'Test doc 2',
          keyTopics: ['Test'],
          fileType: 'application/pdf',
          fileSize: 2000,
          uploadDate: new Date(),
          processed: true,
          difficulty: 'intermediate' as const,
          chunks: [],
          contentLength: 25,
          contentPreview: 'This is document 2...',
        },
      ]

      const context = documentProcessor.getDocumentContent(documents)
      
      expect(context).toContain('test1.pdf')
      expect(context).toContain('test2.pdf')
      expect(context).toContain('This is document 1 content')
      expect(context).toContain('This is document 2 content')
    })

    it('should get document summaries', () => {
      const documents = [
        {
          id: 'doc1',
          fileName: 'test1.pdf',
          extractedContent: 'Content 1',
          extractedText: 'Content 1',
          summary: 'Test document 1',
          keyTopics: ['Topic1', 'Topic2'],
          fileType: 'application/pdf',
          fileSize: 1000,
          uploadDate: new Date(),
          processed: true,
          difficulty: 'beginner' as const,
          chunks: [],
          contentLength: 10,
          contentPreview: 'Content 1',
        },
      ]

      const summaries = documentProcessor.getDocumentSummaries(documents)
      
      expect(summaries).toContain('📄 test1.pdf')
      expect(summaries).toContain('Test document 1')
      expect(summaries).toContain('Topic1, Topic2')
    })

    it('should handle empty documents array', () => {
      const content = documentProcessor.getDocumentContent([])
      const summaries = documentProcessor.getDocumentSummaries([])
      
      expect(content).toBe('')
      expect(summaries).toBe('')
    })
  })
})

