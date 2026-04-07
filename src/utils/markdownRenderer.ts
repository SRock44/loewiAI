/**
 * Markdown renderer for chat and flashcard content.
 * Handles headers, bold, italic, lists, tables, code blocks, math expressions,
 * blockquotes, and horizontal rules.
 *
 * Placeholders use \x01…\x02 delimiters so they can never collide with
 * markdown syntax (unlike the previous __ delimiters which clashed with bold).
 */

export const renderMarkdown = (text: string): string => {
  if (!text || typeof text !== 'string') return '';

  let html = text;

  // ── Protect elements that must not be processed by markdown rules ──

  const codeBlocks: string[] = [];
  html = html.replace(/```(\w+)?\s*\n?([\s\S]*?)```/g, (match) => {
    codeBlocks.push(match);
    return `\x01CB${codeBlocks.length - 1}\x02`;
  });

  const inlineCode: string[] = [];
  html = html.replace(/`([^`]+)`/g, (match) => {
    inlineCode.push(match);
    return `\x01IC${inlineCode.length - 1}\x02`;
  });

  // Display math: $$…$$ and \[…\]
  const mathBlocks: string[] = [];
  html = html.replace(/\$\$([\s\S]+?)\$\$/g, (match) => {
    mathBlocks.push(match);
    return `\x01MB${mathBlocks.length - 1}\x02`;
  });
  html = html.replace(/\\\[([\s\S]+?)\\\]/g, (match) => {
    mathBlocks.push(match);
    return `\x01MB${mathBlocks.length - 1}\x02`;
  });

  // Inline math: \(…\) and $…$
  const mathInline: string[] = [];
  html = html.replace(/\\\((.+?)\\\)/g, (match) => {
    mathInline.push(match);
    return `\x01MI${mathInline.length - 1}\x02`;
  });
  html = html.replace(/(?<!\$)\$(?!\$)([^\n$]+?)\$(?!\$)/g, (match) => {
    mathInline.push(match);
    return `\x01MI${mathInline.length - 1}\x02`;
  });

  // ── Block-level elements ──

  // Headers
  html = html.replace(/^#### (.*$)/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');

  // Blockquotes
  html = html.replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>');

  // Horizontal rules (must come before list handling so --- isn't treated as a list)
  html = html.replace(/^---+$/gm, '<hr>');

  // Tables — markdown pipe tables with header separator row
  html = html.replace(/((?:^\|.+\|[ \t]*$\n?)+)/gm, (tableBlock) => {
    const rows = tableBlock.trim().split('\n').filter(r => r.trim());
    if (rows.length < 2) return tableBlock;
    if (!/^\|[\s:]*-{2,}[\s:]*(\|[\s:]*-{2,}[\s:]*)*\|?\s*$/.test(rows[1].trim())) {
      return tableBlock;
    }

    const parseRow = (row: string) =>
      row.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());

    const headers = parseRow(rows[0]);
    const thead = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
    const bodyRows = rows.slice(2);
    const tbody = `<tbody>${bodyRows.map(row => {
      const cells = parseRow(row);
      return `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
    }).join('')}</tbody>`;

    return `<table>${thead}${tbody}</table>`;
  });

  // ── Inline elements ──

  // Bold (**…** and __…__) — must come before italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic (*…* and _…_)
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // ── Lists ──

  // Bullet points
  html = html.replace(/^[-*•]\s+(.*)$/gm, '<li>$1</li>');
  // Numbered lists
  html = html.replace(/^\d+\.\s+(.*)$/gm, '<li class="numbered">$1</li>');

  // Wrap consecutive <li> runs in <ul>/<ol>
  html = html.replace(/((?:<li[^>]*>.*<\/li>\s*)+)/g, (match) => {
    if (match.includes('class="numbered"')) {
      return `<ol>${match}</ol>`;
    }
    return `<ul>${match}</ul>`;
  });

  // Merge adjacent same-type list wrappers
  html = html.replace(/<\/ul>\s*<ul>/g, '');
  html = html.replace(/<\/ol>\s*<ol>/g, '');

  // ── Paragraphs & line breaks ──
  // Remove blank lines immediately before/after block elements to prevent double-spacing
  html = html.replace(/\n{2,}(?=<(?:h[1-4]|ul|ol|table|blockquote|hr|div|\x01))/g, '\n');
  html = html.replace(/(<\/(?:h[1-4]|ul|ol|table|blockquote|div)>)\n{2,}/g, '$1\n');
  html = html.replace(/<hr>\n{2,}/g, '<hr>\n');

  // Double newlines become paragraph breaks
  html = html.replace(/\n\n+/g, '</p><p>');
  // Single newlines become <br> only between inline content
  html = html.replace(/\n/g, '<br>')

  // Clean up <br> tags adjacent to block elements (they cause extra blank lines)
  html = html.replace(/<br>\s*(<(?:h[1-4]|ul|ol|li|table|blockquote|hr|div|pre))/g, '$1');
  html = html.replace(/(<\/(?:h[1-4]|ul|ol|li|table|blockquote|div|pre)>)\s*<br>/g, '$1');
  html = html.replace(/<br>\s*<\/p>/g, '</p>');
  html = html.replace(/<p>\s*<br>/g, '<p>');

  // Clean up empty paragraphs wrapping block elements
  html = html.replace(/<p>\s*(<(?:h[1-4]|ul|ol|table|blockquote|hr|div|pre))/g, '$1');
  html = html.replace(/(<\/(?:h[1-4]|ul|ol|table|blockquote|div|pre)>)\s*<\/p>/g, '$1');

  // ── Restore protected elements (reverse order of extraction) ──

  mathInline.forEach((block, i) => {
    html = html.replace(`\x01MI${i}\x02`, block);
  });
  mathBlocks.forEach((block, i) => {
    html = html.replace(`\x01MB${i}\x02`, block);
  });
  inlineCode.forEach((block, i) => {
    html = html.replace(`\x01IC${i}\x02`, block);
  });
  codeBlocks.forEach((block, i) => {
    html = html.replace(`\x01CB${i}\x02`, block);
  });

  // ── Final wrapping ──

  if (!html.startsWith('<p>') && !html.startsWith('<h') && !html.startsWith('<ul') &&
      !html.startsWith('<ol') && !html.startsWith('<blockquote') && !html.startsWith('<table')) {
    html = `<p>${html}</p>`;
  }

  html = html.replace(/<p>\s*<\/p>/g, '');

  return html;
};

/**
 * Sanitize HTML to prevent XSS attacks.
 */
export const sanitizeHtml = (html: string): string => {
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  html = html.replace(/javascript:/gi, '');
  html = html.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  return html;
};

/**
 * Clean and normalize flashcard content before rendering.
 * Handles JSON strings, escaped characters, HTML entities, and code blocks.
 */
export const cleanFlashcardContent = (text: string): string => {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text.trim();

  // Remove JSON wrapper if the content is a JSON string
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed.question) {
        cleaned = parsed.question;
      } else if (parsed.answer) {
        cleaned = parsed.answer;
      } else if (parsed.flashcards && Array.isArray(parsed.flashcards) && parsed.flashcards.length > 0) {
        const firstCard = parsed.flashcards[0];
        cleaned = firstCard.question || firstCard.answer || cleaned;
      }
    } catch {
      // Not valid JSON, continue with original text
    }
  }

  // Remove markdown code blocks (```json, ```markdown, ```html, or just ```)
  cleaned = cleaned.replace(/```(?:json|markdown|html)?\s*([\s\S]*?)```/g, '$1');

  // Decode HTML entities
  try {
    if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.innerHTML = cleaned;
      cleaned = textarea.value;
    } else {
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
  const htmlTagCount = (cleaned.match(/<[^>]+>/g) || []).length;
  const hasMarkdownFormatting = /(\*\*|__|\*|_|- |# )/.test(cleaned);
  if (htmlTagCount > 3 && !hasMarkdownFormatting) {
    cleaned = cleaned.replace(/<[^>]+>/g, ' ');
  }

  // Replace escaped characters
  cleaned = cleaned
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, '\\')
    .replace(/\\r/g, '\r');

  // Clean up excessive whitespace but preserve intentional spacing
  cleaned = cleaned.replace(/[ \t]+/g, ' ');
  cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n');

  return cleaned.trim();
};

/**
 * Render markdown and sanitize the result.
 */
export const renderMarkdownSafe = (text: string): string => {
  try {
    if (!text || typeof text !== 'string') return '';
    const cleaned = cleanFlashcardContent(text);
    const html = renderMarkdown(cleaned);
    return sanitizeHtml(html);
  } catch (error) {
    console.error('Error rendering markdown:', error);
    try {
      return sanitizeHtml(cleanFlashcardContent(text));
    } catch {
      return text || '';
    }
  }
};
