import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ChatInterface from '../components/ChatInterface';
import ErrorBoundary from '../components/ErrorBoundary';
import { DocumentMetadata } from '../types/ai';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const [uploadedDocuments, setUploadedDocuments] = useState<DocumentMetadata[]>([]);

  const handleDocumentsUploaded = (documents: DocumentMetadata[]) => {
    setUploadedDocuments(documents);
  };

  const handleDocumentDeleted = (documentId: string) => {
    setUploadedDocuments(prev => prev.filter(doc => doc.id !== documentId));
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div className="container">
          <h1>Chat</h1>
          <p>
            {isAuthenticated && user 
              ? `Welcome back, ${user.name}! Upload your documents and chat with your AI assistant.`
              : 'Upload your academic documents and get instant AI-powered guidance and support.'
            }
          </p>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="chat-container">
          <ErrorBoundary>
            <ChatInterface 
              documents={uploadedDocuments}
              onDocumentsChange={handleDocumentsUploaded}
              onDocumentDelete={handleDocumentDeleted}
              onNewSession={(session) => {
                console.log('New chat session created:', session);
              }}
            />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
