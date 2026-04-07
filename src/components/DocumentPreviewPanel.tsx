import { useEffect, useRef } from 'react';
import { downloadElementAsPDF } from '../utils/pdfService';
import './DocumentPreviewPanel.css';

interface DocumentPreviewPanelProps {
  messageId: string;
  title: string;
  contentHtml: string;
  onClose: () => void;
}

export default function DocumentPreviewPanel({ title, contentHtml, onClose }: DocumentPreviewPanelProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const fileName = title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '.pdf';

  const handleDownload = () => {
    if (contentRef.current) {
      downloadElementAsPDF(contentRef.current, title);
    }
  };

  return (
    <div className="doc-panel">
      {/* Header */}
      <div className="doc-panel-header">
        <div className="doc-panel-title-row">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.7 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <span className="doc-panel-filename">{fileName}</span>
          <span className="doc-panel-type-badge">PDF</span>
        </div>
        <div className="doc-panel-actions">
          <button className="doc-panel-icon-btn" title="Download PDF" onClick={handleDownload}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
          <button className="doc-panel-icon-btn" title="Close" onClick={onClose}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Document body */}
      <div className="doc-panel-body">
        <div className="doc-panel-page">
          <div
            ref={contentRef}
            className="doc-panel-content message-text"
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
        </div>
      </div>
    </div>
  );
}
