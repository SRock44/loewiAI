import { GoogleGenerativeAI, GenerativeModel, GenerationConfig } from '@google/generative-ai';
import { UserProfileService } from './userProfileService';

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

  async generateResponse(_message: string, _context?: string, _conversationHistory?: string): Promise<AIResponse> {
    if (!this.isAvailable()) {
      throw new Error('Gemini AI is not available');
    }

    try {
      // Build the prompt with academic context and conversation history
      const systemPrompt = this.buildAcademicPrompt(_context, _conversationHistory);
      const fullPrompt = `${systemPrompt}\n\nUser: ${_message}`;

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

  private buildAcademicPrompt(context?: string, conversationHistory?: string): string {
    const basePrompt = `You are Newton 1.0, an intelligent next-generation academic AI prototype designed to help students and researchers with their academic work. You provide:

1. **Clear explanations** of complex academic concepts
2. **Step-by-step guidance** for assignments and projects  
3. **Study strategies** and learning techniques
4. **Research assistance** and source evaluation
5. **Academic writing** support and feedback
6. **Problem-solving** approaches for coursework

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

    // Get user profile information for personalization
    const userProfileContext = UserProfileService.buildPersonalizationContext();
    
    let fullPrompt = basePrompt;
    
    if (userProfileContext) {
      fullPrompt += `\n\n${userProfileContext}`;
    }
    
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
  name = 'Mock Academic Assistant';
  
  isAvailable(): boolean {
    return true;
  }

  async generateResponse(_message: string, _context?: string, _conversationHistory?: string): Promise<AIResponse> {
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
    
    // Add conversation context awareness to mock responses
    let contextualResponse = randomResponse;
    if (_conversationHistory && _conversationHistory.includes('CONVERSATION HISTORY')) {
      contextualResponse = "I can see from our previous conversation that you're building on earlier topics. " + randomResponse;
    }
    
    return {
      content: contextualResponse,
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

  async generateResponse(_message: string, _context?: string, _conversationHistory?: string): Promise<AIResponse> {
    if (!this.currentProvider) {
      throw new Error('No AI provider available');
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
