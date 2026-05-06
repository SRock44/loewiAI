/**
 * ThinkingAgent — deploys a swarm of sub-agents for complex, comprehensive analysis.
 *
 * Flow:
 *   1. ResearchCall  (parallel) — gather key facts and background context
 *   2. AnalysisCall  (parallel) — identify nuances, perspectives, potential errors
 *   3. SynthesisCall            — combine both into a thorough answer via the main AI
 */
import Groq from 'groq-sdk';
import { ChatMessage, ChatContext } from '../types/chat';
import { firebaseAILogicService } from '../services/firebaseAILogicService';
import { firebaseService } from '../services/firebaseService';

// Heuristic keywords that signal a request requiring deep, comprehensive analysis
const THINKING_TRIGGERS = [
  'analyze', 'analyse', 'critically', 'examine',
  'evaluate', 'assess', 'compare and contrast',
  'implications of', 'significance of', 'impact of',
  'pros and cons', 'advantages and disadvantages',
  'both sides', 'debate', 'argue whether',
  'comprehensive', 'in depth', 'in-depth', 'thorough',
  'history of', 'evolution of', 'causes of', 'effects of',
  'explain the relationship', 'why did', 'how did',
  'perspectives on', 'theories about',
  'ethical', 'philosophical',
  'fact check', 'validate', 'verify whether',
  'what led to', 'what caused', 'root cause',
  'what are the main', 'what were the',
];

export class ThinkingAgent {
  private groqClient: Groq | null;
  private messageCounter: () => number;
  private getSessions: () => Map<string, import('../types/chat').ChatSession>;
  private getCurrentUserId: () => string | null;

  constructor(
    groqClient: Groq | null,
    messageCounter: () => number,
    getSessions: () => Map<string, import('../types/chat').ChatSession>,
    getCurrentUserId: () => string | null
  ) {
    this.groqClient = groqClient;
    this.messageCounter = messageCounter;
    this.getSessions = getSessions;
    this.getCurrentUserId = getCurrentUserId;
  }

  /** Returns true if the message warrants deep thinking mode. */
  detect(message: string): boolean {
    const lower = message.toLowerCase();
    return THINKING_TRIGGERS.some(kw => lower.includes(kw));
  }

  /** Run the full swarm: 2 parallel sub-agents → synthesis. */
  async handle(
    message: string,
    context: ChatContext,
    userMessage: ChatMessage,
    userMemoryCache: string,
    userContextCache: string,
    onStreamChunk?: (partial: string) => void
  ): Promise<ChatMessage> {
    // Step 1 — deploy research + analysis sub-agents in parallel
    const [researchNotes, analysisNotes] = await Promise.all([
      this.runSubAgent(message, 'research'),
      this.runSubAgent(message, 'analysis'),
    ]);

    // Step 2 — build synthesis context
    let synthesisContext = '';
    if (userMemoryCache) {
      synthesisContext += '\n\nUSER MEMORY:\n' + userMemoryCache + '\n';
    }
    if (userContextCache) {
      synthesisContext += '\n\nUSER STUDY HISTORY:\n' + userContextCache + '\n';
    }

    // Include recent conversation history
    const sessions = this.getSessions();
    if (context.sessionId && sessions.has(context.sessionId)) {
      const session = sessions.get(context.sessionId)!;
      const recentMessages = session.messages.slice(-6);
      if (recentMessages.length > 1) {
        synthesisContext += '\n\nCURRENT CONVERSATION:\n';
        for (let i = 0; i < recentMessages.length - 1; i++) {
          const msg = recentMessages[i];
          const role = msg.role === 'user' ? 'User' : 'Newton';
          const content = msg.content.length > 300
            ? msg.content.substring(0, 300) + '...'
            : msg.content;
          synthesisContext += `${role}: ${content}\n\n`;
        }
      }
    }

    // Append sub-agent research as background context for the synthesis call
    if (researchNotes) {
      synthesisContext += '\n\nRESEARCH NOTES (background context — do NOT mention these in your answer):\n' + researchNotes;
    }
    if (analysisNotes) {
      synthesisContext += '\n\nMULTIPLE PERSPECTIVES (background context — do NOT mention these in your answer):\n' + analysisNotes;
    }

    // Step 3 — synthesize a comprehensive answer
    // If this is a document/writing request, the full document must be generated.
    const isDocumentRequest = /\b(?:write|create|generate|make|draft|produce)\b.{0,60}\b(?:essay|paper|report|thesis|analysis|summary|overview|study guide|formula sheet|cheat sheet|document)\b/i.test(message);
    const synthPrompt = (researchNotes || analysisNotes)
      ? `Using the background research and analysis above, ${isDocumentRequest
          ? 'write the full requested document content using proper markdown formatting — include all required sections, headers, and content. Do not summarize or describe what you will write; write the actual document.'
          : 'write a comprehensive, well-structured answer as Newton. Do not reference "research notes" or "analysis notes" — write a fluent, authoritative response.'
        }\n\nRequest: ${message}`
      : message;

    const aiResponse = onStreamChunk
      ? await firebaseAILogicService.generateResponseStream(synthPrompt, '', synthesisContext, onStreamChunk)
      : await firebaseAILogicService.generateResponse(synthPrompt, '', synthesisContext);

    const assistantMessage: ChatMessage = {
      id: `msg_${Date.now()}_${this.messageCounter()}`,
      role: 'assistant',
      content: aiResponse.content,
      timestamp: new Date(),
    };

    // Persist to session
    if (context.sessionId && sessions.has(context.sessionId)) {
      const session = sessions.get(context.sessionId)!;
      session.messages.push(userMessage, assistantMessage);
      session.updatedAt = new Date();
      const userId = this.getCurrentUserId();
      if (userId) {
        await firebaseService.saveChatSession(session, userId);
        window.dispatchEvent(new CustomEvent('sessionUpdated'));
      }
    }

    return assistantMessage;
  }

  /** One focused sub-agent call — fast, low-token, factual. */
  private async runSubAgent(message: string, role: 'research' | 'analysis'): Promise<string> {
    if (!this.groqClient) return '';

    const systemPrompt = role === 'research'
      ? 'You are a research assistant. Given a question or topic, provide 3-5 concise bullet points of key facts, background context, and relevant information. Be factual and brief. Never say you cannot do something — just provide the research.'
      : 'You are a critical thinking assistant. Given a question or topic, provide 3-5 bullet points covering nuances, counterarguments, multiple perspectives, and important considerations. Be analytical and brief. Never say you cannot do something — just provide the analysis.';

    try {
      const completion = await this.groqClient.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.3,
        max_tokens: 300,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message.substring(0, 600) },
        ],
      });
      return completion.choices[0]?.message?.content?.trim() ?? '';
    } catch {
      return '';
    }
  }

  /**
   * Generate a short, contextual loading message for the spinner using ~20 tokens.
   * Falls back silently to an empty string so callers use their static default.
   */
  async generateLoadingHint(
    query: string,
    type: 'thinking' | 'document' | 'flashcard'
  ): Promise<string> {
    if (!this.groqClient) return '';

    const systemMap: Record<string, string> = {
      thinking:
        'Generate a 6-9 word loading status message for a deep-analysis task. Start with an action verb. Examples: "Analyzing the geopolitical causes in depth", "Researching key perspectives on this topic". Output ONLY the message, no quotes, no punctuation at end.',
      document:
        'Generate a 6-9 word loading status message for a document generation task. Start with an action verb. Examples: "Building your climate change research paper", "Structuring your calculus derivatives study guide". Output ONLY the message, no quotes, no punctuation at end.',
      flashcard:
        'Generate a 6-9 word loading status message for flashcard generation. Start with an action verb. Examples: "Identifying core photosynthesis concepts for flashcards", "Designing biology exam study cards". Output ONLY the message, no quotes, no punctuation at end.',
    };

    try {
      const completion = await this.groqClient.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.6,
        max_tokens: 20,
        messages: [
          { role: 'system', content: systemMap[type] },
          { role: 'user', content: query.substring(0, 150) },
        ],
      });
      const raw = completion.choices[0]?.message?.content?.trim() ?? '';
      return raw.replace(/^["'`]|["'`.,!?]$/g, '').trim();
    } catch {
      return '';
    }
  }
}
