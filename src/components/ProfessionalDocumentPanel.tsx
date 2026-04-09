import { useEffect, useMemo } from 'react';
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

/** Render markdown → HTML with math, but WITHOUT chat-specific code-block UI */
function renderDocumentMarkdown(markdown: string): string {
  if (!markdown) return '';

  // Basic markdown render (paragraphs, headers, bold, italic, lists)
  let html = renderMarkdownSafe(markdown);

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

  const handlePrint = () => window.print();

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
          <button className="prof-doc-print-btn" title="Print / Save as PDF" onClick={handlePrint}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            Print / Save PDF
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
