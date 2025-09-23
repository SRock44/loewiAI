import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { ChatMessage, ChatSession, ChatContext, QuickAction, QUICK_ACTIONS } from '../types/chat';
import { chatService } from '../services/chatService';
import { DocumentMetadata } from '../types/ai';
import { validateFile, getFileIcon, formatFileSize } from '../utils/fileValidation';
import { useAuth } from '../contexts/AuthContext';
import { documentProcessor, ProcessedDocument } from '../services/documentProcessor';
import FlashcardList from './FlashcardList';
import { FlashcardSet } from '../types/flashcard';
import { Card, Lightbulb, Calendar, Document, QuestionCircle, List, Target, Paperclip, ArrowRight, Pen, ClipboardList } from 'solar-icons';
import { allFlashcardEventTarget } from '../hooks/useAllFlashcards';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import './ChatInterface.css';

interface ChatInterfaceProps {
  documents?: DocumentMetadata[];
  onDocumentsChange?: (documents: DocumentMetadata[]) => void;
  onNewSession?: (session: ChatSession) => void;
}

export interface ChatInterfaceRef {
  createNewSession: () => void;
  switchToSession: (sessionId: string) => void;
}

interface UploadedFile extends DocumentMetadata {
  uploadProgress: number;
  uploadStatus: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
  processedDocument?: ProcessedDocument;
}

const ChatInterface = forwardRef<ChatInterfaceRef, ChatInterfaceProps>((props, ref) => {
  const { 
    documents = [], 
    onDocumentsChange,
    onNewSession 
  } = props;
  const { isAuthenticated, user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [, setSessions] = useState<ChatSession[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [showFlashcardList, setShowFlashcardList] = useState(false);
  const [currentFlashcardSet, setCurrentFlashcardSet] = useState<FlashcardSet | null>(null);
  const [typingText, setTypingText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  // Example prompts to cycle through
  const examplePrompts = [
    "Ask me about calculus derivatives...",
    "Help me understand photosynthesis...",
    "Create flashcards for my biology exam...",
    "Explain quantum mechanics simply...",
    "Summarize this research paper...",
    "Help me write an essay about...",
    "What are the key concepts in...",
    "Generate practice problems for...",
    "Ask me anything about your studies..."
  ];

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle copy button clicks for code blocks
  useEffect(() => {
    const handleCopyClick = (event: Event) => {
      const target = event.target as HTMLElement;
      if (target.classList.contains('copy-code-btn')) {
        const codeContent = target.getAttribute('data-code-content');
        if (codeContent) {
          // Decode the escaped content
          const decodedContent = codeContent
            .replace(/&quot;/g, '"')
            .replace(/\\n/g, '\n')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&');
          
          navigator.clipboard.writeText(decodedContent).then(() => {
            // Show feedback
            const originalText = target.textContent;
            target.textContent = 'Copied!';
            target.style.color = '#10b981';
            setTimeout(() => {
              target.textContent = originalText;
              target.style.color = '';
            }, 2000);
          }).catch(err => {
            console.error('Failed to copy code:', err);
          });
        }
      }
    };

    document.addEventListener('click', handleCopyClick);
    return () => document.removeEventListener('click', handleCopyClick);
  }, []);

  // Typing animation effect
  useEffect(() => {
    if (messages.length === 0 && !isLoading && inputValue === '') {
      // Add a small delay to ensure component is fully mounted
      setTimeout(() => {
        startTypingAnimation();
      }, 500);
    } else {
      stopTypingAnimation();
    }

    return () => {
      stopTypingAnimation();
    };
  }, [messages.length, isLoading, inputValue]);

  const startTypingAnimation = () => {
    if (isTypingRef.current) {
      return;
    }
    
    setIsTyping(true);
    isTypingRef.current = true;
    
    // Start with a random prompt
    let currentPromptIndex = Math.floor(Math.random() * examplePrompts.length);
    let currentPrompt = examplePrompts[currentPromptIndex];
    let currentIndex = 0;
    
    const typeText = () => {
      if (currentIndex < currentPrompt.length && isTypingRef.current) {
        const currentText = currentPrompt.substring(0, currentIndex + 1);
        setTypingText(currentText);
        currentIndex++;
        typingTimeoutRef.current = setTimeout(typeText, 100);
      } else if (isTypingRef.current) {
        // Wait a bit, then start erasing
        typingTimeoutRef.current = setTimeout(() => {
          if (isTypingRef.current) {
            eraseText();
          }
        }, 2000);
      }
    };

    const eraseText = () => {
      let index = currentPrompt.length;
      const erase = () => {
        if (index > 0 && isTypingRef.current) {
          const currentText = currentPrompt.substring(0, index - 1);
          setTypingText(currentText);
          index--;
          typingTimeoutRef.current = setTimeout(erase, 50);
        } else if (isTypingRef.current) {
          // Wait a bit, then start typing a new prompt
          typingTimeoutRef.current = setTimeout(() => {
            if (isTypingRef.current) {
              // Select next prompt (cycle through)
              currentPromptIndex = (currentPromptIndex + 1) % examplePrompts.length;
              currentPrompt = examplePrompts[currentPromptIndex];
              currentIndex = 0;
              typeText();
            }
          }, 1000);
        }
      };
      erase();
    };

    typeText();
  };

  const stopTypingAnimation = () => {
    setIsTyping(false);
    isTypingRef.current = false;
    setTypingText('');
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

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
    
    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent('sessionUpdated'));
  };

  useImperativeHandle(ref, () => ({
    createNewSession,
    switchToSession: switchSession
  }));

  const handleFlashcardsGenerated = (flashcardSet: FlashcardSet) => {
    // Flashcard sets are now managed by the unified system
    setCurrentFlashcardSet(flashcardSet);
    setShowFlashcardList(true);
    
    // Save to sessionStorage and dispatch event for current session
    if (currentSession) {
      const sessionFlashcards = sessionStorage.getItem(`flashcards_${currentSession.id}`);
      let existingFlashcards = [];
      if (sessionFlashcards) {
        try {
          existingFlashcards = JSON.parse(sessionFlashcards);
        } catch (error) {
          console.error('Error parsing existing session flashcards:', error);
        }
      }
      
      const updatedFlashcards = [flashcardSet, ...existingFlashcards];
      sessionStorage.setItem(`flashcards_${currentSession.id}`, JSON.stringify(updatedFlashcards));
      
      // Dispatch event to notify other components
      allFlashcardEventTarget.dispatchEvent(new CustomEvent('flashcardUpdate', {
        detail: { sessionId: currentSession.id, flashcardSets: updatedFlashcards }
      }));
    }
  };

  const handleFlashcardSetUpdate = (updatedSet: FlashcardSet) => {
    // Flashcard updates are now managed by the unified system
    if (currentFlashcardSet?.id === updatedSet.id) {
      setCurrentFlashcardSet(updatedSet);
    }
    
    // Save updated flashcard set to sessionStorage
    if (currentSession) {
      const sessionFlashcards = sessionStorage.getItem(`flashcards_${currentSession.id}`);
      let existingFlashcards = [];
      if (sessionFlashcards) {
        try {
          existingFlashcards = JSON.parse(sessionFlashcards);
        } catch (error) {
          console.error('Error parsing existing session flashcards:', error);
        }
      }
      
      const updatedFlashcards = existingFlashcards.map((set: FlashcardSet) => set.id === updatedSet.id ? updatedSet : set);
      sessionStorage.setItem(`flashcards_${currentSession.id}`, JSON.stringify(updatedFlashcards));
      console.log('Updated flashcard set in session storage for session:', currentSession.id);
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
          content: `Upload failed: ${validation.error}`,
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

        // Use documentProcessor directly to get full ProcessedDocument
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
                  uploadStatus: 'completed' as const,
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
          content: `Successfully uploaded and processed "${file.name}". I can now help you with questions about this document.`,
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
          content: `Failed to process "${file.name}". Please try again.`,
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
      
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('sessionUpdated'));
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
      console.log('📄 Processed documents details:', processedDocs.map(doc => ({
        id: doc.id,
        fileName: doc.fileName,
        contentLength: doc.extractedContent.length,
        contentPreview: doc.extractedContent.substring(0, 200)
      })));
      const response = await chatService.sendMessage(content.trim(), context);
      console.log('📥 Received response:', response);
      setMessages(prev => [...prev, response]);
      
      // Chat sessions are automatically managed by the chat service
      // No need to manually add to history - the Layout component will pick up new sessions
      
      // Check if the response contains a flashcard set
      if (response.flashcardSet) {
        handleFlashcardsGenerated(response.flashcardSet);
      }
      
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
    // Get the latest sessions from the chat service
    const latestSessions = chatService.getSessions();
    setSessions(latestSessions);
    
    const session = latestSessions.find(s => s.id === sessionId);
    if (session) {
      setCurrentSession(session);
      setMessages(session.messages);
    }
  };

  // Language mapping for Prism.js
  const getPrismLanguage = (lang: string): string => {
    const languageMap: { [key: string]: string } = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'cpp': 'c', // Use C highlighting for C++ since prism-cpp has issues
      'c++': 'c',
      'c': 'c',
      'cs': 'csharp',
      'php': 'markup', // Use markup highlighting for PHP since prism-php has dependency issues
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'sql': 'sql',
      'json': 'json',
      'css': 'css',
      'html': 'markup',
      'xml': 'markup',
      'md': 'markdown',
      'sh': 'bash',
      'bash': 'bash',
      'yml': 'yaml',
      'yaml': 'yaml',
      'jsx': 'jsx',
      'tsx': 'tsx'
    };
    return languageMap[lang.toLowerCase()] || lang.toLowerCase();
  };

  const formatMessage = (message: ChatMessage) => {
    let content = message.content;
    
    // First, handle code blocks (triple backticks) - must be done before other replacements
    content = content.replace(/```(\w+)?\n?([\s\S]*?)```/g, (match, language, code) => {
      const lang = language || 'text';
      const cleanCode = code.trim();
      const codeId = `code-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Apply syntax highlighting using Prism.js
      let highlightedCode = cleanCode;
      const prismLang = getPrismLanguage(lang);
      
      if (lang !== 'text' && Prism && Prism.languages && Prism.languages[prismLang] && Prism.highlight) {
        try {
          // Additional safety check for the specific language
          const languageDef = Prism.languages[prismLang];
          if (languageDef && typeof languageDef === 'object') {
            highlightedCode = Prism.highlight(cleanCode, languageDef, prismLang);
          } else {
            console.warn(`Invalid language definition for: ${prismLang}`);
          }
        } catch (error) {
          console.warn(`Failed to highlight code for language: ${prismLang}`, error);
          highlightedCode = cleanCode;
        }
      } else if (lang !== 'text') {
        console.warn(`Language not supported: ${prismLang}`);
      }
      
      return `<div class="code-block-container">
        <div class="code-block-header">
          <span class="code-language">${lang}</span>
          <button class="copy-code-btn" data-code-id="${codeId}" data-code-content="${cleanCode.replace(/"/g, '&quot;').replace(/\n/g, '\\n')}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Copy
          </button>
        </div>
        <pre class="code-block" id="${codeId}"><code class="language-${prismLang}">${highlightedCode}</code></pre>
      </div>`;
    });
    
    // Handle inline code (single backticks)
    content = content.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    
    // Handle math expressions (basic LaTeX-style)
    content = content.replace(/\$\$([^$]+)\$\$/g, '<div class="math-block">$$$1$$</div>');
    content = content.replace(/\$([^$]+)\$/g, '<span class="math-inline">$$1$</span>');
    
    // Handle step-by-step math solutions
    content = content.replace(/Step (\d+):\s*(.*)/g, '<div class="math-step"><strong>Step $1:</strong> $2</div>');
    
    // Handle bold and italic text
    content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Handle numbered lists with better styling
    content = content.replace(/^\d+\.\s+(.*)$/gm, '<div class="list-item numbered">$1</div>');
    
    // Handle bullet points with better spacing and styling
    content = content.replace(/^[-•]\s+(.*)$/gm, '<div class="list-item bulleted">$1</div>');
    
    // Handle line breaks with proper spacing
    content = content.replace(/\n\n/g, '<br/><br/>');
    content = content.replace(/\n/g, '<br/>');
    
    return content;
  };

  const renderSolarIcon = (iconName: string, size: number = 16) => {
    const iconProps = { size };
    switch (iconName) {
      case 'Lightbulb':
        return <Lightbulb {...iconProps} />;
      case 'Calendar':
        return <Calendar {...iconProps} />;
      case 'Document':
        return <Document {...iconProps} />;
      case 'Edit':
        return <Pen {...iconProps} />;
      case 'QuestionCircle':
        return <QuestionCircle {...iconProps} />;
      case 'List':
        return <List {...iconProps} />;
      case 'Target':
        return <Target {...iconProps} />;
      case 'Card':
        return <Card {...iconProps} />;
      default:
        return <Document {...iconProps} />;
    }
  };

  return (
    <div className="chat-interface">
      
      <div className="chat-main">

        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="welcome-message">
              <div className="welcome-content">
                <h3 className="welcome-title">Welcome to Newton 1.0!</h3>
                <p className="welcome-description">Your next-generation academic AI prototype - combining the expertise of an advisor, professor, tutor, and intelligent assistant in one powerful platform.</p>
                
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
                        <span className="action-icon">{renderSolarIcon(action.icon, 18)}</span>
                        <div className="action-content">
                          <strong>{action.title}</strong>
                          <small>{action.description}</small>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                
                <button 
                  className="flashcard-info flashcard-action-btn"
                  onClick={() => handleQuickAction({
                    id: 'create_flashcards',
                    title: 'Create Flashcards',
                    description: 'Generate flashcards for any topic',
                    prompt: 'Create flashcards about ',
                    icon: 'Card',
                    category: 'study'
                  })}
                  disabled={isLoading}
                >
                  <div className="info-icon">
                    <ClipboardList size={24} />
                  </div>
                  <div className="info-content">
                    <h4>Create Flashcards Instantly!</h4>
                    <p>Just type "create flashcards about [topic]" and I'll create study cards for you automatically! Works with any subject or uploaded documents.</p>
                    <div className="example-commands">
                      <strong>Examples:</strong>
                      <ul>
                        <li>"Create flashcards about photosynthesis"</li>
                        <li>"Make flashcards for calculus derivatives"</li>
                        <li>"Generate flashcards from my uploaded PDF"</li>
                      </ul>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`message ${message.role} ${message.flashcardSet ? 'flashcard-message' : ''}`}
              >
                <div 
                  className={`message-content ${message.flashcardSet ? 'clickable-flashcard-message' : ''}`}
                  onClick={message.flashcardSet ? () => {
                    setCurrentFlashcardSet(message.flashcardSet!);
                    setShowFlashcardList(true);
                  } : undefined}
                >
                  <div className="message-text">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: formatMessage(message)
                      }}
                    />
                  </div>
                  
                  {message.flashcardSet && (
                    <div className="flashcard-message-hint">
                      <span className="hint-text">Click to view flashcards</span>
                    </div>
                  )}
                  <div className="message-time">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))
          )}
          
          {isLoading && (
            <div className="message assistant">
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
                <span className="attached-files-title">
                  <Paperclip size={14} style={{ marginRight: '6px' }} />
                  Attached Files
                </span>
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
                placeholder={inputValue === '' && !isLoading && typingText ? typingText : "Ask me anything about your studies..."}
                disabled={isLoading}
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                onFocus={() => {
                  stopTypingAnimation();
                }}
                onBlur={() => {
                  if (messages.length === 0 && !isLoading && inputValue === '') {
                    setTimeout(() => startTypingAnimation(), 1000);
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  // Drag over state removed
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  // Drag over state removed
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  // Drag over state removed
                  handleFiles(e.dataTransfer.files);
                }}
              />
              {inputValue === '' && !isLoading && isTyping && (
                <div className="typing-cursor">|</div>
              )}
              <div className="input-actions">
                <button
                  type="button"
                  className="attach-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  title="Attach files"
                >
                  <Paperclip size={16} />
                </button>
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isLoading}
                  className="send-btn"
                  onClick={() => console.log('🔘 Send button clicked')}
                >
                  {isLoading ? (
                    <div className="loading-spinner"></div>
                  ) : (
                    <ArrowRight size={16} />
                  )}
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
            Press Enter to send, Shift+Enter for new line • Drag & drop files or click <Paperclip size={12} style={{ display: 'inline', margin: '0 2px' }} /> to attach
          </div>
        </form>
      </div>


      {/* Flashcard List Modal */}
      {showFlashcardList && currentFlashcardSet && (
        <div className="flashcard-list-overlay">
          <div className="flashcard-list-modal">
            <button 
              className="floating-close-btn" 
              onClick={() => setShowFlashcardList(false)}
            >
              ✕
            </button>
            <div className="flashcard-list-content">
              <FlashcardList
                flashcardSet={currentFlashcardSet}
                onSetUpdate={handleFlashcardSetUpdate}
                showFilters={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

ChatInterface.displayName = 'ChatInterface';

export default ChatInterface;
