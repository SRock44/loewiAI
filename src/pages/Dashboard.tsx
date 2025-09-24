import { useState, forwardRef, useImperativeHandle, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ChatInterface, { ChatInterfaceRef } from '../components/ChatInterface';
import ErrorBoundary from '../components/ErrorBoundary';
import { DocumentMetadata } from '../types/ai';
import './Dashboard.css';

export interface DashboardRef {
  createNewChat: () => void;
  switchToChat: (chatId: string) => void;
}

const Dashboard = forwardRef<DashboardRef>((_, ref) => {
  useAuth(); // Authentication context
  const [uploadedDocuments, setUploadedDocuments] = useState<DocumentMetadata[]>([]);
  const chatInterfaceRef = useRef<ChatInterfaceRef>(null);

  const handleDocumentsUploaded = (documents: DocumentMetadata[]) => {
    setUploadedDocuments(documents);
  };


  const createNewChat = () => {
    if (chatInterfaceRef.current?.createNewSession) {
      chatInterfaceRef.current.createNewSession();
    }
  };

  const switchToChat = (chatId: string) => {
    if (chatInterfaceRef.current?.switchToSession) {
      chatInterfaceRef.current.switchToSession(chatId);
    }
  };

  useImperativeHandle(ref, () => ({
    createNewChat,
    switchToChat
  }));

  return (
    <div className="dashboard-page">
      <ErrorBoundary>
        <ChatInterface 
          ref={chatInterfaceRef}
          documents={uploadedDocuments}
          onDocumentsChange={handleDocumentsUploaded}
          onNewSession={(session) => {
            console.log('New chat session created:', session);
          }}
        />
      </ErrorBoundary>
    </div>
  );
});

Dashboard.displayName = 'Dashboard';

export default Dashboard;
