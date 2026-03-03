import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { ChatMessage, ChatSession, ChatContext, QuickAction, QUICK_ACTIONS } from '../types/chat';
import { chatService } from '../services/chatService';
import { DocumentMetadata } from '../types/ai';
import { validateFile, getFileIcon, formatFileSize } from '../utils/fileValidation';
import { useAuth } from '../contexts/AuthContext';
import { documentProcessor, ProcessedDocument } from '../services/documentProcessor';
import FlashcardList from './FlashcardList';
import { FlashcardSet } from '../types/flashcard';
import { Card, Lightbulb, Calendar, Document as DocumentIcon, QuestionCircle, List, Target, Paperclip, ArrowRight, Pen, ClipboardList } from '@solar-icons/react';
import { allFlashcardEventTarget } from '../hooks/useAllFlashcards';
import { firebaseAILogicService, ModelPreference } from '../services/firebaseAILogicService';
import { ModelSelector } from './ModelSelector';
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

// this is the main chat interface - handles all user interaction
// it manages messages, document uploads, chat sessions, and coordinates with the chat service
const ChatInterface = forwardRef<ChatInterfaceRef, ChatInterfaceProps>((props, ref) => {
  const { 
    documents = [],  // documents passed from parent (dashboard)
    onDocumentsChange,  // callback when documents are uploaded
    onNewSession  // callback when a new chat session is created
  } = props;
  const { isAuthenticated } = useAuth();  // check if user is logged in
  const [messages, setMessages] = useState<ChatMessage[]>([]);  // all messages in current chat
  const [inputValue, setInputValue] = useState('');  // what user is typing
  const [isLoading, setIsLoading] = useState(false);  // is AI currently responding?
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);  // current chat session
  const [, setSessions] = useState<ChatSession[]>([]);  // all chat sessions (for sidebar)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);  // files being uploaded/processed
  const [showFlashcardList, setShowFlashcardList] = useState(false);  // show flashcard list sidebar?
  const [currentFlashcardSet, setCurrentFlashcardSet] = useState<FlashcardSet | null>(null);  // currently viewing flashcard set
  const [typingText, setTypingText] = useState('');  // for typing animation effect
  const [modelPreference, setModelPreference] = useState<ModelPreference>(() => {
    // Load from service on mount
    return firebaseAILogicService.getModelPreference();
  });  // selected AI model preference
  const messagesEndRef = useRef<HTMLDivElement>(null);  // ref to scroll to bottom of messages
  const lastAssistantMessageRef = useRef<HTMLDivElement>(null);  // ref to last assistant message for scrolling
  const fileInputRef = useRef<HTMLInputElement>(null);  // ref to hidden file input
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);  // timeout for typing animation
  const isTypingRef = useRef(false);  // track if typing animation is running
  const inputWrapperRef = useRef<HTMLDivElement>(null);
  const inputActionsLeftRef = useRef<HTMLDivElement>(null);

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

  // Auto-scroll to top of last assistant message when it's generated
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant' && lastAssistantMessageRef.current) {
      // Scroll to the top of the assistant message
      lastAssistantMessageRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [messages]);

  // handle copy button clicks for code blocks
  useEffect(() => {
    const handleCopyClick = (event: Event) => {
      const target = event.target as HTMLElement;
      // check if click was on the button or its child (svg)
      const button = target.closest('.copy-code-btn') as HTMLElement;
      if (button) {
        const codeContent = button.getAttribute('data-code-content');
        if (codeContent) {
          // decode the escaped content - this is the clean code stored in the data attribute
          const decodedContent = codeContent
            .replace(/&amp;/g, '&')  // decode &amp; first
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');
          
          // ensure the decoded content is clean (no HTML tags)
          const cleanDecodedContent = decodedContent.replace(/<[^>]*>/g, '').trim();
          
          navigator.clipboard.writeText(cleanDecodedContent).then(() => {
            // show feedback - save original html and restore after 2 seconds
            const originalHTML = button.innerHTML;
            button.innerHTML = 'Copied!';
            button.style.color = '#10b981';
            setTimeout(() => {
              button.innerHTML = originalHTML;
              button.style.color = '';
            }, 2000);
          }).catch(() => {
            // failed to copy code
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- startTypingAnimation is stable (uses refs internally), adding it would cause infinite re-renders
  }, [messages.length, isLoading, inputValue]);

  const startTypingAnimation = () => {
    if (isTypingRef.current) {
      return;
    }
    
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
          // Clear typing text so default placeholder shows
          setTypingText('');
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
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- loadSessions should only run when auth state changes, not on every render
  }, [isAuthenticated]);

  // Keep textarea caret + animated placeholder aligned with the actual model selector width.
  // This prevents overlap when the selected model label is long.
  useEffect(() => {
    const wrapper = inputWrapperRef.current;
    const left = inputActionsLeftRef.current;
    if (!wrapper || !left) return;

    const update = () => {
      const wrapperRect = wrapper.getBoundingClientRect();
      const leftRect = left.getBoundingClientRect();
      // Place textarea text start just after the left control area + a small gap.
      const gapPx = 12;
      const leftPadPx = Math.max(0, Math.round(leftRect.right - wrapperRect.left + gapPx));
      wrapper.style.setProperty('--chat-input-left-pad', `${leftPadPx}px`);
    };

    update();

    const ro = new ResizeObserver(() => update());
    ro.observe(wrapper);
    ro.observe(left);

    // Font loads or layout shifts can change widths without resize events in some browsers.
    const raf = requestAnimationFrame(update);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [modelPreference, isAuthenticated]);

  // Notify parent component when documents are uploaded
  // Using a ref to track previous uploadedFiles to avoid infinite loops
  const prevUploadedFilesRef = useRef<string>('');
  const onDocumentsChangeRef = useRef(onDocumentsChange);
  
  // Keep ref in sync with prop
  useEffect(() => {
    onDocumentsChangeRef.current = onDocumentsChange;
  }, [onDocumentsChange]);
  
  useEffect(() => {
    if (onDocumentsChangeRef.current && uploadedFiles.length > 0) {
      const completedDocs = uploadedFiles.filter(f => f.uploadStatus === 'completed');
      if (completedDocs.length > 0) {
        // Create a stable key to detect actual changes (only trigger on new completions)
        const completedIds = completedDocs.map(d => d.id).sort().join(',');
        if (prevUploadedFilesRef.current !== completedIds) {
          prevUploadedFilesRef.current = completedIds;
          onDocumentsChangeRef.current(completedDocs);
        }
      }
    }
  }, [uploadedFiles]);

  const loadSessions = async () => {
    if (!isAuthenticated) {
      return;
    }

    await chatService.reloadForUser();
    const existingSessions = chatService.getSessions();
    setSessions(existingSessions);

    // Always start users in a fresh blank chat when they return.
    // Prior chats remain accessible via the sidebar.
    createNewSession();
  };

  const createNewSession = async () => {
    const newSession = await chatService.createNewSession();
    setCurrentSession(newSession);
    
    // Refresh sessions from chat service to get all updated sessions
    const updatedSessions = chatService.getSessions();
    setSessions(updatedSessions);
    
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
    
    // Dispatch event to notify other components
    allFlashcardEventTarget.dispatchEvent(new CustomEvent('flashcardUpdate', {
      detail: { sessionId: currentSession?.id, flashcardSets: [flashcardSet] }
    }));
  };

  const handleFlashcardSetUpdate = (updatedSet: FlashcardSet) => {
    // Flashcard updates are now managed by the unified system
    if (currentFlashcardSet?.id === updatedSet.id) {
      setCurrentFlashcardSet(updatedSet);
    }
  };

  const handleModelChange = (newPreference: ModelPreference) => {
    setModelPreference(newPreference);
    firebaseAILogicService.setModelPreference(newPreference);
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
        
        // Store processed document data for use in chat context
        
        // Update with processed data
        setUploadedFiles(prev => {
          return prev.map(f => 
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
        });

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
  }, []);

  // this is called when user hits enter or clicks send
  // it sends the message to the chat service which handles AI communication
  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;  // don't send empty messages or if already loading

    // create a new chat session if this is the first message
    // each chat session has its own message history
    let session = currentSession;
    if (!session) {
      session = await chatService.createNewSession();
      setCurrentSession(session);
      setSessions(prev => [session!, ...prev]);
      
      // notify other components (like sidebar) that a new session was created
      window.dispatchEvent(new CustomEvent('sessionUpdated'));
    }

    const wasEmptySession = session.messages.length === 0;

    // add user message to UI immediately so it feels responsive
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');  // clear input field
    setIsLoading(true);

    try {
      // get all the processed documents that are ready
      // these get sent to the AI as context so it knows what documents to reference
      const processedDocs = uploadedFiles
        .filter(f => f.uploadStatus === 'completed' && f.processedDocument)
        .map(f => f.processedDocument!);

      // build context object - includes session id, document ids, and full processed documents
      // the chat service uses this to build the prompt for the AI
      const context: ChatContext = {
        sessionId: session.id,
        documentIds: documents.map(doc => doc.id),
        currentTopic: 'general',
        processedDocuments: processedDocs
      };
      // send to chat service - it handles AI communication and returns the response
      const response = await chatService.sendMessage(content.trim(), context);
      setMessages(prev => [...prev, response]);
      
      // If this was the first message in a brand-new blank session, notify parent
      // so the sidebar highlight can follow the active session once it becomes real.
      if (wasEmptySession && onNewSession) {
        onNewSession(session);
      }

      // chat service automatically saves sessions to firebase (if logged in) or memory
      // the layout component listens for session updates to show them in the sidebar
      
      // if the AI generated flashcards, show them to the user
      if (response.flashcardSet) {
        handleFlashcardsGenerated(response.flashcardSet);
      }
      
      // refresh session list to get updated titles (AI sometimes updates session title based on conversation)
      if (isAuthenticated) {
        const updatedSessions = chatService.getSessions();
        setSessions(updatedSessions);
      }
    } catch (error) {
      // if something goes wrong, show error message to user
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
    } else {
      // Session was deleted, create a new blank chat
      createNewSession();
    }
  };

  const formatMessage = (message: ChatMessage) => {
    let content = message.content;
    
    // Handle code blocks (triple backticks)
    content = content.replace(/```(\w+)?\s*\n?([\s\S]*?)```/g, (_, language, code) => {
      const lang = (language && language.trim()) || 'text';
      const escapedCode = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
      
      return `<div class="code-block-container">
        <div class="code-block-header">
          <span class="code-language">${lang !== 'text' ? lang.toUpperCase() : 'CODE'}</span>
          <button class="copy-code-btn" data-code-content="${escapedCode}" title="Copy code">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
        </div>
        <pre class="code-block"><code>${escapedCode}</code></pre>
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
    
    // note: we removed the fallback code detection because it was creating false positives
    // the AI should use proper markdown code blocks with triple backticks
    // if code doesn't have backticks, it will display as regular text (which is acceptable)
    
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
        return <DocumentIcon {...iconProps} />;
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
        return <DocumentIcon {...iconProps} />;
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
                    <div className="notice-icon">
                      <Lightbulb size={50} />
                    </div>
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
            messages.map((message, index) => {
              const isLastAssistantMessage = 
                message.role === 'assistant' && 
                index === messages.length - 1;
              
              return (
                <div
                  key={message.id}
                  ref={isLastAssistantMessage ? lastAssistantMessageRef : null}
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
                      {message.timestamp instanceof Date 
                        ? message.timestamp.toLocaleTimeString()
                        : new Date(message.timestamp).toLocaleTimeString()
                      }
                    </div>
                  </div>
                </div>
              );
            })
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
            <div className="input-wrapper" ref={inputWrapperRef}>
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={inputValue === '' && !isLoading && typingText && typingText.length > 0 ? typingText : ''}
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
                  onClick={() => {}}
                >
                  {isLoading ? (
                    <div className="loading-spinner"></div>
                  ) : (
                    <ArrowRight size={16} />
                  )}
                </button>
              </div>
              <div className="input-actions-left" ref={inputActionsLeftRef}>
                <ModelSelector
                  selectedModel={modelPreference}
                  onModelChange={handleModelChange}
                  disabled={isLoading}
                />
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