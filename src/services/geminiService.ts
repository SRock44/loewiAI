import { GoogleGenerativeAI, GenerativeModel, GenerationConfig } from '@google/generative-ai';

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
  generateResponse(message: string, context?: string): Promise<AIResponse>;
  isAvailable(): boolean;
}

// Google Gemini Provider
class GeminiProvider implements AIProvider {
  name = 'Google Gemini';
  private genAI: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.initializeGemini();
  }

  private initializeGemini() {
    if (!this.apiKey) {
      console.warn('Gemini API key not provided');
      return;
    }

    try {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      
      // Initialize the model with configuration
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
      
      console.log('✅ Gemini AI initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Gemini AI:', error);
      this.genAI = null;
      this.model = null;
    }
  }

  isAvailable(): boolean {
    return this.genAI !== null && this.model !== null;
  }

  async generateResponse(message: string, context?: string): Promise<AIResponse> {
    if (!this.isAvailable()) {
      throw new Error('Gemini AI is not available');
    }

    try {
      // Build the prompt with academic context
      const systemPrompt = this.buildAcademicPrompt(context);
      const fullPrompt = `${systemPrompt}\n\nUser: ${message}`;

      console.log('🤖 Sending request to Gemini...');
      
      const result = await this.model!.generateContent(fullPrompt);
      const response = await result.response;
      const content = response.text();

      console.log('✅ Gemini response received');

      return {
        content: content,
        model: 'gemini-1.5-flash',
        provider: 'Google Gemini'
      };
    } catch (error) {
      console.error('❌ Gemini API error:', error);
      throw new Error(`Gemini API error: ${error}`);
    }
  }

  private buildAcademicPrompt(context?: string): string {
    const basePrompt = `You are an intelligent Academic AI Assistant designed to help students and researchers with their academic work. You provide:

1. **Clear explanations** of complex academic concepts
2. **Step-by-step guidance** for assignments and projects  
3. **Study strategies** and learning techniques
4. **Research assistance** and source evaluation
5. **Academic writing** support and feedback
6. **Problem-solving** approaches for coursework

Guidelines:
- Be encouraging and supportive
- Break down complex topics into understandable parts
- Provide examples when helpful
- Ask clarifying questions when needed
- Maintain an academic tone while being approachable
- Focus on learning and understanding over just answers`;

    if (context) {
      return `${basePrompt}\n\nAdditional Context: ${context}`;
    }
    
    return basePrompt;
  }
}

// Mock Provider (Fallback)
class MockProvider implements AIProvider {
  name = 'Mock Academic Assistant';
  
  isAvailable(): boolean {
    return true;
  }

  async generateResponse(message: string, context?: string): Promise<AIResponse> {
    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 1000));

    const responses = [
      "That's an excellent academic question! Let me help you understand this concept step by step.",
      "I can see you're working on an important academic topic. Here's how I'd approach this problem...",
      "Great question! This is a fundamental concept that builds the foundation for more advanced topics.",
      "I'd be happy to help you with this academic challenge. Let's break it down into manageable parts.",
      "This is a common area where students need extra support. Here's my recommended approach..."
    ];

    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    
    return {
      content: randomResponse,
      model: 'mock-academic-assistant',
      provider: 'Mock'
    };
  }
}

// AI Service Manager
export class GeminiAIService {
  private providers: AIProvider[] = [];
  private currentProvider: AIProvider | null = null;

  constructor() {
    this.initializeProviders();
    this.selectBestProvider();
  }

  private initializeProviders() {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    
    // Add Gemini provider if API key is available
    if (apiKey) {
      this.providers.push(new GeminiProvider(apiKey));
      console.log('🔑 Gemini API key found, provider added');
    } else {
      console.warn('⚠️  Gemini API key not found in environment variables');
    }

    // Always add mock as fallback
    this.providers.push(new MockProvider());
  }

  private selectBestProvider() {
    this.currentProvider = this.providers.find(provider => provider.isAvailable()) || null;
    console.log(`🎯 Selected AI provider: ${this.currentProvider?.name || 'None'}`);
  }

  async generateResponse(message: string, context?: string): Promise<AIResponse> {
    if (!this.currentProvider) {
      throw new Error('No AI provider available');
    }

    try {
      return await this.currentProvider.generateResponse(message, context);
    } catch (error) {
      console.error(`❌ Error with ${this.currentProvider.name}:`, error);
      
      // Try fallback providers
      for (const provider of this.providers) {
        if (provider !== this.currentProvider && provider.isAvailable()) {
          console.log(`🔄 Falling back to ${provider.name}`);
          try {
            return await provider.generateResponse(message, context);
          } catch (fallbackError) {
            console.error(`❌ Fallback ${provider.name} also failed:`, fallbackError);
          }
        }
      }
      
      throw new Error('All AI providers failed');
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

  // Test Gemini connection
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.generateResponse("Hello, are you working?");
      console.log('✅ Gemini connection test successful:', response.content.substring(0, 50));
      return true;
    } catch (error) {
      console.error('❌ Gemini connection test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const geminiAIService = new GeminiAIService();
