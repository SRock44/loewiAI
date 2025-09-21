import { ChatMessage, ChatSession, ChatContext, ChatService, QuickAction } from '../types/chat';
import { authService } from './authService';
import { geminiAIService, AIResponse } from './geminiService';
import { documentProcessor, ProcessedDocument } from './documentProcessor';
import { flashcardService } from './flashcardService';
import { FlashcardGenerationRequest } from '../types/flashcard';

// Enhanced Chat Service with Gemini AI integration
class GeminiChatService implements ChatService {
  private sessions: Map<string, ChatSession> = new Map();
  private messageCounter = 0;
  private storageKey = 'academic-ai-chat-sessions';

  constructor() {
    console.log('🏗️ ChatService constructor called');
    this.loadFromStorage();
  }

  private loadFromStorage() {
    const user = authService.getCurrentUser();
    if (!user) {
      console.log('⚠️ Not loading chat history - user not authenticated');
      // Clear sessions for unauthenticated users
      this.sessions.clear();
      this.messageCounter = 0;
      return;
    }

    try {
      const stored = localStorage.getItem(this.storageKey);
      console.log('📂 Loading chat sessions from storage for user:', user.email);
      
      if (stored) {
        const data = JSON.parse(stored);
        console.log('📊 Found stored data:', data);
        
        // Only load sessions if they belong to the current user
        if (data.userId === user.id) {
          this.sessions = new Map(data.sessions.map((s: any) => [s.id, {
            ...s,
            createdAt: new Date(s.createdAt),
            updatedAt: new Date(s.updatedAt),
            messages: s.messages.map((m: any) => ({
              ...m,
              timestamp: new Date(m.timestamp)
            }))
          }]));
          this.messageCounter = data.messageCounter || 0;
          console.log('✅ Loaded', this.sessions.size, 'sessions for user:', user.email);
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
    const user = authService.getCurrentUser();
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
      console.log('✅ Saved chat sessions to storage for user:', user.email);
      console.log('📊 Sessions saved:', this.sessions.size);
    } catch (error) {
      console.error('❌ Error saving chat sessions to storage:', error);
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
      
      // Get AI response from Gemini
      const aiResponse: AIResponse = await geminiAIService.generateResponse(
        message, 
        documentContext
      );

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_${++this.messageCounter}`,
        role: 'assistant',
        content: aiResponse.content,
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
    const sessionId = `session_${Date.now()}`;
    const sessionNumber = this.sessions.size + 1;
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
    console.log('✅ Created new session:', session);
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
    this.sessions.delete(sessionId);
    this.saveToStorage();
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
    return Array.from(this.sessions.values()).sort((a, b) => 
      b.updatedAt.getTime() - a.updatedAt.getTime()
    );
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
    console.log('Current user:', authService.getCurrentUser());
  }


  private generateAIResponse(userMessage: string, context: ChatContext): string {
    const message = userMessage.toLowerCase();

    // Context-aware responses based on uploaded documents
    if (context.documentIds.length > 0) {
      if (message.includes('explain') || message.includes('what is')) {
        return `Based on your uploaded documents, I can explain this concept. From what I've analyzed in your materials, this topic covers several key areas. Let me break it down for you:\n\n1. **Core Concept**: The fundamental principle involves...\n2. **Key Components**: The main elements include...\n3. **Practical Applications**: You'll find this useful when...\n\nWould you like me to elaborate on any specific aspect?`;
      }
      
      if (message.includes('study') || message.includes('learn')) {
        return `I've reviewed your course materials and can help you create an effective study plan. Here's what I recommend:\n\n📚 **Priority Topics**: Focus on these areas first based on your syllabus\n⏰ **Study Schedule**: Allocate 2-3 hours daily for these topics\n🎯 **Assessment Prep**: Practice these specific concepts for upcoming exams\n\nWould you like me to create a detailed weekly schedule for you?`;
      }
      
      if (message.includes('assignment') || message.includes('project')) {
        return `I can help you with your assignment based on the requirements in your uploaded documents. Here's a structured approach:\n\n1. **Understanding Requirements**: From your materials, the assignment asks for...\n2. **Key Components Needed**: You should include...\n3. **Suggested Approach**: I recommend starting with...\n\nWhat specific part of the assignment would you like help with?`;
      }
    }

    // General academic assistance responses
    if (message.includes('hello') || message.includes('hi')) {
      return `Hello! I'm your Academic AI Assistant. I'm here to help you with:\n\n• Understanding course materials\n• Creating study plans\n• Assignment guidance\n• Concept explanations\n• Academic questions\n\nWhat would you like to work on today?`;
    }

    if (message.includes('help') || message.includes('stuck')) {
      return `I'm here to help! Here are some ways I can assist you:\n\n💡 **Explain concepts** - Ask me to clarify any topic\n📅 **Study planning** - Get personalized study schedules\n📝 **Assignment help** - Guidance on projects and homework\n❓ **Question answering** - Ask specific academic questions\n🎯 **Practice problems** - Generate exercises and solutions\n\nWhat would you like to start with?`;
    }

    if (message.includes('thank')) {
      return `You're very welcome! I'm glad I could help. Feel free to ask me anything else about your studies. I'm here 24/7 to support your academic journey! 🎓`;
    }

    // Default response for other queries
    return `That's an interesting question! Let me help you with that.\n\nBased on my analysis, here's what I can tell you:\n\n• **Key Points**: The main aspects to consider are...\n• **Important Details**: You should pay attention to...\n• **Next Steps**: I recommend that you...\n\nIs there anything specific about this topic you'd like me to elaborate on?`;
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

  private getProcessedDocuments(documentIds: string[]): ProcessedDocument[] {
    // In a real app, you'd fetch from a database or storage
    // For now, we'll return an empty array as documents are stored in component state
    // This will be enhanced when we integrate with the chat interface
    return [];
  }

  // Get AI provider info for debugging
  getAIProviderInfo(): string {
    return geminiAIService.getCurrentProvider();
  }

  getAvailableAIProviders(): string[] {
    return geminiAIService.getAvailableProviders();
  }

  // Test Gemini connection
  async testGeminiConnection(): Promise<boolean> {
    return await geminiAIService.testConnection();
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
      'quiz cards'
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
      const document = context.processedDocuments[0];
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
        response.setTitle,
        response.setDescription,
        response.flashcards,
        response.sourceDocumentId ? [response.sourceDocumentId] : undefined
      );
      
      // Save the set
      flashcardService.saveFlashcardSet(flashcardSet);
      
      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_${++this.messageCounter}`,
        role: 'assistant',
        content: `🎴 I've created ${response.flashcards.length} flashcards for you! 

**Set Title:** ${response.setTitle}
**Description:** ${response.setDescription}

The flashcards are now ready for you to study. You can view them by clicking the "📚 View Flashcards" button in the header, or just ask me to "show my flashcards" to study them right here in the chat!`,
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
      
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}_${++this.messageCounter}`,
        role: 'assistant',
        content: `I apologize, but I had trouble generating flashcards for you. Please try again with a more specific request, like "create flashcards about photosynthesis" or "generate flashcards for my uploaded document".`,
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
