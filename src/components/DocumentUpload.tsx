import React, { useState, useCallback, useRef } from 'react';
import { DocumentMetadata } from '../types/ai';
import { validateFile, getFileIcon, formatFileSize } from '../utils/fileValidation';
import { aiService } from '../services/aiService';
import DocumentList from './DocumentList';
import './DocumentUpload.css';

interface DocumentUploadProps {
  onDocumentsChange?: (documents: DocumentMetadata[]) => void;
  onDocumentDelete?: (documentId: string) => void;
}

interface UploadedFile extends DocumentMetadata {
  uploadProgress: number;
  uploadStatus: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({ 
  onDocumentsChange, 
  onDocumentDelete 
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList) => {
    const fileArray = Array.from(files);
    
    for (const file of fileArray) {
      const validation = validateFile(file);
      
      if (!validation.isValid) {
        setUploadedFiles(prev => [...prev, {
          id: `error_${Date.now()}`,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          uploadDate: new Date(),
          processed: false,
          uploadProgress: 0,
          uploadStatus: 'error',
          error: validation.error
        }]);
        continue;
      }

      // Add file to upload list
      const uploadedFile: UploadedFile = {
        id: `upload_${Date.now()}_${Math.random()}`,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        uploadDate: new Date(),
        processed: false,
        uploadProgress: 0,
        uploadStatus: 'uploading'
      };

      setUploadedFiles(prev => [...prev, uploadedFile]);

      try {
        // Simulate upload progress
        for (let progress = 0; progress <= 100; progress += 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
          setUploadedFiles(prev => prev.map(f => 
            f.id === uploadedFile.id 
              ? { ...f, uploadProgress: progress }
              : f
          ));
        }

        // Change status to processing
        setUploadedFiles(prev => prev.map(f => 
          f.id === uploadedFile.id 
            ? { ...f, uploadStatus: 'processing' }
            : f
        ));

        // Process with AI service
        const processedDocument = await aiService.processDocument(file);
        
        // Update with processed data
        setUploadedFiles(prev => {
          const updated = prev.map(f => 
            f.id === uploadedFile.id 
              ? { 
                  ...f, 
                  ...processedDocument,
                  uploadStatus: 'completed',
                  uploadProgress: 100
                }
              : f
          );
          
          // Notify parent component of completed documents
          const completedDocs = updated.filter(f => f.uploadStatus === 'completed');
          if (completedDocs.length > 0 && onDocumentsChange) {
            onDocumentsChange(completedDocs);
          }
          
          return updated;
        });

      } catch (error) {
        setUploadedFiles(prev => prev.map(f => 
          f.id === uploadedFile.id 
            ? { 
                ...f, 
                uploadStatus: 'error',
                error: 'Failed to process document'
              }
            : f
        ));
      }
    }
  }, [onDocumentsChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  const handleClickUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setUploadedFiles(prev => {
      const updated = prev.filter(f => f.id !== fileId);
      const completedDocs = updated.filter(f => f.uploadStatus === 'completed');
      if (onDocumentsChange) {
        onDocumentsChange(completedDocs);
      }
      return updated;
    });
    
    if (onDocumentDelete) {
      onDocumentDelete(fileId);
    }
  }, [onDocumentsChange, onDocumentDelete]);

  const retryUpload = useCallback((fileId: string) => {
    setUploadedFiles(prev => prev.map(f => 
      f.id === fileId 
        ? { ...f, uploadStatus: 'uploading', uploadProgress: 0, error: undefined }
        : f
    ));
    // Re-process the file
  }, []);

  return (
    <div className="document-upload-component">
      <div className="upload-header">
        <h2>Upload Your Documents</h2>
        <p>Upload syllabi, lecture notes, assignments, and other academic documents for AI analysis and personalized guidance.</p>
      </div>

      <div 
        className={`upload-area ${isDragOver ? 'drag-over' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClickUpload}
      >
        <div className="upload-content">
          <div className="paperclip-icon">📎</div>
          <h3>Drag & Drop Files Here</h3>
          <p>or click to browse</p>
          <div className="supported-formats">
            <span>Supported formats:</span>
            <div className="format-tags">
              <span className="format-tag">PDF</span>
              <span className="format-tag">DOCX</span>
              <span className="format-tag">DOC</span>
              <span className="format-tag">PPTX</span>
              <span className="format-tag">PPT</span>
            </div>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.doc,.pptx,.ppt"
        onChange={handleFileInput}
        style={{ display: 'none' }}
      />

      {/* Active Uploads */}
      {uploadedFiles.filter(f => f.uploadStatus !== 'completed').length > 0 && (
        <div className="active-uploads">
          <h3>Uploading Documents</h3>
          <div className="files-list">
            {uploadedFiles
              .filter(file => file.uploadStatus !== 'completed')
              .map((file) => (
              <div key={file.id} className={`file-item ${file.uploadStatus}`}>
                <div className="file-info">
                  <div className="file-icon">{getFileIcon(file.fileType)}</div>
                  <div className="file-details">
                    <h4>{file.fileName}</h4>
                    <p>{formatFileSize(file.fileSize)}</p>
                  </div>
                </div>
                
                <div className="file-status">
                  {file.uploadStatus === 'uploading' && (
                    <div className="upload-progress">
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ width: `${file.uploadProgress}%` }}
                        ></div>
                      </div>
                      <span>{file.uploadProgress}%</span>
                    </div>
                  )}
                  
                  {file.uploadStatus === 'processing' && (
                    <div className="processing-status">
                      <div className="spinner"></div>
                      <span>AI Processing...</span>
                    </div>
                  )}
                  
                  {file.uploadStatus === 'error' && (
                    <div className="error-status">
                      <span className="error-icon">❌</span>
                      <span>{file.error}</span>
                      <button 
                        className="retry-btn"
                        onClick={() => retryUpload(file.id)}
                      >
                        Retry
                      </button>
                    </div>
                  )}
                </div>
                
                <button 
                  className="remove-btn"
                  onClick={() => removeFile(file.id)}
                  title="Remove file"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Documents */}
      <DocumentList 
        documents={uploadedFiles.filter(f => f.uploadStatus === 'completed')}
        onDocumentDelete={removeFile}
        onDocumentSelect={(doc) => {
          console.log('Document selected:', doc);
          // TODO: Navigate to document analysis page
        }}
      />

      <div className="upload-tips">
        <h4>💡 Tips for Best Results</h4>
        <ul>
          <li>Upload clear, readable documents for better AI analysis</li>
          <li>Include course syllabi for personalized study recommendations</li>
          <li>Upload lecture notes to get instant explanations and clarifications</li>
          <li>Add assignment documents for step-by-step guidance</li>
        </ul>
      </div>
    </div>
  );
};

export default DocumentUpload;
