import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import UserProfile from './UserProfile';
import UserSettings from './UserSettings';
import { Home, ChatSquare, AddSquare, TextSquare, Card, Document } from 'solar-icons';
import FlashcardModal from './FlashcardModal';
import { useSessionFlashcards } from '../hooks/useSessionFlashcards';
import { chatService } from '../services/chatService';
import { ChatSession } from '../types/chat';
import './Layout.css';

// Remove the custom ChatHistoryItem interface - we'll use ChatSession directly

interface LayoutProps {
  children: React.ReactNode;
  onCreateNewChat?: () => void;
  onChatSelect?: (chatId: string) => void;
  currentChatId?: string;
}

const Layout: React.FC<LayoutProps> = ({ children, onCreateNewChat, onChatSelect, currentChatId }) => {
  const location = useLocation();
  const { isAuthenticated, user, signInWithGoogle, signOut, isLoading } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const [showFlashcardList, setShowFlashcardList] = useState(false);
  
  // Use custom hooks for efficient state management
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const { flashcardSets, updateFlashcardSet } = useSessionFlashcards(currentChatId);
  
  // Load chat sessions
  useEffect(() => {
    if (isAuthenticated) {
      const sessions = chatService.getSessions();
      setChatSessions(sessions);
    } else {
      setChatSessions([]);
    }
  }, [isAuthenticated]);

  // Listen for session updates (when new chats are created)
  useEffect(() => {
    const handleStorageChange = () => {
      if (isAuthenticated) {
        const sessions = chatService.getSessions();
        setChatSessions(sessions);
      }
    };

    // Listen for localStorage changes (where chat sessions are stored)
    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom events if the chat service dispatches them
    const handleSessionUpdate = () => {
      if (isAuthenticated) {
        const sessions = chatService.getSessions();
        setChatSessions(sessions);
      }
    };
    
    window.addEventListener('sessionUpdated', handleSessionUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('sessionUpdated', handleSessionUpdate);
    };
  }, [isAuthenticated]);

  const handleChatSelect = (chatId: string) => {
    if (onChatSelect) {
      onChatSelect(chatId);
    }
  };


  const navigationItems = [
    { 
      path: '/', 
      label: 'Home', 
      icon: <Home size={20} />
    },
    { 
      path: '/dashboard', 
      label: 'Chat', 
      icon: <ChatSquare size={20} />
    },
  ];

  return (
    <div className="layout">
      {/* Left Sidebar */}
      <aside className="sidebar">
        <nav className="sidebar-nav">
          {!isAuthenticated && (
            <div className="sign-in-section">
              <button
                className="sidebar-sign-in-btn"
                onClick={() => {
                  console.log('Sign in button clicked');
                  signInWithGoogle().catch(error => {
                    console.error('Sign in error:', error);
                  });
                }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="spinner"></div>
                ) : (
                  <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
              </button>
            </div>
          )}
          {navigationItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
            </Link>
          ))}
          
          {/* New Chat button - only show on chat page */}
          {location.pathname === '/dashboard' && onCreateNewChat && (
            <button
              className="nav-item new-chat-nav-btn"
              onClick={onCreateNewChat}
              title="New Chat"
            >
              <span className="nav-icon">
                <AddSquare size={16} />
              </span>
            </button>
          )}
          
          {/* Chat History Section - only show when chats exist */}
          {location.pathname === '/dashboard' && chatSessions.length > 0 && (
            <div className="chat-history-section">
              {chatSessions.slice(0, 10).map((session, index) => {
                const firstMessage = session.messages.find(m => m.role === 'user');
                const title = firstMessage ? firstMessage.content.substring(0, 30) + (firstMessage.content.length > 30 ? '...' : '') : 'New Chat';
                const summary = firstMessage ? `Chat about: ${firstMessage.content.substring(0, 100)}${firstMessage.content.length > 100 ? '...' : ''}` : 'New conversation';
                
                return (
                  <button
                    key={session.id}
                    className={`nav-item chat-history-item ${currentChatId === session.id ? 'active' : ''}`}
                    onClick={() => handleChatSelect(session.id)}
                    title={summary}
                  >
                    <span className="nav-icon chat-number">
                      {index + 1}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          
          {/* Flashcard Button */}
          {location.pathname === '/dashboard' && (
            <div>
              {flashcardSets.length > 0 ? (
                <button
                  className="nav-item flashcard-nav-btn"
                  onClick={() => setShowFlashcardList(true)}
                  title={`View your flashcard sets (${flashcardSets.length})`}
                >
                  <span className="nav-icon">
                    <Card size={16} />
                  </span>
                </button>
                  ) : (
                    <button
                      className="nav-item flashcard-nav-btn"
                      onClick={() => setShowFlashcardList(true)}
                      title="No flashcards yet - click to create some"
                    >
                      <span className="nav-icon">
                        <Document size={16} />
                      </span>
                    </button>
                  )}
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          {isAuthenticated ? (
            <button 
              className="profile-icon-only"
              onClick={() => setShowSettings(true)}
              title="User Settings"
            >
              {user?.picture ? (
                <img 
                  src={user.picture} 
                  alt="User Profile" 
                  className="user-profile-image"
                />
              ) : (
                <div className="user-profile-placeholder">
                  {user?.name?.charAt(0) || 'U'}
                </div>
              )}
            </button>
          ) : (
            <button
              className="login-btn-icon-only"
              onClick={() => {
                console.log('Sign in button clicked');
                signInWithGoogle().catch(error => {
                  console.error('Sign in error:', error);
                });
              }}
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="spinner"></div>
              ) : (
                <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {children}
      </main>

      {/* User Settings Modal */}
      <UserSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSignOut={signOut}
      />

      {/* Flashcard Modal */}
      {showFlashcardList && (
        <FlashcardModal
          isOpen={showFlashcardList}
          onClose={() => setShowFlashcardList(false)}
          flashcardSets={flashcardSets}
          onSetUpdate={updateFlashcardSet}
        />
      )}
    </div>
  );
};

export default Layout;
