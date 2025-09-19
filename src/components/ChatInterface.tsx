import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, ChatSession, ChatContext, QuickAction, QUICK_ACTIONS } from '../types/chat';
import { chatService } from '../services/chatService';
import { DocumentMetadata } from '../types/ai';
import { validateFile, getFileIcon, formatFileSize } from '../utils/fileValidation';
import { aiService } from '../services/aiService';
import { useAuth } from '../contexts/AuthContext';
import { documentProcessor, ProcessedDocument } from '../services/documentProcessor';
import './ChatInterface.css';

interface ChatInterfaceProps {
  documents?: DocumentMetadata[];
  onDocumentsChange?: (documents: DocumentMetadata[]) => void;
  onDocumentDelete?: (documentId: string) => void;
  onNewSession?: (session: ChatSession) => void;
}

interface UploadedFile extends DocumentMetadata {
  uploadProgress: number;
  uploadStatus: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
  processedDocument?: ProcessedDocument;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  documents = [], 
  onDocumentsChange,
  onDocumentDelete,
  onNewSession 
}) => {
  const { isAuthenticated, user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load existing sessions on component mount and when auth state changes
  useEffect(() => {
    if (isAuthenticated) {
      loadSessions();
    } else {
      // Clear sessions for unauthenticated users
      setSessions([]);
      setMessages([]);
      setCurrentSession(null);
      chatService.clearAllData();
    }
  }, [isAuthenticated]);

  const loadSessions = () => {
    if (!isAuthenticated) {
      return;
    }

    console.log('📂 Loading sessions for authenticated user:', user?.email);
    chatService.reloadForUser();
    const existingSessions = chatService.getSessions();
    console.log('📊 Found existing sessions:', existingSessions.length);
    setSessions(existingSessions);
    
    if (existingSessions.length > 0) {
      setCurrentSession(existingSessions[0]);
      setMessages(existingSessions[0].messages);
    } else {
      // Create initial session for authenticated users
      createNewSession();
    }
  };

  const createNewSession = async () => {
    const newSession = await chatService.createNewSession();
    setCurrentSession(newSession);
    setSessions(prev => [newSession, ...prev]);
    setMessages([]);
    if (onNewSession) {
      onNewSession(newSession);
    }
  };

  const handleFiles = useCallback(async (files: FileList) => {
    const fileArray = Array.from(files);
    
    for (const file of fileArray) {
      const validation = validateFile(file);
      
      if (!validation.isValid) {
        // Show error message to user
        const errorMessage: ChatMessage = {
          id: `error_${Date.now()}`,
          role: 'assistant',
          content: `❌ Upload failed: ${validation.error}`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
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

      // Show upload message
      const uploadMessage: ChatMessage = {
        id: `upload_${Date.now()}`,
        role: 'user',
        content: `📎 Uploading ${file.name}...`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, uploadMessage]);

      try {
        // Simulate upload progress
        for (let progress = 0; progress <= 100; progress += 10) {
          await new Promise(resolve => setTimeout(resolve, 50));
          setUploadedFiles(prev => prev.map(f => 
            f.id === uploadedFile.id 
              ? { ...f, uploadProgress: progress }
              : f
          ));
        }

        // Process with document processor
        setUploadedFiles(prev => prev.map(f => 
          f.id === uploadedFile.id 
            ? { ...f, uploadStatus: 'processing' }
            : f
        ));

        const processedDocument = await documentProcessor.processDocument(file);
        
        console.log('📄 Processed document result:', {
          id: processedDocument.id,
          fileName: processedDocument.fileName,
          summary: processedDocument.summary,
          keyTopics: processedDocument.keyTopics,
          contentLength: processedDocument.extractedContent.length,
          contentPreview: processedDocument.extractedContent.substring(0, 200)
        });
        
        // Update with processed data
        setUploadedFiles(prev => {
          const updated = prev.map(f => 
            f.id === uploadedFile.id 
              ? { 
                  ...f, 
                  ...processedDocument,
                  processedDocument: processedDocument,
                  uploadStatus: 'completed',
                  uploadProgress: 100
                }
              : f
          );
          
          return updated;
        });
        
        // Notify parent component of completed documents (outside setState)
        setTimeout(() => {
          setUploadedFiles(current => {
            const completedDocs = current.filter(f => f.uploadStatus === 'completed');
            if (completedDocs.length > 0 && onDocumentsChange) {
              onDocumentsChange(completedDocs);
            }
            return current;
          });
        }, 0);

        // Show success message
        const successMessage: ChatMessage = {
          id: `success_${Date.now()}`,
          role: 'assistant',
          content: `✅ Successfully uploaded and processed "${file.name}". I can now help you with questions about this document!`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, successMessage]);

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

        const errorMessage: ChatMessage = {
          id: `error_${Date.now()}`,
          role: 'assistant',
          content: `❌ Failed to process "${file.name}". Please try again.`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    }
  }, [onDocumentsChange]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    console.log('🚀 Attempting to send message:', content);
    console.log('📊 Current session:', currentSession);
    console.log('🔐 Is authenticated:', isAuthenticated);

    // Create a session if one doesn't exist
    let session = currentSession;
    if (!session) {
      console.log('📝 Creating new session...');
      session = await chatService.createNewSession();
      setCurrentSession(session);
      setSessions(prev => [session!, ...prev]);
      console.log('✅ New session created:', session);
    }

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Get processed documents from uploaded files
      const processedDocs = uploadedFiles
        .filter(f => f.uploadStatus === 'completed' && f.processedDocument)
        .map(f => f.processedDocument!);

      const context: ChatContext = {
        sessionId: session.id,
        documentIds: documents.map(doc => doc.id),
        currentTopic: 'general',
        processedDocuments: processedDocs
      };

      console.log('📤 Sending to chat service with context:', context);
      console.log('📄 Processed documents available:', processedDocs.length);
      const response = await chatService.sendMessage(content.trim(), context);
      console.log('📥 Received response:', response);
      setMessages(prev => [...prev, response]);
      
      // Refresh sessions to get updated titles
      if (isAuthenticated) {
        const updatedSessions = chatService.getSessions();
        setSessions(updatedSessions);
      }
    } catch (error) {
      console.error('❌ Error sending message:', error);
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('📝 Form submitted with input:', inputValue);
    console.log('⏳ Is loading:', isLoading);
    sendMessage(inputValue);
  };

  const handleQuickAction = (action: QuickAction) => {
    setInputValue(action.prompt);
    // Focus the input field so user can continue typing
    const inputElement = document.querySelector('.chat-input') as HTMLInputElement;
    if (inputElement) {
      inputElement.focus();
      // Move cursor to end of text
      inputElement.setSelectionRange(inputElement.value.length, inputElement.value.length);
    }
  };

  const switchSession = async (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setCurrentSession(session);
      setMessages(session.messages);
    }
  };

  const deleteSession = async (sessionId: string) => {
    await chatService.deleteSession(sessionId);
    const updatedSessions = sessions.filter(s => s.id !== sessionId);
    setSessions(updatedSessions);
    
    if (currentSession?.id === sessionId) {
      if (updatedSessions.length > 0) {
        switchSession(updatedSessions[0].id);
      } else {
        await createNewSession();
      }
    }
  };

  const formatMessage = (message: ChatMessage) => {
    // Convert markdown-like formatting to HTML
    return message.content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/• (.*?)(?=\n|$)/g, '• $1<br/>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <div className="chat-interface">
      <div className="chat-sidebar">
        <div className="sidebar-header">
          <h3>Chat Sessions</h3>
                <button 
                  className="new-chat-btn"
                  onClick={createNewSession}
                  title="Start new chat"
                >
                  ➕
                </button>
        </div>
        
        <div className="sessions-list">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`session-item ${currentSession?.id === session.id ? 'active' : ''}`}
              onClick={() => switchSession(session.id)}
            >
              <div className="session-content">
                <h4>{session.title}</h4>
                <p>{session.messages.length} messages</p>
                <small>{session.updatedAt.toLocaleDateString()}</small>
              </div>
              <button
                className="delete-session-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSession(session.id);
                }}
                title="Delete session"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="chat-main">
        <div className="chat-header">
          <div className="header-info">
            <h2>{currentSession?.title || 'Academic AI Assistant'}</h2>
            <p>
              {documents.length > 0 
                ? `Context: ${documents.length} document(s) loaded`
                : 'Ready to help with your academic questions'
              }
            </p>
          </div>
          <div className="header-actions">
            <span className="status-indicator">
              {isLoading ? '🤔 Thinking...' : '🟢 Online'}
            </span>
          </div>
        </div>

        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="welcome-message">
              <div className="welcome-content">
                <div className="welcome-icon">🤖</div>
                <h3>Welcome to Academic AI Assistant!</h3>
                <p>I'm here to help you with your academic journey. Ask me anything about your studies!</p>
                
                {!isAuthenticated && (
                  <div className="auth-notice">
                    <div className="notice-icon">💡</div>
                    <p><strong>Tip:</strong> Sign in with Google to save your chat history and get personalized recommendations based on your uploaded documents!</p>
                  </div>
                )}
                
                <div className="quick-actions">
                  <h4>Quick Actions:</h4>
                  <div className="actions-grid">
                    {QUICK_ACTIONS.map((action) => (
                      <button
                        key={action.id}
                        className="quick-action-btn"
                        onClick={() => handleQuickAction(action)}
                        disabled={isLoading}
                      >
                        <span className="action-icon">{action.icon}</span>
                        <div className="action-content">
                          <strong>{action.title}</strong>
                          <small>{action.description}</small>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`message ${message.role}`}
              >
                <div className="message-avatar">
                  {message.role === 'user' ? '👤' : '🤖'}
                </div>
                <div className="message-content">
                  <div className="message-text">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: formatMessage(message)
                      }}
                    />
                  </div>
                  <div className="message-time">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))
          )}
          
          {isLoading && (
            <div className="message assistant">
              <div className="message-avatar">🤖</div>
              <div className="message-content">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        <form className="chat-input-form" onSubmit={handleSubmit}>
          {/* Attached Files Display */}
          {uploadedFiles.filter(f => f.uploadStatus === 'completed').length > 0 && (
            <div className="attached-files">
              <div className="attached-files-header">
                <span className="attached-files-title">📎 Attached Files</span>
                <button 
                  className="clear-files-btn"
                  onClick={() => setUploadedFiles(prev => prev.filter(f => f.uploadStatus !== 'completed'))}
                  title="Remove all attached files"
                >
                  ✕
                </button>
              </div>
              <div className="attached-files-list">
                {uploadedFiles
                  .filter(f => f.uploadStatus === 'completed')
                  .map((file) => (
                    <div key={file.id} className="attached-file-item">
                      <div className="file-icon">{getFileIcon(file.fileType)}</div>
                      <div className="file-info">
                        <span className="file-name" title={file.fileName}>{file.fileName}</span>
                        <span className="file-size">{formatFileSize(file.fileSize)}</span>
                      </div>
                      <button 
                        className="remove-file-btn"
                        onClick={() => setUploadedFiles(prev => prev.filter(f => f.id !== file.id))}
                        title="Remove file"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="input-container">
            <div className="input-wrapper">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask me anything about your studies..."
                disabled={isLoading}
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  handleFiles(e.dataTransfer.files);
                }}
              />
              <div className="input-actions">
                <button
                  type="button"
                  className="attach-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  title="Attach files"
                >
                  📎
                </button>
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isLoading}
                  className="send-btn"
                  onClick={() => console.log('🔘 Send button clicked')}
                >
                  {isLoading ? '⏳' : '📤'}
                </button>
              </div>
            </div>
            
            {/* File Upload Input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.pptx,.ppt"
              onChange={(e) => {
                if (e.target.files) {
                  handleFiles(e.target.files);
                }
              }}
              style={{ display: 'none' }}
            />
          </div>
          
          {/* Uploaded Files Preview */}
          {uploadedFiles.filter(f => f.uploadStatus !== 'completed').length > 0 && (
            <div className="upload-preview">
              {uploadedFiles
                .filter(file => file.uploadStatus !== 'completed')
                .map((file) => (
                <div key={file.id} className={`upload-item ${file.uploadStatus}`}>
                  <div className="upload-icon">{getFileIcon(file.fileType)}</div>
                  <div className="upload-info">
                    <span className="upload-name">{file.fileName}</span>
                    <div className="upload-progress">
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ width: `${file.uploadProgress}%` }}
                        ></div>
                      </div>
                      <span className="progress-text">{file.uploadProgress}%</span>
                    </div>
                  </div>
                  <button 
                    className="remove-upload-btn"
                    onClick={() => {
                      setUploadedFiles(prev => prev.filter(f => f.id !== file.id));
                    }}
                    title="Remove file"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div className="input-hint">
            Press Enter to send, Shift+Enter for new line • Drag & drop files or click 📎 to attach
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
