import { describe, it, expect } from 'vitest'
import { renderMarkdown, sanitizeHtml, cleanFlashcardContent, renderMarkdownSafe } from '../../src/utils/markdownRenderer'

describe('markdownRenderer', () => {
  describe('renderMarkdown', () => {
    it('should render bold text', () => {
      const result = renderMarkdown('This is **bold** text')
      expect(result).toContain('<strong>bold</strong>')
    })

    it('should render italic text', () => {
      const result = renderMarkdown('This is *italic* text')
      expect(result).toContain('<em>italic</em>')
    })

    it('should render both bold and italic', () => {
      const result = renderMarkdown('**bold** and *italic*')
      expect(result).toContain('<strong>bold</strong>')
      expect(result).toContain('<em>italic</em>')
    })

    it('should convert line breaks to br tags', () => {
      const result = renderMarkdown('Line 1\nLine 2')
      expect(result).toContain('<br>')
    })

    it('should convert double line breaks to paragraphs', () => {
      const result = renderMarkdown('Paragraph 1\n\nParagraph 2')
      expect(result).toContain('</p><p>')
    })

    it('should render bullet lists', () => {
      const result = renderMarkdown('- Item 1\n- Item 2')
      expect(result).toContain('<ul>')
      expect(result).toContain('<li>Item 1</li>')
      expect(result).toContain('<li>Item 2</li>')
    })

    it('should wrap content in paragraph tags', () => {
      const result = renderMarkdown('Simple text')
      expect(result).toContain('<p>')
    })

    it('should handle empty strings', () => {
      const result = renderMarkdown('')
      expect(result).toBe('')
    })

    it('should handle text with only whitespace', () => {
      const result = renderMarkdown('   \n\n   ')
      expect(result).toBe('')
    })
  })

  describe('sanitizeHtml', () => {
    it('should remove script tags', () => {
      const result = sanitizeHtml('<script>alert("xss")</script>Hello')
      expect(result).not.toContain('<script>')
      expect(result).toContain('Hello')
    })

    it('should remove javascript: protocols', () => {
      const result = sanitizeHtml('<a href="javascript:alert(1)">Click</a>')
      expect(result).not.toContain('javascript:')
    })

    it('should remove event handlers', () => {
      const result = sanitizeHtml('<div onclick="alert(1)">Click</div>')
      expect(result).not.toContain('onclick')
    })

    it('should preserve safe HTML', () => {
      const result = sanitizeHtml('<p>Safe content</p>')
      expect(result).toContain('<p>Safe content</p>')
    })

    it('should handle empty strings', () => {
      expect(sanitizeHtml('')).toBe('')
    })
  })

  describe('cleanFlashcardContent', () => {
    it('should extract question from JSON wrapper', () => {
      const json = '{"question": "What is React?", "answer": "A library"}'
      const result = cleanFlashcardContent(json)
      expect(result).toBe('What is React?')
    })

    it('should extract answer from JSON wrapper', () => {
      const json = '{"answer": "A JavaScript library"}'
      const result = cleanFlashcardContent(json)
      expect(result).toBe('A JavaScript library')
    })

    it('should remove markdown code blocks', () => {
      const text = '```json\n{"question": "Test"}\n```'
      const result = cleanFlashcardContent(text)
      expect(result).not.toContain('```')
    })

    it('should decode HTML entities', () => {
      const text = '&lt;div&gt;Content&lt;/div&gt;'
      const result = cleanFlashcardContent(text)
      expect(result).not.toContain('&lt;')
      expect(result).not.toContain('&gt;')
    })

    it('should handle plain text without modification', () => {
      const text = 'Simple text content'
      const result = cleanFlashcardContent(text)
      expect(result).toBe('Simple text content')
    })

    it('should handle empty strings', () => {
      expect(cleanFlashcardContent('')).toBe('')
      expect(cleanFlashcardContent('   ')).toBe('')
    })

    it('should handle null and undefined gracefully', () => {
      expect(cleanFlashcardContent(null as unknown as string)).toBe('')
      expect(cleanFlashcardContent(undefined as unknown as string)).toBe('')
    })
  })

  describe('renderMarkdownSafe', () => {
    it('should render and sanitize markdown', () => {
      const result = renderMarkdownSafe('**Bold** text')
      expect(result).toContain('<strong>Bold</strong>')
      expect(result).not.toContain('<script>')
    })

    it('should clean JSON content before rendering', () => {
      const json = '{"question": "What is **React**?"}'
      const result = renderMarkdownSafe(json)
      expect(result).toContain('<strong>React</strong>')
      expect(result).not.toContain('"question"')
    })

    it('should handle errors gracefully', () => {
      // This should not throw
      const result = renderMarkdownSafe('Normal text')
      expect(typeof result).toBe('string')
    })

    it('should handle empty strings', () => {
      expect(renderMarkdownSafe('')).toBe('')
    })

    it('should handle null and undefined', () => {
      expect(renderMarkdownSafe(null as unknown as string)).toBe('')
      expect(renderMarkdownSafe(undefined as unknown as string)).toBe('')
    })

    it('should sanitize while preserving formatting', () => {
      const result = renderMarkdownSafe('**Safe** <script>unsafe</script>')
      expect(result).toContain('<strong>Safe</strong>')
      expect(result).not.toContain('<script>')
    })
  })
})
