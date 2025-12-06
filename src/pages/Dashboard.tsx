import { useState, forwardRef, useImperativeHandle, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ChatInterface, { ChatInterfaceRef } from '../components/ChatInterface';
import ErrorBoundary from '../components/ErrorBoundary';
import { DocumentMetadata } from '../types/ai';
import './Dashboard.css';

// this interface lets the parent App component call methods on Dashboard
// like creating a new chat or switching to a different chat
export interface DashboardRef {
  createNewChat: () => void;
  switchToChat: (chatId: string) => void;
}

interface DashboardProps {
  onNewSessionCreated?: (session: any) => void;
}

const Dashboard = forwardRef<DashboardRef, DashboardProps>(({ onNewSessionCreated }, ref) => {
  // just calling useAuth() here ensures we're subscribed to auth state changes
  // even though we don't use the return value directly
  useAuth();
  // track all documents that have been uploaded - these get passed to chat interface
  // so the AI knows what documents are available for context
  const [uploadedDocuments, setUploadedDocuments] = useState<DocumentMetadata[]>([]);
  // ref to chat interface so we can call its methods (createNewSession, switchToSession)
  const chatInterfaceRef = useRef<ChatInterfaceRef>(null);

  // when documents get uploaded in chat interface, we store them here
  // this lets us pass them to other parts of the app if needed
  const handleDocumentsUploaded = (documents: DocumentMetadata[]) => {
    setUploadedDocuments(documents);
  };

  // these methods get exposed to parent component via useImperativeHandle
  // parent can call dashboardRef.current.createNewChat() to create a new chat
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

  // this exposes methods to parent component - when parent has a ref to Dashboard,
  // it can call these methods. this is how App.tsx controls the dashboard.
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
            // New chat session created
            if (onNewSessionCreated) {
              onNewSessionCreated(session);
            }
          }}
        />
      </ErrorBoundary>
    </div>
  );
});

Dashboard.displayName = 'Dashboard';

export default Dashboard;
