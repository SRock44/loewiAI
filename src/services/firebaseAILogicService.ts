import { GoogleGenerativeAI, GenerativeModel, GenerationConfig } from '@google/generative-ai';
// import { firebaseAuthService } from './firebaseAuthService';

export interface AIResponse {
  content: string;
  model: string;
  provider: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface AIProvider {
  name: string;
  generateResponse(_message: string, _context?: string, _conversationHistory?: string): Promise<AIResponse>;
  isAvailable(): boolean;
}

// Firebase AI Logic Provider using Google Generative AI
class FirebaseAILogicProvider implements AIProvider {
  name = 'Firebase AI Logic (Gemini)';
  private genAI: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.initializeFirebaseAI();
  }

  private initializeFirebaseAI() {
    if (!this.apiKey) {
      console.warn('Gemini API key not provided for Firebase AI Logic');
      return;
    }

    try {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      
      // Initialize the model with Firebase-optimized configuration
      const generationConfig: GenerationConfig = {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      };

      this.model = this.genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        generationConfig: generationConfig
      });
      
      console.log('✅ Firebase AI Logic initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Firebase AI Logic:', error);
      this.genAI = null;
      this.model = null;
    }
  }

  isAvailable(): boolean {
    return this.genAI !== null && this.model !== null;
  }

  async generateResponse(_message: string, _context?: string, _conversationHistory?: string): Promise<AIResponse> {
    if (!this.isAvailable()) {
      throw new Error('Firebase AI Logic is not available');
    }

    const maxRetries = 3;
    const baseDelay = 1000;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Build the prompt with Firebase AI Logic context
        const systemPrompt = this.buildFirebaseAIPrompt(_context, _conversationHistory);
        const fullPrompt = `${systemPrompt}\n\nUser: ${_message}`;

        console.log(`🤖 Firebase AI Logic request... (attempt ${attempt}/${maxRetries})`);
        
        const result = await this.model!.generateContent(fullPrompt);
        const response = await result.response;
        const content = response.text();

        console.log('✅ Firebase AI Logic response received');

        return {
          content: content,
          model: 'gemini-1.5-flash',
          provider: 'Firebase AI Logic'
        };
      } catch (error) {
        console.error(`❌ Firebase AI Logic error (attempt ${attempt}/${maxRetries}):`, error);
        
        // Check if this is a 503 error (service overloaded)
        if (error instanceof Error && error.message.includes('503') && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          console.log(`⏳ Retrying in ${delay}ms due to service overload...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw new Error(`Firebase AI Logic error: ${error}`);
      }
    }
    
    throw new Error('Firebase AI Logic failed after all retry attempts');
  }

  private buildFirebaseAIPrompt(context?: string, conversationHistory?: string): string {
    const basePrompt = `You are Newton 1.0, an intelligent next-generation academic AI prototype powered by Firebase AI Logic. You provide:

1. **Clear explanations** of complex academic concepts
2. **Step-by-step guidance** for assignments and projects  
3. **Study strategies** and learning techniques
4. **Research assistance** and source evaluation
5. **Academic writing** support and feedback
6. **Problem-solving** approaches for coursework

FIREBASE AI LOGIC FEATURES:
- **Real-time processing** with Firebase infrastructure
- **Scalable AI responses** backed by Google Cloud
- **Secure API handling** through Firebase services
- **Cross-device synchronization** via Firebase

FORMATTING GUIDELINES:
- **Code blocks**: Always wrap code in triple backticks with language specification (e.g., \`\`\`python, \`\`\`javascript, \`\`\`sql)
- **Math problems**: Use clear step-by-step format with numbered steps and proper mathematical notation
- **Inline code**: Use single backticks for short code snippets or variable names
- **Lists**: Use numbered lists for step-by-step solutions, bullet points for general lists
- **Emphasis**: Use **bold** for important concepts and *italics* for emphasis

MATH PROBLEM FORMAT:
When solving math problems, use this structure:
1. **Given**: State what's given in the problem
2. **Find**: State what needs to be found
3. **Solution**:
   Step 1: [First step with explanation]
   Step 2: [Second step with explanation]
   ...
4. **Answer**: [Final answer with units if applicable]

CODE FORMATTING:
- Always specify the programming language in code blocks
- Include comments explaining complex logic
- Use proper indentation and formatting
- For algorithms, explain the approach before showing code
- Include test cases and examples when appropriate
- Write executable code snippets that demonstrate the concept

Guidelines:
- Be encouraging and supportive
- Break down complex topics into understandable parts
- Provide examples when helpful
- Ask clarifying questions when needed
- Maintain an academic tone while being approachable
- Focus on learning and understanding over just answers
- **Always reference previous topics when relevant** - if the user asks follow-up questions, acknowledge what was discussed before
- **Build upon previous explanations** - don't repeat information unless asked
- **Maintain conversation continuity** - use phrases like "As we discussed earlier..." or "Building on your previous question about..."
- **Handle ambiguous references** - if the user says "what about X?" or "how about Y?", refer to the conversation history to understand the context
- **Code execution requests** - if users ask to run/execute code, explain that they should use IDEs like VS Code, Cursor, or online compilers like Replit`;

    let fullPrompt = basePrompt;
    
    if (context) {
      fullPrompt += `\n\nAdditional Context: ${context}`;
    }
    
    if (conversationHistory) {
      fullPrompt += conversationHistory;
    }
    
    return fullPrompt;
  }
}

// Mock Provider (Fallback)
class MockProvider implements AIProvider {
  name = 'Mock Academic Assistant (Firebase AI Logic Fallback)';
  
  isAvailable(): boolean {
    return true;
  }

  async generateResponse(_message: string, _context?: string, _conversationHistory?: string): Promise<AIResponse> {
    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if this is a flashcard generation request
    const isFlashcardRequest = _message.toLowerCase().includes('flashcard') || 
                              _message.toLowerCase().includes('generate') ||
                              _message.toLowerCase().includes('create') ||
                              _message.toLowerCase().includes('json');

    if (isFlashcardRequest) {
      // Return a proper JSON response for flashcard requests
      const flashcardResponse = {
        "flashcards": [
          {
            "question": "What is Firebase AI Logic?",
            "answer": "Firebase AI Logic is currently unavailable. This is a fallback response. Please check your API configuration and try again.",
            "category": "Firebase AI",
            "difficulty": "medium",
            "tags": ["firebase", "ai-logic", "fallback"]
          }
        ]
      };
      
      return {
        content: JSON.stringify(flashcardResponse),
        model: 'mock-firebase-ai-logic',
        provider: 'Mock (Firebase AI Logic Fallback)'
      };
    }

    const responses = [
      "I'm currently using Firebase AI Logic fallback mode. The main AI service is temporarily unavailable.",
      "Firebase AI Logic is currently offline. This is a temporary fallback response.",
      "The Firebase AI Logic service is being updated. Please try again in a few moments."
    ];

    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    
    return {
      content: randomResponse,
      model: 'mock-firebase-ai-logic',
      provider: 'Mock (Firebase AI Logic Fallback)'
    };
  }
}

// Firebase AI Logic Service Manager
export class FirebaseAILogicService {
  private providers: AIProvider[] = [];
  private currentProvider: AIProvider | null = null;

  constructor() {
    this.initializeProviders();
    this.selectBestProvider();
  }

  private initializeProviders() {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    
    // Add Firebase AI Logic provider if API key is available
    if (apiKey) {
      this.providers.push(new FirebaseAILogicProvider(apiKey));
      console.log('🔑 Firebase AI Logic provider added');
    } else {
      console.warn('⚠️  Gemini API key not found for Firebase AI Logic');
    }

    // Always add mock as fallback
    this.providers.push(new MockProvider());
  }

  private selectBestProvider() {
    this.currentProvider = this.providers.find(provider => provider.isAvailable()) || null;
    console.log(`🎯 Selected Firebase AI Logic provider: ${this.currentProvider?.name || 'None'}`);
  }

  async generateResponse(_message: string, _context?: string, _conversationHistory?: string): Promise<AIResponse> {
    if (!this.currentProvider) {
      throw new Error('No Firebase AI Logic provider available');
    }

    try {
      return await this.currentProvider.generateResponse(_message, _context, _conversationHistory);
    } catch (error) {
      console.error(`❌ Error with ${this.currentProvider.name}:`, error);
      
      // Try fallback providers
      for (const provider of this.providers) {
        if (provider !== this.currentProvider && provider.isAvailable()) {
          console.log(`🔄 Falling back to ${provider.name}`);
          try {
            return await provider.generateResponse(_message, _context, _conversationHistory);
          } catch (fallbackError) {
            console.error(`❌ Fallback ${provider.name} also failed:`, fallbackError);
          }
        }
      }
      
      throw new Error('All Firebase AI Logic providers failed');
    }
  }

  getCurrentProvider(): string {
    return this.currentProvider?.name || 'None';
  }

  getAvailableProviders(): string[] {
    return this.providers
      .filter(provider => provider.isAvailable())
      .map(provider => provider.name);
  }

  // Test Firebase AI Logic connection
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.generateResponse("Hello, is Firebase AI Logic working?");
      console.log('✅ Firebase AI Logic connection test successful:', response.content.substring(0, 50));
      return true;
    } catch (error) {
      console.error('❌ Firebase AI Logic connection test failed:', error);
      return false;
    }
  }

  // Get service status
  getServiceStatus() {
    return {
      currentProvider: this.getCurrentProvider(),
      availableProviders: this.getAvailableProviders(),
      isFirebaseAIEnabled: this.providers.some(p => p.name.includes('Firebase AI Logic')),
      isFallbackActive: this.currentProvider?.name.includes('Mock') || false
    };
  }
}

// Export singleton instance
export const firebaseAILogicService = new FirebaseAILogicService();
