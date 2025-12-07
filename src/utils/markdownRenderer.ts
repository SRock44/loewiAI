/**
 * Simple markdown renderer for flashcard content
 * Handles basic markdown formatting like bold, italic, line breaks, and lists
 */

export const renderMarkdown = (text: string): string => {
  if (!text || typeof text !== 'string') return '';

  let html = text;

  // First, handle bold and italic formatting before processing line breaks
  // Convert **bold** to <strong>
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Convert *italic* to <em> (but not if it's part of **bold**)
  html = html.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');

  // Handle bullet points first (before converting line breaks)
  // Convert lines that start with - to list items
  html = html.replace(/^(\s*)-\s*(.+)$/gm, '<li>$2</li>');

  // Wrap consecutive list items in <ul> tags
  html = html.replace(/(<li>.*?<\/li>\s*)+/g, (match) => {
    const listItems = match.trim();
    return `<ul>${listItems}</ul>`;
  });

  // Convert double line breaks to paragraph breaks
  html = html.replace(/\n\n+/g, '</p><p>');

  // Convert single line breaks to <br> tags (but not inside lists)
  html = html.replace(/\n/g, '<br>');

  // Remove <br> tags that are now inside lists
  html = html.replace(/<ul>(.*?)<\/ul>/gs, (_, content) => {
    return `<ul>${content.replace(/<br\s*\/?>/g, '')}</ul>`;
  });

  // Wrap in paragraph tags if not already wrapped and doesn't start with a list
  if (!html.startsWith('<p>') && !html.startsWith('<ul>')) {
    html = `<p>${html}</p>`;
  }

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/<p><br\s*\/?><\/p>/g, '');

  // Clean up paragraph tags around lists
  html = html.replace(/<p><ul>/g, '<ul>');
  html = html.replace(/<\/ul><\/p>/g, '</ul>');

  // Clean up multiple consecutive <br> tags
  html = html.replace(/(<br\s*\/?>){3,}/g, '<br><br>');

  return html;
};

/**
 * Sanitize HTML to prevent XSS attacks
 * This is a basic implementation - in production, consider using a proper HTML sanitizer
 */
export const sanitizeHtml = (html: string): string => {
  // Remove any script tags and their content
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove any javascript: protocols
  html = html.replace(/javascript:/gi, '');
  
  // Remove any on* event handlers
  html = html.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  
  return html;
};

/**
 * Clean and normalize flashcard content before rendering
 * Handles JSON strings, escaped characters, HTML entities, and code blocks
 */
export const cleanFlashcardContent = (text: string): string => {
  if (!text || typeof text !== 'string') return '';
  
  let cleaned = text.trim();
  
  // Remove JSON wrapper if the content is a JSON string
  // Check if it looks like a JSON object or array
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
    try {
      const parsed = JSON.parse(cleaned);
      // If it parsed successfully and has flashcard-like structure, extract the content
      if (parsed.question) {
        cleaned = parsed.question;
      } else if (parsed.answer) {
        cleaned = parsed.answer;
      } else if (parsed.flashcards && Array.isArray(parsed.flashcards) && parsed.flashcards.length > 0) {
        // If it's a full flashcard set, try to extract first card
        const firstCard = parsed.flashcards[0];
        cleaned = firstCard.question || firstCard.answer || cleaned;
      }
    } catch {
      // Not valid JSON, continue with original text
    }
  }
  
  // Remove markdown code blocks (```json, ```markdown, ```html, or just ```)
  cleaned = cleaned.replace(/```(?:json|markdown|html)?\s*([\s\S]*?)```/g, '$1');
  
  // Decode HTML entities first (before removing tags)
  // Use a more robust method that works in all contexts
  try {
    // Create a temporary element to decode HTML entities
    if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.innerHTML = cleaned;
      cleaned = textarea.value;
    } else {
      // Fallback for server-side rendering or non-browser environments
      cleaned = cleaned
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'");
    }
  } catch {
    // If HTML entity decoding fails, use fallback
    cleaned = cleaned
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'");
  }
  
  // Remove HTML/XML tags if the content appears to be raw HTML
  // Only remove if it looks like HTML (has multiple tags) and isn't markdown-formatted content
  const htmlTagCount = (cleaned.match(/<[^>]+>/g) || []).length;
  // Check if it's likely raw HTML vs markdown that will be converted to HTML
  const hasMarkdownFormatting = /(\*\*|__|\*|_|- |# )/.test(cleaned);
  if (htmlTagCount > 3 && !hasMarkdownFormatting) {
    // Extract text content from HTML (remove tags but keep text)
    cleaned = cleaned.replace(/<[^>]+>/g, ' ');
  }
  
  // Replace escaped characters
  cleaned = cleaned
    .replace(/\\n/g, '\n')           // \n to actual newline
    .replace(/\\t/g, '\t')           // \t to actual tab
    .replace(/\\"/g, '"')            // \" to "
    .replace(/\\'/g, "'")            // \' to '
    .replace(/\\\\/g, '\\')          // \\ to \
    .replace(/\\r/g, '\r');          // \r to carriage return
  
  // Clean up excessive whitespace but preserve intentional spacing
  cleaned = cleaned.replace(/[ \t]+/g, ' ');  // Multiple spaces/tabs to single space
  cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n');  // More than 3 newlines to 3
  
  return cleaned.trim();
};

/**
 * Render markdown and sanitize the result
 */
export const renderMarkdownSafe = (text: string): string => {
  try {
    if (!text || typeof text !== 'string') return '';
    
    // First clean the content to handle JSON, escaped chars, etc.
    const cleaned = cleanFlashcardContent(text);
    
    // Then render markdown
    const html = renderMarkdown(cleaned);
    
    // Finally sanitize for security
    return sanitizeHtml(html);
  } catch (error) {
    console.error('Error rendering markdown:', error);
    // Fallback: try to at least clean the content even if markdown rendering fails
    try {
      return sanitizeHtml(cleanFlashcardContent(text));
    } catch {
      return text || '';
    }
  }
};
