import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { ChatMessage, ChatSession, ChatContext, QuickAction, QUICK_ACTIONS } from '../types/chat';
import { chatService } from '../services/chatService';
import { DocumentMetadata } from '../types/ai';
import { validateFile, formatFileSize } from '../utils/fileValidation';
import { createThumbnail, readFileAsDataUrl, compressImage } from '../utils/imageUtils';
import { useAuth } from '../contexts/AuthContext';
import { documentProcessor, ProcessedDocument } from '../services/documentProcessor';
import FlashcardList from './FlashcardList';
import DocumentPreviewPanel from './DocumentPreviewPanel';
import ProfessionalDocumentPanel from './ProfessionalDocumentPanel';
import { FlashcardSet } from '../types/flashcard';
import { Card, Lightbulb, Calendar, Document as DocumentIcon, QuestionCircle, List, Target, Paperclip, ArrowRight, Pen, ClipboardList } from '@solar-icons/react';
import { renderMarkdownSafe } from '../utils/markdownRenderer';
import { allFlashcardEventTarget } from '../hooks/useAllFlashcards';
import { firebaseAILogicService, ModelPreference } from '../services/firebaseAILogicService';
import { firebaseService } from '../services/firebaseService';
import { firebaseAuthService } from '../services/firebaseAuthService';
import { ModelSelector } from './ModelSelector';
import katex from 'katex';
import 'katex/dist/katex.min.css';
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
  thumbnailUrl?: string;
  fullImageUrl?: string;   // data URL — in-session lightbox (in-memory, not persisted)
  storageUrl?: string;     // Firebase Storage download URL — cross-session lightbox (persisted to Firestore)
  storagePath?: string;    // Firebase Storage path — used for cleanup on session delete
}

const DOC_LOADER_MESSAGES = [
  (title: string) => `Generating your ${title}`,
  () => 'Gathering relevant concepts',
  () => 'Compiling key formulas',
  () => 'Organizing sections',
  () => 'Formatting equations',
  () => 'Structuring definitions',
  () => 'Reviewing worked examples',
  () => 'Building your reference guide',
  () => 'Polishing the final layout',
  () => 'Almost there',
];

const PROF_DOC_LOADER_MESSAGES = [
  (title: string) => `Drafting your ${title}`,
  () => 'Structuring the argument',
  () => 'Writing the introduction',
  () => 'Developing body paragraphs',
  () => 'Formatting citations',
  () => 'Crafting the conclusion',
  () => 'Building the Works Cited',
  () => 'Reviewing academic style',
  () => 'Polishing the final draft',
  () => 'Almost there',
];

const FLASHCARD_LOADER_MESSAGES = [
  (topic: string) => topic ? `Creating flashcards for ${topic}` : 'Creating your flashcards',
  () => 'Identifying key concepts',
  () => 'Writing question prompts',
  () => 'Crafting clear answers',
  () => 'Balancing difficulty levels',
  () => 'Adding helpful hints',
  () => 'Organizing by topic',
  () => 'Reviewing for accuracy',
  () => 'Almost ready to study',
];

function DocGeneratingLoader({ title, isProfessional }: { title: string; isProfessional?: boolean }) {
  const messages = isProfessional ? PROF_DOC_LOADER_MESSAGES : DOC_LOADER_MESSAGES;
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIdx(i => (i + 1) % messages.length), 2200);
    return () => clearInterval(id);
  }, [messages.length]);

  const msg = messages[idx](title);

  return (
    <div className="doc-generating-loader">
      <div className="atom-spinner">
        <svg viewBox="0 0 64 64" width="54" height="54" aria-hidden="true">
          <defs>
            <filter id="atom-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="1.8" result="blur"/>
              <feMerge>
                <feMergeNode in="blur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <radialGradient id="nucleusGrad" cx="38%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#93c5fd" />
              <stop offset="100%" stopColor="#3b6de0" />
            </radialGradient>
          </defs>
          {/* Orbit 1 – blue */}
          <g className="orbit-group orbit-group-1">
            <ellipse cx="32" cy="32" rx="27" ry="9.5" fill="none" stroke="#3b6de0" strokeWidth="2" strokeOpacity="0.8" />
            <circle cx="59" cy="32" r="2.8" fill="#3b6de0" filter="url(#atom-glow)" />
          </g>
          {/* Orbit 2 – indigo */}
          <g className="orbit-group orbit-group-2">
            <ellipse cx="32" cy="32" rx="27" ry="9.5" fill="none" stroke="#6366f1" strokeWidth="2" strokeOpacity="0.8" />
            <circle cx="59" cy="32" r="2.8" fill="#6366f1" filter="url(#atom-glow)" />
          </g>
          {/* Orbit 3 – cyan */}
          <g className="orbit-group orbit-group-3">
            <ellipse cx="32" cy="32" rx="27" ry="9.5" fill="none" stroke="#06b6d4" strokeWidth="2" strokeOpacity="0.8" />
            <circle cx="59" cy="32" r="2.8" fill="#06b6d4" filter="url(#atom-glow)" />
          </g>
          {/* Nucleus */}
          <circle cx="32" cy="32" r="5.5" fill="url(#nucleusGrad)" filter="url(#atom-glow)" className="atom-nucleus" />
        </svg>
      </div>
      <span className="doc-generating-text">{msg}…</span>
    </div>
  );
}

function FlashcardGeneratingLoader({ topic }: { topic: string }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIdx(i => (i + 1) % FLASHCARD_LOADER_MESSAGES.length), 2200);
    return () => clearInterval(id);
  }, []);

  const msg = FLASHCARD_LOADER_MESSAGES[idx](topic);

  return (
    <div className="doc-generating-loader">
      <div className="atom-spinner">
        <svg viewBox="0 0 64 64" width="54" height="54" aria-hidden="true">
          <defs>
            <filter id="fc-atom-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="1.8" result="blur"/>
              <feMerge>
                <feMergeNode in="blur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <radialGradient id="fcNucleusGrad" cx="38%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#86efac" />
              <stop offset="100%" stopColor="#16a34a" />
            </radialGradient>
          </defs>
          {/* Orbit 1 – green */}
          <g className="orbit-group orbit-group-1">
            <ellipse cx="32" cy="32" rx="27" ry="9.5" fill="none" stroke="#16a34a" strokeWidth="2" strokeOpacity="0.8" />
            <circle cx="59" cy="32" r="2.8" fill="#16a34a" filter="url(#fc-atom-glow)" />
          </g>
          {/* Orbit 2 – emerald */}
          <g className="orbit-group orbit-group-2">
            <ellipse cx="32" cy="32" rx="27" ry="9.5" fill="none" stroke="#10b981" strokeWidth="2" strokeOpacity="0.8" />
            <circle cx="59" cy="32" r="2.8" fill="#10b981" filter="url(#fc-atom-glow)" />
          </g>
          {/* Orbit 3 – teal */}
          <g className="orbit-group orbit-group-3">
            <ellipse cx="32" cy="32" rx="27" ry="9.5" fill="none" stroke="#14b8a6" strokeWidth="2" strokeOpacity="0.8" />
            <circle cx="59" cy="32" r="2.8" fill="#14b8a6" filter="url(#fc-atom-glow)" />
          </g>
          {/* Nucleus */}
          <circle cx="32" cy="32" r="5.5" fill="url(#fcNucleusGrad)" filter="url(#fc-atom-glow)" className="atom-nucleus" />
        </svg>
      </div>
      <span className="doc-generating-text">{msg}…</span>
    </div>
  );
}

// this is the main chat interface - handles all user interaction
// it manages messages, document uploads, chat sessions, and coordinates with the chat service
const ChatInterface = forwardRef<ChatInterfaceRef, ChatInterfaceProps>((props, ref) => {
  const { 
    documents = [],  // documents passed from parent (dashboard)
    onDocumentsChange,  // callback when documents are uploaded
    onNewSession  // callback when a new chat session is created
  } = props;
  const { isAuthenticated, user } = useAuth();  // check if user is logged in
  const [messages, setMessages] = useState<ChatMessage[]>([]);  // all messages in current chat
  const [inputValue, setInputValue] = useState('');  // what user is typing
  const [isLoading, setIsLoading] = useState(false);  // is AI currently responding?
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);  // current chat session
  const [, setSessions] = useState<ChatSession[]>([]);  // all chat sessions (for sidebar)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);  // files being uploaded/processed
  // Session-level document cache: all docs processed in this session, keyed by id.
  // Persists across message sends so subsequent questions can still reference uploaded files.
  const sessionDocsRef = useRef<Map<string, ProcessedDocument>>(new Map());
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [showFlashcardList, setShowFlashcardList] = useState(false);  // show flashcard list sidebar?
  const [currentFlashcardSet, setCurrentFlashcardSet] = useState<FlashcardSet | null>(null);  // currently viewing flashcard set
  const [docPreviewMessage, setDocPreviewMessage] = useState<ChatMessage | null>(null);
  const [typingText, setTypingText] = useState('');  // for typing animation effect
  const [generatingDocTitle, setGeneratingDocTitle] = useState<string>('');
  const [generatingDocIsProfessional, setGeneratingDocIsProfessional] = useState(false);
  const [messageRatings, setMessageRatings] = useState<Record<string, 'good' | 'bad'>>({});
  const [retryDialogMsgId, setRetryDialogMsgId] = useState<string | null>(null);
  const [retryFeedback, setRetryFeedback] = useState('');
  const [isRetrying, setIsRetrying] = useState(false);
  const [modelPreference, setModelPreference] = useState<ModelPreference>(() => {
    // Load from service on mount
    return firebaseAILogicService.getModelPreference();
  });  // selected AI model preference
  const messagesEndRef = useRef<HTMLDivElement>(null);  // ref to scroll to bottom of messages
  const lastAssistantMessageRef = useRef<HTMLDivElement>(null);  // ref to last assistant message for scrolling
  const fileInputRef = useRef<HTMLInputElement>(null);  // ref to hidden file input
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);  // timeout for typing animation
  const isTypingRef = useRef(false);  // track if typing animation is running
  // Streaming animation refs — separate from React state to avoid batching issues
  const streamBufferRef = useRef('');       // full content received so far from API
  const revealedLenRef = useRef(0);         // how many chars are currently shown
  const streamDoneRef = useRef(false);      // true when API has finished sending
  const streamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDocStreamRef = useRef(false);
  const isFlashcardStreamRef = useRef(false);
  const [generatingFlashcardTopic, setGeneratingFlashcardTopic] = useState('');
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

  // Auto-scroll: snap to top of assistant message on first appearance,
  // then keep bottom in view during streaming updates
  const prevMessageCountRef = useRef(messages.length);
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'assistant') return;

    const isNewMessage = messages.length !== prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;

    if (isNewMessage && lastAssistantMessageRef.current) {
      // New message just appeared — scroll to its top
      lastAssistantMessageRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (lastMessage.isTyping && messagesEndRef.current) {
      // Streaming update — keep bottom visible
      messagesEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
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


  // Close lightbox on Escape
  useEffect(() => {
    if (!lightboxUrl) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxUrl(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxUrl]);

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

    // Clear session-level document cache for the new session
    sessionDocsRef.current.clear();
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
        // Show error message to user (validation errors still shown in chat)
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

      // Generate thumbnail + full-quality data URL early for immediate display
      let thumbnailUrl: string | undefined;
      let fullImageUrl: string | undefined;
      if (file.type.startsWith('image/')) {
        try {
          [thumbnailUrl, fullImageUrl] = await Promise.all([
            createThumbnail(file),
            readFileAsDataUrl(file),
          ]);
          setUploadedFiles(prev => prev.map(f =>
            f.id === uploadedFile.id ? { ...f, thumbnailUrl, fullImageUrl } : f
          ));
          // Generate path synchronously so it's in state before the upload resolves,
          // preventing a race condition where the user sends before the upload finishes.
          const userId = firebaseAuthService.getCurrentUser()?.id;
          if (userId) {
            const storagePath = firebaseService.generateChatFilePath(userId, file.name);
            setUploadedFiles(prev => prev.map(f =>
              f.id === uploadedFile.id ? { ...f, storagePath } : f
            ));
            compressImage(file)
              .then(blob => firebaseService.uploadChatFileToPath(blob, storagePath, 'image/jpeg'))
              .then(storageUrl => setUploadedFiles(prev => prev.map(f =>
                f.id === uploadedFile.id ? { ...f, storageUrl } : f
              )))
              .catch(() => { /* silent — data URL lightbox still works for current session */ });
          }
        } catch {
          // continue without
        }
      }

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

        // Upload raw document to Firebase Storage after processing completes.
        // Path is generated synchronously so it's in state before the upload resolves,
        // preventing a race condition where the user sends before the upload finishes.
        let docStoragePath: string | undefined;
        if (!file.type.startsWith('image/')) {
          const userId = firebaseAuthService.getCurrentUser()?.id;
          if (userId) {
            docStoragePath = firebaseService.generateChatDocPath(userId, file.name);
            firebaseService.uploadChatFileToPath(file, docStoragePath, file.type || 'application/octet-stream')
              .then(storageUrl => {
                setUploadedFiles(prev => prev.map(f =>
                  f.id === uploadedFile.id
                    ? {
                        ...f,
                        storageUrl,
                        processedDocument: f.processedDocument
                          ? { ...f.processedDocument, storageUrl }
                          : f.processedDocument,
                      }
                    : f
                ));
              })
              .catch(() => { /* silent — text extraction still works without storage URL */ });
          }
        }

        // Update with processed data
        setUploadedFiles(prev => {
          // Cache this document for the lifetime of the session
          sessionDocsRef.current.set(processedDocument.id, processedDocument);

          return prev.map(f =>
            f.id === uploadedFile.id
              ? {
                  ...f,
                  ...processedDocument,
                  processedDocument: processedDocument,
                  uploadStatus: 'completed' as const,
                  uploadProgress: 100,
                  thumbnailUrl,
                  fullImageUrl,
                  ...(docStoragePath ? { storagePath: docStoragePath } : {}),
                }
              : f
          );
        });

      } catch {
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

    // Collect image thumbnails and URLs from attached files
    const imageUrls = uploadedFiles
      .filter(f => f.uploadStatus === 'completed' && f.thumbnailUrl)
      .map(f => f.thumbnailUrl!);
    // Prefer Storage URL (persists across sessions); fall back to data URL (current session only)
    const fullImageUrls = uploadedFiles
      .filter(f => f.uploadStatus === 'completed' && (f.storageUrl ?? f.fullImageUrl))
      .map(f => (f.storageUrl ?? f.fullImageUrl)!);
    const storagePaths = uploadedFiles
      .filter(f => f.uploadStatus === 'completed' && f.storagePath)
      .map(f => f.storagePath!);

    // add user message to UI immediately so it feels responsive
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
      ...(imageUrls.length > 0 ? { imageUrls } : {}),
      ...(fullImageUrls.length > 0 ? { fullImageUrls } : {}),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');  // clear input field
    setIsLoading(true);

    // Merge current tray docs into session cache (in case they weren't cached yet)
    uploadedFiles
      .filter(f => f.uploadStatus === 'completed' && f.processedDocument)
      .forEach(f => sessionDocsRef.current.set(f.processedDocument!.id, f.processedDocument!));

    // All processed docs for this session (tray + previously uploaded)
    const processedDocs = Array.from(sessionDocsRef.current.values());

    // Clear attached files immediately so the input area feels responsive
    setUploadedFiles([]);

    try {
      // build context object - includes session id, document ids, and full processed documents
      // the chat service uses this to build the prompt for the AI
      const context: ChatContext = {
        sessionId: session.id,
        documentIds: documents.map(doc => doc.id),
        currentTopic: 'general',
        processedDocuments: processedDocs,
        ...(imageUrls.length > 0 ? { imageUrls } : {}),
        ...(fullImageUrls.length > 0 ? { fullImageUrls } : {}),
        ...(storagePaths.length > 0 ? { storagePaths } : {}),
      };

      // --- Detect document / flashcard request before streaming starts ---
      // mightBeDocument covers both academic-resource and professional-document types
      const trimmed = content.trim();
      const willBeFlashcard = chatService.mightBeFlashcard(trimmed);
      const willBeDocument = !willBeFlashcard && chatService.mightBeDocument(trimmed);
      isFlashcardStreamRef.current = willBeFlashcard;
      isDocStreamRef.current = willBeDocument;
      if (willBeFlashcard) {
        const topicMatch = trimmed.match(/flashcards?\s+(?:for|about|on)\s+(.+)/i)
          ?? trimmed.match(/(?:create|make|generate)\s+flashcards?\s+(?:for|about|on)\s+(.+)/i);
        setGeneratingFlashcardTopic(topicMatch?.[1]?.replace(/[.!?]+$/, '').trim() ?? '');
      }
      if (willBeDocument) {
        // Check if this looks like a professional document vs academic resource
        const looksProf = /\b(?:essay|research paper|lab report|thesis|term paper|mla|apa|chicago|cover letter|resume|argumentative|analytical paper|position paper)\b/i.test(trimmed);
        setGeneratingDocIsProfessional(looksProf);
        setGeneratingDocTitle(chatService.extractDocumentTitle(trimmed));
      }

      // --- Streaming animation setup ---
      const streamingId = `streaming_${Date.now()}`;
      streamBufferRef.current = '';
      revealedLenRef.current = 0;
      streamDoneRef.current = false;

      // Add empty placeholder message
      setMessages(prev => [...prev, {
        id: streamingId,
        role: 'assistant' as const,
        content: '',
        timestamp: new Date(),
        isTyping: true
      }]);

      // Typing speed: ~2 words per tick at 30ms intervals ≈ ~65 wpm visual pace.
      // Feels natural — fast enough to not bore, slow enough to read along.
      const TICK_MS = 30;
      const CHARS_PER_TICK = 3;

      const revealTick = () => {
        // Don't reveal document/flashcard content — we show the atom loader instead
        if (isDocStreamRef.current || isFlashcardStreamRef.current) {
          revealedLenRef.current = streamBufferRef.current.length;
          if (!streamDoneRef.current) streamTimerRef.current = setTimeout(revealTick, TICK_MS);
          return;
        }

        const target = streamBufferRef.current.length;
        if (revealedLenRef.current < target) {
          // Advance by CHARS_PER_TICK, then snap forward to the next word boundary
          let next = Math.min(revealedLenRef.current + CHARS_PER_TICK, target);
          if (next < target) {
            const spaceIdx = streamBufferRef.current.indexOf(' ', next);
            if (spaceIdx !== -1 && spaceIdx - next < 15) next = spaceIdx + 1;
          }
          revealedLenRef.current = next;
          const slice = streamBufferRef.current.slice(0, revealedLenRef.current);
          setMessages(prev => prev.map(m =>
            m.id === streamingId ? { ...m, content: slice } : m
          ));
        }

        // Keep ticking until we've shown everything AND the API is done
        if (!(streamDoneRef.current && revealedLenRef.current >= streamBufferRef.current.length)) {
          streamTimerRef.current = setTimeout(revealTick, TICK_MS);
        }
      };
      streamTimerRef.current = setTimeout(revealTick, TICK_MS);

      // Chunk callback — just fills the buffer (no React state updates)
      const onStreamChunk = (partialContent: string) => {
        streamBufferRef.current = partialContent;
      };

      // Fire the streaming request
      const response = await chatService.sendMessage(content.trim(), context, onStreamChunk);
      streamDoneRef.current = true;
      streamBufferRef.current = response.content;

      // Wait for reveal animation to catch up to full content
      await new Promise<void>(resolve => {
        const waitDone = () => {
          if (revealedLenRef.current >= streamBufferRef.current.length) {
            if (streamTimerRef.current) clearTimeout(streamTimerRef.current);
            resolve();
          } else {
            setTimeout(waitDone, TICK_MS);
          }
        };
        waitDone();
      });

      // Replace placeholder with final message (correct id, flashcardSet, etc.)
      setMessages(prev => prev.map(m =>
        m.id === streamingId ? { ...response, isTyping: false } : m
      ));

      // If this was the first message in a brand-new blank session, notify parent
      // so the sidebar highlight can follow the active session once it becomes real.
      if (wasEmptySession && onNewSession) {
        onNewSession(session);
      }

      // if the AI generated flashcards, show them to the user
      if (response.flashcardSet) {
        handleFlashcardsGenerated(response.flashcardSet);
      }

      // refresh session list to get updated titles
      if (isAuthenticated) {
        const updatedSessions = chatService.getSessions();
        setSessions(updatedSessions);
      }
    } catch {
      // Cancel any running animation
      if (streamTimerRef.current) clearTimeout(streamTimerRef.current);
      // if something goes wrong, show error message to user
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      // Remove any streaming placeholder and add error
      setMessages(prev => {
        const withoutStreaming = prev.filter(m => !m.isTyping);
        return [...withoutStreaming, errorMessage];
      });
    } finally {
      isDocStreamRef.current = false;
      isFlashcardStreamRef.current = false;
      setGeneratingDocTitle('');
      setGeneratingFlashcardTopic('');
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  // ── Rating handlers ──────────────────────────────────────────────────────────

  const handleRate = async (message: ChatMessage, rating: 'good' | 'bad') => {
    const current = messageRatings[message.id];

    // Tapping the active rating deselects it
    if (current === rating) {
      setMessageRatings(prev => { const n = { ...prev }; delete n[message.id]; return n; });
      await chatService.removeRating(message.id);
      return;
    }

    // Switch to new rating (overwrites previous record in Firestore via setDoc)
    setMessageRatings(prev => ({ ...prev, [message.id]: rating }));
    if (!currentSession) return;
    const msgIdx = messages.findIndex(m => m.id === message.id);
    const prevUser = messages.slice(0, msgIdx).reverse().find(m => m.role === 'user');
    await chatService.rateMessage(
      message.id,
      currentSession.id,
      rating,
      message.content,
      prevUser?.content ?? ''
    );
  };

  const openRetryDialog = (msgId: string) => {
    setRetryDialogMsgId(msgId);
    setRetryFeedback('');
  };

  const handleRetrySubmit = async () => {
    if (!retryDialogMsgId || !currentSession || isRetrying) return;
    const feedback = retryFeedback.trim() || undefined;
    const retryingId = retryDialogMsgId;
    setRetryDialogMsgId(null);
    setIsRetrying(true);
    setIsLoading(true);

    // Strip the old assistant message from the UI
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === retryingId);
      return idx >= 0 ? prev.slice(0, idx) : prev;
    });

    const streamingId = `streaming_${Date.now()}`;
    streamBufferRef.current = '';
    revealedLenRef.current = 0;
    streamDoneRef.current = false;
    isDocStreamRef.current = false;

    setMessages(prev => [...prev, {
      id: streamingId,
      role: 'assistant' as const,
      content: '',
      timestamp: new Date(),
      isTyping: true
    }]);

    const TICK_MS = 30;
    const CHARS_PER_TICK = 3;
    const revealTick = () => {
      if (!isDocStreamRef.current) {
        const target = streamBufferRef.current.length;
        if (revealedLenRef.current < target) {
          let next = Math.min(revealedLenRef.current + CHARS_PER_TICK, target);
          if (next < target) {
            const spaceIdx = streamBufferRef.current.indexOf(' ', next);
            if (spaceIdx !== -1 && spaceIdx - next < 15) next = spaceIdx + 1;
          }
          revealedLenRef.current = next;
          const slice = streamBufferRef.current.slice(0, revealedLenRef.current);
          setMessages(prev => prev.map(m => m.id === streamingId ? { ...m, content: slice } : m));
        }
      }
      if (!(streamDoneRef.current && revealedLenRef.current >= streamBufferRef.current.length)) {
        streamTimerRef.current = setTimeout(revealTick, TICK_MS);
      }
    };
    streamTimerRef.current = setTimeout(revealTick, TICK_MS);

    try {
      const onStreamChunk = (partial: string) => { streamBufferRef.current = partial; };
      const response = await chatService.retryMessage(currentSession.id, retryingId, feedback, onStreamChunk);
      streamDoneRef.current = true;
      streamBufferRef.current = response.content;

      await new Promise<void>(resolve => {
        const waitDone = () => {
          if (revealedLenRef.current >= streamBufferRef.current.length) {
            if (streamTimerRef.current) clearTimeout(streamTimerRef.current);
            resolve();
          } else setTimeout(waitDone, TICK_MS);
        };
        waitDone();
      });

      setMessages(prev => prev.map(m => m.id === streamingId ? { ...response, isTyping: false } : m));
      if (response.flashcardSet) handleFlashcardsGenerated(response.flashcardSet);
      setSessions(chatService.getSessions());
    } catch {
      if (streamTimerRef.current) clearTimeout(streamTimerRef.current);
      const errMsg: ChatMessage = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error while regenerating. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev.filter(m => !m.isTyping), errMsg]);
    } finally {
      setIsLoading(false);
      setIsRetrying(false);
      isDocStreamRef.current = false;
      isFlashcardStreamRef.current = false;
    }
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
      // Clear document cache — different session has different uploads
      sessionDocsRef.current.clear();
    } else {
      // Session was deleted, create a new blank chat
      createNewSession();
    }
  };

  // Render LaTeX math expressions using KaTeX
  const renderMath = (html: string): string => {
    // Render display math: $$...$$ or \[...\]
    html = html.replace(/\$\$([\s\S]*?)\$\$/g, (_, tex) => {
      try {
        return katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false });
      } catch { return `<div class="math-block">${tex}</div>`; }
    });
    html = html.replace(/\\\[([\s\S]*?)\\\]/g, (_, tex) => {
      try {
        return katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false });
      } catch { return `<div class="math-block">${tex}</div>`; }
    });

    // Render inline math: $...$ or \(...\)
    html = html.replace(/\\\(([\s\S]*?)\\\)/g, (_, tex) => {
      try {
        return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false });
      } catch { return `<span class="math-inline">${tex}</span>`; }
    });
    // Single $ delimiters — avoid matching $$ (already handled) or currency like $5
    html = html.replace(/(?<!\$)\$(?!\$)([^\n$]+?)\$(?!\$)/g, (_, tex) => {
      try {
        return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false });
      } catch { return `<span class="math-inline">${tex}</span>`; }
    });

    return html;
  };

  const formatMessage = (message: ChatMessage) => {
    // For assistant messages, use the robust markdown renderer
    if (message.role === 'assistant') {
      // Special handling for code blocks to keep the copy button
      let content = message.content;

      // Preserve code blocks with custom UI
      const codeBlocks: string[] = [];
      content = content.replace(/```(\w+)?\s*\n?([\s\S]*?)```/g, (_, language, code) => {
        const lang = (language && language.trim()) || 'text';
        const escapedCode = code
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');

        const block = `<div class="code-block-container">
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
        codeBlocks.push(block);
        return `\x01CBUI${codeBlocks.length - 1}\x02`;
      });

      // Render the rest with the robust markdown utility
      let rendered = renderMarkdownSafe(content);

      // Render LaTeX math expressions with KaTeX
      rendered = renderMath(rendered);

      // Restore code blocks
      codeBlocks.forEach((block, i) => {
        rendered = rendered.replace(`\x01CBUI${i}\x02`, block);
      });

      return rendered;
    }
    
    // For user messages, simple escape and basic formatting
    return message.content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>');
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

  const renderFileTypeIcon = (fileType: string, size = 20) => {
    if (fileType.startsWith('image/')) return null;
    if (fileType.includes('presentation') || fileType.includes('powerpoint'))
      return <ClipboardList size={size} />;
    return <DocumentIcon size={size} />;
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
                    className="message-content"
                  >
                    <div className={`message-role-label ${message.role === 'assistant' ? 'newton' : ''}`}>
                      {message.role === 'user'
                        ? (user?.name?.split(' ')[0] || 'You')
                        : 'Newton'}
                    </div>
                    {message.imageUrls && message.imageUrls.length > 0 && (
                      <div className="message-images">
                        {message.imageUrls.map((url, i) => (
                          <img
                            key={i}
                            src={url}
                            alt="Uploaded image"
                            className="message-thumbnail"
                            onClick={() => setLightboxUrl(message.fullImageUrls?.[i] ?? url)}
                          />
                        ))}
                      </div>
                    )}
                    {message.isTyping && isFlashcardStreamRef.current ? (
                      <FlashcardGeneratingLoader topic={generatingFlashcardTopic} />
                    ) : message.isTyping && isDocStreamRef.current ? (
                      <DocGeneratingLoader title={generatingDocTitle} isProfessional={generatingDocIsProfessional} />
                    ) : (
                      <div
                        data-message-id={message.id}
                        className={`message-text ${message.isTyping ? 'streaming' : ''}`}
                      >
                        <div
                          dangerouslySetInnerHTML={{
                            __html: formatMessage(message)
                          }}
                        />
                      </div>
                    )}

                    {message.flashcardSet && (
                      <button
                        className="flashcard-message-hint"
                        onClick={() => {
                          setCurrentFlashcardSet(message.flashcardSet!);
                          setShowFlashcardList(true);
                        }}
                      >
                        <span className="hint-text">Click to view flashcards</span>
                      </button>
                    )}
                    {message.isDocument && !message.isTyping && (
                      <button
                        className="doc-attachment-card"
                        onClick={e => { e.stopPropagation(); setDocPreviewMessage(message); }}
                      >
                        <div className="doc-attachment-icon">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/>
                            <line x1="16" y1="17" x2="8" y2="17"/>
                          </svg>
                        </div>
                        <div className="doc-attachment-info">
                          <span className="doc-attachment-name">
                            {(message.documentTitle ?? 'Document').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}{message.isProfessionalDocument ? '.pdf' : '.pdf'}
                          </span>
                          <span className="doc-attachment-meta">
                            {message.isProfessionalDocument
                              ? `${message.documentMetadata?.citationStyle ?? 'DOC'} · Click to preview`
                              : 'PDF · Click to preview'}
                          </span>
                        </div>
                      </button>
                    )}
                    <div className="message-footer">
                      <div className="message-time">
                        {message.timestamp instanceof Date
                          ? message.timestamp.toLocaleTimeString()
                          : new Date(message.timestamp).toLocaleTimeString()
                        }
                      </div>
                      {message.role === 'assistant' && !message.isTyping && (
                        <div className="message-actions">
                          <button
                            className={`msg-action-btn${messageRatings[message.id] === 'good' ? ' rated-good' : ''}`}
                            onClick={() => handleRate(message, 'good')}
                            title="Good response"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/>
                            </svg>
                          </button>
                          <button
                            className={`msg-action-btn${messageRatings[message.id] === 'bad' ? ' rated-bad' : ''}`}
                            onClick={() => handleRate(message, 'bad')}
                            title="Bad response"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/>
                            </svg>
                          </button>
                          <button
                            className="msg-action-btn retry-btn"
                            onClick={() => openRetryDialog(message.id)}
                            title="Regenerate response"
                            disabled={isLoading}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          
          {isLoading && !messages.some(m => m.isTyping) && (
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
          {uploadedFiles.filter(f => f.uploadStatus !== 'error').length > 0 && (
            <div className="attached-files">
              <div className="attached-files-header">
                <span className="attached-files-title">
                  <Paperclip size={14} style={{ marginRight: '6px' }} />
                  Attached Files
                </span>
                <button
                  className="clear-files-btn"
                  onClick={() => setUploadedFiles([])}
                  title="Remove all attached files"
                >
                  ✕
                </button>
              </div>
              <div className="attached-files-list">
                {uploadedFiles
                  .filter(f => f.uploadStatus !== 'error')
                  .map((file) => (
                    <div key={file.id} className="attached-file-item">
                      <div className="attached-file-thumbnail-wrapper">
                        {file.thumbnailUrl ? (
                          <img src={file.thumbnailUrl} alt={file.fileName} className={`attached-file-thumbnail${file.uploadStatus !== 'completed' ? ' loading' : ''}`} />
                        ) : (
                          <div className={`attached-file-icon-box${file.uploadStatus !== 'completed' ? ' loading' : ''}`}>
                            {renderFileTypeIcon(file.fileType)}
                          </div>
                        )}
                        {file.uploadStatus !== 'completed' && (
                          <div className="attached-file-spinner-overlay">
                            <div className="thumbnail-spinner"></div>
                          </div>
                        )}
                      </div>
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
              accept=".pdf,.docx,.doc,.pptx,.ppt,.jpg,.jpeg,.png,.gif,.webp,.heic,.md"
              onChange={(e) => {
                if (e.target.files) {
                  handleFiles(e.target.files);
                }
              }}
              style={{ display: 'none' }}
            />
          </div>
          
          <div className="input-hint">
            Press Enter to send, Shift+Enter for new line • Drag & drop files or click <Paperclip size={12} style={{ display: 'inline', margin: '0 2px' }} /> to attach
          </div>
        </form>
      </div>

      {/* Document Preview Panel — sibling to chat-main, forms the right column */}
      {docPreviewMessage && (
        docPreviewMessage.isProfessionalDocument ? (
          <ProfessionalDocumentPanel
            messageId={docPreviewMessage.id}
            title={docPreviewMessage.documentTitle ?? 'Document'}
            contentMarkdown={docPreviewMessage.documentContent ?? docPreviewMessage.content}
            metadata={docPreviewMessage.documentMetadata}
            onClose={() => setDocPreviewMessage(null)}
          />
        ) : (
          <DocumentPreviewPanel
            messageId={docPreviewMessage.id}
            title={docPreviewMessage.documentTitle ?? 'Document'}
            contentHtml={formatMessage({
              ...docPreviewMessage,
              content: docPreviewMessage.documentContent ?? docPreviewMessage.content,
            })}
            onClose={() => setDocPreviewMessage(null)}
          />
        )
      )}

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

      {lightboxUrl && (
        <div className="lightbox-overlay" onClick={() => setLightboxUrl(null)}>
          <button className="lightbox-close" onClick={() => setLightboxUrl(null)}>✕</button>
          <img
            src={lightboxUrl}
            alt="Full size image"
            className="lightbox-image"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {retryDialogMsgId && (
        <div className="retry-overlay" onClick={() => !isRetrying && setRetryDialogMsgId(null)}>
          <div className="retry-dialog" onClick={e => e.stopPropagation()}>
            <div className="retry-dialog-header">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
              </svg>
              <h4>Regenerate Response</h4>
            </div>
            <p className="retry-dialog-desc">How can we improve this response? <span>(optional)</span></p>
            <textarea
              className="retry-feedback-input"
              value={retryFeedback}
              onChange={e => setRetryFeedback(e.target.value)}
              placeholder="e.g. Make it simpler, add more examples, be more concise..."
              rows={3}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleRetrySubmit(); }}
            />
            <div className="retry-dialog-actions">
              <button className="retry-cancel" onClick={() => setRetryDialogMsgId(null)}>Cancel</button>
              <button className="retry-submit" onClick={handleRetrySubmit} disabled={isLoading}>
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

ChatInterface.displayName = 'ChatInterface';

export default ChatInterface;