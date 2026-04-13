import { useEffect, useMemo, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { ProfessionalDocumentMetadata } from '../types/documentIntent';
import { renderMarkdownSafe } from '../utils/markdownRenderer';
import './ProfessionalDocumentPanel.css';

interface ProfessionalDocumentPanelProps {
  messageId: string;
  title: string;
  /** Raw markdown string from the AI — rendered cleanly here, NOT via formatMessage() */
  contentMarkdown: string;
  metadata?: ProfessionalDocumentMetadata;
  onClose: () => void;
}

/**
 * Pre-processing: merge consecutive sentence-fragment paragraphs that the AI
 * incorrectly splits with blank lines. Works Cited entries are never merged.
 * A "fragment" is a block shorter than 320 chars with fewer than 2 internal
 * sentence breaks — almost certainly a single sentence, not a real paragraph.
 */
function mergeBodyParagraphs(markdown: string): string {
  const isSingleSentence = (s: string) =>
    s.length < 320 && (s.match(/\.\s+[A-Z]/g) ?? []).length < 2;

  const segments = markdown.split(/\n\n+/);
  const result: string[] = [];
  let inWorksSection = false;
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length) { result.push(buffer.join(' ')); buffer = []; }
  };

  for (const seg of segments) {
    const s = seg.trim();
    if (!s) continue;
    // Works Cited / References / Bibliography — never merge these entries
    if (/^##\s*(Works\s+Cited|References|Bibliography)/i.test(s)) {
      flush(); inWorksSection = true; result.push(s); continue;
    }
    // Any heading — flush buffer, reset section flag
    if (s.startsWith('#')) { flush(); inWorksSection = false; result.push(s); continue; }
    // Inside Works Cited — each citation entry stays on its own
    if (inWorksSection) { result.push(s); continue; }
    // Body text: accumulate likely-single-sentence blocks; flush on real paragraphs
    if (isSingleSentence(s)) { buffer.push(s); }
    else { flush(); result.push(s); }
  }
  flush();
  return result.join('\n\n');
}

/** Render markdown → HTML with math, but WITHOUT chat-specific code-block UI */
function renderDocumentMarkdown(markdown: string): string {
  if (!markdown) return '';

  // Merge AI-split sentences into proper paragraphs before HTML conversion
  const normalized = mergeBodyParagraphs(markdown);

  // Basic markdown render (paragraphs, headers, bold, italic, lists)
  let html = renderMarkdownSafe(normalized);

  // Mark Works Cited / References / Bibliography headings so CSS can target
  // them specifically for hanging-indent without affecting body section headings.
  html = html.replace(
    /<h2>(Works\s+Cited|References|Bibliography)<\/h2>/gi,
    '<h2 class="works-cited-heading">$1</h2>'
  );

  // Render display math: $$...$$
  html = html.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
    try {
      return `<div class="prof-math-block">${katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false })}</div>`;
    } catch {
      return `<div class="prof-math-block">${tex}</div>`;
    }
  });

  // Render inline math: $...$
  html = html.replace(/(?<!\$)\$(?!\$)([^\n$]+?)\$(?!\$)/g, (_, tex) => {
    try {
      return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return `<span>${tex}</span>`;
    }
  });

  return html;
}

export default function ProfessionalDocumentPanel({
  title,
  contentMarkdown,
  metadata,
  onClose,
}: ProfessionalDocumentPanelProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const contentHtml = useMemo(() => renderDocumentMarkdown(contentMarkdown), [contentMarkdown]);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    const element = document.getElementById('newton-professional-doc');
    if (!element || isDownloading) return;
    setIsDownloading(true);
    try {
      const { jsPDF } = await import('jspdf');
      await import('html2canvas'); // ensure html2canvas is available for jsPDF's html()

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
      const filename = title.replace(/[^\w\s-]/g, '').trim() || 'document';

      await new Promise<void>((resolve) => {
        pdf.html(element, {
          callback: (doc) => {
            doc.save(`${filename}.pdf`);
            resolve();
          },
          // autoPaging:'text' avoids splitting lines at page boundaries
          autoPaging: 'text',
          // margin: 0 — the .prof-page already has 96px (1in) CSS padding
          margin: [0, 0, 0, 0],
          // width maps the element's CSS pixel width to PDF points (816px = 612pt = 8.5in)
          width: 612,
          windowWidth: 816,
          x: 0,
          y: 0,
        });
      });
    } catch (err) {
      console.error('PDF download failed:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const citationLabel = metadata?.citationStyle ?? 'DOC';

  return (
    <div className="prof-doc-panel">
      {/* Header */}
      <div className="prof-doc-header">
        <div className="prof-doc-title-row">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.7 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <span className="prof-doc-filename">{title}</span>
          <span className="prof-doc-style-badge">{citationLabel}</span>
        </div>
        <div className="prof-doc-actions">
          <button className="prof-doc-print-btn" title="Download as PDF" onClick={handleDownload} disabled={isDownloading}>
            {isDownloading ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            )}
            {isDownloading ? 'Generating…' : 'Download PDF'}
          </button>
          <button className="prof-doc-icon-btn" title="Close" onClick={onClose}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Document body — isolated for @media print */}
      <div className="prof-doc-body">
        <div id="newton-professional-doc" className="prof-page">
          {metadata && <TitleBlock metadata={metadata} />}
          <div
            className="prof-doc-content"
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
        </div>
      </div>
    </div>
  );
}

function TitleBlock({ metadata }: { metadata: ProfessionalDocumentMetadata }) {
  const { citationStyle, authorName, professorName, courseName, date, title } = metadata;

  if (citationStyle === 'MLA') {
    return (
      <div className="prof-title-block prof-title-block--mla">
        {authorName && <p>{authorName}</p>}
        {professorName && <p>{professorName}</p>}
        {courseName && <p>{courseName}</p>}
        <p>{date}</p>
        <p className="prof-title-centered">{title}</p>
      </div>
    );
  }

  if (citationStyle === 'APA' || citationStyle === 'Chicago') {
    return (
      <div className="prof-title-block prof-title-block--centered">
        <p className="prof-title-centered prof-title-main">{title}</p>
        {authorName && <p className="prof-title-centered">{authorName}</p>}
        {courseName && <p className="prof-title-centered">{courseName}</p>}
        {professorName && <p className="prof-title-centered">{professorName}</p>}
        <p className="prof-title-centered">{date}</p>
      </div>
    );
  }

  return (
    <div className="prof-title-block">
      <p className="prof-title-centered prof-title-main">{title}</p>
      {(authorName || courseName || date) && (
        <div className="prof-title-meta">
          {authorName && <p className="prof-title-centered">{authorName}</p>}
          {courseName && <p className="prof-title-centered">{courseName}</p>}
          {date && <p className="prof-title-centered">{date}</p>}
        </div>
      )}
    </div>
  );
}
