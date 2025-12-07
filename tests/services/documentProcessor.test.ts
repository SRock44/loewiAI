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

describe('documentProcessor', () => {
  // Helper to create mock File with arrayBuffer method
  const createMockFile = (name: string, type: string, content: string = 'test content'): File => {
    const buffer = new TextEncoder().encode(content).buffer
    const file = new File([content], name, { type })
    // Mock arrayBuffer method
    if (!file.arrayBuffer) {
      (file as any).arrayBuffer = async () => {
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

      vi.mocked(pdfjsLib.getDocument).mockReturnValue(mockLoadingTask as any)

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
      } as any)

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
      vi.mocked(mammoth.extractRawText).mockRejectedValue(new Error('DOCX parsing failed'))

      const file = createMockFile('corrupted.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'corrupted')
      const result = await documentProcessor.processDocument(file)

      expect(result.processed).toBe(true)
      expect(result.extractedContent).toBeTruthy()
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
      const mockParser = {
        parse: vi.fn().mockRejectedValue(new Error('PPTX parsing failed')),
        slides: [],
      }

      vi.mocked(PPTXParser).mockImplementation(() => mockParser as any)

      const file = createMockFile('corrupted.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'corrupted')
      const result = await documentProcessor.processDocument(file)

      expect(result.processed).toBe(true)
      expect(result.extractedContent).toBeTruthy()
    })
  })

  describe('Text Processing', () => {
    it('should generate summary for homework documents', async () => {
      const file = createMockFile('homework.pdf', 'application/pdf', 'homework content')
      const result = await documentProcessor.processDocument(file)

      expect(result.summary).toContain('homework assignment')
      expect(result.keyTopics).toContain('Homework')
    })

    it('should generate summary for syllabus documents', async () => {
      const file = createMockFile('syllabus.pdf', 'application/pdf', 'syllabus content')
      const result = await documentProcessor.processDocument(file)

      expect(result.summary).toContain('syllabus')
      expect(result.keyTopics).toContain('Syllabus')
    })

    it('should extract key topics from document', async () => {
      const file = createMockFile('statistics_homework.pdf', 'application/pdf', 'statistics content')
      const result = await documentProcessor.processDocument(file)

      expect(result.keyTopics).toContain('Statistics')
      expect(result.keyTopics).toContain('Homework')
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

      vi.mocked(pdfjsLib.getDocument).mockReturnValue(mockLoadingTask as any)

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

      vi.mocked(pdfjsLib.getDocument).mockReturnValue(mockLoadingTask as any)

      const file = createMockFile('messy.pdf', 'application/pdf', 'messy content')
      const result = await documentProcessor.processDocument(file)

      // Should have normalized whitespace
      expect(result.extractedContent).not.toContain('   ')
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

