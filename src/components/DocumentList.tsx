import React from 'react';
import { DocumentMetadata } from '../types/ai';
import { getFileIcon, formatFileSize } from '../utils/fileValidation';
import './DocumentList.css';

interface DocumentListProps {
  documents: DocumentMetadata[];
  onDocumentSelect?: (document: DocumentMetadata) => void;
  onDocumentDelete?: (documentId: string) => void;
}

const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  onDocumentSelect,
  onDocumentDelete
}) => {
  const handleDocumentClick = (document: DocumentMetadata) => {
    if (onDocumentSelect) {
      onDocumentSelect(document);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, documentId: string) => {
    e.stopPropagation();
    if (onDocumentDelete) {
      onDocumentDelete(documentId);
    }
  };

  if (documents.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📚</div>
        <h3>No documents uploaded yet</h3>
        <p>Upload your first document to get started with AI-powered academic guidance.</p>
      </div>
    );
  }

  return (
    <div className="document-list">
      <div className="list-header">
        <h3>Your Documents ({documents.length})</h3>
        <div className="list-actions">
          <button className="action-btn">Sort by Date</button>
          <button className="action-btn">Filter</button>
        </div>
      </div>
      
      <div className="documents-grid">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className={`document-card ${doc.processed ? 'processed' : 'processing'}`}
            onClick={() => handleDocumentClick(doc)}
          >
            <div className="document-header">
              <div className="document-icon">{getFileIcon(doc.fileType)}</div>
              <div className="document-actions">
                <button
                  className="delete-btn"
                  onClick={(e) => handleDeleteClick(e, doc.id)}
                  title="Delete document"
                >
                  🗑️
                </button>
              </div>
            </div>
            
            <div className="document-content">
              <h4 className="document-title" title={doc.fileName}>
                {doc.fileName}
              </h4>
              
              <div className="document-meta">
                <span className="file-size">{formatFileSize(doc.fileSize)}</span>
                <span className="upload-date">
                  {doc.uploadDate.toLocaleDateString()}
                </span>
              </div>
              
              {doc.summary && (
                <p className="document-summary">{doc.summary}</p>
              )}
              
              {doc.keyTopics && doc.keyTopics.length > 0 && (
                <div className="document-topics">
                  <span className="topics-label">Key Topics:</span>
                  <div className="topics-list">
                    {doc.keyTopics.slice(0, 3).map((topic, index) => (
                      <span key={index} className="topic-tag">
                        {topic}
                      </span>
                    ))}
                    {doc.keyTopics.length > 3 && (
                      <span className="topic-more">
                        +{doc.keyTopics.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )}
              
              <div className="document-status">
                {doc.processed ? (
                  <span className="status-badge processed">
                    ✅ Ready for AI Analysis
                  </span>
                ) : (
                  <span className="status-badge processing">
                    ⏳ Processing...
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DocumentList;
