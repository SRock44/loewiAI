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
 * Render markdown and sanitize the result
 */
export const renderMarkdownSafe = (text: string): string => {
  try {
    if (!text || typeof text !== 'string') return '';
    const html = renderMarkdown(text);
    return sanitizeHtml(html);
  } catch (error) {
    console.error('Error rendering markdown:', error);
    return text || '';
  }
};
