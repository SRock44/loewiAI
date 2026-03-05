import { GoogleGenerativeAI, GenerativeModel, GenerationConfig } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { UserProfileService } from './userProfileService';

interface AIServiceError {
  status?: number;
  code?: string | number;
  statusCode?: number;
  message?: string;
  body?: unknown;
  response?: { data?: unknown };
}

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
  generateFlashcards(_prompt: string): Promise<AIResponse>;
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

  private getGenerationConfig(isFlashcardRequest: boolean = false): GenerationConfig {
    return {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      // Use more tokens for flashcard generation to ensure comprehensive Q&A pairs
      // Regular conversations stay concise to save tokens
      // Increased maxOutputTokens for flashcard generation to handle longer responses
      maxOutputTokens: isFlashcardRequest ? 8192 : 1024,
    };
  }

  private trySwitchModel(modelName: string, isFlashcardRequest: boolean = false): boolean {
    if (!this.genAI) return false;
    try {
      this.model = this.genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: this.getGenerationConfig(isFlashcardRequest)
      });
      this.currentModelName = modelName;
      return true;
    } catch (error) {
      return false;
    }
  }

  private isFlashcardOrStructuredRequest(message?: string): boolean {
    if (!message) return false;
    const lowerMessage = message.toLowerCase();
    // Check for flashcard generation keywords - be very permissive
    return lowerMessage.includes('flashcard') ||
           (lowerMessage.includes('generate') && (lowerMessage.includes('flashcard') || lowerMessage.includes('json'))) ||
           lowerMessage.includes('respond with only valid json') ||
           lowerMessage.includes('must respond with only') ||
           lowerMessage.includes('expert educational content creator') ||
           lowerMessage.includes('required json format') ||
           lowerMessage.includes('you are an expert educational') ||
           lowerMessage.includes('high-quality flashcards') ||
           lowerMessage.includes('educational content creator');
  }

  private initializeFirebaseAIAsync() {
    // initialize in the background - if it fails, the app can still work
    // just AI features won't be available
    this.initializeFirebaseAI().catch(() => {
      // Initialization failed silently
    });
  }

  private async initializeFirebaseAI() {
    if (!this.apiKey) {
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
            generationConfig: this.getGenerationConfig(false)
          });
          this.currentModelName = modelName;
          this.triedModels.add(modelName);
          modelInitialized = true;
          break;
        } catch (modelError) {
          // Model initialization failed, try next
        }
      }

      if (!modelInitialized) {
        throw new Error('All Firebase AI Logic models failed to initialize');
      }
    } catch (error) {
      this.genAI = null;
      this.model = null;
    }
  }

  isAvailable(): boolean {
    return this.genAI !== null && this.model !== null;
  }

  // Direct flashcard generation - bypasses system prompt and uses flashcard-specific config
  async generateFlashcards(_prompt: string): Promise<AIResponse> {
    if (!this.isAvailable()) {
      throw new Error('Firebase AI Logic is not available');
    }

    // Create a model instance specifically for flashcard generation with higher token limit
    if (!this.genAI) {
      throw new Error('Firebase AI Logic is not initialized');
    }

    const flashcardModel = this.genAI.getGenerativeModel({
      model: this.currentModelName || 'gemini-2.5-flash',
      generationConfig: this.getGenerationConfig(true) // true = isFlashcardRequest
    });

    const maxRetries = 3;
    const baseDelay = 1000;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Use the prompt directly without adding system prompt - the flashcard prompt is self-contained
        // Ensure we wait for the complete response - generateContent returns a promise that resolves when complete
        const result = await flashcardModel.generateContent(_prompt);
        
        // Wait for the full response to be available
        const response = await result.response;
        
        // Get the complete text content - this should wait for the full response
        const content = response.text();
        
        // Verify we got content - if empty or too short, might indicate incomplete response
        if (!content || content.trim().length < 10) {
          throw new Error('Received empty or incomplete response from AI');
        }

        return {
          content: content,
          model: this.currentModelName || 'gemini-2.5-flash',
          provider: 'Firebase AI Logic'
        };
      } catch (error: unknown) {
        const err = error as AIServiceError;
        // Check for fallback-worthy error codes (400, 403, 404, 429, 500, 503, 504)
        const errorCode = Number(err?.status || err?.code || err?.statusCode);
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Check if this is a fallback-worthy error (rate limit, quota, server errors)
        const isFallbackError = [400, 403, 404, 429, 500, 503, 504].includes(errorCode) ||
                                errorMessage.includes('429') ||
                                errorMessage.includes('403') ||
                                errorMessage.includes('500') ||
                                errorMessage.includes('503') ||
                                errorMessage.toLowerCase().includes('quota') ||
                                errorMessage.toLowerCase().includes('rate limit');
        
        // Check if this is a quota exhaustion error (not just rate limiting)
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
          this.triedModels.add(this.currentModelName);
          
          const untriedModels = this.availableModels.filter(m => !this.triedModels.has(m));
          let switched = false;
          
          for (const modelName of untriedModels) {
            if (this.trySwitchModel(modelName, true)) {
              switched = true;
              // Retry with new model
              continue;
            }
          }
          
          if (!switched) {
            throw new Error(`Firebase AI Logic models unavailable: ${errorMessage}`);
          }
          continue;
        }
        
        // If quota is exhausted, try switching models
        if (isQuotaExhausted && this.currentModelName) {
          this.triedModels.add(this.currentModelName);
          
          const untriedModels = this.availableModels.filter(m => !this.triedModels.has(m));
          let switched = false;
          
          for (const modelName of untriedModels) {
            if (this.trySwitchModel(modelName, true)) {
              switched = true;
              continue;
            }
          }
          
          if (!switched) {
            throw new Error(`Firebase AI Logic quota exhausted for all models: ${errorMessage}`);
          }
          continue;
        }
        
        // if it's a rate limit or service overload error, wait and retry with exponential backoff
        // but if we've exhausted retries, throw to trigger fallback
        if (isFallbackError && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          // Wait longer for flashcard generation to ensure server has time to process
          const extendedDelay = delay * 2; // Double the delay for flashcard generation
          await new Promise(resolve => setTimeout(resolve, extendedDelay));
          continue;
        }
        
        // If it's an incomplete response error, retry with longer wait
        if (error instanceof Error && (error.message.includes('empty') || error.message.includes('incomplete')) && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1) * 3; // Triple the delay for incomplete responses
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // If it's a fallback-worthy error and we've exhausted retries, throw to trigger fallback
        if (isFallbackError && attempt >= maxRetries) {
          throw new Error(`Firebase AI Logic error (${errorCode || 'unknown'}): ${errorMessage}`);
        }
        
        throw new Error(`Firebase AI Logic flashcard error: ${error}`);
      }
    }
    
    throw new Error('Firebase AI Logic flashcard generation failed after all retry attempts');
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
    const isFlashcardRequest = this.isFlashcardOrStructuredRequest(_message);
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // build the full prompt - includes system instructions, document context,
        // conversation history, personalization, and the user's current message
        const systemPrompt = await this.buildFirebaseAIPrompt(_context, _conversationHistory, _message);
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
      } catch (error: unknown) {
        const err = error as AIServiceError;
        // Check for fallback-worthy error codes (429, 403, 500, 503)
        const errorCode = Number(err?.status || err?.code || err?.statusCode);
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Check if this is a fallback-worthy error (rate limit, quota, server errors)
        const isFallbackError = [429, 403, 500, 503].includes(errorCode) ||
                                errorMessage.includes('429') ||
                                errorMessage.includes('403') ||
                                errorMessage.includes('500') ||
                                errorMessage.includes('503') ||
                                errorMessage.toLowerCase().includes('quota') ||
                                errorMessage.toLowerCase().includes('rate limit');
        
        // Check if this is a quota exhaustion error (not just rate limiting)
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
          this.triedModels.add(this.currentModelName);
          
          // Try other models that haven't been tried yet
          const untriedModels = this.availableModels.filter(m => !this.triedModels.has(m));
          let switched = false;
          
          for (const modelName of untriedModels) {
            if (this.trySwitchModel(modelName, isFlashcardRequest)) {
              switched = true;
              break; // Break out of model loop, continue to retry request
            }
          }
          
          // If we couldn't switch models, all models are unavailable - fall back
          if (!switched) {
            throw new Error(`Firebase AI Logic models unavailable: ${errorMessage}`);
          }
          // Continue to retry with the new model (this will restart the loop)
          continue;
        }
        
        // If quota is exhausted for current model, try switching to another model
        if (isQuotaExhausted && this.currentModelName) {
          this.triedModels.add(this.currentModelName);
          
          // Try other models that haven't been tried yet
          const untriedModels = this.availableModels.filter(m => !this.triedModels.has(m));
          let switched = false;
          
          for (const modelName of untriedModels) {
            if (this.trySwitchModel(modelName, isFlashcardRequest)) {
              switched = true;
              break; // Break out of model loop, continue to retry request
            }
          }
          
          // If we couldn't switch models, all models have quota issues - fall back
          if (!switched) {
            throw new Error(`Firebase AI Logic quota exhausted for all models: ${errorMessage}`);
          }
          // Continue to retry with the new model (this will restart the loop)
          continue;
        }
        
        // if it's a rate limit or service overload error (but not quota exhaustion), wait and retry
        // exponential backoff means we wait 1s, then 2s, then 4s
        // but if we've exhausted retries, throw to trigger fallback
        if (isFallbackError && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // If it's a fallback-worthy error and we've exhausted retries, throw to trigger fallback
        if (isFallbackError && attempt >= maxRetries) {
          throw new Error(`Firebase AI Logic error (${errorCode || 'unknown'}): ${errorMessage}`);
        }
        
        throw new Error(`Firebase AI Logic error: ${error}`);
      }
    }
    
    throw new Error('Firebase AI Logic failed after all retry attempts');
  }

  private async buildFirebaseAIPrompt(context?: string, conversationHistory?: string, userMessage?: string): Promise<string> {
    const promptStart = `You are Newton 1.0, an intelligent next-generation academic AI prototype powered by Firebase AI Logic. You provide:

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

RESPONSE EFFICIENCY:`;

    // Build response efficiency section based on request type
    const isStructuredRequest = this.isFlashcardOrStructuredRequest(userMessage);
    const responseEfficiencySection = isStructuredRequest ? `
- **CRITICAL FOR FLASHCARD GENERATION**: You are creating educational flashcards. This is VERY DIFFERENT from regular chat.
- **MUST provide COMPREHENSIVE, DETAILED answers** - students need complete explanations to learn
- **Do NOT be concise** - flashcards require thorough answers that fully explain concepts
- **Each flashcard answer must be educational and complete** - include examples, context, and explanations
- **Questions should be specific and test understanding** - avoid generic questions like "What is the main topic?"
- **Answers must be detailed enough for independent learning** - students study from these flashcards
- **IGNORE any conciseness guidelines** - comprehensive answers are required for flashcards
` : `
- **Be concise and direct** - aim for quality over quantity
- **Get to the point quickly** - start with the core answer, then add context if needed
- **Avoid unnecessary elaboration** - explain clearly but briefly
- **Use lists and formatting** to convey information efficiently
- **Prioritize essential information** - focus on what the user needs to know
- **Keep responses focused** - avoid tangents or excessive background unless specifically requested
`;

    const basePrompt = `${promptStart}${responseEfficiencySection}

Guidelines:
- Be encouraging and supportive
- Break down complex topics into understandable parts${isStructuredRequest ? '' : ' (but concisely)'}
- Provide examples when helpful${isStructuredRequest ? ' (provide comprehensive examples)' : ' (keep them brief)'}
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

// Groq Provider (Fallback for Gemini)
class GroqProvider implements AIProvider {
  name = 'Groq (Moonshot AI Kimi2)';
  private groqClient: Groq | null = null;
  private apiKey: string;
  private modelName: string = 'moonshotai/kimi-k2-instruct-0905';
  
  // Set model name (supports multiple Groq models)
  setModel(modelName: string) {
    this.modelName = modelName;
    // Update display name based on model
    if (modelName === 'moonshotai/kimi-k2-instruct-0905') {
      this.name = 'Groq (KimiK2)';
    } else if (modelName === 'llama-3.3-70b-versatile') {
      this.name = 'Groq (Llama 3.3 70B Versatile)';
    } else if (modelName === 'openai/gpt-oss-120b') {
      this.name = 'Groq (GPT-OSS 120B)';
    } else {
      this.name = `Groq (${modelName})`;
    }
  }
  
  getModel(): string {
    return this.modelName;
  }

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.initializeGroq();
  }

  private initializeGroq() {
    if (!this.apiKey) {
      return;
    }

    try {
      this.groqClient = new Groq({ 
        apiKey: this.apiKey,
        dangerouslyAllowBrowser: true 
      });
    } catch (error) {
      console.error('Failed to initialize Groq client:', error);
      this.groqClient = null;
    }
  }

  isAvailable(): boolean {
    return this.groqClient !== null;
  }

  private async buildGroqPrompt(context?: string, conversationHistory?: string, _userMessage?: string): Promise<string> {
    // Reuse the same prompt building logic as Gemini for consistency
    const promptStart = `You are Newton 1.0, an intelligent next-generation academic AI prototype. You provide:

1. **Clear explanations** of complex academic concepts
2. **Step-by-step guidance** for assignments and projects  
3. **Study strategies** and learning techniques
4. **Research assistance** and source evaluation
5. **Academic writing** support and feedback
6. **Problem-solving** approaches for coursework

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

    // Get user profile information for personalization
    const userProfileContext = await UserProfileService.buildPersonalizationContext();
    
    let fullPrompt = promptStart;
    
    // Add personalization context if available
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

  async generateResponse(_message: string, _context?: string, _conversationHistory?: string): Promise<AIResponse> {
    if (!this.isAvailable()) {
      throw new Error('Groq is not available');
    }

    try {
      const systemPrompt = await this.buildGroqPrompt(_context, _conversationHistory, _message);
      
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
      
      // Add system prompt
      messages.push({ role: 'system', content: systemPrompt });
      
      // Add user message
      messages.push({ role: 'user', content: _message });

      console.log(`Groq API call - Model: ${this.modelName}, Messages: ${messages.length}`);
      
      // Try the requested model, fallback to moonshot-v1-128k if it fails
      let completion;
      try {
        completion = await this.groqClient!.chat.completions.create({
          messages,
          model: this.modelName,
          temperature: 0.7,
          max_tokens: 2048
        });
      } catch (modelError: unknown) {
        // If model not found, log error and rethrow
        console.error(`Groq model ${this.modelName} not found or not accessible:`, modelError);
        throw modelError;
      }

      const content = completion.choices[0]?.message?.content || '';
      
      if (!content || content.trim().length === 0) {
        throw new Error('Empty response from Groq');
      }

      return {
        content: content,
        model: this.modelName,
        provider: this.name,
        usage: completion.usage ? {
          prompt_tokens: completion.usage.prompt_tokens || 0,
          completion_tokens: completion.usage.completion_tokens || 0,
          total_tokens: completion.usage.total_tokens || 0
        } : undefined
      };
    } catch (error: unknown) {
      const err = error as AIServiceError;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorDetails = err?.response?.data || err?.body || err?.message || error;
      console.error('Groq API error:', {
        message: errorMessage,
        details: errorDetails,
        model: this.modelName,
        status: err?.status || err?.statusCode
      });
      throw new Error(`Groq error: ${errorMessage}`);
    }
  }

  // Vision analysis - uses Llama 4 Scout to fully analyze any type of image
  async analyzeImage(imageBase64: string, mimeType: string): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('Groq is not available');
    }

    const visionModel = 'meta-llama/llama-4-scout-17b-16e-instruct';

    const prompt = `You are an expert image analyst. Analyze this image thoroughly.

First, identify which ONE of these types best describes it:
- TEXT: Typed or printed text (document, article, book page)
- HANDWRITING: Handwritten notes or annotations
- MATH: Mathematical equations, formulas, or problem sets (typed or handwritten)
- DIAGRAM: Flowchart, graph, chart, plot, or scientific figure
- TABLE: Data table, spreadsheet, or structured grid data
- SLIDE: Presentation slide or projected screen content
- PHOTO: Real-world photograph, scene, or object
- MIXED: Clear combination of two or more of the above

Then extract everything useful based on what you found:
- TEXT or HANDWRITING → Transcribe ALL text verbatim, preserving layout and structure.
- MATH → Extract all equations; use LaTeX notation (e.g. $x^2 + y^2 = z^2$) where appropriate. Transcribe any surrounding text too.
- DIAGRAM → Describe what it represents, extract all labels, axis titles, legend entries, and key data values. Explain the relationships or trends shown.
- TABLE → Reproduce the full table in markdown format, preserving all rows, columns, and values.
- SLIDE → Extract the title, all bullet points, and describe any figures, charts, or images on the slide.
- PHOTO → Describe the scene in detail: objects present, any visible text, setting, and anything academically or contextually relevant.
- MIXED → Handle each component using the appropriate method above, clearly separating each section.

Respond in exactly this format:
IMAGE TYPE: [type]
CONTENT:
[your full extraction or description]`;

    const completion = await this.groqClient!.chat.completions.create({
      model: visionModel,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`
              }
            }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 4096
    });

    return completion.choices[0]?.message?.content || '';
  }

  async generateFlashcards(_prompt: string): Promise<AIResponse> {
    if (!this.isAvailable()) {
      throw new Error('Groq is not available');
    }

    try {
      // For flashcards, use the prompt directly as user message
      // The prompt already contains all necessary instructions
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
      
      // Add system message for flashcard generation
      messages.push({ 
        role: 'system', 
        content: 'You are an expert educational content creator. Generate high-quality flashcards in JSON format based on the user\'s request.'
      });
      
      // Add the flashcard generation prompt as user message
      messages.push({ role: 'user', content: _prompt });

      console.log(`Groq flashcard API call - Model: ${this.modelName}`);
      
      // Try the requested model, fallback to moonshot-v1-128k if it fails
      let completion;
      try {
        completion = await this.groqClient!.chat.completions.create({
          messages,
          model: this.modelName,
          temperature: 0.5,
          max_tokens: 8192 // Higher token limit for flashcard generation
        });
      } catch (modelError: unknown) {
        // If model not found, log error and rethrow
        console.error(`Groq model ${this.modelName} not found or not accessible:`, modelError);
        throw modelError;
      }

      const content = completion.choices[0]?.message?.content || '';
      
      if (!content || content.trim().length < 10) {
        throw new Error('Empty or incomplete response from Groq');
      }

      return {
        content: content,
        model: this.modelName,
        provider: this.name,
        usage: completion.usage ? {
          prompt_tokens: completion.usage.prompt_tokens || 0,
          completion_tokens: completion.usage.completion_tokens || 0,
          total_tokens: completion.usage.total_tokens || 0
        } : undefined
      };
    } catch (error: unknown) {
      const err = error as AIServiceError;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorDetails = err?.response?.data || err?.body || err?.message || error;
      console.error('Groq flashcard API error:', {
        message: errorMessage,
        details: errorDetails,
        model: this.modelName,
        status: err?.status || err?.statusCode
      });
      throw new Error(`Groq flashcard error: ${errorMessage}`);
    }
  }
}

// Mock Provider (Fallback)
class MockProvider implements AIProvider {
  name = 'Mock Academic Assistant (Firebase AI Logic Fallback)';
  
  isAvailable(): boolean {
    return true;
  }

  async generateFlashcards(_prompt: string): Promise<AIResponse> {
    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
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

// Model preference type
export type ModelPreference =
  | 'auto'
  | 'kimi2'
  | 'llama-3.3-70b-versatile'
  | 'openai/gpt-oss-120b';

const GROQ_MODEL_BY_PREFERENCE: Record<Exclude<ModelPreference, 'auto'>, string> = {
  kimi2: 'moonshotai/kimi-k2-instruct-0905',
  'llama-3.3-70b-versatile': 'llama-3.3-70b-versatile',
  'openai/gpt-oss-120b': 'openai/gpt-oss-120b'
};

function isDirectGroqPreference(preference: ModelPreference): preference is Exclude<ModelPreference, 'auto'> {
  return preference !== 'auto';
}

// Firebase AI Logic Service Manager
export class FirebaseAILogicService {
  private providers: AIProvider[] = [];
  private currentProvider: AIProvider | null = null;
  private geminiProvider: FirebaseAILogicProvider | null = null;
  private groqProvider: GroqProvider | null = null;
  private modelPreference: ModelPreference = 'auto';

  constructor() {
    this.loadModelPreference();
    this.initializeProviders();
    this.selectBestProvider();
  }
  
  private loadModelPreference() {
    try {
      const saved = localStorage.getItem('newton_ai_model_preference');
      if (
        saved === 'auto' ||
        saved === 'kimi2' ||
        saved === 'llama-3.3-70b-versatile' ||
        saved === 'openai/gpt-oss-120b'
      ) {
        this.modelPreference = saved;
      }
    } catch (error) {
      // localStorage not available, use default
    }
  }
  
  setModelPreference(preference: ModelPreference) {
    this.modelPreference = preference;
    try {
      localStorage.setItem('newton_ai_model_preference', preference);
    } catch (error) {
      // localStorage not available, ignore
    }
    
    // Update Groq model (auto uses KimiK2 as the fallback model; direct modes select explicitly)
    if (this.groqProvider) {
      if (preference === 'auto') {
        this.groqProvider.setModel('moonshotai/kimi-k2-instruct-0905');
      } else {
        this.groqProvider.setModel(GROQ_MODEL_BY_PREFERENCE[preference]);
      }
    }
    
    // Re-select provider based on preference
    this.selectBestProvider();
  }
  
  getModelPreference(): ModelPreference {
    return this.modelPreference;
  }

  private initializeProviders() {
    const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
    const groqApiKey = import.meta.env.VITE_GROQ_API_KEY;
    
    // Add Firebase AI Logic provider (Gemini) if API key is available - PRIMARY
    if (geminiApiKey) {
      this.geminiProvider = new FirebaseAILogicProvider(geminiApiKey);
      this.providers.push(this.geminiProvider);
    }

    // Add Groq provider as fallback for Gemini - SECONDARY
    if (groqApiKey) {
      this.groqProvider = new GroqProvider(groqApiKey);
      // Set model based on preference
      if (this.modelPreference === 'auto') {
        // In auto mode, use KimiK2 as the Groq fallback model (existing behavior)
        this.groqProvider.setModel('moonshotai/kimi-k2-instruct-0905');
      } else {
        this.groqProvider.setModel(GROQ_MODEL_BY_PREFERENCE[this.modelPreference]);
      }
      this.providers.push(this.groqProvider);
    }

    // Always add mock as final fallback - TERTIARY
    this.providers.push(new MockProvider());
  }

  private selectBestProvider() {
    // If user prefers a direct Groq model, use Groq directly (if available)
    if (isDirectGroqPreference(this.modelPreference) && this.groqProvider && this.groqProvider.isAvailable()) {
      this.currentProvider = this.groqProvider;
      return;
    }
    
    // Otherwise, use Gemini (auto mode) or first available provider
    this.currentProvider = this.providers.find(provider => provider.isAvailable()) || null;
  }

  async generateFlashcards(prompt: string): Promise<AIResponse> {
    if (!this.currentProvider) {
      throw new Error('No Firebase AI Logic provider available');
    }

    try {
      return await this.currentProvider.generateFlashcards(prompt);
    } catch (error) {
      // In auto mode, try fallback providers
      // In kimi2 mode, only try other providers if Groq fails
      if (this.modelPreference === 'auto') {
      // Try fallback providers
      for (const provider of this.providers) {
        if (provider !== this.currentProvider && provider.isAvailable()) {
          try {
            return await provider.generateFlashcards(prompt);
          } catch (fallbackError) {
            // Fallback failed, try next
            }
          }
        }
      }
      
      throw new Error('All Firebase AI Logic providers failed for flashcard generation');
    }
  }

  async generateResponse(_message: string, _context?: string, _conversationHistory?: string): Promise<AIResponse> {
    if (!this.currentProvider) {
      throw new Error('No Firebase AI Logic provider available');
    }

    try {
      return await this.currentProvider.generateResponse(_message, _context, _conversationHistory);
    } catch (error) {
      // Log the error for debugging
      console.error('Primary provider failed:', error);
      
      // Try fallback providers (both auto and kimi2 modes should fallback)
      for (const provider of this.providers) {
        if (provider !== this.currentProvider && provider.isAvailable()) {
          try {
            console.log(`Trying fallback provider: ${provider.name}`);
            return await provider.generateResponse(_message, _context, _conversationHistory);
          } catch (fallbackError) {
            console.error(`Fallback provider ${provider.name} failed:`, fallbackError);
            // Fallback failed, try next
          }
        }
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`All Firebase AI Logic providers failed. Last error: ${errorMessage}`);
    }
  }

  // Analyze an image using Groq's vision model (Llama 4 Scout)
  async analyzeImage(imageBase64: string, mimeType: string): Promise<string> {
    if (this.groqProvider && this.groqProvider.isAvailable()) {
      return this.groqProvider.analyzeImage(imageBase64, mimeType);
    }
    throw new Error('Image analysis requires Groq provider (Llama 4 Scout) but it is not available');
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
      return false;
    }
  }

  // Get service status
  getServiceStatus() {
    return {
      currentProvider: this.getCurrentProvider(),
      availableProviders: this.getAvailableProviders(),
      isFirebaseAIEnabled: this.providers.some(p => p.name.includes('Firebase AI Logic')),
      isFallbackActive: this.currentProvider?.name.includes('Mock') || this.currentProvider?.name.includes('Groq') || false
    };
  }
}

// Export singleton instance
export const firebaseAILogicService = new FirebaseAILogicService();
