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
class GeminiChatService implements ChatService {
  // store all chat sessions in memory - key is session id, value is the session object
  private sessions: Map<string, ChatSession> = new Map();
  // counter to make sure each message gets a unique id
  private messageCounter = 0;
  // track which user is currently logged in (null if not logged in)
  private currentUserId: string | null = null;
  // function to unsubscribe from firebase real-time updates when user logs out
  private realtimeUnsubscribe: (() => void) | null = null;

  constructor() {
    // listen for when user signs in/out so we can load their sessions
    this.setupAuthStateListener();
  }

  // this listens for auth changes - when user signs in, we load their chat sessions
  // when they sign out, we clear everything from memory
  private setupAuthStateListener() {
    firebaseAuthService.onAuthStateChange((user) => {
      console.log('🔐 Auth state changed:', user ? `User ${user.id}` : 'No user');
      if (user && user.id !== this.currentUserId) {
        // user just signed in or switched accounts - load their sessions from firebase
        console.log('👤 User signed in, loading sessions...');
        this.currentUserId = user.id;
        this.loadSessionsFromFirebase();
      } else if (!user && this.currentUserId) {
        // user signed out - clean up everything
        console.log('👋 User signed out, clearing sessions...');
        if (this.realtimeUnsubscribe) {
          this.realtimeUnsubscribe();
          this.realtimeUnsubscribe = null;
        }
        this.currentUserId = null;
        this.sessions.clear();
        this.messageCounter = 0;
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
        // Filter and sort sessions
        const sortedSessions = sessions
          .filter(session => this.hasValidConversation(session))
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        
        // Update local sessions
        this.sessions = new Map();
        sortedSessions.forEach(session => {
          this.sessions.set(session.id, session);
        });
        
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
  async sendMessage(message: string, context: ChatContext): Promise<ChatMessage> {
    // create the user message object - this gets saved to the session
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_${++this.messageCounter}`,
      role: 'user',
      content: message,
      timestamp: new Date()
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
      const conversationContext = this.buildConversationContext(context.sessionId);
      
      // Get AI response from Firebase AI Logic Service
      const aiResponse: AIResponse = await firebaseAILogicService.generateResponse(
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
        
        // Persist session (including messages array) to Firestore for signed-in users.
        // We intentionally avoid a separate "messages" collection here because it was
        // causing ID mismatches and duplicate writes.
        if (this.currentUserId) {
          try {
            await firebaseService.saveChatSession(session, this.currentUserId);
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
      console.log('🗑️ Starting deletion process:', { sessionId });

      // If signed in, delete from Firestore.
      // (Messages are stored on the session document itself.)
      if (userId) {
        await firebaseService.deleteChatSession(sessionId);
        await this.loadSessionsFromFirebase();
      }
      
      // Remove from local memory (for both Firebase and local sessions)
      console.log('🗑️ Step 4: Removing from local memory...');
      this.sessions.delete(sessionId);
      console.log('✅ Step 4: Removed from local memory');
      
      // Dispatch event to notify all connected devices of the deletion
      console.log('🗑️ Step 5: Dispatching session update event...');
      window.dispatchEvent(new CustomEvent('sessionUpdated'));
      console.log('✅ Step 5: Session update event dispatched');
      
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

  private buildDocumentContext(documentIds: string[], processedDocuments?: ProcessedDocument[]): string {
    if (documentIds.length === 0) return '';

    // Use processed documents if available, otherwise fallback to basic context
    if (!processedDocuments || processedDocuments.length === 0) {
      return `The user has uploaded ${documentIds.length} document(s) that may be relevant to their question. Consider this when providing academic guidance.`;
    }

    // Build rich context from processed document content
    try {
    const documentSummaries = documentProcessor.getDocumentSummaries(processedDocuments);
    const documentContent = documentProcessor.getDocumentContent(processedDocuments, 3000);

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
export const chatService = new GeminiChatService();
