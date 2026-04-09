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

// Groq Provider (Primary)
class GroqProvider implements AIProvider {
  name = 'Groq (GPT-OSS 120B)';
  private groqClient: Groq | null = null;
  private apiKey: string;
  private modelName: string = 'openai/gpt-oss-120b';

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
    const promptStart = `You are Newton — a knowledgeable, approachable academic AI assistant. You refer to yourself as "Newton" (never "an AI" or "a language model"). Do not introduce yourself or mention your name unless the user explicitly asks who you are. You have a warm, confident personality — think of yourself as the student's smartest study partner who genuinely enjoys helping them learn.

You provide:

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
- **Math notation**: Use LaTeX with dollar-sign delimiters ONLY.
  - Inline math: $x^2 + 1$ (single dollar signs)
  - Display math: $$\\frac{d}{dx}[x^n] = n x^{n-1}$$ (double dollar signs, on their own line)
  - NEVER use \\( \\) or \\[ \\] delimiters — only $ and $$.
- **Tables**: Use proper markdown table syntax with header row and separator row (|---|).
- **Inline code**: Use single backticks for short code snippets or variable names.
- **Lists**: Use numbered lists for step-by-step solutions, bullet points for general lists. Do NOT use bullet points for section sub-headings — use **bold text** or sub-headers instead.
- **Emphasis**: Use **bold** for important concepts and *italics* for emphasis.
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

For math expressions within steps, always use $ for inline and $$ for display equations.

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
- **Code execution requests** - if users ask to run/execute code, explain that they should use IDEs like VS Code, Cursor, or online compilers like Replit

DOCUMENT GENERATION (study guides, formula sheets, cheat sheets, reference sheets, etc.):
- When a user asks you to create a study guide, formula sheet, cheat sheet, or any document, ALWAYS write the full content directly in your response using markdown formatting.
- NEVER generate Python, JavaScript, or any other code to create a document — write the document content itself.
- Structure the content clearly with headers, sections, tables, and LaTeX math where appropriate.
- The app will automatically provide a download button so the user can save your response as a PDF.`;

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
          max_tokens: 4096
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

  // Streaming response — yields partial content to the caller as tokens arrive
  async generateResponseStream(
    _message: string,
    _context?: string,
    _conversationHistory?: string,
    onChunk?: (partialContent: string) => void
  ): Promise<AIResponse> {
    if (!this.isAvailable()) {
      throw new Error('Groq is not available');
    }

    try {
      const systemPrompt = await this.buildGroqPrompt(_context, _conversationHistory, _message);
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: _message }
      ];

      const stream = await this.groqClient!.chat.completions.create({
        messages,
        model: this.modelName,
        temperature: 0.7,
        max_tokens: 4096,
        stream: true
      });

      let fullContent = '';
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
          fullContent += delta;
          onChunk?.(fullContent);
        }
      }

      if (!fullContent || fullContent.trim().length === 0) {
        throw new Error('Empty response from Groq');
      }

      return {
        content: fullContent,
        model: this.modelName,
        provider: this.name
      };
    } catch (error: unknown) {
      const err = error as AIServiceError;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Groq streaming error:', {
        message: errorMessage,
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
  name = 'Mock Academic Assistant (Fallback)';

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
      model: 'mock-ai',
      provider: 'Mock (Fallback)'
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
        model: 'mock-ai',
        provider: 'Mock (Fallback)'
      };
    }

    const responses = [
      "**AI Service Status**: I'm currently operating in limited mode due to API quota exhaustion. The AI service has reached its limits.\n\n**What this means:**\n- The primary AI service is temporarily unavailable\n- You're seeing this fallback response\n- Your data and chat history are safe\n\n**What you can do:**\n- Wait for quota limits to reset\n- Consider upgrading your API plan for higher limits\n\n**Note:** This is a temporary situation and the service should resume automatically once quotas reset.",
      "**Service Notice**: The AI service is currently unavailable due to quota limitations.\n\n**Current Status:**\n- Your chat history is preserved\n- All features will work once service is restored\n- AI responses are limited until quota resets\n\n**Next Steps:**\n- The quota typically resets every 24 hours\n- The service will automatically resume when available\n\nThank you for your patience!",
      "**AI Service Update**: I'm in fallback mode because the API has reached its quota limits.\n\n**Understanding Quota Limits:**\n- Free tier has daily and per-minute request limits\n- Once exceeded, service pauses until the next reset period\n- This usually resets every 24 hours\n\n**Your Options:**\n1. **Wait**: Service typically auto-restores within 24 hours\n2. **Upgrade**: Consider a paid API plan for higher limits\n\n**Good News:** All your conversations and data remain intact and will work normally once service resumes!"
    ];

    const randomResponse = responses[Math.floor(Math.random() * responses.length)];

    return {
      content: randomResponse,
      model: 'mock-ai',
      provider: 'Mock (Fallback)'
    };
  }
}

// Model preference type
export type ModelPreference =
  | 'openai/gpt-oss-120b'
  | 'kimi2'
  | 'llama-3.3-70b-versatile';

const GROQ_MODEL_BY_PREFERENCE: Record<ModelPreference, string> = {
  'openai/gpt-oss-120b': 'openai/gpt-oss-120b',
  kimi2: 'moonshotai/kimi-k2-instruct-0905',
  'llama-3.3-70b-versatile': 'llama-3.3-70b-versatile'
};

// AI Service Manager
export class FirebaseAILogicService {
  private providers: AIProvider[] = [];
  private currentProvider: AIProvider | null = null;
  private groqProvider: GroqProvider | null = null;
  private modelPreference: ModelPreference = 'openai/gpt-oss-120b';

  constructor() {
    this.loadModelPreference();
    this.initializeProviders();
    this.selectBestProvider();
  }

  private loadModelPreference() {
    try {
      const saved = localStorage.getItem('newton_ai_model_preference');
      if (
        saved === 'openai/gpt-oss-120b' ||
        saved === 'kimi2' ||
        saved === 'llama-3.3-70b-versatile'
      ) {
        this.modelPreference = saved;
      }
    } catch {
      // localStorage not available, use default
    }
  }

  setModelPreference(preference: ModelPreference) {
    this.modelPreference = preference;
    try {
      localStorage.setItem('newton_ai_model_preference', preference);
    } catch {
      // localStorage not available, ignore
    }

    // Update Groq model selection
    if (this.groqProvider) {
      this.groqProvider.setModel(GROQ_MODEL_BY_PREFERENCE[preference]);
    }

    // Re-select provider based on preference
    this.selectBestProvider();
  }

  getModelPreference(): ModelPreference {
    return this.modelPreference;
  }

  private initializeProviders() {
    const groqApiKey = import.meta.env.VITE_GROQ_API_KEY;

    // Add Groq provider - PRIMARY
    if (groqApiKey) {
      this.groqProvider = new GroqProvider(groqApiKey);
      this.groqProvider.setModel(GROQ_MODEL_BY_PREFERENCE[this.modelPreference]);
      this.providers.push(this.groqProvider);
    }

    // Always add mock as final fallback
    this.providers.push(new MockProvider());
  }

  private selectBestProvider() {
    if (this.groqProvider && this.groqProvider.isAvailable()) {
      this.currentProvider = this.groqProvider;
      return;
    }

    // Fall back to first available provider (mock)
    this.currentProvider = this.providers.find(provider => provider.isAvailable()) || null;
  }

  async generateFlashcards(prompt: string): Promise<AIResponse> {
    if (!this.currentProvider) {
      throw new Error('No AI provider available');
    }

    try {
      return await this.currentProvider.generateFlashcards(prompt);
    } catch {
      // Try fallback providers
      for (const provider of this.providers) {
        if (provider !== this.currentProvider && provider.isAvailable()) {
          try {
            return await provider.generateFlashcards(prompt);
          } catch {
            // Fallback failed, try next
          }
        }
      }

      throw new Error('All AI providers failed for flashcard generation');
    }
  }

  async generateResponse(_message: string, _context?: string, _conversationHistory?: string): Promise<AIResponse> {
    if (!this.currentProvider) {
      throw new Error('No AI provider available');
    }

    try {
      return await this.currentProvider.generateResponse(_message, _context, _conversationHistory);
    } catch (error) {
      // Log the error for debugging
      console.error('Primary provider failed:', error);

      // Try fallback providers
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
      throw new Error(`All AI providers failed. Last error: ${errorMessage}`);
    }
  }

  // Streaming response — calls onChunk with progressively longer content
  async generateResponseStream(
    _message: string,
    _context?: string,
    _conversationHistory?: string,
    onChunk?: (partialContent: string) => void
  ): Promise<AIResponse> {
    if (this.groqProvider && this.groqProvider.isAvailable()) {
      try {
        return await this.groqProvider.generateResponseStream(_message, _context, _conversationHistory, onChunk);
      } catch (error) {
        console.error('Streaming failed, falling back to non-streaming:', error);
      }
    }
    // Fallback to non-streaming
    return this.generateResponse(_message, _context, _conversationHistory);
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

  // Test AI connection
  async testConnection(): Promise<boolean> {
    try {
      await this.generateResponse("Hello, is the AI service working?");
      return true;
    } catch {
      return false;
    }
  }

  // Get service status
  getServiceStatus() {
    return {
      currentProvider: this.getCurrentProvider(),
      availableProviders: this.getAvailableProviders(),
      isGroqEnabled: this.providers.some(p => p.name.includes('Groq')),
      isFallbackActive: this.currentProvider?.name.includes('Mock') || false
    };
  }
}

// Export singleton instance
export const firebaseAILogicService = new FirebaseAILogicService();
