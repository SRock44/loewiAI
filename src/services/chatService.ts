import { ChatMessage, ChatSession, ChatContext, ChatService } from '../types/chat';
import { firebaseAuthService } from './firebaseAuthService';
import { firebaseAILogicService, AIResponse } from './firebaseAILogicService';
import { documentProcessor } from './documentProcessor';
import { flashcardService } from './flashcardService';
import { FlashcardGenerationRequest } from '../types/flashcard';
import { codeValidator, CodeValidationResult } from './codeValidator';
import { codeExecutor } from './codeExecutor';
import { firebaseService } from './firebaseService';
import { automaticCleanupService } from './automaticCleanupService';

// Enhanced Chat Service with Gemini AI integration
class GeminiChatService implements ChatService {
  private sessions: Map<string, ChatSession> = new Map();
  private messageCounter = 0;
  private storageKey = 'academic-ai-chat-sessions';

  constructor() {
    this.loadFromStorage();
    this.cleanupEmptySessions();
    this.syncWithFirebase();
    this.setupRealtimeSync();
    this.setupAuthStateListener();
    
    // Start automatic cleanup service
    automaticCleanupService.startAutomaticCleanup();
  }

  // Sync with Firebase
  private async syncWithFirebase() {
    const user = firebaseAuthService.getCurrentUser();
    if (!user) return;

    try {
      const firebaseSessions = await firebaseService.getChatSessions(user.id);
      
      // Merge Firebase sessions with local sessions, but only if they have valid conversations
      firebaseSessions.forEach(session => {
        if (this.hasValidConversation(session)) {
          this.sessions.set(session.id, session);
        }
      });
      
      // Only save local sessions to Firebase if they don't already exist in Firebase
      // This prevents duplicate sessions from being created
      for (const [, session] of this.sessions) {
        if (this.hasValidConversation(session) && !session.id.startsWith('firebase_')) {
          try {
            await firebaseService.saveChatSession(session, user.id);
          } catch (error) {
            // Error saving session to Firebase
          }
        }
      }
      
      // Clean up any duplicate sessions that may exist
      try {
        const duplicatesRemoved = await firebaseService.cleanupDuplicateSessions(user.id);
        if (duplicatesRemoved > 0) {
          // Reload sessions after cleanup
          const cleanSessions = await firebaseService.getChatSessions(user.id);
          this.sessions.clear();
          cleanSessions.forEach(session => {
            if (this.hasValidConversation(session)) {
              this.sessions.set(session.id, session);
            }
          });
        }
      } catch (error) {
        // Error cleaning up duplicates
      }
      
      // Firebase sync completed
    } catch (error) {
      // Firebase sync failed silently
    }
  }

  // Setup real-time synchronization with Firebase
  private setupRealtimeSync() {
    const user = firebaseAuthService.getCurrentUser();
    if (!user) return;

    try {
      
      // Subscribe to real-time chat session updates
      const unsubscribe = firebaseService.subscribeToChatSessions(user.id, (sessions) => {
        
        // Update local sessions with Firebase data, but only if they have valid conversations
        sessions.forEach(session => {
          if (this.hasValidConversation(session)) {
            this.sessions.set(session.id, session);
          }
        });
        
        // Save to local storage for offline access
        this.saveToStorage();
      });

      // Store unsubscribe function for cleanup
      (this as any).unsubscribeFirebase = unsubscribe;
      
      // Real-time Firebase sync enabled
    } catch (error) {
      // Failed to setup real-time sync
    }
  }

  // Setup authentication state listener for cross-device sync
  private setupAuthStateListener() {
    try {
      
      // Listen for authentication state changes
      const unsubscribeAuth = firebaseAuthService.onAuthStateChange((user) => {
        if (user) {
          // User signed in, sync with Firebase
          this.syncWithFirebase();
          this.setupRealtimeSync();
        } else {
          // User signed out, clear local sessions
          this.sessions.clear();
          this.saveToStorage();
          
          // Cleanup Firebase listeners
          if ((this as any).unsubscribeFirebase) {
            (this as any).unsubscribeFirebase();
            (this as any).unsubscribeFirebase = null;
          }
        }
      });

      // Store auth unsubscribe function for cleanup
      (this as any).unsubscribeAuth = unsubscribeAuth;
      
      // Auth state listener enabled
    } catch (error) {
      // Failed to setup auth state listener
    }
  }

  private loadFromStorage() {
    const user = firebaseAuthService.getCurrentUser();
    if (!user) {
      // Clear sessions for unauthenticated users
      this.sessions.clear();
      this.messageCounter = 0;
      return;
    }

    try {
      const stored = localStorage.getItem(this.storageKey);
      
      if (stored) {
        const data = JSON.parse(stored);
        
        // Only load sessions if they belong to the current user
        if (data.userId === user.id) {
          const loadedSessions = data.sessions.map((s: any) => ({
            ...s,
            createdAt: new Date(s.createdAt),
            updatedAt: new Date(s.updatedAt),
            messages: s.messages.map((m: any) => ({
              ...m,
              timestamp: new Date(m.timestamp)
            }))
          }));
          
          // Filter out empty sessions and only keep valid conversations
          const validSessions = loadedSessions.filter((session: ChatSession) => 
            this.hasValidConversation(session)
          );
          
          this.sessions = new Map(validSessions.map((s: ChatSession) => [s.id, s]));
          this.messageCounter = data.messageCounter || 0;
          // Loaded sessions for user
        } else {
          console.log('⚠️ Stored sessions belong to different user, clearing');
          // Clear sessions if they belong to a different user
          this.sessions.clear();
          this.messageCounter = 0;
        }
      } else {
        console.log('📂 No stored chat sessions found');
      }
    } catch (error) {
      console.error('❌ Error loading chat sessions from storage:', error);
      this.sessions.clear();
      this.messageCounter = 0;
    }
  }

  private saveToStorage() {
    // Only save chat history if user is authenticated
    const user = firebaseAuthService.getCurrentUser();
    if (!user) {
      console.log('⚠️ Not saving chat history - user not authenticated');
      return; // Don't save chat history for unauthenticated users
    }

    try {
      const data = {
        sessions: Array.from(this.sessions.values()),
        messageCounter: this.messageCounter,
        userId: user.id // Associate sessions with user
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      // Sessions saved to storage
    } catch (error) {
      // Error saving chat sessions to storage
    }
  }

  async sendMessage(message: string, context: ChatContext): Promise<ChatMessage> {
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_${++this.messageCounter}`,
      role: 'user',
      content: message,
      timestamp: new Date()
    };

    try {
      // Check if this is a flashcard generation request
      const flashcardRequest = this.detectFlashcardRequest(message, context);
      
      if (flashcardRequest) {
        return await this.handleFlashcardGeneration(flashcardRequest, context, userMessage);
      }

      // Build context from uploaded documents
      const documentContext = this.buildDocumentContext(context.documentIds, context.processedDocuments);
      
      // Check if user is asking for code execution
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
      const conversationContext = this.buildConversationContext(context.sessionId);
      
      // Get AI response from Firebase AI Logic Service
      const aiResponse: AIResponse = await firebaseAILogicService.generateResponse(
        message, 
        documentContext,
        conversationContext
      );

      // Validate code in the AI response and silently fix if needed
      const validationResults = codeValidator.validateCodeBlocks(aiResponse.content);
      const hasErrors = validationResults.some(result => !result.isValid || result.errors.length > 0);

      let finalContent = aiResponse.content;

      // If there are code errors, attempt to fix them silently
      if (hasErrors) {
        console.log('Code validation found errors, attempting to fix silently...');
        const correctedResponse = await this.attemptCodeCorrection(aiResponse.content, validationResults, documentContext);
        if (correctedResponse) {
          finalContent = correctedResponse;
          console.log('Code correction successful');
        } else {
          console.log('Code correction failed, using original code');
        }
      }

      // Execute code blocks silently for validation (no user display)
      await codeExecutor.executeCodeBlocks(finalContent);
      // Note: Execution results are not displayed to users, only used for internal validation

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_${++this.messageCounter}`,
        role: 'assistant',
        content: finalContent,
        timestamp: new Date()
      };

      // Update session with new messages
      if (context.sessionId && this.sessions.has(context.sessionId)) {
        const session = this.sessions.get(context.sessionId)!;
        session.messages.push(userMessage, assistantMessage);
        session.updatedAt = new Date();
        
        // Update session title based on first message if it's generic
        this.updateSessionTitleIfNeeded(session, message);
        
        this.saveToStorage();
        
        // Save messages to Firebase for cross-device sync
        const user = firebaseAuthService.getCurrentUser();
        if (user) {
          try {
            // Check if this is the first message in the session
            const isFirstMessage = session.messages.length === 2; // user + assistant message
            
            if (isFirstMessage) {
              // Save the entire session to Firebase for the first time
              const firebaseSessionId = await firebaseService.saveChatSession(session, user.id);
              
              // Update local session with Firebase ID for consistency
              session.id = firebaseSessionId;
              this.sessions.set(firebaseSessionId, session);
              this.sessions.delete(context.sessionId); // Remove old local ID
              
              // Update the context session ID for future messages
              context.sessionId = firebaseSessionId;
            } else {
              // Save individual messages to existing Firebase session
              await firebaseService.saveMessage(context.sessionId, userMessage);
              await firebaseService.saveMessage(context.sessionId, assistantMessage);
              
              // Update session timestamp in Firebase for cleanup tracking
              await firebaseService.updateChatSession(context.sessionId, { 
                updatedAt: new Date(),
                lastActivityAt: new Date(), // Track last activity for cleanup
                messages: session.messages // Update the full messages array
              });
            }
            
            // Messages saved to Firebase for cross-device sync
          } catch (error) {
            // Continue execution even if Firebase save fails
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
        this.saveToStorage();
      }

      return errorMessage;
    }
  }

  async getChatHistory(sessionId: string): Promise<ChatMessage[]> {
    const session = this.sessions.get(sessionId);
    return session ? session.messages : [];
  }

  async createNewSession(title?: string): Promise<ChatSession> {
    // Check if there's already an empty session that we can reuse
    const existingEmptySession = Array.from(this.sessions.values()).find(session => 
      !this.hasValidConversation(session)
    );
    
    if (existingEmptySession) {
      // Return the existing empty session instead of creating a new one
      return existingEmptySession;
    }
    
    // Double-check: if we already have an empty session, don't create another one
    const allSessions = Array.from(this.sessions.values());
    const emptySessions = allSessions.filter(session => !this.hasValidConversation(session));
    
    if (emptySessions.length > 0) {
      // Return the first empty session
      return emptySessions[0];
    }
    
    const sessionId = `session_${Date.now()}`;
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
    this.saveToStorage();
    
    // Note: We do NOT save empty sessions to Firebase
    // Sessions will only be saved to Firebase when the first message is sent
    
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
        console.log('📝 Updated session title from', session.title, 'to', newTitle);
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
    console.log('🗑️ Deleting session:', sessionId);
    
    // Delete from local storage
    this.sessions.delete(sessionId);
    this.saveToStorage();
    console.log('✅ Deleted from local storage');
    
    // Delete from Firebase
    const user = firebaseAuthService.getCurrentUser();
    if (user) {
      try {
        console.log('🔥 Deleting from Firebase...');
        await firebaseService.deleteChatSession(sessionId);
        console.log('✅ Deleted chat session from Firebase');
        
        // Also delete associated messages
        await firebaseService.deleteSessionMessages(sessionId);
        console.log('✅ Deleted session messages from Firebase');
      } catch (error) {
        console.error('❌ Firebase deletion failed:', error);
        // Continue execution even if Firebase delete fails
      }
    } else {
      console.log('⚠️ No user authenticated, skipping Firebase deletion');
    }
  }

  async updateContext(sessionId: string, context: Partial<ChatContext>): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (context.documentIds) {
        session.documentIds = context.documentIds;
      }
      session.updatedAt = new Date();
      this.saveToStorage();
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

  // Check if a session has valid conversation content
  private hasValidConversation(session: ChatSession): boolean {
    if (!session.messages || session.messages.length === 0) {
      return false;
    }

    // Check if there's at least one user message and one assistant response
    const hasUserMessage = session.messages.some(msg => msg.role === 'user' && msg.content && msg.content.trim().length > 0);
    const hasAssistantMessage = session.messages.some(msg => msg.role === 'assistant' && msg.content && msg.content.trim().length > 0);
    
    return hasUserMessage && hasAssistantMessage;
  }

  // Clean up empty sessions to prevent accumulation
  private cleanupEmptySessions(): void {
    const emptySessions = Array.from(this.sessions.entries()).filter(([_, session]) => 
      !this.hasValidConversation(session)
    );
    
    // Keep only one empty session if any exist
    if (emptySessions.length > 1) {
      // Remove all but the first empty session
      for (let i = 1; i < emptySessions.length; i++) {
        this.sessions.delete(emptySessions[i][0]);
      }
      this.saveToStorage();
    }
  }

  // Clear all chat data (called when user signs out)
  clearAllData(): void {
    this.sessions.clear();
    this.messageCounter = 0;
    localStorage.removeItem(this.storageKey);
  }

  // Reload sessions when user authentication changes
  reloadForUser(): void {
    console.log('🔄 Reloading chat service for user');
    this.loadFromStorage();
  }

  // Debug method to check localStorage contents
  debugStorage(): void {
    console.log('🔍 Debugging localStorage:');
    console.log('Storage key:', this.storageKey);
    const stored = localStorage.getItem(this.storageKey);
    console.log('Raw stored data:', stored);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        console.log('Parsed data:', parsed);
      } catch (e) {
        console.error('Error parsing stored data:', e);
      }
    }
    console.log('Current sessions in memory:', this.sessions.size);
    console.log('Current user:', firebaseAuthService.getCurrentUser());
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
        console.log('Corrected code still has errors, returning original with validation results');
        return null;
      }

      console.log('Code correction successful');
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
   * Builds conversation history context for better follow-up question handling
   */
  private buildConversationContext(sessionId: string): string {
    if (!sessionId || !this.sessions.has(sessionId)) {
      return '';
    }

    const session = this.sessions.get(sessionId)!;
    const messages = session.messages;
    
    // Only include recent conversation history (last 10 messages to avoid token limits)
    const recentMessages = messages.slice(-10);
    
    if (recentMessages.length <= 2) {
      return ''; // No need for context if this is the first exchange
    }

    let context = '\n\nCONVERSATION HISTORY:\n';
    context += 'The following is the recent conversation history to help you understand the context and provide better follow-up responses:\n\n';

    for (let i = 0; i < recentMessages.length - 1; i++) {
      const msg = recentMessages[i];
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      const content = msg.content.length > 500 ? msg.content.substring(0, 500) + '...' : msg.content;
      
      context += `${role}: ${content}\n\n`;
    }

    context += 'CURRENT USER MESSAGE: [This is the message you are responding to]\n\n';
    context += 'INSTRUCTIONS:\n';
    context += '- Use the conversation history to understand the context of follow-up questions\n';
    context += '- Reference previous topics, code, or concepts when relevant\n';
    context += '- If the user asks about something from a previous message, acknowledge and build upon it\n';
    context += '- Maintain continuity in the conversation flow\n';
    context += '- If the user asks "what about X?" or "how about Y?", refer to the previous context\n';

    return context;
  }

  private buildDocumentContext(documentIds: string[], processedDocuments?: any[]): string {
    if (documentIds.length === 0) return '';

    // Use processed documents if available, otherwise fallback to basic context
    if (!processedDocuments || processedDocuments.length === 0) {
      return `The user has uploaded ${documentIds.length} document(s) that may be relevant to their question. Consider this when providing academic guidance.`;
    }

    // Build rich context from processed document content
    const documentSummaries = documentProcessor.getDocumentSummaries(processedDocuments);
    const documentContent = documentProcessor.getDocumentContent(processedDocuments, 3000);

    console.log('📄 Document summaries:', documentSummaries);
    console.log('📄 Document content length:', documentContent.length);
    console.log('📄 Document content preview:', documentContent.substring(0, 300));
    console.log('📄 Full document context being sent to Gemini:', documentContent);

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
  }


  // Get AI provider info for debugging
  getAIProviderInfo(): string {
    return firebaseAILogicService.getCurrentProvider();
  }

  getAvailableAIProviders(): string[] {
    return firebaseAILogicService.getAvailableProviders();
  }

  // Test Gemini connection
  async testGeminiConnection(): Promise<boolean> {
    return await firebaseAILogicService.testConnection();
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
      console.log('🎴 Generating flashcards from chat request:', request);
      
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
      flashcardService.saveFlashcardSet(flashcardSet);
      
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
        this.saveToStorage();
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
        this.saveToStorage();
      }

      return errorMessage;
    }
  }
}

// Export singleton instance
export const chatService = new GeminiChatService();
