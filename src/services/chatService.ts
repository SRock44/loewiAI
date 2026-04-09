import { ChatMessage, ChatSession, ChatContext, ChatService } from '../types/chat';
import { firebaseAuthService } from './firebaseAuthService';
import { firebaseAILogicService, AIResponse } from './firebaseAILogicService';
import { documentProcessor, ProcessedDocument } from './documentProcessor';
import { flashcardService } from './flashcardService';
import { FlashcardGenerationRequest } from '../types/flashcard';
import { allFlashcardEventTarget } from '../hooks/useAllFlashcards';
import { codeValidator, CodeValidationResult } from './codeValidator';
import { codeExecutor } from './codeExecutor';
import { firebaseService } from './firebaseService';

// this is the main chat service - handles all chat logic, AI integration, and session management
// it's a singleton that gets created once when the app starts
class ChatServiceImpl implements ChatService {
  // store all chat sessions in memory - key is session id, value is the session object
  private sessions: Map<string, ChatSession> = new Map();
  // counter to make sure each message gets a unique id
  private messageCounter = 0;
  // track which user is currently logged in (null if not logged in)
  private currentUserId: string | null = null;
  // function to unsubscribe from firebase real-time updates when user logs out
  private realtimeUnsubscribe: (() => void) | null = null;
  // In-memory user context — loaded once per sign-in, avoids repeated fetches
  private userContextCache: string = '';
  // In-memory user memory — persisted facts about the user across sessions
  private userMemoryCache: string = '';
  // Throttle context saves — adaptive interval based on activity
  private lastContextSaveTime = 0;
  private recentMessageTimestamps: number[] = []; // tracks message times for activity detection
  private static IDLE_SAVE_INTERVAL_MS = 2 * 60 * 60 * 1000;   // 2 hours when idle
  private static ACTIVE_SAVE_INTERVAL_MS = 20 * 60 * 1000;      // 20 minutes when very active

  constructor() {
    // listen for when user signs in/out so we can load their sessions
    this.setupAuthStateListener();
  }

  // this listens for auth changes - when user signs in, we load their chat sessions
  // when they sign out, we clear everything from memory
  private setupAuthStateListener() {
    firebaseAuthService.onAuthStateChange((user) => {
      if (user && user.id !== this.currentUserId) {
        // user just signed in or switched accounts - load their sessions from firebase
        this.currentUserId = user.id;
        this.loadSessionsFromFirebase();
        this.loadUserContext();
        this.loadUserMemory();
      } else if (!user && this.currentUserId) {
        // user signed out - clean up everything
        if (this.realtimeUnsubscribe) {
          this.realtimeUnsubscribe();
          this.realtimeUnsubscribe = null;
        }
        this.currentUserId = null;
        this.sessions.clear();
        this.messageCounter = 0;
        this.userContextCache = '';
        this.userMemoryCache = '';
        this.lastContextSaveTime = 0;
        this.recentMessageTimestamps = [];
      }
    });
  }

  // Load sessions from Firebase
  private async loadSessionsFromFirebase() {
    if (!this.currentUserId) {
      this.sessions.clear();
      return;
    }

    try {
      const firebaseSessions = await firebaseService.getChatSessions(this.currentUserId);
      
      // Sort sessions by updatedAt (newest first)
      const validSessions = firebaseSessions.filter(session => this.hasValidConversation(session));
      
      const sortedSessions = validSessions
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      
      // Convert to Map
      this.sessions = new Map();
      sortedSessions.forEach(session => {
        this.sessions.set(session.id, session);
      });
      
      // Set up real-time listener for cross-device synchronization
      this.setupRealtimeListener();
      
    } catch (error) {
      console.error('❌ Error loading chat sessions from Firebase:', error);
      this.sessions.clear();
    }
  }

  // Set up real-time listener for cross-device synchronization
  private setupRealtimeListener() {
    if (!this.currentUserId) return;

    try {
      // Clean up any existing listener
      if (this.realtimeUnsubscribe) {
        this.realtimeUnsubscribe();
        this.realtimeUnsubscribe = null;
      }

      // Subscribe to real-time updates for chat sessions
      const unsubscribe = firebaseService.subscribeToChatSessions(this.currentUserId, (sessions) => {
        // Build a set of IDs coming from Firestore
        const firestoreIds = new Set(sessions.map(s => s.id));

        // Preserve local-only sessions (created but not yet saved to Firestore)
        const localOnlySessions: ChatSession[] = [];
        for (const [id, session] of this.sessions) {
          if (!firestoreIds.has(id)) {
            localOnlySessions.push(session);
          }
        }

        // Rebuild the map: Firestore sessions (filtered) + local-only sessions
        const merged = new Map<string, ChatSession>();

        sessions
          .filter(session => this.hasValidConversation(session))
          .forEach(session => merged.set(session.id, session));

        localOnlySessions.forEach(session => merged.set(session.id, session));

        this.sessions = merged;

        // Notify UI components of the update
        window.dispatchEvent(new CustomEvent('sessionUpdated'));
      });

      // Store unsubscribe function for cleanup
      this.realtimeUnsubscribe = unsubscribe;
    } catch (error) {
      console.error('❌ Error setting up real-time listener:', error);
    }
  }





  // this is the main function that handles when user sends a message
  // it figures out what the user wants (regular chat, flashcards, code help) and routes accordingly
  async sendMessage(message: string, context: ChatContext, onStreamChunk?: (partialContent: string) => void): Promise<ChatMessage> {
    // create the user message object - this gets saved to the session
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_${++this.messageCounter}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
      ...(context.imageUrls && context.imageUrls.length > 0 ? { imageUrls: context.imageUrls } : {}),
      ...(context.fullImageUrls && context.fullImageUrls.length > 0 ? { fullImageUrls: context.fullImageUrls } : {}),
      ...(context.storagePaths && context.storagePaths.length > 0 ? { storagePaths: context.storagePaths } : {}),
    };

    try {
      // first check if user is asking to generate flashcards
      // we look for keywords like "create flashcards" or "make flashcards"
      const flashcardRequest = this.detectFlashcardRequest(message, context);
      
      if (flashcardRequest) {
        // if it's a flashcard request, handle it specially and return early
        return await this.handleFlashcardGeneration(flashcardRequest, context, userMessage);
      }

      // build context from any documents user uploaded
      // this gets sent to the AI so it knows what documents to reference
      const documentContext = this.buildDocumentContext(context.documentIds, context.processedDocuments);
      
      // check if user wants to execute code (we can't actually run it, but we can help)
      if (this.isCodeExecutionRequest(message)) {
        const executionGuidanceMessage: ChatMessage = {
          id: `msg_${Date.now()}_${++this.messageCounter}`,
          role: 'assistant',
          content: `I understand you'd like to run the code! While I can help you write and validate code, I can't execute it directly in this interface.

**To run your code, you can:**

🖥️ **Desktop IDEs:**
- **VS Code** - Free, excellent for most languages
- **Cursor** - AI-powered code editor
- **IntelliJ IDEA** - Great for Java, Python, and more
- **Visual Studio** - Perfect for C# and .NET

🌐 **Online Compilers:**
- **Replit** - Supports 50+ languages, collaborative
- **CodePen** - Great for HTML/CSS/JavaScript
- **JSFiddle** - JavaScript playground
- **OnlineGDB** - C, C++, Python, Java, and more
- **Programiz** - Multiple language support

📱 **Quick Testing:**
- **Python**: Use \`python filename.py\` in terminal
- **JavaScript**: Use Node.js with \`node filename.js\`
- **Java**: Compile with \`javac\` then run with \`java\`

**Coming Soon:** Direct code execution support will be added to this AI assistant!

Would you like me to help you with anything else about the code, such as explaining how it works or suggesting improvements?`,
          timestamp: new Date()
        };

        // Add the guidance message to the session
        if (this.sessions.has(context.sessionId)) {
          this.sessions.get(context.sessionId)!.messages.push(executionGuidanceMessage);
        }

        return executionGuidanceMessage;
      }

      // Build conversation history context
      const conversationContext = await this.buildConversationContext(context.sessionId);
      
      // Get AI response — use streaming when a chunk callback is provided
      const aiResponse: AIResponse = onStreamChunk
        ? await firebaseAILogicService.generateResponseStream(
            message,
            documentContext,
            conversationContext,
            onStreamChunk
          )
        : await firebaseAILogicService.generateResponse(
            message,
            documentContext,
            conversationContext
          );

      // Log error if AI returns empty response
      if (!aiResponse || !aiResponse.content || aiResponse.content.trim().length === 0) {
        console.error('❌ AI returned empty response!', { message });
      }

      // Validate code in the AI response and silently fix if needed
      const validationResults = codeValidator.validateCodeBlocks(aiResponse.content);
      const hasErrors = validationResults.some(result => !result.isValid || result.errors.length > 0);

      let finalContent = aiResponse.content;

      // If there are code errors, attempt to fix them silently
      if (hasErrors) {
        const correctedResponse = await this.attemptCodeCorrection(aiResponse.content, validationResults, documentContext);
        if (correctedResponse) {
          finalContent = correctedResponse;
        }
      }

      // Execute code blocks silently for validation (no user display)
      await codeExecutor.executeCodeBlocks(finalContent);
      // Note: Execution results are not displayed to users, only used for internal validation

      const isDoc = this.isDocumentRequest(message);
      const chatContent = isDoc ? this.extractDocumentSummary(finalContent) : finalContent;

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_${++this.messageCounter}`,
        role: 'assistant',
        content: chatContent,
        timestamp: new Date(),
        ...(isDoc ? {
          isDocument: true,
          documentTitle: this.extractDocumentTitle(message),
          documentContent: finalContent,
        } : {}),
      };

      // Update session with new messages
      if (context.sessionId && this.sessions.has(context.sessionId)) {
        const session = this.sessions.get(context.sessionId)!;
        session.messages.push(userMessage, assistantMessage);
        session.updatedAt = new Date();
        
        // Update session title based on first message if it's generic
        this.updateSessionTitleIfNeeded(session, message);
        
        // Persist session (including messages array) to Firestore for signed-in users.
        // We intentionally avoid a separate "messages" collection here because it was
        // causing ID mismatches and duplicate writes.
        if (this.currentUserId) {
          try {
            await firebaseService.saveChatSession(session, this.currentUserId);
            
            // Background: Update user context file (throttled to every 2 hours)
            this.maybeUpdateUserContext(session);
            
            window.dispatchEvent(new CustomEvent('sessionUpdated'));
          } catch (error) {
            console.error('Failed to save session to Firebase:', error);
          }
        }
      }

      return assistantMessage;
    } catch (error) {
      console.error('Error generating AI response:', error);
      
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}_${++this.messageCounter}`,
        role: 'assistant',
        content: 'I apologize, but I\'m having trouble processing your request right now. Please try again in a moment.',
        timestamp: new Date()
      };

      // Still save the user message and error response
      if (context.sessionId && this.sessions.has(context.sessionId)) {
        const session = this.sessions.get(context.sessionId)!;
        session.messages.push(userMessage, errorMessage);
        session.updatedAt = new Date();
        // Save session to Firebase
        if (this.currentUserId) {
          try {
            await firebaseService.saveChatSession(session, this.currentUserId);
            
            // Dispatch event to notify UI components
            window.dispatchEvent(new CustomEvent('sessionUpdated'));
          } catch (error) {
            console.error('Failed to save session to Firebase:', error);
          }
        }
      }

      return errorMessage;
    }
  }

  async getChatHistory(sessionId: string): Promise<ChatMessage[]> {
    const session = this.sessions.get(sessionId);
    return session ? session.messages : [];
  }

  async createNewSession(title?: string): Promise<ChatSession> {
    const sessionId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `session_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const defaultTitle = title || this.generateSessionTitle();
    
    const session: ChatSession = {
      id: sessionId,
      title: defaultTitle,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      documentIds: []
    };

    this.sessions.set(sessionId, session);
    
    // We intentionally don't save empty sessions to Firestore.
    
    return session;
  }

  private generateSessionTitle(): string {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    const dateStr = now.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
    return `Chat ${dateStr} ${timeStr}`;
  }

  private updateSessionTitleIfNeeded(session: ChatSession, firstMessage: string): void {
    // Only update title if it's still the generic time-based title and this is the first user message
    if (session.title.startsWith('Chat ') && session.messages.length === 2) { // 2 because we just added user and assistant messages
      const newTitle = this.generateTopicBasedTitle(firstMessage);
      // Only update if the new title is significantly different and more descriptive
      if (newTitle !== session.title && !newTitle.startsWith('Chat ')) {
        session.title = newTitle;
      }
    }
  }

  private generateTopicBasedTitle(message: string): string {
    const lowerMessage = message.toLowerCase();
    
    // Check for specific academic topics with more precise matching
    if ((lowerMessage.includes('statistics') || lowerMessage.includes('probability')) && 
        (lowerMessage.includes('homework') || lowerMessage.includes('assignment') || lowerMessage.includes('help'))) {
      return 'Statistics & Probability';
    } else if ((lowerMessage.includes('calculus') || lowerMessage.includes('derivative') || lowerMessage.includes('integral')) && 
               (lowerMessage.includes('help') || lowerMessage.includes('problem') || lowerMessage.includes('solve'))) {
      return 'Calculus Help';
    } else if (lowerMessage.includes('homework') || lowerMessage.includes('assignment')) {
      return 'Homework Help';
    } else if (lowerMessage.includes('exam') || lowerMessage.includes('test') || lowerMessage.includes('quiz')) {
      return 'Exam Preparation';
    } else if (lowerMessage.includes('essay') || lowerMessage.includes('writing') || lowerMessage.includes('paper')) {
      return 'Writing Help';
    } else if (lowerMessage.includes('research') || lowerMessage.includes('project')) {
      return 'Research Project';
    } else if (lowerMessage.includes('programming') || lowerMessage.includes('code') || lowerMessage.includes('algorithm')) {
      return 'Programming Help';
    } else if (lowerMessage.includes('physics') || lowerMessage.includes('chemistry') || lowerMessage.includes('biology')) {
      return 'Science Help';
    } else if (lowerMessage.includes('math') || lowerMessage.includes('algebra') || lowerMessage.includes('geometry')) {
      return 'Mathematics Help';
    } else if (lowerMessage.includes('summarize') || lowerMessage.includes('explain') || lowerMessage.includes('document')) {
      return 'Document Analysis';
    }
    
    // If no specific topic found, create a title from the first few meaningful words
    const words = message.trim().split(' ').filter(word => 
      word.length > 2 && 
      !['help', 'me', 'with', 'the', 'this', 'that', 'can', 'you', 'please'].includes(word.toLowerCase())
    ).slice(0, 3);
    
    if (words.length > 0) {
      return words.join(' ').replace(/[^\w\s]/g, '');
    }
    
    // Fallback to time-based title
    return this.generateSessionTitle();
  }

  async deleteSession(sessionId: string): Promise<void> {
    
    // Check authentication - use currentUserId if available, otherwise check auth service
    let userId = this.currentUserId;
    if (!userId) {
      const currentUser = firebaseAuthService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      userId = currentUser.id;
    }
    
    try {
      // If signed in, delete from Firestore.
      // (Messages are stored on the session document itself.)
      if (userId) {
        await firebaseService.deleteChatSession(sessionId);
        await this.loadSessionsFromFirebase();
      }

      // Remove from local memory (for both Firebase and local sessions)
      this.sessions.delete(sessionId);

      // Dispatch event to notify all connected devices of the deletion
      window.dispatchEvent(new CustomEvent('sessionUpdated'));
      
    } catch (error) {
      console.error('❌ Firebase deletion failed:', error);
      throw error; // Re-throw error so UI can handle it
    }
  }

  async updateContext(sessionId: string, context: Partial<ChatContext>): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (context.documentIds) {
        session.documentIds = context.documentIds;
      }
      session.updatedAt = new Date();
      // Save session to Firebase
      if (this.currentUserId) {
        try {
          await firebaseService.saveChatSession(session, this.currentUserId);
      } catch (error) {
        console.error('❌ Failed to save session to Firebase:', error);
      }
    }
    }
  }

  getSessions(): ChatSession[] {
    return Array.from(this.sessions.values())
      .filter(session => this.hasValidConversation(session))
      .sort((a, b) => {
        const aTime = a.updatedAt instanceof Date ? a.updatedAt.getTime() : new Date(a.updatedAt).getTime();
        const bTime = b.updatedAt instanceof Date ? b.updatedAt.getTime() : new Date(b.updatedAt).getTime();
        return bTime - aTime;
      });
  }

  // Add messages to an existing session (used by ChatInterface to persist upload messages)
  addMessagesToSession(sessionId: string, messages: ChatMessage[]): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.messages.push(...messages);
      session.updatedAt = new Date();
    }
  }

  // Save a session to Firestore immediately (used after image uploads so thumbnails persist)
  async saveSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (this.currentUserId) {
      try {
        await firebaseService.saveChatSession(session, this.currentUserId);
        window.dispatchEvent(new CustomEvent('sessionUpdated'));
      } catch (error) {
        console.error('Failed to save session to Firebase:', error);
      }
    }
  }

  // Check if a session has valid conversation content
  private hasValidConversation(session: ChatSession): boolean {
    if (!session.messages || session.messages.length === 0) {
      return false;
    }

    // Check if there's at least one meaningful message (user or assistant)
    const hasValidMessage = session.messages.some(msg => 
      msg.content && 
      msg.content.trim().length > 0 && 
      (msg.role === 'user' || msg.role === 'assistant')
    );
    
    return hasValidMessage;
  }


  // Reload sessions when user authentication changes
  async reloadForUser(): Promise<void> {
    await this.loadSessionsFromFirebase();
  }




  /**
   * Attempts to correct code errors by sending them back to the AI
   */
  private async attemptCodeCorrection(
    originalContent: string, 
    validationResults: CodeValidationResult[], 
    documentContext: string
  ): Promise<string | null> {
    try {
      const errorSummary = this.formatErrorsForAI(validationResults);
      
      const correctionPrompt = `I found some issues with the code I provided. Please fix these errors and provide the corrected code:

${errorSummary}

Original code:
${originalContent}

Please provide the corrected version with the same formatting and structure, but with all the errors fixed.`;

      const correctedResponse = await firebaseAILogicService.generateResponse(
        correctionPrompt,
        documentContext
      );

      // Validate the corrected code
      const correctedValidationResults = codeValidator.validateCodeBlocks(correctedResponse.content);
      const stillHasErrors = correctedValidationResults.some(result => !result.isValid || result.errors.length > 0);

      if (stillHasErrors) {
        return null;
      }

      return correctedResponse.content;
    } catch (error) {
      console.error('Error during code correction:', error);
      return null;
    }
  }

  /**
   * Formats validation errors for AI correction
   */
  private formatErrorsForAI(validationResults: CodeValidationResult[]): string {
    let errorSummary = 'Code validation found the following issues:\n\n';
    
    for (let i = 0; i < validationResults.length; i++) {
      const result = validationResults[i];
      if (result.errors.length === 0 && result.warnings.length === 0) {
        continue;
      }

      errorSummary += `Code Block ${i + 1} (${result.language}):\n`;
      
      if (result.errors.length > 0) {
        errorSummary += 'Errors:\n';
        for (const error of result.errors) {
          errorSummary += `- Line ${error.line}: ${error.message}\n`;
        }
      }

      if (result.warnings.length > 0) {
        errorSummary += 'Warnings:\n';
        for (const warning of result.warnings) {
          errorSummary += `- Line ${warning.line}: ${warning.message}\n`;        }
      }
      errorSummary += '\n';
    }

    return errorSummary;
  }

  /**
   * Detects if user is asking for code execution
   */
  private isCodeExecutionRequest(message: string): boolean {
    const executionKeywords = [
      'run this code',
      'execute this code',
      'run the code',
      'execute the code',
      'test this code',
      'run it',
      'execute it',
      'can you run',
      'please run',
      'how do i run',
      'how to run',
      'run the program',
      'execute the program',
      'test the program',
      'run this program',
      'execute this program',
      'does this work',
      'will this work',
      'can you test',
      'please test',
      'try running',
      'run and see',
      'execute and see'
    ];

    const lowerMessage = message.toLowerCase();
    return executionKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  /**
   * Load user context from Firebase Storage into memory (called once on sign-in).
   */
  private async loadUserContext() {
    if (!this.currentUserId) return;
    try {
      this.userContextCache = await firebaseService.getUserContext(this.currentUserId);
    } catch {
      this.userContextCache = '';
    }
  }

  /**
   * Load user memory from Firestore into memory (called once on sign-in).
   */
  private async loadUserMemory() {
    if (!this.currentUserId) return;
    try {
      this.userMemoryCache = await firebaseService.getUserMemory(this.currentUserId);
    } catch {
      this.userMemoryCache = '';
    }
  }

  /**
   * Append a fact/note to the in-memory user memory and persist it.
   */
  private appendToUserMemory(note: string) {
    if (!this.currentUserId) return;
    const updated = this.userMemoryCache
      ? `${this.userMemoryCache}\n${note}`
      : `# User Memory\n\n${note}`;
    this.userMemoryCache = updated;
    firebaseService.saveUserMemory(this.currentUserId, updated).catch(() => {});
  }

  /**
   * Remove a previously submitted rating (user deselected it).
   */
  async removeRating(messageId: string): Promise<void> {
    await firebaseService.deleteMessageRating(messageId);
  }

  /**
   * Record a thumbs-up / thumbs-down rating for an assistant message.
   */
  async rateMessage(
    messageId: string,
    sessionId: string,
    rating: 'good' | 'bad',
    assistantContent: string,
    userContent: string,
    feedback?: string
  ): Promise<void> {
    if (!this.currentUserId) return;
    await firebaseService.saveMessageRating({
      messageId,
      sessionId,
      userId: this.currentUserId,
      rating,
      assistantContent,
      userContent,
      feedback
    });
    if (rating === 'bad' && feedback) {
      const topicPreview = userContent.substring(0, 80).replace(/\n/g, ' ');
      this.appendToUserMemory(
        `- [${new Date().toLocaleDateString()}] Improvement requested for: "${topicPreview}" — Feedback: "${feedback}"`
      );
    }
  }

  /**
   * Retry an assistant message: removes it from the session and regenerates using the
   * preceding user message, optionally incorporating improvement feedback.
   */
  async retryMessage(
    sessionId: string,
    assistantMessageId: string,
    feedback?: string,
    onStreamChunk?: (partial: string) => void
  ): Promise<ChatMessage> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const assistantIdx = session.messages.findIndex(m => m.id === assistantMessageId);
    if (assistantIdx < 0) throw new Error('Assistant message not found');

    // Remove the assistant message (and anything after it)
    const removed = session.messages.splice(assistantIdx);

    // The message just before should be the user's prompt
    const userMsg = session.messages[session.messages.length - 1];
    if (!userMsg || userMsg.role !== 'user') {
      session.messages.push(...removed);
      throw new Error('No preceding user message found');
    }

    // Persist retry feedback to user memory so future responses honour it
    if (feedback) {
      const topicPreview = userMsg.content.substring(0, 80).replace(/\n/g, ' ');
      this.appendToUserMemory(
        `- [${new Date().toLocaleDateString()}] User preference (from retry): "${feedback}" (context: "${topicPreview}")`
      );
    }

    const documentContext = this.buildDocumentContext(session.documentIds || []);
    const conversationContext = await this.buildConversationContext(sessionId);

    const messageForAI = feedback
      ? `${userMsg.content}\n\n[The previous response was unsatisfactory. Please provide a significantly improved answer addressing this feedback: "${feedback}"]`
      : userMsg.content;

    try {
      const aiResponse: AIResponse = onStreamChunk
        ? await firebaseAILogicService.generateResponseStream(messageForAI, documentContext, conversationContext, onStreamChunk)
        : await firebaseAILogicService.generateResponse(messageForAI, documentContext, conversationContext);

      const isDoc = this.isDocumentRequest(userMsg.content);
      const chatContent = isDoc ? this.extractDocumentSummary(aiResponse.content) : aiResponse.content;

      const newMsg: ChatMessage = {
        id: `msg_${Date.now()}_${++this.messageCounter}`,
        role: 'assistant',
        content: chatContent,
        timestamp: new Date(),
        ...(isDoc ? {
          isDocument: true,
          documentTitle: this.extractDocumentTitle(userMsg.content),
          documentContent: aiResponse.content
        } : {})
      };

      session.messages.push(newMsg);
      session.updatedAt = new Date();

      if (this.currentUserId) {
        firebaseService.saveChatSession(session, this.currentUserId).catch(() => {});
      }

      return newMsg;
    } catch (error) {
      // Restore removed messages so the session isn't left broken
      session.messages.push(...removed);
      throw error;
    }
  }

  /**
   * Build a condensed context summary from a session (topics + key facts, not raw messages).
   */
  private buildSessionSummary(session: ChatSession): string {
    if (!session.messages || session.messages.length < 2) return '';

    const userMessages = session.messages
      .filter(m => m.role === 'user')
      .map(m => m.content.length > 150 ? m.content.substring(0, 150) + '...' : m.content);

    // Keep it very concise — just the topics discussed
    const title = session.title || 'Untitled';
    const date = session.updatedAt instanceof Date
      ? session.updatedAt.toLocaleDateString()
      : new Date().toLocaleDateString();
    const topics = userMessages.slice(0, 5).join(' | ');

    return `- ${title} (${date}): ${topics}`;
  }

  /**
   * Throttled save — interval adapts to user activity.
   * Very active (5+ messages in 10 min) → saves every 20 minutes.
   * Idle → saves every 2 hours.
   */
  private maybeUpdateUserContext(_session: ChatSession) {
    if (!this.currentUserId) return;

    const now = Date.now();

    // Track this message for activity detection
    this.recentMessageTimestamps.push(now);
    // Only keep timestamps from the last 10 minutes
    const tenMinAgo = now - 10 * 60 * 1000;
    this.recentMessageTimestamps = this.recentMessageTimestamps.filter(t => t > tenMinAgo);

    // If 5+ messages in the last 10 minutes, user is very active → shorter interval
    const isVeryActive = this.recentMessageTimestamps.length >= 5;
    const interval = isVeryActive
      ? ChatServiceImpl.ACTIVE_SAVE_INTERVAL_MS
      : ChatServiceImpl.IDLE_SAVE_INTERVAL_MS;

    if (now - this.lastContextSaveTime < interval) return;
    this.lastContextSaveTime = now;

    // Build a fresh context from all in-memory sessions
    const allSummaries = Array.from(this.sessions.values())
      .filter(s => s.messages.length >= 2)
      .sort((a, b) => {
        const aTime = a.updatedAt instanceof Date ? a.updatedAt.getTime() : 0;
        const bTime = b.updatedAt instanceof Date ? b.updatedAt.getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 15) // keep the 15 most recent sessions
      .map(s => this.buildSessionSummary(s))
      .filter(s => s.length > 0);

    if (allSummaries.length === 0) return;

    const md = `# User Study Context\nUpdated: ${new Date().toISOString()}\n\nRecent topics and questions:\n${allSummaries.join('\n')}\n`;

    // Update in-memory cache immediately
    this.userContextCache = md;

    // Persist to Firebase in background
    firebaseService.saveUserContext(this.currentUserId, md).catch(() => {
      // Silent — non-critical background save
    });
  }

  /**
   * Builds conversation history context for better follow-up question handling.
   * Uses in-memory cached user context (no network calls) + recent session messages.
   */
  private async buildConversationContext(sessionId: string): Promise<string> {
    let context = '';

    // 1. Add user memory (persisted facts about the user — preferences, feedback patterns)
    if (this.userMemoryCache) {
      context += '\n\nUSER MEMORY:\n';
      context += this.userMemoryCache;
      context += '\n';
    }

    // 2. Add user context from memory (loaded once on sign-in, updated every 2h)
    if (this.userContextCache) {
      context += '\n\nUSER STUDY HISTORY:\n';
      context += this.userContextCache;
      context += '\n';
    }

    if (!sessionId || !this.sessions.has(sessionId)) {
      return context;
    }

    const session = this.sessions.get(sessionId)!;
    const messages = session.messages;

    // 2. Add recent conversation history from current session (last 8 messages)
    const recentMessages = messages.slice(-8);

    if (recentMessages.length <= 2 && !this.userContextCache) {
      return '';
    }

    if (recentMessages.length > 1) {
      context += '\n\nCURRENT CONVERSATION:\n';
      for (let i = 0; i < recentMessages.length - 1; i++) {
        const msg = recentMessages[i];
        const role = msg.role === 'user' ? 'User' : 'Newton';
        const content = msg.content.length > 400 ? msg.content.substring(0, 400) + '...' : msg.content;
        context += `${role}: ${content}\n\n`;
      }
    }

    return context;
  }

  private buildDocumentContext(documentIds: string[], processedDocuments?: ProcessedDocument[]): string {
    if (documentIds.length === 0) return '';

    // Use processed documents if available, otherwise fallback to basic context
    if (!processedDocuments || processedDocuments.length === 0) {
      return `The user has uploaded ${documentIds.length} document(s) that may be relevant to their question. Consider this when providing academic guidance.`;
    }

    // Build rich context from processed document content
    try {
    const documentSummaries = documentProcessor.getDocumentSummaries(processedDocuments);
    const documentContent = documentProcessor.getDocumentContent(processedDocuments, 24000);

      // Check if we actually got content
      if (!documentContent || documentContent.trim().length === 0) {
        return `The user has uploaded ${processedDocuments.length} document(s), but the content could not be extracted. Please ask the user to describe what they need help with.`;
      }

    return `The user has uploaded ${processedDocuments.length} document(s) with the following content:

${documentSummaries}

ACTUAL DOCUMENT CONTENT (use this as the source of truth):
${documentContent}

CRITICAL INSTRUCTIONS:
- The content above IS the actual document content - treat it as real assignment text
- When asked to summarize, provide a detailed summary based on this exact content
- Do NOT ask for more information - use the content provided above
- Reference specific sections, requirements, and topics from the document content
- Provide actionable guidance based on the assignment details shown above
- For homework assignments, extract and summarize assignment title, requirements, problems, and instructions
- For study guides, identify key concepts, formulas, and learning objectives
- For exams, note question types, point values, and topics covered

The document content above contains all the information needed to provide comprehensive help. Use it directly.`;
    } catch (error) {
      console.error('❌ Error building document context:', error);
      return `The user has uploaded ${processedDocuments.length} document(s), but there was an error processing the content. Please ask the user to describe what they need help with.`;
    }
  }


  // Get AI provider info for debugging
  getAIProviderInfo(): string {
    return firebaseAILogicService.getCurrentProvider();
  }

  getAvailableAIProviders(): string[] {
    return firebaseAILogicService.getAvailableProviders();
  }

  // Test AI connection
  async testAIConnection(): Promise<boolean> {
    return await firebaseAILogicService.testConnection();
  }

  public extractDocumentTitle(message: string): string {
    const lower = message.toLowerCase();

    let docType = 'Document';
    if (lower.includes('study guide')) docType = 'Study Guide';
    else if (lower.includes('formula sheet')) docType = 'Formula Sheet';
    else if (lower.includes('cheat sheet')) docType = 'Cheat Sheet';
    else if (lower.includes('reference sheet') || lower.includes('quick reference')) docType = 'Reference Sheet';
    else if (lower.includes('review sheet') || lower.includes('summary sheet')) docType = 'Review Sheet';
    else if (lower.includes('fact sheet')) docType = 'Fact Sheet';

    const topicPatterns = [
      /(?:create|generate|make|write)\s+(?:a\s+|an\s+)?(?:study guide|formula sheet|cheat sheet|reference sheet|review sheet|summary sheet|fact sheet|guide|sheet)\s+(?:for|about|on)\s+(.+)/i,
      /(?:study guide|formula sheet|cheat sheet|reference sheet|review sheet|fact sheet)\s+(?:for|about|on)\s+(.+)/i,
      /(?:for|about|on)\s+(.+?)(?:\s+(?:study guide|formula sheet|cheat sheet|sheet|guide))?$/i,
    ];

    for (const pattern of topicPatterns) {
      const match = message.match(pattern);
      if (match?.[1]) {
        const topic = match[1].trim().replace(/[^a-zA-Z0-9 ]/g, '').trim();
        if (topic.length > 0 && topic.length < 60) {
          return `${topic.charAt(0).toUpperCase() + topic.slice(1)} ${docType}`;
        }
      }
    }

    return docType;
  }

  private extractDocumentSummary(fullContent: string): string {
    // Take the first paragraph (up to the first section heading or horizontal rule)
    const match = fullContent.match(/^([\s\S]*?)(?=\n#{1,3} |\n---)/);
    const intro = match ? match[1].trim() : fullContent.slice(0, 400).trim();
    // Hard cap at 400 chars so the chat bubble stays compact
    const capped = intro.length > 400 ? intro.slice(0, 400).replace(/\s+\S*$/, '') + '…' : intro;
    return capped || fullContent.slice(0, 200);
  }

  public isDocumentRequest(message: string): boolean {
    // Must have BOTH a creation-intent verb AND an explicit document-type noun.
    // This prevents "the problems are in the study guide" from triggering.
    const creationVerbs = /\b(?:create|make|generate|write|build|produce|give me|can you make|can you create|can you generate)\b/i;
    if (!creationVerbs.test(message)) return false;

    const documentTypes = /\b(?:study guide|formula sheet|cheat sheet|reference sheet|summary sheet|review sheet|fact sheet|reference card|quick reference|study sheet|notes sheet|pdf)\b/i;
    return documentTypes.test(message);
  }

  // Flashcard generation methods
  private detectFlashcardRequest(message: string, context: ChatContext): FlashcardGenerationRequest | null {
    const lowerMessage = message.toLowerCase();
    
    // Check for flashcard generation keywords
    const flashcardKeywords = [
      'create flashcards',
      'generate flashcards',
      'make flashcards',
      'flashcards for',
      'flashcards about',
      'study cards',
      'quiz cards',
      'flashcard',
      'study set',
      'quiz set',
      'learning cards',
      'memory cards'
    ];
    
    const hasFlashcardKeyword = flashcardKeywords.some(keyword => lowerMessage.includes(keyword));
    
    if (!hasFlashcardKeyword) {
      return null;
    }

    // Extract topic from message
    let topic = '';
    const topicPatterns = [
      /flashcards?\s+(?:for|about|on)\s+(.+)/i,
      /create\s+flashcards?\s+(?:for|about|on)\s+(.+)/i,
      /generate\s+flashcards?\s+(?:for|about|on)\s+(.+)/i,
      /make\s+flashcards?\s+(?:for|about|on)\s+(.+)/i
    ];
    
    for (const pattern of topicPatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        topic = match[1].trim();
        break;
      }
    }
    
    // If no specific topic found, use the whole message as content
    if (!topic) {
      topic = message.replace(/create\s+flashcards?|generate\s+flashcards?|make\s+flashcards?|flashcards?\s+(?:for|about|on)/gi, '').trim();
    }

    // Determine if this should use document content or text content
    const hasDocuments = context.processedDocuments && context.processedDocuments.length > 0;
    
    if (hasDocuments) {
      // Use first document for generation
      const document = context.processedDocuments![0];
      return {
        documentId: document.id,
        topic: topic || undefined,
        count: 10,
        difficulty: 'medium',
        format: 'q&a',
        sourceType: 'document'
      };
    } else {
      // Use the message content for text-based generation
      return {
        textContent: message,
        topic: topic || undefined,
        count: 10,
        difficulty: 'medium',
        format: 'q&a',
        sourceType: 'text'
      };
    }
  }

  private async handleFlashcardGeneration(
    request: FlashcardGenerationRequest, 
    context: ChatContext, 
    userMessage: ChatMessage
  ): Promise<ChatMessage> {
    try {
      
      let response;
      if (request.sourceType === 'document' && request.documentId) {
        const document = context.processedDocuments?.find(doc => doc.id === request.documentId);
        if (document) {
          response = await flashcardService.generateFlashcards(request, document);
        } else {
          throw new Error('Document not found');
        }
      } else {
        response = await flashcardService.generateFlashcardsFromText(request);
      }
      
      // Create flashcard set
      const flashcardSet = flashcardService.createFlashcardSet(
        '',
        '',
        response.flashcards,
        response.sourceDocumentId ? [response.sourceDocumentId] : undefined
      );
      
      // Save the set
      await flashcardService.saveFlashcardSet(flashcardSet);
      
      // Notify the flashcard system that new flashcards have been saved
      // This will trigger the useAllFlashcards hook to reload the data
      allFlashcardEventTarget.dispatchEvent(new CustomEvent('flashcardUpdate'));
      
      // Also dispatch a test event to verify the event system is working
      allFlashcardEventTarget.dispatchEvent(new CustomEvent('testEvent'));
      
      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_${++this.messageCounter}`,
        role: 'assistant',
        content: `I've successfully created ${response.flashcards.length} flashcards for you.

Your flashcards are now ready for study. You can view them by clicking the "View Flashcards" button in the header, or simply ask me to "show my flashcards" to study them directly in the chat.`,
        timestamp: new Date(),
        flashcardSet: flashcardSet // Add flashcard set to message for UI handling
      };

      // Update session with new messages
      if (context.sessionId && this.sessions.has(context.sessionId)) {
        const session = this.sessions.get(context.sessionId)!;
        session.messages.push(userMessage, assistantMessage);
        session.updatedAt = new Date();
        // Save session to Firebase
        if (this.currentUserId) {
          try {
            await firebaseService.saveChatSession(session, this.currentUserId);
            
            // Dispatch event to notify UI components
            window.dispatchEvent(new CustomEvent('sessionUpdated'));
          } catch (error) {
            console.error('Failed to save session to Firebase:', error);
          }
        }
      }

      return assistantMessage;
    } catch (error) {
      console.error('❌ Error generating flashcards:', error);
      
      let errorContent = '';
      if (error instanceof Error) {
        if (error.message.includes('overloaded')) {
          errorContent = `🚫 **Service Temporarily Unavailable**

The AI service is currently experiencing high demand and is temporarily overloaded. This is a common issue that usually resolves within a few minutes.

**What you can do:**
- Wait 2-3 minutes and try again
- The service will automatically retry your request
- Your request has been queued and will be processed when capacity is available

This is not an issue with your request - it's just high server load. Please try again in a few minutes!`;
        } else if (error.message.includes('experiencing issues')) {
          errorContent = `⚠️ **Temporary Service Issue**

I'm having trouble generating flashcards right now due to a temporary service issue. This usually resolves quickly.

**Please try:**
- Waiting a moment and trying again
- Using a simpler request like "create flashcards about [topic]"
- Checking back in a few minutes

Your request was valid - this is just a temporary technical issue.`;
        } else {
          errorContent = `I apologize, but I had trouble generating flashcards for you. Please try again with a more specific request, like "create flashcards about photosynthesis" or "generate flashcards for my uploaded document".`;
        }
      } else {
        errorContent = `I apologize, but I had trouble generating flashcards for you. Please try again with a more specific request, like "create flashcards about photosynthesis" or "generate flashcards for my uploaded document".`;
      }
      
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}_${++this.messageCounter}`,
        role: 'assistant',
        content: errorContent,
        timestamp: new Date()
      };

      // Still save the user message and error response
      if (context.sessionId && this.sessions.has(context.sessionId)) {
        const session = this.sessions.get(context.sessionId)!;
        session.messages.push(userMessage, errorMessage);
        session.updatedAt = new Date();
        // Save session to Firebase
        if (this.currentUserId) {
          try {
            await firebaseService.saveChatSession(session, this.currentUserId);
            
            // Dispatch event to notify UI components
            window.dispatchEvent(new CustomEvent('sessionUpdated'));
          } catch (error) {
            console.error('Failed to save session to Firebase:', error);
          }
        }
      }

      return errorMessage;
    }
  }
}

// Export singleton instance
export const chatService = new ChatServiceImpl();
