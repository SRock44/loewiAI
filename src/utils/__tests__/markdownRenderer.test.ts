import { describe, it, expect } from 'vitest'
import { renderMarkdown, sanitizeHtml, renderMarkdownSafe } from '../markdownRenderer'

describe('markdownRenderer', () => {
  describe('renderMarkdown', () => {
    it('should return empty string for empty input', () => {
      expect(renderMarkdown('')).toBe('')
      expect(renderMarkdown(null as any)).toBe('')
      expect(renderMarkdown(undefined as any)).toBe('')
    })

    it('should convert bold text', () => {
      const result = renderMarkdown('This is **bold** text')
      expect(result).toContain('<strong>bold</strong>')
    })

    it('should convert italic text', () => {
      const result = renderMarkdown('This is *italic* text')
      expect(result).toContain('<em>italic</em>')
    })

    it('should handle both bold and italic', () => {
      const result = renderMarkdown('This is **bold** and *italic* text')
      expect(result).toContain('<strong>bold</strong>')
      expect(result).toContain('<em>italic</em>')
    })

    it('should convert bullet points to list items', () => {
      const result = renderMarkdown('- Item 1\n- Item 2\n- Item 3')
      expect(result).toContain('<ul>')
      expect(result).toContain('<li>Item 1</li>')
      expect(result).toContain('<li>Item 2</li>')
      expect(result).toContain('<li>Item 3</li>')
    })

    it('should convert double line breaks to paragraphs', () => {
      const result = renderMarkdown('Paragraph 1\n\nParagraph 2')
      expect(result).toContain('</p><p>')
    })

    it('should convert single line breaks to br tags', () => {
      const result = renderMarkdown('Line 1\nLine 2')
      expect(result).toContain('<br>')
    })

    it('should wrap content in paragraph tags', () => {
      const result = renderMarkdown('Simple text')
      expect(result).toContain('<p>')
      expect(result).toContain('</p>')
    })

    it('should not wrap lists in paragraph tags', () => {
      const result = renderMarkdown('- Item 1')
      expect(result).toContain('<ul>')
      expect(result).not.toContain('<p><ul>')
    })

    it('should handle complex markdown', () => {
      const input = '**Bold** text with *italic* and\n\n- List item 1\n- List item 2'
      const result = renderMarkdown(input)
      expect(result).toContain('<strong>Bold</strong>')
      expect(result).toContain('<em>italic</em>')
      expect(result).toContain('<ul>')
      expect(result).toContain('<li>List item 1</li>')
    })

    it('should clean up empty paragraphs', () => {
      const result = renderMarkdown('\n\n\n')
      expect(result).not.toContain('<p></p>')
    })

    it('should remove multiple consecutive br tags', () => {
      const result = renderMarkdown('Line 1\n\n\n\nLine 2')
      // Should not have more than 2 consecutive br tags
      expect(result).not.toMatch(/(<br\s*\/?>){3,}/)
    })
  })

  describe('sanitizeHtml', () => {
    it('should remove script tags', () => {
      const input = '<p>Hello</p><script>alert("xss")</script><p>World</p>'
      const result = sanitizeHtml(input)
      expect(result).not.toContain('<script>')
      expect(result).not.toContain('alert')
    })

    it('should remove javascript: protocols', () => {
      const input = '<a href="javascript:alert(\'xss\')">Link</a>'
      const result = sanitizeHtml(input)
      expect(result).not.toContain('javascript:')
    })

    it('should remove event handlers', () => {
      const input = '<div onclick="alert(\'xss\')">Click me</div>'
      const result = sanitizeHtml(input)
      expect(result).not.toContain('onclick=')
      expect(result).not.toContain('alert')
    })

    it('should preserve safe HTML', () => {
      const input = '<p>Safe <strong>content</strong></p>'
      const result = sanitizeHtml(input)
      expect(result).toContain('<p>')
      expect(result).toContain('<strong>content</strong>')
    })

    it('should handle multiple event handlers', () => {
      const input = '<div onclick="bad()" onmouseover="bad()">Content</div>'
      const result = sanitizeHtml(input)
      expect(result).not.toContain('onclick')
      expect(result).not.toContain('onmouseover')
    })
  })

  describe('renderMarkdownSafe', () => {
    it('should render markdown and sanitize it', () => {
      const input = '**Bold** text<script>alert("xss")</script>'
      const result = renderMarkdownSafe(input)
      expect(result).toContain('<strong>Bold</strong>')
      expect(result).not.toContain('<script>')
    })

    it('should return empty string for invalid input', () => {
      expect(renderMarkdownSafe(null as any)).toBe('')
      expect(renderMarkdownSafe(undefined as any)).toBe('')
    })

    it('should handle errors gracefully', () => {
      // This should not throw
      const result = renderMarkdownSafe('Normal text')
      expect(typeof result).toBe('string')
    })

    it('should combine markdown rendering and sanitization', () => {
      const input = '- Item 1\n- Item 2\n\n**Bold** text'
      const result = renderMarkdownSafe(input)
      expect(result).toContain('<ul>')
      expect(result).toContain('<li>Item 1</li>')
      expect(result).toContain('<strong>Bold</strong>')
    })
  })
})

