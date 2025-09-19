import { ChatMessage, ChatSession, ChatContext, ChatService, QuickAction } from '../types/chat';
import { authService } from './authService';
import { aiService, AIResponse } from './aiIntegration';
import { DocumentMetadata } from '../types/ai';

// Enhanced Chat Service with AI Integration
class EnhancedChatService implements ChatService {
  private sessions: Map<string, ChatSession> = new Map();
  private messageCounter = 0;
  private storageKey = 'academic-ai-chat-sessions';

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    const user = authService.getCurrentUser();
    if (!user) {
      this.sessions.clear();
      this.messageCounter = 0;
      return;
    }

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        
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
        } else {
          this.sessions.clear();
          this.messageCounter = 0;
        }
      }
    } catch (error) {
      console.error('Error loading chat sessions from storage:', error);
      this.sessions.clear();
      this.messageCounter = 0;
    }
  }

  private saveToStorage() {
    const user = authService.getCurrentUser();
    if (!user) return;

    try {
      const data = {
        sessions: Array.from(this.sessions.values()),
        messageCounter: this.messageCounter,
        userId: user.id
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving chat sessions to storage:', error);
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
      // Build context from uploaded documents
      const documentContext = this.buildDocumentContext(context.documentIds);
      
      // Get AI response
      const aiResponse: AIResponse = await aiService.generateResponse(
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

  private buildDocumentContext(documentIds: string[]): string {
    if (documentIds.length === 0) return '';

    // In a real app, you'd fetch document content from your storage
    // For now, we'll create a simple context
    return `The user has uploaded ${documentIds.length} document(s) that may be relevant to their question. Consider this when providing academic guidance.`;
  }

  async createNewSession(): Promise<ChatSession> {
    const sessionId = `session_${Date.now()}`;
    const session: ChatSession = {
      id: sessionId,
      title: 'New Chat Session',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      documentIds: []
    };

    this.sessions.set(sessionId, session);
    this.saveToStorage();
    return session;
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

  clearAllData(): void {
    this.sessions.clear();
    this.messageCounter = 0;
    localStorage.removeItem(this.storageKey);
  }

  reloadForUser(): void {
    this.loadFromStorage();
  }

  // Enhanced method to update session with documents
  async updateSessionDocuments(sessionId: string, documents: DocumentMetadata[]): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.documentIds = documents.map(doc => doc.id);
      session.updatedAt = new Date();
      this.saveToStorage();
    }
  }

  // Get AI provider info for debugging
  getAIProviderInfo(): string {
    return aiService.getCurrentProvider();
  }

  getAvailableAIProviders(): string[] {
    return aiService.getAvailableProviders();
  }
}

// Export singleton instance
export const enhancedChatService = new EnhancedChatService();

