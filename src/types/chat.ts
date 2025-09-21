// Chat Interface Types

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  documentId?: string; // Reference to uploaded document if relevant
  isTyping?: boolean;
  flashcardSet?: any; // FlashcardSet generated from this message
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  documentIds: string[]; // Documents available in this chat context
}

export interface ChatContext {
  sessionId: string;
  documentIds: string[];
  currentTopic?: string;
  processedDocuments?: any[]; // Will be ProcessedDocument[] but avoiding circular import
  userPreferences?: {
    responseStyle: 'concise' | 'detailed' | 'conversational';
    expertiseLevel: 'beginner' | 'intermediate' | 'advanced';
  };
}

export interface ChatService {
  sendMessage(message: string, context: ChatContext): Promise<ChatMessage>;
  getChatHistory(sessionId: string): Promise<ChatMessage[]>;
  createNewSession(title?: string): Promise<ChatSession>;
  deleteSession(sessionId: string): Promise<void>;
  updateContext(sessionId: string, context: Partial<ChatContext>): Promise<void>;
}

// Chat UI State
export interface ChatUIState {
  currentSessionId: string | null;
  sessions: ChatSession[];
  isLoading: boolean;
  error: string | null;
  inputValue: string;
  isTyping: boolean;
}

// Quick Actions for common academic queries
export interface QuickAction {
  id: string;
  title: string;
  description: string;
  prompt: string;
  icon: string;
  category: 'general' | 'syllabus' | 'assignment' | 'study' | 'clarification';
}

export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'explain_concept',
    title: 'Explain a Concept',
    description: 'Get a detailed explanation of any topic',
    prompt: 'Can you explain ',
    icon: '💡',
    category: 'general'
  },
  {
    id: 'study_plan',
    title: 'Create Study Plan',
    description: 'Generate a personalized study schedule',
    prompt: 'Help me create a study plan for ',
    icon: '📅',
    category: 'study'
  },
  {
    id: 'assignment_help',
    title: 'Assignment Help',
    description: 'Get guidance on assignments and projects',
    prompt: 'I need help with this assignment about ',
    icon: '📝',
    category: 'assignment'
  },
  {
    id: 'clarify_doubt',
    title: 'Clarify Doubts',
    description: 'Ask specific questions about the content',
    prompt: 'I have a question about ',
    icon: '❓',
    category: 'clarification'
  },
  {
    id: 'summarize_content',
    title: 'Summarize Content',
    description: 'Get a concise summary of the material',
    prompt: 'Can you summarize ',
    icon: '📋',
    category: 'general'
  },
  {
    id: 'practice_questions',
    title: 'Practice Questions',
    description: 'Generate practice questions and answers',
    prompt: 'Create practice questions for ',
    icon: '🎯',
    category: 'study'
  },
  {
    id: 'generate_flashcards',
    title: 'Generate Flashcards',
    description: 'Create flashcards from your documents',
    prompt: 'Generate flashcards from my uploaded documents focusing on ',
    icon: '🎴',
    category: 'study'
  }
];
