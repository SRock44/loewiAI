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

// this is the AI provider that talks to google's gemini API
// it handles all the AI requests - chat messages, flashcard generation, etc.
// we prioritize gemini-2.5-flash which is the latest fast model, with fallbacks to 2.0 and 1.5 models
class FirebaseAILogicProvider implements AIProvider {
  name = 'Firebase AI Logic (Gemini)';
  private genAI: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;
  private apiKey: string;
  private currentModelName: string = '';
  private availableModels: string[] = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-001',
    'gemini-2.0-flash-001',
    'gemini-2.0-flash'
  ];
  private triedModels: Set<string> = new Set();

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    // initialize async so we don't block the app startup
    this.initializeFirebaseAIAsync();
  }

  private getGenerationConfig(): GenerationConfig {
    return {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024, // Reduced from 2048 to save token usage while maintaining quality
    };
  }

  private trySwitchModel(modelName: string): boolean {
    if (!this.genAI) return false;
    try {
      this.model = this.genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: this.getGenerationConfig()
      });
      this.currentModelName = modelName;
      console.log(`✅ Switched to model: ${modelName}`);
      return true;
    } catch (error) {
      console.warn(`⚠️ Failed to switch to model ${modelName}:`, error);
      return false;
    }
  }

  private initializeFirebaseAIAsync() {
    // initialize in the background - if it fails, we'll just log it
    // the app can still work, just AI features won't be available
    this.initializeFirebaseAI().catch(error => {
      console.error('❌ Async Firebase AI Logic initialization failed:', error);
    });
  }

  private async initializeFirebaseAI() {
    if (!this.apiKey) {
      console.warn('Gemini API key not provided for Firebase AI Logic');
      return;
    }

    try {
      // create the google generative AI client with our API key
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      
      // try different models in order - if one doesn't work, try the next
      // prioritizes gemini-2.5-flash (latest), with gemini-2.0 models as backups
      // each model is tried until one successfully initializes
      let modelInitialized = false;
      for (const modelName of this.availableModels) {
        try {
          this.model = this.genAI.getGenerativeModel({ 
            model: modelName,
            generationConfig: this.getGenerationConfig()
          });
          this.currentModelName = modelName;
          this.triedModels.add(modelName);
          modelInitialized = true;
          console.log(`✅ Initialized Firebase AI Logic with model: ${modelName}`);
          break;
        } catch (modelError) {
          console.warn(`⚠️ Failed to initialize Firebase AI Logic model ${modelName}:`, modelError);
        }
      }

      if (!modelInitialized) {
        throw new Error('All Firebase AI Logic models failed to initialize');
      }
    } catch (error) {
      console.error('❌ Failed to initialize Firebase AI Logic:', error);
      this.genAI = null;
      this.model = null;
    }
  }

  isAvailable(): boolean {
    return this.genAI !== null && this.model !== null;
  }

  // main function that sends a message to the AI and gets a response back
  // _context is document content, _conversationHistory is previous messages
  async generateResponse(_message: string, _context?: string, _conversationHistory?: string): Promise<AIResponse> {
    if (!this.isAvailable()) {
      throw new Error('Firebase AI Logic is not available');
    }

    // retry logic - sometimes the API is overloaded (503) or we hit rate limits (429)
    // we retry up to 3 times with exponential backoff (wait longer each time)
    const maxRetries = 3;
    const baseDelay = 1000;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // build the full prompt - includes system instructions, document context,
        // conversation history, personalization, and the user's current message
        const systemPrompt = await this.buildFirebaseAIPrompt(_context, _conversationHistory);
        const fullPrompt = `${systemPrompt}\n\nUser: ${_message}`;

        // send to gemini API and get response
        const result = await this.model!.generateContent(fullPrompt);
        const response = await result.response;
        const content = response.text();

        return {
          content: content,
          model: this.currentModelName || 'gemini-2.5-flash',
          provider: 'Firebase AI Logic'
        };
      } catch (error) {
        console.error(`❌ Firebase AI Logic error (attempt ${attempt}/${maxRetries}):`, error);
        
        // Check if this is a quota exhaustion error (not just rate limiting)
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isQuotaExhausted = errorMessage.includes('quota') && 
                                 (errorMessage.includes('limit: 0') || 
                                  errorMessage.includes('exceeded your current quota') ||
                                  errorMessage.includes('FreeTier'));
        
        // Check if this is a model not found error (404)
        const isModelNotFound = errorMessage.includes('404') || 
                                errorMessage.includes('not found') ||
                                errorMessage.includes('is not found for API version');
        
        // If model not found, try switching to another model immediately
        if (isModelNotFound && this.currentModelName) {
          console.warn(`⚠️ Model ${this.currentModelName} not found or unavailable, trying alternative models...`);
          this.triedModels.add(this.currentModelName);
          
          // Try other models that haven't been tried yet
          const untriedModels = this.availableModels.filter(m => !this.triedModels.has(m));
          let switched = false;
          
          for (const modelName of untriedModels) {
            if (this.trySwitchModel(modelName)) {
              switched = true;
              break; // Break out of model loop, continue to retry request
            }
          }
          
          // If we couldn't switch models, all models are unavailable - fall back
          if (!switched) {
            console.error('❌ All Firebase AI Logic models are unavailable - falling back');
            throw new Error(`Firebase AI Logic models unavailable: ${errorMessage}`);
          }
          // Continue to retry with the new model (this will restart the loop)
          continue;
        }
        
        // If quota is exhausted for current model, try switching to another model
        if (isQuotaExhausted && this.currentModelName) {
          console.warn(`⚠️ Quota exhausted for model ${this.currentModelName}, trying alternative models...`);
          this.triedModels.add(this.currentModelName);
          
          // Try other models that haven't been tried yet
          const untriedModels = this.availableModels.filter(m => !this.triedModels.has(m));
          let switched = false;
          
          for (const modelName of untriedModels) {
            if (this.trySwitchModel(modelName)) {
              switched = true;
              break; // Break out of model loop, continue to retry request
            }
          }
          
          // If we couldn't switch models, all models have quota issues - fall back
          if (!switched) {
            console.error('❌ All Firebase AI Logic models have quota exhausted - falling back');
            throw new Error(`Firebase AI Logic quota exhausted for all models: ${errorMessage}`);
          }
          // Continue to retry with the new model (this will restart the loop)
          continue;
        }
        
        // if it's a rate limit or service overload error (but not quota exhaustion), wait and retry
        // exponential backoff means we wait 1s, then 2s, then 4s
        if (error instanceof Error && (error.message.includes('503') || error.message.includes('429')) && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          console.log(`⏳ Retrying in ${delay}ms due to service overload or rate limit...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw new Error(`Firebase AI Logic error: ${error}`);
      }
    }
    
    throw new Error('Firebase AI Logic failed after all retry attempts');
  }

  private async buildFirebaseAIPrompt(context?: string, conversationHistory?: string): Promise<string> {
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
  - IMPORTANT: Use actual newlines in code blocks, NOT HTML tags like <br/> or <br>
  - Use proper markdown formatting with triple backticks
  - Preserve indentation using spaces, not HTML entities
- **Math problems**: Use clear step-by-step format with numbered steps and proper mathematical notation
- **Inline code**: Use single backticks for short code snippets or variable names
- **Lists**: Use numbered lists for step-by-step solutions, bullet points for general lists
- **Emphasis**: Use **bold** for important concepts and *italics* for emphasis
- **CRITICAL**: Never use HTML tags (<br/>, <br>, &nbsp;, etc.) in your responses. Use plain markdown only.

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

RESPONSE EFFICIENCY:
- **Be concise and direct** - aim for quality over quantity
- **Get to the point quickly** - start with the core answer, then add context if needed
- **Avoid unnecessary elaboration** - explain clearly but briefly
- **Use lists and formatting** to convey information efficiently
- **Prioritize essential information** - focus on what the user needs to know
- **Keep responses focused** - avoid tangents or excessive background unless specifically requested

Guidelines:
- Be encouraging and supportive
- Break down complex topics into understandable parts (but concisely)
- Provide examples when helpful (keep them brief)
- Ask clarifying questions when needed
- Maintain an academic tone while being approachable
- Focus on learning and understanding over just answers
- **Always reference previous topics when relevant** - if the user asks follow-up questions, acknowledge what was discussed before
- **Build upon previous explanations** - don't repeat information unless asked
- **Maintain conversation continuity** - use phrases like "As we discussed earlier..." or "Building on your previous question about..."
- **Handle ambiguous references** - if the user says "what about X?" or "how about Y?", refer to the conversation history to understand the context
- **Code execution requests** - if users ask to run/execute code, explain that they should use IDEs like VS Code, Cursor, or online compilers like Replit`;

    // get user profile information for personalization
    const userProfileContext = await UserProfileService.buildPersonalizationContext();
    
    let fullPrompt = basePrompt;
    
    // add personalization context if available
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
            "question": "What is the current status of the AI service?",
            "answer": "The AI service is temporarily unavailable due to quota limits or high demand. This is a fallback response. Please try again in a few minutes when the service is restored.",
            "category": "System Status",
            "difficulty": "easy",
            "tags": ["service-status", "fallback", "ai-unavailable"]
          },
          {
            "question": "What should I do if I see this fallback message?",
            "answer": "This indicates the AI service has hit its quota limits or is experiencing high demand. Wait a few minutes and try again, or contact support if the issue persists.",
            "category": "Troubleshooting",
            "difficulty": "easy",
            "tags": ["troubleshooting", "support", "quota-limits"]
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
      "⚠️ **AI Service Status**: I'm currently operating in limited mode due to API quota exhaustion. The Gemini AI service has reached its free tier limits.\n\n**What this means:**\n- The primary AI service is temporarily unavailable\n- You're seeing this fallback response\n- Your data and chat history are safe\n\n**What you can do:**\n- Wait 24 hours for quota limits to reset\n- Check your Gemini API quota at: https://ai.dev/usage?tab=rate-limit\n- Consider upgrading your API plan for higher limits\n\n**Note:** This is a temporary situation and the service should resume automatically once quotas reset.",
      "🔧 **Service Notice**: The AI service is currently unavailable due to quota limitations. The free tier quota for Gemini models has been exhausted.\n\n**Current Status:**\n- ✅ Your chat history is preserved\n- ✅ All features will work once service is restored\n- ⚠️ AI responses are limited until quota resets\n\n**Next Steps:**\n- The quota typically resets every 24 hours\n- Monitor service status at: https://ai.dev/usage\n- The service will automatically resume when available\n\nThank you for your patience!",
      "📊 **AI Service Update**: I'm in fallback mode because the Gemini API has reached its quota limits for the free tier.\n\n**Understanding Quota Limits:**\n- Free tier has daily and per-minute request limits\n- Once exceeded, service pauses until the next reset period\n- This usually resets every 24 hours\n\n**Your Options:**\n1. **Wait**: Service typically auto-restores within 24 hours\n2. **Check Status**: Visit https://ai.dev/usage?tab=rate-limit\n3. **Upgrade**: Consider a paid API plan for higher limits\n\n**Good News:** All your conversations and data remain intact and will work normally once service resumes!"
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
    } else {
      console.warn('⚠️  Gemini API key not found for Firebase AI Logic');
    }

    // Always add mock as fallback
    this.providers.push(new MockProvider());
  }

  private selectBestProvider() {
    this.currentProvider = this.providers.find(provider => provider.isAvailable()) || null;
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
      await this.generateResponse("Hello, is Firebase AI Logic working?");
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
