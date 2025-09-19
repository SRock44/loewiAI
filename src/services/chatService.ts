import { ChatMessage, ChatSession, ChatContext, ChatService, QuickAction } from '../types/chat';
import { authService } from './authService';

// Mock Chat Service - Replace with actual AI integration
class MockChatService implements ChatService {
  private sessions: Map<string, ChatSession> = new Map();
  private messageCounter = 0;
  private storageKey = 'academic-ai-chat-sessions';

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    const user = authService.getCurrentUser();
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
          // Clear sessions if they belong to a different user
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
    // Only save chat history if user is authenticated
    const user = authService.getCurrentUser();
    if (!user) {
      return; // Don't save chat history for unauthenticated users
    }

    try {
      const data = {
        sessions: Array.from(this.sessions.values()),
        messageCounter: this.messageCounter,
        userId: user.id // Associate sessions with user
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving chat sessions to storage:', error);
    }
  }

  async sendMessage(message: string, context: ChatContext): Promise<ChatMessage> {
    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));

    const userMessage: ChatMessage = {
      id: `msg_${this.messageCounter++}`,
      role: 'user',
      content: message,
      timestamp: new Date()
    };

    // Generate AI response based on message content
    const aiResponse = this.generateAIResponse(message, context);
    
    const assistantMessage: ChatMessage = {
      id: `msg_${this.messageCounter++}`,
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date(),
      documentId: context.documentIds[0] // Reference to first document if available
    };

    // Update session with new messages
    if (context.sessionId && this.sessions.has(context.sessionId)) {
      const session = this.sessions.get(context.sessionId)!;
      session.messages.push(userMessage, assistantMessage);
      session.updatedAt = new Date();
      this.saveToStorage();
    }

    return assistantMessage;
  }

  async getChatHistory(sessionId: string): Promise<ChatMessage[]> {
    const session = this.sessions.get(sessionId);
    return session ? session.messages : [];
  }

  async createNewSession(title?: string): Promise<ChatSession> {
    const sessionId = `session_${Date.now()}`;
    const session: ChatSession = {
      id: sessionId,
      title: title || `Chat ${this.sessions.size + 1}`,
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

  // Clear all chat data (called when user signs out)
  clearAllData(): void {
    this.sessions.clear();
    this.messageCounter = 0;
    localStorage.removeItem(this.storageKey);
  }

  // Reload sessions when user authentication changes
  reloadForUser(): void {
    this.loadFromStorage();
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
}

// Export singleton instance
export const chatService = new MockChatService();

// Future: Replace with actual AI service integration
// export const chatService = new OpenAIAPIService(process.env.REACT_APP_OPENAI_API_KEY);
// export const chatService = new AnthropicAPIService(process.env.REACT_APP_ANTHROPIC_API_KEY);
